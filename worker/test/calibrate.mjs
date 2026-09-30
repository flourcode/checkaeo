/**
 * Calibration harness — run real sites through the scanner and eyeball the numbers.
 *   node test/calibrate.mjs stripe.com anthropic.com quotabird.com "https://en.wikipedia.org/wiki/Plumber"
 * Prints one line per site: score, grade, status, four category scores, what AI sees, top fix.
 * The question to ask of each line: does the score feel directionally right before reading the explanation?
 */
import { scan } from '../src/index.js';
const urls = process.argv.slice(2);
if (!urls.length) { console.log('usage: node test/calibrate.mjs <url> [url...]'); process.exit(1); }
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(pad('site', 28), pad('score', 6), pad('grade', 6), pad('status', 20), pad('A/C/An/T', 16), 'top fix');
for (const u of urls) {
  try {
    const r = await scan(/^https?:/.test(u) ? u : 'https://' + u);
    const c = r.categories;
    console.log(pad(r.domain, 28), pad(r.score, 6), pad(r.grade, 6), pad(r.status, 20), pad(`${c.access.score}/${c.clarity.score}/${c.answers.score}/${c.trust.score}`, 16), r.fixes[0]?.title || '—');
    console.log('   sees:', r.whatAiSees.summary, `(${r.whatAiSees.confidence}${r.whatAiSees.source ? ', ' + r.whatAiSees.source : ''})`);
  } catch (e) { console.log(pad(u, 28), 'ERROR', e.message); }
}
