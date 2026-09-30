import { analyze } from '../src/analyze.js';
import { GOOD, OK_ROBOTS, BLOCKED_ROBOTS } from './fixtures.mjs';
import { MIXED } from './fixtures-mixed.mjs';
import fs from 'node:fs';
const demos = {
  quotabird: analyze({ url: 'https://quotabird.example/', finalUrl: 'https://quotabird.example/', status: 200, headers: {}, html: GOOD.replace(/<p>Last updated[\s\S]*?<\/p>/,'').replace(',{"@type":"FAQPage","mainEntity":[]}','').replace(/<h2>Frequently asked questions<\/h2>[\s\S]*?<\/p>/,'').replace('<link rel="canonical" href="https://quotabird.example/">','').replace(/<h2>Who is it for\?<\/h2>[\s\S]*?<\/p>/,'').replace(/<h2>How does it work\?<\/h2>[\s\S]*?<\/ol>/,'').replace(/,"sameAs":\[[^\]]*\]/,''), robotsTxt: OK_ROBOTS, fetchMs: 412, redirectCount: 0, sitemapFound: true, llmsTxtFound: false }),
  harborandoak: analyze({ url: 'https://harborandoak.example/', finalUrl: 'https://harborandoak.example/', status: 200, headers: {}, html: MIXED, robotsTxt: null, robotsStatus: 404, fetchMs: 1180, redirectCount: 1, sitemapFound: false, llmsTxtFound: false }),
  northwind: analyze({ url: 'https://northwind-tools.example/', finalUrl: 'https://northwind-tools.example/', status: 200, headers: {}, html: GOOD.replace(/Quotabird/g, 'Northwind Tools').replace(/quotabird\.com/g, 'northwind-tools.example'), robotsTxt: BLOCKED_ROBOTS, fetchMs: 640, redirectCount: 0, sitemapFound: true, llmsTxtFound: false })
};
for (const [k, d] of Object.entries(demos)) { d.demo = true; d.scannedAt = '2026-09-30T09:00:00.000Z'; console.log(k, d.score, d.grade, d.status, '|', Object.values(d.categories).map(c => c.grade + ' ' + c.label).join(' | ')); console.log('  ', d.whatAiSees.summary); console.log('  ', d.fixes.map(f => f.title).join(' / ')); }
fs.writeFileSync(new URL('../../assets/js/demo-data.js', import.meta.url), `/* Bundled example scans for demo mode. Generated with the real analyzer from fixture pages.\n   These are illustrative: quotabird.example is a fictional example site; the others use .example domains. */\nwindow.CHECKAEO_DEMOS = ${JSON.stringify(demos, null, 1)};\n`);
