import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, detectBlock, familiarityFrom } from '../src/analyze.js';
import { lookupEntity } from '../src/index.js';

const page = (body, head = '') => `<!doctype html><html lang="en"><head><title>Acme Tools – invoicing software for freelancers</title><meta name="description" content="Acme Tools is invoicing software that helps freelancers send invoices and get paid faster.">${head}</head><body><header><nav><a href="/about">About</a><a href="/contact">Contact</a></nav></header><main><h1>Invoicing software for freelancers</h1>${body}</main><footer><a href="/privacy">Privacy</a> © 2026 Acme Tools Inc.</footer></body></html>`;
const para = 'Acme Tools is invoicing software for freelancers. It creates invoices, sends reminders, and records payments so you get paid on time without chasing clients by email every week. ';
const good = page(`<h2>What is Acme Tools?</h2><p>${para.repeat(3)}</p><h2>How does it work?</h2><p>${para.repeat(3)}</p><ul><li>Create</li><li>Send</li><li>Track</li></ul>`);
const base = { url: 'https://acme.example/', status: 200, html: good, robotsTxt: 'User-agent: *\nAllow: /', sitemapFound: true, llmsTxtFound: true };

test('a site that refuses our crawler is reported as blocked, not scored', () => {
  const r = analyze({ ...base, status: 403, html: '<html><body>Forbidden</body></html>' });
  assert.equal(r.score, null);
  assert.equal(r.blocked.status, 403);
  assert.match(r.whatAiSees.summary, /does not mean AI crawlers are blocked/);
  assert.equal(r.blocked.allowedSearch, r.blocked.searchTotal, 'robots.txt allows all AI search crawlers here');
});

test('bot challenges are detected; long pages that merely mention captcha are not', () => {
  assert.ok(detectBlock(200, '<html><head><title>Just a moment...</title></head><body>cf-chl-</body></html>', 5));
  assert.equal(detectBlock(200, '<html><body>' + 'We added a captcha to our signup form. '.repeat(80) + '</body></html>', 640), null);
  assert.equal(detectBlock(404, '<html></html>', 0), null, 'a real 404 is still a real error');
});

test('AI familiarity tiers', () => {
  assert.equal(familiarityFrom(null), null, 'failed lookup = unknown, not absent');
  assert.equal(familiarityFrom({ found: false }).score, 0);
  assert.equal(familiarityFrom({ found: true, sitelinks: 150 }).score, 100);
  assert.equal(familiarityFrom({ found: true, sitelinks: 30 }).score, 85);
  assert.equal(familiarityFrom({ found: true, sitelinks: 0 }).score, 30);
});

test('overall = 75% page readiness + 25% familiarity; failed lookup falls back to readiness', () => {
  const none = analyze({ ...base });
  const unknown = analyze({ ...base, entity: { found: false } });
  const famous = analyze({ ...base, entity: { found: true, id: 'Q1', label: 'Acme', description: 'company', sitelinks: 120 } });
  assert.equal(none.score, none.readiness);
  assert.equal(unknown.score, Math.round(unknown.readiness * 0.75));
  assert.equal(famous.score, Math.round(famous.readiness * 0.75 + 25));
  assert.ok(famous.score > unknown.score);
  assert.equal(famous.familiarity.level, 'Widely known');
});

test('Wikidata lookup: exact official-website matches only, parsed safely', async () => {
  let seen = '';
  const ok = async (u) => { seen = decodeURIComponent(u); return { ok: true, json: async () => ({ results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q312' }, itemLabel: { value: 'Apple Inc.' }, itemDescription: { value: 'American technology company' }, links: { value: '156' } }] } }) }; };
  const r = await lookupEntity('www.apple.com', ok);
  assert.deepEqual(r, { found: true, id: 'Q312', label: 'Apple Inc.', description: 'American technology company', sitelinks: 156 });
  assert.match(seen, /<https:\/\/www\.apple\.com\/>/); assert.match(seen, /<https:\/\/apple\.com>/); assert.match(seen, /wdt:P856/);
  assert.deepEqual(await lookupEntity('betterverses.com', async () => ({ ok: true, json: async () => ({ results: { bindings: [] } }) })), { found: false });
  assert.equal(await lookupEntity('x.com', async () => { throw new Error('timeout'); }), null);
  assert.equal(await lookupEntity('x.com', async () => ({ ok: false })), null);
});
