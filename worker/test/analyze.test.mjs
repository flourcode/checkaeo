import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, parseRobots, isBlocked } from '../src/analyze.js';
import { validateUrl, isPrivateHost } from '../src/index.js';
import { GOOD, VAGUE, BLOCKED_ROBOTS, OK_ROBOTS } from './fixtures.mjs';

const base = { url: 'https://quotabird.example/', finalUrl: 'https://quotabird.example/', status: 200, headers: {}, fetchMs: 420, redirectCount: 0, sitemapFound: true, llmsTxtFound: false };

test('a well-structured page scores well', () => {
  const r = analyze({ ...base, html: GOOD, robotsTxt: OK_ROBOTS });
  assert.ok(r.score >= 85, `score ${r.score}`);
  assert.equal(r.categories.access.score, 100);
  assert.equal(r.whatAiSees.siteName, 'Quotabird');
  assert.ok(r.whatAiSees.purpose.includes('sales'));
  assert.equal(r.whatAiSees.unclear, false);
  assert.ok(r.fixes.length <= 3);
});

test('a vague page scores poorly and is flagged unclear', () => {
  const r = analyze({ ...base, url: 'http://vague.example', finalUrl: 'http://vague.example/', html: VAGUE, robotsTxt: null, robotsStatus: 404, sitemapFound: false });
  assert.ok(r.score < 60, `score ${r.score}`);
  assert.equal(r.grade, 'F');
  assert.equal(r.whatAiSees.unclear, true);
  assert.ok(r.fixes.some(f => /H1|plain sentence/i.test(f.title)));
  assert.ok(r.categories.clarity.checks.find(c => c.id === 'title').status === 'fail');
});

test('robots.txt parsing and AI bot blocking', () => {
  const rb = parseRobots(BLOCKED_ROBOTS);
  assert.equal(rb.sitemaps.length, 1);
  assert.equal(isBlocked(rb, 'OAI-SearchBot', '/'), true);
  assert.equal(isBlocked(rb, 'Googlebot', '/'), false);
  assert.equal(isBlocked(rb, 'Googlebot', '/admin/x'), true);
  const r = analyze({ ...base, html: GOOD, robotsTxt: BLOCKED_ROBOTS });
  const bots = r.categories.access.checks.find(c => c.id === 'ai-bots');
  assert.equal(bots.status, 'fail');
  assert.ok(r.fixes[0].title.includes('Unblock'));
});

test('noindex tanks access', () => {
  const r = analyze({ ...base, html: GOOD.replace('<head>', '<head><meta name="robots" content="noindex">'), robotsTxt: OK_ROBOTS });
  assert.equal(r.categories.access.checks.find(c => c.id === 'noindex').status, 'fail');
  assert.ok(r.categories.access.score < 90);
});

test('non-200 page is hard to reach', () => {
  const r = analyze({ ...base, status: 503, html: '', robotsTxt: null, fetchMs: 900 });
  assert.equal(r.status, 'Hard to reach');
});

test('headings are found in minimal, unclosed markup (example.com style)', () => {
  const html = '<!doctype html><html lang="en"><head><title>Example Domain</title><style>h1{x:1}</style><body><div><h1>Example Domain</h1><p>This domain is for use in documentation examples without needing permission. This is not a service, avoid relying on it for testing and monitoring purposes.</p><p><a href="https://iana.org/domains/example">Learn more</a></p></div>';
  const r = analyze({ ...base, url: 'https://example.com/', finalUrl: 'https://example.com/', html, robotsTxt: null, robotsStatus: 404, sitemapFound: false });
  assert.equal(r.categories.clarity.checks.find(c => c.id === 'h1').status !== 'fail', true);
  assert.deepEqual(r.meta.h1, ['Example Domain']);
  assert.notEqual(r.fixes[0].id, 'rendered'); // thin static text is not a gating access problem
});

test('URL validation blocks private hosts', () => {
  assert.ok(validateUrl('localhost').error);
  assert.ok(validateUrl('http://127.0.0.1/').error);
  assert.ok(validateUrl('http://10.1.2.3/').error);
  assert.ok(validateUrl('http://169.254.169.254/latest/').error);
  assert.ok(validateUrl('http://[::1]/').error);
  assert.ok(validateUrl('http://2130706433/').error);
  assert.ok(validateUrl('ftp://example.com').error);
  assert.equal(validateUrl('example.com').url, 'https://example.com/');
  assert.equal(validateUrl('https://Example.com/path?x=1#frag').url, 'https://example.com/path?x=1');
  assert.equal(isPrivateHost('metadata.google.internal'), true);
});
