/**
 * CheckAEO scanner — AWS Lambda adapter (Node.js 20+, ESM)
 *
 * Reuses the exact same scan pipeline and scoring as the Cloudflare Worker.
 * Deploy as a Lambda with a Function URL (auth: NONE, CORS enabled) and set
 * SCAN_API_URL in assets/js/config.js to that URL (no trailing slash needed).
 *
 * Accepts:  POST <url>/scan  {"url":"example.com"}     GET <url>/scan?url=example.com
 */
import { scan, validateUrl } from './index.js';

const RATE = { windowMs: 60_000, max: 12 };
const hits = new Map();
const cache = new Map();            // per-container memo, 10 min
const CACHE_TTL_MS = 600_000;

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/';
  if (method === 'OPTIONS') return resp(204, '');
  if (path.endsWith('/health')) return json(200, { ok: true, service: 'checkaeo-scan', runtime: 'lambda' });

  let target = event.queryStringParameters?.url;
  if (method === 'POST') {
    try { target = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '{}')).url; }
    catch { return json(400, { ok: false, error: 'Body must be JSON with a "url" field.' }); }
  }

  const ip = event.requestContext?.http?.sourceIp || 'anon';
  if (!allow(ip)) return json(429, { ok: false, error: 'Too many scans in the last minute. Try again shortly.' });

  const v = validateUrl(target);
  if (v.error) return json(400, { ok: false, error: v.error });

  const fresh = event.queryStringParameters?.fresh === '1';
  const hit = cache.get(v.url);
  if (hit && !fresh && Date.now() - hit.t < CACHE_TTL_MS) return json(200, { ...hit.r, cached: true });

  try {
    const r = await scan(v.url);
    cache.set(v.url, { t: Date.now(), r });
    if (cache.size > 500) cache.clear();
    return json(200, r);
  } catch (e) {
    return json(502, { ok: false, error: 'We could not reach that site.' });
  }
};

function allow(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { start: now, n: 0 };
  if (now - rec.start > RATE.windowMs) { rec.start = now; rec.n = 0; }
  rec.n++; hits.set(ip, rec);
  return rec.n <= RATE.max;
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
function resp(statusCode, body, extra = {}) { return { statusCode, headers: { ...CORS, ...extra }, body }; }
function json(statusCode, obj) { return resp(statusCode, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); }
