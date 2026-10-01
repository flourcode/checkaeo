import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/analyze.js';
import { validateLlms, generateLlms, validateCatalog, generateCatalog, validateRobots, generateRobotsBlock, CATALOG_TYPES } from '../src/files.js';
import { parseRobots, isBlocked } from '../src/analyze.js';

const html = `<!doctype html><html lang="en"><head><title>Acme Tools – invoicing for freelancers</title>
<meta name="description" content="Acme Tools is invoicing software that helps freelancers send invoices and get paid faster.">
<link rel="apple-touch-icon" href="/icon-180.png"></head><body>
<header><nav><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/features">Features</a><a href="mailto:hi@acme.example">Email</a><a href="https://other.example/x">Partner</a></nav></header>
<main><h1>Invoicing for freelancers</h1><p>Acme Tools is invoicing software for freelancers. It sends invoices and reminders.</p></main>
<footer><a href="https://www.linkedin.com/company/acme">LinkedIn</a></footer></body></html>`;
const base = { url: 'https://acme.example/', status: 200, html, robotsTxt: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /', sitemapFound: true,
  sitemapUrls: ['https://acme.example/', 'https://acme.example/blog/how-to-invoice', 'https://acme.example/pricing', 'https://cdn.other.example/a'],
  llmsTxt: { found: false }, aiCatalog: { found: false } };

test('the pack: four files, grounded in the page, placeholders where facts are missing', () => {
  const r = analyze(base);
  const f = Object.fromEntries(r.aiFiles.files.map(x => [x.id, x]));
  assert.equal(r.aiFiles.total, 3, 'llms, structured data, robots are core; the catalog is optional');
  // llms.txt: H1 = site name, summary = verbatim meta description, nav + sitemap pages on this host only
  assert.match(f.llms.generated, /^# Acme Tools\n/);
  assert.match(f.llms.generated, /> Acme Tools is invoicing software that helps freelancers send invoices and get paid faster\./);
  assert.match(f.llms.generated, /\[Pricing\]\(https:\/\/acme\.example\/pricing\)/);
  assert.match(f.llms.generated, /\[How to invoice\]\(https:\/\/acme\.example\/blog\/how-to-invoice\)/);
  assert.doesNotMatch(f.llms.generated, /other\.example|mailto:/);
  assert.equal(validateLlms({ found: true, text: f.llms.generated, type: 'text/plain' }).status, 'ok', 'what we generate passes our own validator');
  // JSON-LD: description verbatim, sameAs from the page, logo hint used; no invention
  assert.match(f.jsonld.generated, /"description": "Acme Tools is invoicing software/);
  assert.match(f.jsonld.generated, /linkedin\.com\/company\/acme/);
  assert.match(f.jsonld.generated, /icon-180\.png/);
  // robots: keeps the owner's training choice (GPTBot blocked), allows answer crawlers, adds sitemap
  assert.match(f.robots.generated, /Currently blocked; we kept that choice\.\nUser-agent: GPTBot[\s\S]*Disallow: \//);
  assert.match(f.robots.generated, /User-agent: OAI-SearchBot[\s\S]*Allow: \//);
  assert.match(f.robots.generated, /Sitemap: https:\/\/acme\.example\/sitemap\.xml/);
  // catalog: optional when absent; generated doc is a valid, empty, discoverable catalog
  assert.equal(f.catalog.status, 'optional');
  const cat = JSON.parse(f.catalog.generated);
  assert.equal(cat.specVersion, '1.0'); assert.deepEqual(cat.entries, []); assert.equal(cat.host.displayName, 'Acme Tools'); assert.equal(cat.host.identifier, 'acme.example');
  assert.equal(validateCatalog({ found: true, text: f.catalog.generated }).status, 'ok');
});

test('llms.txt validation catches HTML soft-404s and missing H1', () => {
  assert.equal(validateLlms({ found: false, servedHtml: true }).status, 'fix');
  assert.equal(validateLlms({ found: true, text: 'Just some text\n- [a](https://a.example)' }).status, 'fix');
  assert.equal(validateLlms({ found: false }).status, 'missing');
});

test('ai-catalog validation follows the AI Catalog spec and flags text/html entries', () => {
  const bad = { specVersion: '1.0', entries: [{ identifier: 'urn:air:x.example:page:quota', type: 'text/html', url: 'https://x.example/quota' }, { identifier: 'urn:air:x.example:mcp:tools', type: 'application/mcp-server-card+json', url: 'https://x.example/mcp' }] };
  const v = validateCatalog({ found: true, text: JSON.stringify(bad) });
  assert.equal(v.status, 'fix'); assert.equal(v.htmlEntries, 1);
  const fixed = JSON.parse(generateCatalog({ siteName: 'X', host: 'x.example', origin: 'https://x.example', existing: bad }));
  assert.equal(fixed.entries.length, 1, 'html entry removed, the real MCP entry kept');
  assert.equal(fixed.entries[0].type, 'application/mcp-server-card+json');
  assert.equal(validateCatalog({ found: true, text: '{ nope' }).status, 'fix');
  assert.equal(validateCatalog({ found: true, text: JSON.stringify({ specVersion: 1, entries: [] }) }).status, 'fix', 'specVersion must be a "Major.Minor" string');
  assert.equal(validateCatalog({ found: true, text: JSON.stringify({ specVersion: '1.0', entries: [{ identifier: 'a', type: 'application/mcp-server-card+json', url: 'u', data: {} }] }) }).status, 'fix', 'exactly one of url/data');
  assert.ok(CATALOG_TYPES.includes('application/a2a-agent-card+json'));
});

test('robots validation: blocked answer crawlers are a problem, blocked training crawlers are a choice', () => {
  const robots = parseRobots('User-agent: PerplexityBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /');
  const v = validateRobots({ robotsTxt: 'x', isBlockedFor: b => isBlocked(robots, b, '/'), sitemapFound: false });
  assert.equal(v.status, 'fix'); assert.deepEqual(v.blockedSearch, ['PerplexityBot']); assert.deepEqual(v.blockedTraining, ['CCBot']);
  assert.match(generateRobotsBlock({ origin: 'https://x.example', blockedTraining: v.blockedTraining }), /Disallow: \//);
});

test('generated files contain no invented facts: unknowns become [placeholders]', () => {
  const bare = analyze({ ...base, html: '<!doctype html><html><head><title>Hi</title></head><body><p>Hello.</p></body></html>' });
  const ld = bare.aiFiles.files.find(f => f.id === 'jsonld').generated;
  assert.match(ld, /\[One sentence: what .* does and who it is for\.\]/);
  assert.match(ld, /\[path-to-your-logo\.png\]/);
  assert.match(bare.aiFiles.files.find(f => f.id === 'llms').generated, /\[One sentence:/);
});
