/**
 * Aeoden AI files — validate what a site already publishes, and generate what it's missing.
 *
 *   llms.txt           https://llmstxt.org — Markdown: H1 name, > summary, ## sections of [name](url): notes
 *   ai-catalog.json    AI Catalog / Agentic Resource Discovery (ARD), served at /.well-known/ai-catalog.json:
 *                      { specVersion "Major.Minor", host { displayName, identifier? }, entries [ { identifier, type, url|data } ] }
 *                      entries MAY be empty. Entries list callable agent resources (MCP servers, A2A agents, skills),
 *                      not web pages.
 *   Structured data    schema.org Organization + WebSite JSON-LD
 *   robots.txt         explicit rules for AI answer and training crawlers
 *
 * Grounding rule: generated files use only facts found on the site. Anything we could not find becomes a
 * [bracketed placeholder] for the owner to fill in. Nothing is invented.
 */

export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
export const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'];
// Recognised AI Catalog entry types (AI Catalog spec "known types").
export const CATALOG_TYPES = [
  'application/ai-catalog+json', 'application/agent-card+json', 'application/a2a-agent-card+json',
  'application/mcp-server-card+json', 'application/agent-skills+json', 'application/agent-skills+md',
  'application/agent-skills+zip', 'application/agent-skills+gzip', 'application/agent-plugins+zip', 'application/agent-plugins+gzip'
];

const abs = (href, base) => { try { const u = new URL(href, base); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
const sameSite = (u, host) => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return h === host; } catch { return false; } };
const titleFromPath = u => {
  try {
    const seg = new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
    if (!seg) return 'Home';
    return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
  } catch { return null; }
};
const mdEscape = s => String(s).replace(/([\[\]])/g, '\\$1').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ */
/* llms.txt                                                            */
/* ------------------------------------------------------------------ */

export function validateLlms(probe) {
  if (!probe || (!probe.found && !probe.servedHtml)) return { status: 'missing', issues: [] };
  if (probe.servedHtml) return { status: 'fix', issues: ['/llms.txt answers with a web page (probably your 404 page), not a Markdown file.'] };
  const text = String(probe.text || '');
  const issues = []; const notes = [];
  if (/^\s*<(!doctype|html)/i.test(text)) return { status: 'fix', issues: ['The file contains HTML. llms.txt must be plain Markdown.'] };
  const lines = text.split(/\r?\n/);
  const first = lines.find(l => l.trim());
  const h1s = lines.filter(l => /^#\s+\S/.test(l));
  if (!h1s.length) issues.push('No H1 heading. llms.txt must start with "# Your site name".');
  else if (!/^#\s+\S/.test(first || '')) issues.push('The first line should be the H1 ("# Your site name").');
  if (h1s.length > 1) notes.push('More than one H1. The format expects exactly one, at the top.');
  if (!lines.some(l => /^>\s*\S/.test(l))) notes.push('No "> summary" line. A one-sentence summary under the H1 is recommended.');
  const links = (text.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g) || []).length;
  if (!links) notes.push('No links listed. Add sections ("## Docs", "## Pages") with Markdown links to your key pages.');
  if (probe.type && !/text\/(plain|markdown)|application\/octet-stream/.test(probe.type)) notes.push(`Served as ${probe.type.split(';')[0]}; text/plain or text/markdown is expected.`);
  if (text.length > 280_000) notes.push('The file is very large. Keep llms.txt to a curated index and move detail into linked pages.');
  return { status: issues.length ? 'fix' : 'ok', issues, notes, links };
}

export function generateLlms({ siteName, origin, host, summary, navLinks = [], sitemapUrls = [], sitemapFound, hasCatalog }) {
  const seen = new Set([origin + '/']);
  const pages = [];
  const add = (url, title) => { if (!url || !title || seen.has(url) || pages.length >= 24) return; seen.add(url); pages.push({ url, title }); };
  for (const l of navLinks) {
    if (/^(#|mailto:|tel:|javascript:)/i.test(l.href)) continue;
    const u = abs(l.href, origin + '/'); if (!u || !sameSite(u, host)) continue;
    const t = l.text.trim(); if (t.length < 2 || t.length > 60) continue;
    add(u.split('#')[0], t);
  }
  const fromSitemap = sitemapUrls.filter(u => sameSite(u, host) && !/\.(xml|jpg|jpeg|png|gif|webp|pdf|zip)$/i.test(u))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  for (const u of fromSitemap) add(u, titleFromPath(u));
  const out = [`# ${siteName}`, '', `> ${summary || `[One sentence: what ${siteName} does and who it is for.]`}`, ''];
  out.push('## Pages', '');
  if (pages.length) for (const p of pages) out.push(`- [${mdEscape(p.title)}](${p.url})`);
  else out.push(`- [Home](${origin}/)`, `- [About](${origin}/[about-page-path])`);
  const optional = [];
  if (sitemapFound) optional.push(`- [Sitemap](${origin}/sitemap.xml)`);
  if (hasCatalog) optional.push(`- [AI catalog](${origin}/.well-known/ai-catalog.json)`);
  if (optional.length) out.push('', '## Optional', '', ...optional);
  return out.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* ai-catalog.json (AI Catalog / ARD)                                   */
/* ------------------------------------------------------------------ */

export function validateCatalog(probe) {
  if (!probe || (!probe.found && !probe.servedHtml)) return { status: 'optional', issues: [] };
  if (probe.servedHtml) return { status: 'fix', issues: ['/.well-known/ai-catalog.json answers with a web page, not JSON.'] };
  let doc;
  try { doc = JSON.parse(probe.text); } catch { return { status: 'fix', issues: ['The file is not valid JSON.'] }; }
  const issues = []; const notes = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { status: 'fix', issues: ['The catalog must be a JSON object.'] };
  if (typeof doc.specVersion !== 'string' || !/^\d+\.\d+$/.test(doc.specVersion)) issues.push('"specVersion" must be a "Major.Minor" string, e.g. "1.0".');
  if (!Array.isArray(doc.entries)) issues.push('"entries" must be an array (it may be empty).');
  if (doc.host != null && (typeof doc.host !== 'object' || typeof doc.host.displayName !== 'string')) issues.push('"host" must include a "displayName".');
  if (doc.host == null) notes.push('No "host" object. Add { "displayName": "..." } so agents and registries know who publishes this catalog.');
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  const htmlEntries = []; const unknownTypes = new Set(); let broken = 0;
  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') { broken++; return; }
    const hasUrl = typeof e.url === 'string', hasData = e.data !== undefined;
    if (typeof e.identifier !== 'string' || typeof e.type !== 'string' || hasUrl === hasData) broken++;
    const type = String(e.type || '').toLowerCase();
    if (/^text\/html/.test(type)) htmlEntries.push(e.displayName || e.identifier || `entry ${i + 1}`);
    else if (type && !CATALOG_TYPES.includes(type.split(';')[0].trim()) && !/^text\/markdown;\s*profile=/.test(type)) unknownTypes.add(type);
  });
  if (broken) issues.push(`${broken} ${broken === 1 ? 'entry is' : 'entries are'} missing "identifier", "type", or exactly one of "url"/"data".`);
  if (htmlEntries.length) notes.push(`${htmlEntries.length} ${htmlEntries.length === 1 ? 'entry points' : 'entries point'} to web pages (text/html). The catalog is for callable agent resources (MCP servers, A2A agents, skills); list web pages in llms.txt instead.`);
  if (unknownTypes.size) notes.push(`Non-standard entry types: ${[...unknownTypes].slice(0, 3).join(', ')}.`);
  return { status: issues.length ? 'fix' : htmlEntries.length ? 'fix' : 'ok', issues, notes, doc, entryCount: entries.length, htmlEntries: htmlEntries.length };
}

export function generateCatalog({ siteName, host, origin, existing }) {
  const keep = existing && Array.isArray(existing.entries)
    ? existing.entries.filter(e => e && typeof e === 'object' && typeof e.identifier === 'string' && typeof e.type === 'string' && !/^text\/html/i.test(e.type) && ((typeof e.url === 'string') !== (e.data !== undefined)))
    : [];
  const doc = {
    specVersion: '1.0',
    host: { displayName: siteName, identifier: host, ...(existing && existing.host && existing.host.logoUrl ? { logoUrl: existing.host.logoUrl } : {}) },
    entries: keep
  };
  return JSON.stringify(doc, null, 2) + '\n';
}
export const catalogEntryTemplate = host => JSON.stringify({
  identifier: `urn:air:${host}:mcp:[name]`,
  type: 'application/mcp-server-card+json',
  url: `https://${host}/[path-to-your-mcp-server-card]`
}, null, 2);

/* ------------------------------------------------------------------ */
/* Structured data (Organization + WebSite JSON-LD)                     */
/* ------------------------------------------------------------------ */

export function validateJsonLd(x) {
  const nodes = (x.jsonld || []).filter(n => !n.__invalid);
  const invalid = (x.jsonld || []).some(n => n.__invalid);
  const types = n => [].concat(n['@type'] || []).map(String);
  const org = nodes.find(n => types(n).some(t => /Organization|LocalBusiness|Corporation|Store|Restaurant|ProfessionalService/i.test(t)));
  const site = nodes.find(n => types(n).includes('WebSite'));
  const issues = []; const notes = [];
  if (invalid) issues.push('At least one JSON-LD block is not valid JSON, so crawlers ignore it.');
  if (!org) issues.push('No Organization (or LocalBusiness) entity, so nothing tells AI systems who is behind the site.');
  else {
    if (!org.name) issues.push('The Organization has no "name".');
    if (!org.url) notes.push('The Organization has no "url".');
    if (!org.logo) notes.push('The Organization has no "logo".');
    if (!org.sameAs) notes.push('No "sameAs" links to official profiles (LinkedIn, Wikipedia, etc.).');
  }
  if (!site) notes.push('No WebSite entity.');
  if (!org && !site && !invalid && !nodes.length) return { status: 'missing', issues: [], notes: [] };
  return { status: issues.length ? 'fix' : 'ok', issues, notes, hasOrg: !!org };
}

export function generateJsonLd({ siteName, origin, description, logo, sameAs = [] }) {
  const org = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: siteName,
    url: `${origin}/`,
    description: description || `[One sentence: what ${siteName} does and who it is for.]`,
    logo: logo || `${origin}/[path-to-your-logo.png]`,
    sameAs: sameAs.length ? sameAs : ['[https://www.linkedin.com/company/your-company]']
  };
  const graph = { '@context': 'https://schema.org', '@graph': [org, { '@type': 'WebSite', '@id': `${origin}/#website`, name: siteName, url: `${origin}/`, publisher: { '@id': `${origin}/#organization` } }] };
  return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>\n`;
}

/* ------------------------------------------------------------------ */
/* robots.txt AI crawler rules                                          */
/* ------------------------------------------------------------------ */

export function validateRobots({ robotsTxt, isBlockedFor, sitemapFound }) {
  if (robotsTxt == null) return { status: 'missing', issues: [], blockedSearch: [], blockedTraining: [] };
  const blockedSearch = AI_SEARCH_BOTS.filter(isBlockedFor);
  const blockedTraining = AI_TRAINING_BOTS.filter(isBlockedFor);
  const mentions = [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS].filter(b => new RegExp(`user-agent:\\s*${b.replace(/[-]/g, '\\-')}\\b`, 'i').test(robotsTxt));
  const issues = []; const notes = [];
  if (blockedSearch.length) issues.push(`Blocks AI answer crawlers: ${blockedSearch.join(', ')}. Those engines can't fetch your pages to answer or cite them.`);
  if (!mentions.length) notes.push('No explicit rules for AI crawlers. They fall back to your general rules; explicit rules make your choice clear and easy to change.');
  if (!/^\s*sitemap\s*:/im.test(robotsTxt) && sitemapFound) notes.push('Add a "Sitemap:" line so crawlers find every page.');
  return { status: issues.length ? 'fix' : 'ok', issues, notes, blockedSearch, blockedTraining };
}

export function generateRobotsBlock({ origin, blockedTraining = [], sitemapFound }) {
  const trainingAllowed = blockedTraining.length === 0;
  const lines = [
    '# --- AI crawlers (added with Aeoden) ---',
    '# Answer and citation crawlers: keep these allowed to appear in AI answers.',
    ...AI_SEARCH_BOTS.map(b => `User-agent: ${b}`),
    'Allow: /',
    '',
    `# Training crawlers: your choice. ${trainingAllowed ? 'Currently allowed.' : 'Currently blocked; we kept that choice.'}`,
    ...AI_TRAINING_BOTS.map(b => `User-agent: ${b}`),
    trainingAllowed ? 'Allow: /' : 'Disallow: /'
  ];
  if (sitemapFound) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* The pack                                                             */
/* ------------------------------------------------------------------ */

export function buildAiFiles(ctx) {
  const { x, origin, host, siteName, summary, description, robotsTxt, isBlockedFor, sitemapFound, sitemapUrls, llmsTxt, aiCatalog } = ctx;
  const llmsV = validateLlms(llmsTxt);
  const catV = validateCatalog(aiCatalog);
  const ldV = validateJsonLd(x);
  const robV = validateRobots({ robotsTxt, isBlockedFor, sitemapFound });
  const sameAs = [...new Set((x.socialLinks || []).map(l => abs(l.href, origin + '/')).filter(Boolean))].slice(0, 6);
  const logo = x.logoHint ? abs(x.logoHint, origin + '/') : null;
  const files = [
    { id: 'llms', name: 'llms.txt', path: '/llms.txt', ...llmsV,
      what: 'A Markdown index of your site for AI tools: who you are in one line, and links to the pages that matter.',
      install: `Save as llms.txt in your site's root folder so it loads at ${origin}/llms.txt, served as text/plain.`,
      generated: generateLlms({ siteName, origin, host, summary, navLinks: x.navLinks || [], sitemapUrls: sitemapUrls || [], sitemapFound, hasCatalog: catV.status === 'ok' }),
      filename: 'llms.txt', lang: 'markdown' },
    { id: 'jsonld', name: 'Structured data', path: '<head>', ...ldV,
      what: 'Organization and WebSite JSON-LD: tells AI systems and search engines exactly who runs this site.',
      install: 'Paste into the <head> of your homepage, or your theme\u2019s header template. Replace anything in [brackets].',
      generated: generateJsonLd({ siteName, origin, description, logo, sameAs }),
      filename: 'organization.jsonld.html', lang: 'html' },
    { id: 'robots', name: 'robots.txt rules', path: '/robots.txt', ...robV,
      what: 'Explicit rules for AI crawlers: answer engines allowed, training crawlers your choice.',
      install: robotsTxt == null ? `Save as robots.txt in your site's root so it loads at ${origin}/robots.txt.` : 'Add this block to the end of your existing robots.txt. Don\u2019t replace the file.',
      generated: generateRobotsBlock({ origin, blockedTraining: robV.blockedTraining, sitemapFound }),
      filename: 'robots-ai.txt', lang: 'text' },
    { id: 'catalog', name: 'ai-catalog.json', path: '/.well-known/ai-catalog.json', ...catV,
      what: 'Agentic Resource Discovery (ARD) catalog: lists the agent resources your domain offers (MCP servers, A2A agents, skills). A draft standard, announced June 2026.',
      install: `Save as ai-catalog.json inside a .well-known folder at your site root, so it loads at ${origin}/.well-known/ai-catalog.json, served as application/ai-catalog+json or application/json.`,
      generated: generateCatalog({ siteName, host, origin, existing: catV.doc }),
      template: catalogEntryTemplate(host),
      filename: 'ai-catalog.json', lang: 'json',
      optionalNote: catV.status === 'optional' ? 'Optional. Only needed if you offer an API, MCP server, or AI agent. An empty catalog is valid and simply names you as the publisher.' : null }
  ];
  for (const f of files) delete f.doc;
  const core = files.filter(f => f.id !== 'catalog');
  return { files, ready: core.filter(f => f.status === 'ok').length, total: core.length };
}
