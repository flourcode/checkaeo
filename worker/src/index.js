/**
 * Aeoden scan worker (Cloudflare Workers)
 *
 *   POST /scan   { "url": "https://example.com" }
 *   GET  /scan?url=https://example.com
 *   GET  /health
 *
 * Deploy:  cd worker && npx wrangler deploy
 * Then set SCAN_API_URL in /assets/js/config.js to the worker URL.
 */
import { analyze } from './analyze.js';

const USER_AGENT = 'AeodenBot/1.0 (+https://aeoden.com/about/)';
const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;
const CACHE_TTL = 600; // seconds a scan result stays cached
const RATE_LIMIT = { windowMs: 60_000, max: 12 }; // per IP, per isolate (best effort)

const hits = new Map();

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname, searchParams } = new URL(request.url);
    if (pathname === '/health') return json({ ok: true, service: 'checkaeo-scan' }, 200, cors);
    if (pathname !== '/scan' && pathname !== '/') return json({ ok: false, error: 'Not found' }, 404, cors);

    let target = searchParams.get('url');
    if (request.method === 'POST') {
      try { target = (await request.json()).url; } catch { return json({ ok: false, error: 'Body must be JSON with a "url" field.' }, 400, cors); }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (!allow(ip)) return json({ ok: false, error: 'Too many scans in the last minute. Try again shortly.' }, 429, cors);

    const validated = validateUrl(target);
    if (validated.error) return json({ ok: false, error: validated.error }, 400, cors);
    const url = validated.url;

    // Edge cache keyed by normalized URL
    const cache = caches.default;
    const cacheKey = new Request('https://checkaeo-cache.internal/scan?u=' + encodeURIComponent(url));
    const cached = await cache.match(cacheKey);
    if (cached && searchParams.get('fresh') !== '1') {
      const body = await cached.json();
      return json({ ...body, cached: true }, 200, cors);
    }

    try {
      const result = await scan(url);
      const res = json(result, 200, cors);
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `s-maxage=${CACHE_TTL}` } })));
      return res;
    } catch (err) {
      return json({ ok: false, error: friendlyError(err) }, 502, cors);
    }
  }
};

/* ---------------- Scan pipeline ---------------- */

export async function scan(url) {
  const t0 = Date.now();
  const page = await fetchPage(url);
  const fetchMs = Date.now() - t0;

  let origin;
  try { origin = new URL(page.finalUrl).origin; } catch { origin = new URL(url).origin; }

  let host;
  try { host = new URL(page.finalUrl || url).hostname; } catch { host = ''; }
  const [robots, sitemap, llms, catalog, entity] = await Promise.all([
    probe(`${origin}/robots.txt`, true),
    probe(`${origin}/sitemap.xml`, 400_000),
    probe(`${origin}/llms.txt`, 300_000),
    probe(`${origin}/.well-known/ai-catalog.json`, 300_000),
    lookupEntity(host)
  ]);
  // Sitemap URLs (follow one level of sitemap index), used to list pages in a generated llms.txt
  let sitemapUrls = sitemap.ok ? locs(sitemap.text) : [];
  if (sitemap.ok && /<sitemapindex/i.test(sitemap.text) && sitemapUrls.length) {
    const child = await probe(sitemapUrls[0], 400_000);
    sitemapUrls = child.ok ? locs(child.text) : [];
  }

  let sitemapFound = sitemap.ok;
  if (!sitemapFound && robots.ok && /^\s*sitemap\s*:/im.test(robots.text)) sitemapFound = true;

  return analyze({
    url,
    finalUrl: page.finalUrl,
    status: page.status,
    headers: page.headers,
    html: page.html,
    robotsTxt: robots.ok ? robots.text : null,
    robotsStatus: robots.status,
    redirectCount: page.redirects,
    sitemapFound,
    llmsTxtFound: llms.ok,
    fetchMs,
    error: page.error,
    entity,
    sitemapUrls: sitemapUrls.slice(0, 200),
    llmsTxt: { found: llms.ok, servedHtml: !!llms.servedHtml, status: llms.status, type: llms.type || '', text: llms.text || '' },
    aiCatalog: { found: catalog.ok, servedHtml: !!catalog.servedHtml, status: catalog.status, type: catalog.type || '', text: catalog.text || '' }
  });
}

function locs(xml) {
  const out = []; const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi; let m;
  while ((m = re.exec(xml)) && out.length < 500) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}

/* ---------------- AI familiarity: is this site a known entity? ----------------
   Looks the site up in Wikidata by its official-website property (P856), using exact URL
   matches only (no name guessing). Returns { found, id, label, description, sitelinks },
   { found: false }, or null when the lookup itself failed (treated as "unknown", never as "absent"). */
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKIDATA_UA = 'AeodenBot/1.0 (+https://aeoden.com/about/; hello@aeoden.com)';
export async function lookupEntity(host, fetchImpl = fetch, timeoutMs = 3500) {
  const bare = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!bare || !bare.includes('.')) return null;
  const urls = [];
  for (const scheme of ['https', 'http']) for (const h of [`www.${bare}`, bare]) for (const tail of ['/', '']) urls.push(`<${scheme}://${h}${tail}>`);
  const query = `SELECT ?item ?itemLabel ?itemDescription ?links WHERE {
  VALUES ?url { ${urls.join(' ')} }
  ?item wdt:P856 ?url ; wikibase:sitelinks ?links .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 1`;
  try {
    const res = await fetchImpl(`${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': WIKIDATA_UA, 'Accept': 'application/sparql-results+json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b = data && data.results && data.results.bindings && data.results.bindings[0];
    if (!b) return { found: false };
    const id = (b.item && b.item.value || '').split('/').pop();
    return { found: true, id, label: b.itemLabel && b.itemLabel.value || null, description: b.itemDescription && b.itemDescription.value || null, sitelinks: Number(b.links && b.links.value) || 0 };
  } catch {
    return null;
  }
}

async function fetchPage(startUrl) {
  let url = startUrl;
  let redirects = 0;
  for (;;) {
    const guard = validateUrl(url);
    if (guard.error) return { finalUrl: url, status: 0, headers: {}, html: '', redirects, error: guard.error };
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'en' },
        cf: { cacheTtl: 0 }
      });
    } catch (e) {
      return { finalUrl: url, status: 0, headers: {}, html: '', redirects, error: friendlyError(e) };
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
      if (++redirects > MAX_REDIRECTS) return { finalUrl: url, status: res.status, headers: {}, html: '', redirects, error: 'Too many redirects' };
      url = new URL(res.headers.get('location'), url).href;
      continue;
    }
    const headers = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const html = await readCapped(res, MAX_BYTES);
    return { finalUrl: url, status: res.status, headers, html, redirects, error: null };
  }
}

async function probe(url, wantBody) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': USER_AGENT }, cf: { cacheTtl: 0 } });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return { ok: false, status: res.status, text: '', type };
    // Many hosts return 200 HTML for missing files; treat an HTML document as "not found" for txt/xml/json probes,
    // but remember it so we can tell the owner their server answers with a web page instead of the file.
    if (type.includes('text/html')) {
      const peek = (await readCapped(res, 4000)).trimStart().slice(0, 200).toLowerCase();
      if (peek.startsWith('<!doctype') || peek.startsWith('<html')) return { ok: false, status: 404, text: '', type, servedHtml: true };
      return { ok: true, status: 200, text: wantBody ? peek : '', type };
    }
    return { ok: true, status: res.status, text: wantBody ? await readCapped(res, typeof wantBody === 'number' ? wantBody : 200_000) : '', type };
  } catch {
    return { ok: false, status: 0, text: '', type: '' };
  }
}

async function readCapped(res, limit) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= limit) { try { await reader.cancel(); } catch { /* ignore */ } break; }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.byteLength, total - off)), off); off += c.byteLength; if (off >= total) break; }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

/* ---------------- Safety ---------------- */

export function validateUrl(input) {
  if (!input || typeof input !== 'string') return { error: 'Enter a URL to scan.' };
  let s = input.trim();
  if (s.length > 2048) return { error: 'That URL is too long.' };
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return { error: 'That does not look like a valid URL.' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'Only http and https URLs can be scanned.' };
  if (u.username || u.password) return { error: 'URLs with credentials are not allowed.' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') && host !== 'localhost') return { error: 'Enter a full domain, like example.com.' };
  if (isPrivateHost(host)) return { error: 'Private, local and internal addresses cannot be scanned.' };
  if (u.port && !['', '80', '443'].includes(u.port)) return { error: 'Only standard ports (80/443) are supported.' };
  u.hash = '';
  return { url: u.href };
}

export function isPrivateHost(host) {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa') || host.endsWith('.onion')) return true;
  // IPv6 literal
  if (host.startsWith('[') || host.includes(':')) {
    const h = host.replace(/^\[|\]$/g, '');
    return h === '::1' || h === '::' || /^f[cd]/i.test(h) || /^fe[89ab]/i.test(h) || /^::ffff:/i.test(h);
  }
  // IPv4 literal (incl. decimal/octal-ish tricks)
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true; // integer / hex IP forms
  if (host === 'metadata.google.internal' || host === 'instance-data') return true;
  return false;
}

function allow(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { start: now, n: 0 };
  if (now - rec.start > RATE_LIMIT.windowMs) { rec.start = now; rec.n = 0; }
  rec.n++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n <= RATE_LIMIT.max;
}

function corsHeaders(origin, env) {
  const allowed = (env && env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : ['*']).map(s => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
}

function friendlyError(e) {
  const msg = String(e && e.message || e);
  if (/abort|timeout/i.test(msg)) return 'The site took too long to respond.';
  if (/ENOTFOUND|getaddrinfo|resolve|DNS/i.test(msg)) return 'We could not resolve that domain.';
  if (/certificate|SSL|TLS/i.test(msg)) return 'The site has an SSL/TLS problem.';
  return 'We could not reach that site.';
}
