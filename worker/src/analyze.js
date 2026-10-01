/**
 * Aeoden analyzer
 * Pure function: takes a fetched page (html, headers, robots.txt, timing)
 * and returns a structured scan result that powers the AEO Card.
 *
 * GROUNDING RULE (hard): "What AI sees" and every fix suggestion are built only from
 * text that was literally present in the fetched page. The summary is a verbatim
 * sentence from the page with its source named (meta description, main heading,
 * opening text). Nothing is paraphrased or synthesised. Anything not found on the
 * page is shown as a [bracketed placeholder]. Incomplete-but-accurate beats
 * polished-but-invented.
 *
 * Scoring model (see /methodology/):
 *   Access 30% · Clarity 25% · Answers 25% · Trust 20%
 * Each category is a set of weighted checks that sum to 100.
 */

export const WEIGHTS = { access: 0.30, clarity: 0.25, answers: 0.25, trust: 0.20 };

const AI_BOTS = {
  search: ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Googlebot', 'Bingbot'],
  training: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'anthropic-ai', 'Applebot-Extended']
};

const GENERIC_TITLES = /^(home|homepage|welcome|index|untitled|new site|my site|coming soon|site title)$/i;
const VAGUE_WORDS = /\b(innovative|synergy|solutions?|cutting[- ]edge|next[- ]gen(eration)?|revolutionary|world[- ]class|seamless(ly)?|empower(ing|s)?|unlock|elevate|transform(ing|ative)?|leverage|best[- ]in[- ]class|disrupt(ive|ing)?|holistic|robust|scalable|game[- ]chang(er|ing)|reimagin(e|ing))\b/gi;
const STOPWORDS = new Set('a an the and or of to for in on at by with from is are was were be been being it its this that these those we our you your they their as if than then so not no yes can will just also more most very all any some such into over under about up out'.split(' '));

/* ------------------------------------------------------------------ */
/* Small HTML helpers (regex-based, tolerant, no DOM needed)          */
/* ------------------------------------------------------------------ */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™' };
export function decode(s = '') {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
export function stripTags(s = '') {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
}
function all(re, s) { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(s))) out.push(m); return out; }
function truncate(s, n) {
  if (!s || s.length <= n) return s || '';
  const cut = s.slice(0, n);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (end > n * 0.5 ? cut.slice(0, end) : cut).trim().replace(/[,;:\-–—]$/, '') + '…';
}
function clip(s, n) { return s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : (s || ''); }
function words(s) { return (s || '').split(/\s+/).filter(Boolean); }
function sentences(s) { return (s || '').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(x => x.trim()).filter(x => x.length > 0); }

/* ------------------------------------------------------------------ */
/* Extraction                                                         */
/* ------------------------------------------------------------------ */

export function extract(html, pageUrl) {
  const src = html || '';
  const noJunk = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => (/type\s*=\s*["']?application\/ld\+json/i.test(m) ? m : ''))
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');

  const head = (noJunk.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [, noJunk.slice(0, 20000)])[1];
  const bodyRaw = (noJunk.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) || [, noJunk])[1];

  const metas = {};
  for (const m of all(/<meta\b[^>]*>/gi, head)) {
    const tag = m[0];
    const key = (attr(tag, 'name') || attr(tag, 'property') || attr(tag, 'http-equiv') || '').toLowerCase();
    const content = attr(tag, 'content');
    if (key && content != null && !(key in metas)) metas[key] = content.trim();
  }

  const title = stripTags((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  const canonical = (() => { const m = all(/<link\b[^>]*>/gi, head).find(x => /rel\s*=\s*["']?canonical/i.test(x[0])); return m ? attr(m[0], 'href') : null; })();
  const lang = attr((src.match(/<html\b[^>]*>/i) || [''])[0], 'lang');

  // Headings never live in <head>; scan everything else so an unclosed or oddly placed <body> can't hide them.
  const headingScope = noJunk.replace(/<head\b[^>]*>[\s\S]*?(<\/head>|(?=<body\b))/i, '').replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  const headings = [];
  for (const m of all(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, headingScope)) {
    const text = stripTags(m[2]);
    if (text) headings.push({ level: +m[1], text });
  }
  const h1s = headings.filter(h => h.level === 1).map(h => h.text);

  // JSON-LD
  const jsonld = [];
  for (const m of all(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi, src)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const n of nodes) if (n && typeof n === 'object') jsonld.push(n);
    } catch { jsonld.push({ __invalid: true }); }
  }
  const ldTypes = jsonld.flatMap(n => [].concat(n['@type'] || [])).filter(Boolean);
  const ldNode = t => jsonld.find(n => [].concat(n['@type'] || []).some(x => new RegExp(t, 'i').test(String(x))));

  // Content regions
  const mainMatch = bodyRaw.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const content = mainMatch ? mainMatch[2] : bodyRaw;
  const navBlocks = all(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi, bodyRaw).map(m => m[1]);
  const footer = (bodyRaw.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i) || [, ''])[1];

  const paragraphs = all(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, content).map(m => stripTags(m[1])).filter(p => words(p).length >= 4);
  const listItems = all(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, content).map(m => stripTags(m[1])).filter(Boolean);
  const listsWith3 = all(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, content).filter(m => (m[2].match(/<li\b/gi) || []).length >= 3).length;
  const visibleText = stripTags(bodyRaw);
  const contentText = stripTags(content);
  const wordCount = words(visibleText).length;

  // Links
  const links = all(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, bodyRaw).map(m => ({ href: attr(m[0], 'href') || '', text: stripTags(m[1]) }));
  let host = '';
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  const root = host.split('.').slice(-2).join('.');
  const external = links.filter(l => { try { const u = new URL(l.href, pageUrl); const h = u.hostname.replace(/^www\./, ''); return /^https?:$/.test(u.protocol) && h !== host && !h.endsWith('.' + root) && h !== root; } catch { return false; } });
  const SOCIAL = /(twitter|x\.com|facebook|instagram|linkedin|youtube|tiktok|threads\.net|github\.com|bsky|mastodon|pinterest)/i;
  const externalNonSocial = external.filter(l => !SOCIAL.test(l.href));
  const socialLinks = external.filter(l => SOCIAL.test(l.href));
  const linkMatch = re => links.some(l => re.test(l.href) || re.test(l.text));

  const navTexts = navBlocks.flatMap(n => all(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, n).map(m => stripTags(m[1]))).filter(Boolean);

  const imgs = all(/<img\b[^>]*>/gi, bodyRaw).map(m => m[0]);
  const imgsNoAlt = imgs.filter(t => attr(t, 'alt') == null).length;

  const timeTags = all(/<time\b[^>]*>/gi, bodyRaw).length;
  const dateText = /\b(last )?(updated|modified|published|reviewed)( on)?:?\s+[A-Z0-9]/i.test(visibleText);
  const authorMeta = metas['author'] || metas['article:author'] || null;
  const ldAuthor = jsonld.find(n => n.author)?.author;
  const byline = /\b(by|written by|author:)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(visibleText);
  const copyright = (visibleText.match(/(©|\(c\)|copyright)\s*(\d{4}\s*[-–]?\s*\d{0,4})?\s*(?:by\s+)?([A-Za-z][^.|\n]{1,59})/i) || [])[3]?.trim() || null;
  const address = !!ldNode('Organization|LocalBusiness')?.address || /\b\d{1,5}\s+[A-Z][a-zA-Z]+\s+(Street|St|Ave|Avenue|Road|Rd|Blvd|Lane|Ln|Drive|Dr|Way|Suite)\b/.test(footer + ' ' + visibleText.slice(-1500));

  const scriptCount = (src.match(/<script\b/gi) || []).length;
  const modulePreloads = (src.match(/rel=["']modulepreload["']/gi) || []).length;
  const bodyWords = words(stripTags(bodyRaw)).length;
  const jsApp = /id=["'](root|app|__next|__nuxt|svelte|q-app)["']|data-reactroot|ng-app|__NEXT_DATA__|__sveltekit|\/_app\/immutable\/|\/_next\/static\/|\/_nuxt\//i.test(src)
    || ((scriptCount >= 4 || modulePreloads >= 3 || /<script[^>]+type=["']module["']/i.test(src)) && bodyWords < 80);

  const semantic = {
    main: /<main\b/i.test(bodyRaw) || /<article\b/i.test(bodyRaw),
    nav: navBlocks.length > 0,
    header: /<header\b/i.test(bodyRaw),
    footer: /<footer\b/i.test(bodyRaw)
  };

  const siteName = metas['og:site_name'] || ldNode('WebSite|Organization')?.name || null;

  return {
    title, metas, canonical, lang, headings, h1s, jsonld, ldTypes, ldNode,
    paragraphs, listItems, listsWith3, visibleText, contentText, wordCount,
    links, external, externalNonSocial, socialLinks, linkMatch, navTexts,
    imgs: imgs.length, imgsNoAlt, timeTags, dateText, authorMeta, ldAuthor, byline, copyright, address,
    semantic, siteName, host, htmlBytes: src.length, jsApp, scriptCount
  };
}

/* ------------------------------------------------------------------ */
/* robots.txt                                                          */
/* ------------------------------------------------------------------ */

export function parseRobots(txt = '') {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'sitemap') { sitemaps.push(val); continue; }
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if ((key === 'disallow' || key === 'allow') && cur) {
      cur.rules.push({ type: key, path: val });
    }
  }
  return { groups, sitemaps };
}

/** Returns true if `agent` is disallowed from `path` per robots rules (longest-match wins). */
export function isBlocked(robots, agent, path = '/') {
  if (!robots) return false;
  const a = agent.toLowerCase();
  let group = robots.groups.find(g => g.agents.some(x => x !== '*' && (a.includes(x) || x.includes(a))));
  if (!group) group = robots.groups.find(g => g.agents.includes('*'));
  if (!group) return false;
  let best = null;
  for (const r of group.rules) {
    if (r.path === '' && r.type === 'disallow') continue; // empty disallow = allow all
    const re = new RegExp('^' + r.path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? best.type === 'disallow' : false;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function check(id, title, weight, ratio, detail, extra = {}) {
  const points = Math.round(weight * Math.max(0, Math.min(1, ratio)) * 100) / 100;
  const status = weight === 0 ? 'info' : ratio >= 0.999 ? 'pass' : ratio >= 0.45 ? 'warn' : 'fail';
  return { id, title, weight, points, status, detail, ...extra };
}
const grade = s => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F');
export function statusLabel(score, access) {
  if (access < 40) return 'Hard to reach';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Mostly clear';
  if (score >= 60) return 'Needs work';
  return 'Hard to understand';
}
function catScore(checks) {
  const w = checks.reduce((s, c) => s + c.weight, 0);
  const p = checks.reduce((s, c) => s + c.points, 0);
  return w ? Math.round((p / w) * 100) : 0;
}

export function analyze(input) {
  const {
    url, finalUrl = url, status = 0, headers = {}, html = '', robotsTxt = null, robotsStatus = 0,
    redirectCount = 0, sitemapFound = null, llmsTxtFound = null, fetchMs = 0, error = null
  } = input;
  const x = extract(html, finalUrl);
  const robots = robotsTxt != null ? parseRobots(robotsTxt) : null;
  let pathname = '/';
  try { pathname = new URL(finalUrl).pathname || '/'; } catch { /* ignore */ }
  const isHttps = /^https:/i.test(finalUrl);

  /* ---------------- ACCESS ---------------- */
  const A = [];
  A.push(check('https', 'Served over HTTPS', 10, isHttps ? 1 : 0,
    isHttps ? 'The page loads securely over HTTPS.' : 'The page is served over plain HTTP. Most crawlers and answer engines prefer or require HTTPS.'));
  A.push(check('status', 'Page responds successfully', 20, status === 200 ? 1 : status >= 200 && status < 400 ? 0.6 : 0,
    status === 200 ? `The server returned 200 OK in ${fetchMs} ms.` : status ? `The server returned HTTP ${status}. Crawlers treat anything other than a 200 as a page that cannot be used.` : `The page could not be fetched${error ? ` (${error})` : ''}.`));
  A.push(check('redirects', 'Redirect chain is short', 6, redirectCount <= 1 ? 1 : redirectCount === 2 ? 0.6 : 0.2,
    redirectCount === 0 ? 'No redirects.' : `${redirectCount} redirect${redirectCount > 1 ? 's' : ''} before the final page${redirectCount > 1 ? '. Long chains waste crawl budget and sometimes get abandoned.' : '.'}`,
    { evidence: finalUrl !== url ? `${url} → ${finalUrl}` : undefined }));

  const robotsAll = robots && isBlocked(robots, '*', pathname);
  A.push(check('robots', 'robots.txt is present and sane', 8,
    robotsTxt == null ? (robotsStatus === 404 ? 0.65 : 0.5) : robotsAll ? 0 : 1,
    robotsTxt == null ? 'No robots.txt was found. That is allowed, but a simple one signals intent and points to your sitemap.' : robotsAll ? 'robots.txt disallows all user agents from this page. Crawlers will not read it.' : 'robots.txt exists and does not block this page for general crawlers.'));

  const blockedSearch = robots ? AI_BOTS.search.filter(b => isBlocked(robots, b, pathname)) : [];
  const blockedTraining = robots ? AI_BOTS.training.filter(b => isBlocked(robots, b, pathname)) : [];
  A.push(check('ai-bots', 'AI search crawlers are allowed', 12, blockedSearch.length === 0 ? 1 : blockedSearch.length === 1 ? 0.25 : 0,
    blockedSearch.length ? `robots.txt blocks ${blockedSearch.join(', ')}. These are the crawlers answer engines use to fetch pages for live answers.` : 'None of the answer-engine crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot) are blocked.' + (blockedTraining.length ? ` Training crawlers blocked: ${blockedTraining.join(', ')} — that is a separate choice and does not affect this score.` : ''),
    { evidence: blockedSearch.length ? `Blocked: ${blockedSearch.join(', ')}` : undefined }));

  const metaRobots = (x.metas['robots'] || '') + ' ' + (headers['x-robots-tag'] || '');
  const noindex = /noindex|none\b/i.test(metaRobots);
  A.push(check('noindex', 'Page is indexable', 14, noindex ? 0 : 1,
    noindex ? `A noindex directive was found (${/x-robots/i.test(headers['x-robots-tag'] || '') || headers['x-robots-tag'] ? 'X-Robots-Tag header' : 'meta robots tag'}). Search and answer engines will drop this page.` : 'No noindex directive in meta tags or headers.',
    { evidence: noindex ? metaRobots.trim() : undefined }));

  A.push(check('sitemap', 'Sitemap is discoverable', 6, sitemapFound ? 1 : sitemapFound === null ? 0.5 : 0.5,
    sitemapFound ? 'A sitemap was found (via robots.txt or /sitemap.xml).' : 'No sitemap was found in robots.txt or at /sitemap.xml. Sitemaps help crawlers find every page, not just the homepage.'));

  A.push(check('rendered', 'Meaningful text in the HTML', 14, x.wordCount >= 150 ? 1 : x.wordCount >= 50 ? 0.5 : status === 200 ? 0.1 : 0,
    x.wordCount >= 150 ? `The raw HTML contains about ${x.wordCount} words of visible text, so crawlers do not need to run JavaScript to read it.` : x.wordCount >= 50 ? `Only about ${x.wordCount} words are in the raw HTML.${x.jsApp ? ' Your content appears to load with JavaScript, so many AI crawlers will see a nearly empty page.' : ''}` : x.jsApp ? 'The raw HTML has almost no visible text and looks like a JavaScript app. AI crawlers that do not execute JavaScript will see an empty page.' : 'The raw HTML has almost no visible text. There is very little for an AI system to read.'));

  A.push(check('speed', 'Responds quickly', 4, fetchMs && fetchMs < 2000 ? 1 : fetchMs < 5000 ? 0.5 : 0,
    fetchMs ? `Time to fetch the HTML: ${fetchMs} ms.` : 'Timing unavailable.'));

  let canonRatio = 0.65, canonDetail = 'No canonical link. Not required, but it removes ambiguity when the same page exists at several URLs.';
  if (x.canonical) {
    try {
      const c = new URL(x.canonical, finalUrl), f = new URL(finalUrl);
      const same = c.hostname.replace(/^www\./, '') === f.hostname.replace(/^www\./, '');
      canonRatio = same ? 1 : 0.3;
      canonDetail = same ? `Canonical points to ${c.href}.` : `Canonical points to a different domain (${c.hostname}). Engines may attribute this content there instead.`;
    } catch { canonRatio = 0.5; canonDetail = 'The canonical link is not a valid URL.'; }
  }
  A.push(check('canonical', 'Canonical URL is set', 6, canonRatio, canonDetail));

  /* ---------------- CLARITY ---------------- */
  const C = [];
  const tLen = x.title.length;
  const titleRatio = !tLen ? 0 : GENERIC_TITLES.test(x.title) ? 0.2 : tLen < 15 ? 0.5 : tLen > 70 ? 0.7 : 1;
  C.push(check('title', 'Descriptive page title', 15, titleRatio,
    !tLen ? 'The page has no <title>. This is the first thing every engine reads.' : GENERIC_TITLES.test(x.title) ? `The title is "${x.title}", which says nothing about the site.` : tLen < 15 ? `The title "${x.title}" is short. Include what the site is or does.` : tLen > 70 ? 'The title is long and may be truncated. Keep the key words in the first 60 characters.' : `Title: "${clip(x.title, 90)}"`,
    { evidence: x.title || undefined }));

  const ogOnly = !x.metas['description'] && !!x.metas['og:description'];
  const desc = x.metas['description'] || x.metas['og:description'] || '';
  C.push(check('description', 'Meta description explains the page', 10, !desc ? 0 : (desc.length < 50 ? 0.5 : desc.length > 170 ? 0.7 : 1) * (ogOnly ? 0.8 : 1),
    !desc ? 'No meta description. Engines often use it as the one-line summary of your site.' : ogOnly ? `Only an og:description is set ("${clip(desc, 90)}"). Add a plain meta description with the same text.` : desc.length < 50 ? 'The meta description is very short.' : desc.length > 170 ? 'The meta description is long and may be truncated.' : `Description: "${clip(desc, 120)}"`,
    { evidence: desc || undefined }));

  const h1 = x.h1s[0] || '';
  const h1Words = words(h1).length;
  const h1Greeting = /^(welcome|hello|home|hi there)/i.test(h1);
  const h1Ratio = !h1 ? 0 : x.h1s.length > 1 ? 0.6 : h1Greeting ? 0.4 : h1Words < 3 ? 0.5 : 1;
  C.push(check('h1', 'Clear main heading (H1)', 15, h1Ratio,
    !h1 ? 'No H1 found. The H1 is the sentence machines treat as "what this page is about".' : x.h1s.length > 1 ? `${x.h1s.length} H1s found. One H1 keeps the main topic unambiguous.` : h1Greeting ? `The H1 "${h1}" is a greeting, not a statement of what the site does.` : h1Ratio < 1 ? `The H1 "${h1}" is only a name or a fragment. It could say what the site does.` : `H1: "${clip(h1, 90)}"`,
    { evidence: x.h1s.slice(0, 3).join(' | ') || undefined }));

  const nameFromTitle = (x.title.split(/\s*[|–—\-:·•]\s*/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 40 && !GENERIC_TITLES.test(s)).sort((a, b) => a.length - b.length)[0]) || null;
  const siteName = status === 200 ? (x.siteName || nameFromTitle || x.copyright || x.host) : x.host;
  const nameSource = x.siteName ? 'og:site_name / structured data' : nameFromTitle ? 'the page title' : x.copyright ? 'the copyright line' : 'the domain';
  C.push(check('sitename', 'Site or brand name is identifiable', 10, x.siteName ? 1 : nameFromTitle ? 0.7 : 0.35,
    `The site name appears to be "${siteName}" (from ${nameSource}).` + (x.siteName ? '' : ' Adding og:site_name or Organization structured data makes this explicit.')));

  // Purpose sentence: look at top of page for a declarative sentence that says what the site does.
  const topText = [h1, x.headings.find(h => h.level === 2)?.text, ...x.paragraphs.slice(0, 4)].filter(Boolean).map(t => /[.!?]$/.test(t) ? t : t + '.').join(' ');
  const candidateSrc = [];
  const pushC = (text, src) => { for (const sent of sentences(text || '')) if (words(sent).length >= 5 && words(sent).length <= 45) candidateSrc.push({ s: sent, src }); };
  pushC(desc, 'meta description');
  pushC(h1, 'main heading');
  pushC(x.headings.find(h => h.level === 2)?.text, 'first section heading');
  x.paragraphs.slice(0, 4).forEach(p => pushC(p, 'opening text'));
  const candidates = candidateSrc.map(c => c.s);
  const purposePattern = /\b(is|are|helps?|lets?|makes?|builds?|sells?|offers?|provides?|we|our|for|design|create|manage|find|book|get|learn|buy|shop|track|plan|send)\b/i;
  const IMPERATIVE = /^(get|call|visit|contact|learn|book|sign|start|try|join|discover|explore|see|click|read|find out|shop|order|buy|download|subscribe|request|schedule|let's|come)\b/i;
  const nameRe = siteName && siteName !== x.host ? new RegExp(siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const scoreCandidate = (s, i) => {
    const w = words(s);
    const vague = (s.match(VAGUE_WORDS) || []).length;
    const concrete = w.filter(t => !STOPWORDS.has(t.toLowerCase()) && t.length > 3).length;
    return (purposePattern.test(s) ? 2 : 0) + Math.min(concrete, 8) / 4 - vague * 1.5 - (w.length > 30 ? 1 : 0)
      - (IMPERATIVE.test(s) ? 2.5 : 0) + (nameRe && nameRe.test(s) ? 1 : 0) + (i === 0 ? 0.75 : i === 1 ? 0.5 : 0) + (/\b(is|are)\s+(a|an|the)\b/i.test(s) ? 1 : 0);
  };
  const ranked = candidateSrc.map((c, i) => ({ s: c.s, src: c.src, sc: scoreCandidate(c.s, i) })).sort((a, b) => b.sc - a.sc);
  const purpose = ranked[0] && ranked[0].sc >= 2 ? ranked[0].s : null;
  const purposeSource = purpose ? ranked[0].src : null;
  const vagueHits = (topText.match(VAGUE_WORDS) || []).length;
  const purposeRatio = purpose ? (vagueHits >= 3 ? 0.55 : ranked[0].sc >= 3 ? 1 : 0.75) : x.paragraphs.length ? 0.3 : 0.1;
  C.push(check('purpose', 'Plain-English statement of what the site does', 20, purposeRatio,
    purpose ? (vagueHits >= 3 ? `There is a purpose statement, but the top of the page leans on vague words (${[...new Set((topText.match(VAGUE_WORDS) || []).map(v => v.toLowerCase()))].slice(0, 4).join(', ')}).` : `Near the top, the page says: "${clip(purpose, 140)}"`) : 'We could not find a sentence near the top of the page that plainly says what this site does or sells.',
    { evidence: purpose || undefined }));

  const audMatch = topText.match(/\bfor\s+((?:small|local|busy|independent|growing|early[- ]stage|enterprise|modern|remote|new|solo)?\s*(?:businesses|business owners|companies|teams|founders|startups|developers|designers|marketers|agencies|creators|students|parents|families|homeowners|patients|clinics|restaurants|schools|nonprofits|lawyers|doctors|dentists|contractors|sales reps|managers|writers|teachers|artists|musicians|photographers|freelancers|professionals|people who [^.,]{3,40}|anyone who [^.,]{3,40}))/i);
  const audience = audMatch ? audMatch[1].trim() : null;
  C.push(check('audience', 'Audience is stated', 8, audience ? 1 : 0.35,
    audience ? `The page says who it is for: "${clip(audience, 60)}".` : 'The page does not clearly say who it is for. "For X" phrasing helps engines match you to the right questions.'));

  const h2s = x.headings.filter(h => h.level === 2);
  let skipped = 0;
  for (let i = 1; i < x.headings.length; i++) if (x.headings[i].level - x.headings[i - 1].level > 1) skipped++;
  C.push(check('headings', 'Headings outline the page', 10, x.headings.length < 2 ? 0.2 : h2s.length >= 2 ? Math.max(0.5, 1 - skipped * 0.15) : 0.5,
    x.headings.length < 2 ? 'Fewer than two headings. Headings are how machines chunk a page into topics.' : h2s.length >= 2 ? `${x.headings.length} headings, ${h2s.length} of them H2s.${skipped ? ` ${skipped} skipped level${skipped > 1 ? 's' : ''}.` : ''}` : 'Headings exist but there are fewer than two H2 sections.'));

  const semCount = Object.values(x.semantic).filter(Boolean).length;
  C.push(check('semantic', 'Semantic HTML landmarks', 7, semCount / 4,
    semCount === 4 ? 'Uses main, nav, header and footer landmarks.' : `Landmarks present: ${Object.entries(x.semantic).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}. Landmarks tell parsers which part is the content.`));

  const navGood = x.navTexts.filter(t => t.length >= 3 && !/^(click here|learn more|more|here|link)$/i.test(t)).length;
  C.push(check('nav', 'Descriptive navigation', 5, !x.navTexts.length ? 0.4 : navGood / x.navTexts.length,
    !x.navTexts.length ? 'No <nav> links found.' : `${navGood} of ${x.navTexts.length} navigation links use descriptive labels.`));

  /* ---------------- ANSWERS ----------------
     Principle: can the page provide clean, self-contained answers?
     The core signals (answer-first opening, self-contained paragraphs, substance, concision)
     carry 75 points. FAQs, question headings and definitions are supporting signals only:
     a clear homepage that explains itself directly should score well without any of them. */
  const N = [];
  const firstP = x.paragraphs[0] || '';
  const fpWords = words(firstP).length;
  const firstDeclarative = /\b(is|are|helps?|lets?|makes?|means|gives?|provides?|we)\b/i.test(firstP) && !/\?$/.test(firstP);
  const namesSiteFirst = !!firstP && !!siteName && firstP.toLowerCase().includes(String(siteName).toLowerCase()) && !/\?$/.test(firstP);
  const opensWell = !!firstP && fpWords >= 8 && fpWords <= 60 && (firstDeclarative || namesSiteFirst);
  N.push(check('answer-first', 'Opens with a direct answer', 25, !firstP ? 0 : opensWell ? 1 : fpWords > 60 ? 0.5 : 0.4,
    !firstP ? 'No opening paragraph found in the main content.' : opensWell ? `The first paragraph is ${/^(8|11|18|8[0-9])$/.test(String(fpWords)) ? 'an' : 'a'} ${fpWords}-word direct statement — easy to quote.` : fpWords > 60 ? `The first paragraph runs ${fpWords} words. Lead with a one- or two-sentence answer, then expand.` : 'The first paragraph is short or not a statement. Start with the answer to "what is this?"',
    { evidence: firstP ? clip(firstP, 200) : undefined }));

  const chunks = x.paragraphs.filter(p => { const n = words(p).length; return n >= 25 && n <= 120; }).length;
  N.push(check('chunks', 'Self-contained paragraphs', 25, chunks >= 4 ? 1 : chunks >= 2 ? 0.6 : chunks === 1 ? 0.35 : 0.1,
    chunks >= 4 ? `${chunks} paragraphs are the size (25–120 words) that answer engines lift cleanly.` : `Only ${chunks} paragraph${chunks === 1 ? '' : 's'} of 25–120 words. Most text is either fragments or walls.`));

  N.push(check('depth', 'Enough substance to answer from', 15, x.wordCount >= 300 ? 1 : x.wordCount >= 150 ? 0.6 : 0.2,
    x.wordCount >= 300 ? `About ${x.wordCount} words of visible text.` : `About ${x.wordCount} words of visible text — thin. Engines need enough material to answer a question.`));

  const allSentences = sentences(x.paragraphs.join(' '));
  const avgSent = allSentences.length ? allSentences.reduce((s, t) => s + words(t).length, 0) / allSentences.length : 0;
  N.push(check('concise', 'Concise sentences', 10, !avgSent ? 0.3 : avgSent <= 22 ? 1 : avgSent <= 30 ? 0.6 : 0.3,
    avgSent ? `Average sentence length is ${Math.round(avgSent)} words.` : 'Not enough prose to measure.'));

  N.push(check('lists', 'Scannable lists', 10, x.listsWith3 >= 2 ? 1 : x.listsWith3 === 1 ? 0.7 : 0.35,
    x.listsWith3 ? `${x.listsWith3} list${x.listsWith3 > 1 ? 's' : ''} with three or more items.` : 'No lists with three or more items. Not required; steps, options and features usually read best as lists.'));

  // Supporting signals. When the page already explains itself directly, their absence costs little.
  const selfExplains = opensWell && chunks >= 2;
  const qHeadings = x.headings.filter(h => /\?$/.test(h.text) || /^(how|what|why|when|where|who|which|can|do|does|is|should)\b/i.test(h.text));
  N.push(check('question-headings', 'Question-shaped headings', 6, qHeadings.length >= 2 ? 1 : qHeadings.length === 1 ? 0.75 : selfExplains ? 0.5 : 0.25,
    qHeadings.length ? `${qHeadings.length} heading${qHeadings.length > 1 ? 's' : ''} phrased as a question, e.g. "${clip(qHeadings[0].text, 60)}".` : 'No headings phrased as questions. Optional: where a section answers a question people actually ask, a question heading makes the match explicit.'));

  const faq = x.ldTypes.some(t => /FAQPage/i.test(t)) || x.headings.some(h => /\b(faq|frequently asked|common questions|questions)\b/i.test(h.text));
  N.push(check('faq', 'Q&A content', 5, faq ? 1 : selfExplains ? 0.6 : 0.3,
    faq ? 'The page has Q&A content' + (x.ldTypes.some(t => /FAQPage/i.test(t)) ? ' with FAQPage structured data.' : '.') : 'No Q&A content found. Not inherently a problem. If customers commonly ask specific questions about this page’s topic, answering them directly can make the content easier to extract.'));

  const defs = x.paragraphs.filter(p => /^[A-Z][^.]{2,60}\b(is|are|means|refers to)\b\s+(a|an|the|when|how)\b/i.test(p)).length;
  N.push(check('definitions', 'Defines its key terms', 4, defs >= 1 ? 1 : selfExplains ? 0.6 : 0.3,
    defs ? `${defs} definition-style sentence${defs > 1 ? 's' : ''} ("X is a…").` : 'No definition-style sentences. Optional: one plain "X is a …" sentence for your product or key term is easy to quote, but do not force it.'));

  /* ---------------- TRUST ---------------- */
  const T = [];
  const hasAbout = x.linkMatch(/\/about|about[- ]us|our[- ]story|who we are|\bteam\b/i);
  T.push(check('about', 'About page is linked', 15, hasAbout ? 1 : 0,
    hasAbout ? 'An About page is linked.' : 'No link to an About page. Engines use it to establish who is behind the site.'));
  const hasContact = x.linkMatch(/\/contact|contact[- ]us|mailto:|tel:|get in touch|support/i);
  T.push(check('contact', 'Contact path exists', 15, hasContact ? 1 : 0,
    hasContact ? 'A contact link, email or phone number is present.' : 'No contact link, email or phone number found.'));

  const orgLd = x.ldNode('Organization|LocalBusiness|Person|Corporation');
  const identity = orgLd ? 1 : x.copyright && x.address ? 0.8 : x.copyright || x.address ? 0.5 : 0.15;
  T.push(check('identity', 'Organization identity is stated', 15, identity,
    orgLd ? `Structured data identifies "${orgLd.name || siteName}" as the organization.` : x.copyright ? `A copyright line names "${clip(x.copyright, 40)}"${x.address ? ' and an address is listed' : ', but no address or Organization schema'}.` : 'Nothing on the page states who owns or runs it.'));

  const validLd = x.jsonld.filter(n => !n.__invalid);
  const useful = x.ldTypes.filter(t => /Organization|WebSite|LocalBusiness|Article|FAQPage|Product|Service|Person|BreadcrumbList|SoftwareApplication/i.test(t));
  T.push(check('schema', 'Structured data (JSON-LD)', 15, useful.length ? 1 : validLd.length ? 0.6 : x.jsonld.length ? 0.2 : 0.1,
    useful.length ? `Found ${[...new Set(useful)].slice(0, 4).join(', ')} structured data.` : validLd.length ? `JSON-LD present (${[...new Set(x.ldTypes)].slice(0, 3).join(', ') || 'untyped'}) but no Organization, WebSite, FAQPage or Article types.` : x.jsonld.length ? 'JSON-LD block found but it does not parse.' : 'No JSON-LD structured data. Optional, but Organization or WebSite schema is a cheap, unambiguous way to state who you are.'));

  const hasDate = x.timeTags > 0 || x.dateText || x.jsonld.some(n => n.dateModified || n.datePublished);
  T.push(check('dates', 'Freshness signals', 10, hasDate ? 1 : 0.5,
    hasDate ? 'The page carries a date (time element, "updated" text, or dateModified).' : 'No visible date or dateModified. Optional for a homepage, important for articles.'));

  const hasAuthor = !!(x.authorMeta || x.ldAuthor || x.byline);
  T.push(check('author', 'People behind the content', 10, hasAuthor ? 1 : 0.5,
    hasAuthor ? 'An author or byline is present.' : 'No author or byline. Optional for a business homepage, important for guides and articles.'));

  const refs = x.externalNonSocial.length;
  const sameAs = orgLd && Array.isArray(orgLd.sameAs) ? orgLd.sameAs.length : 0;
  T.push(check('references', 'Links out to sources or profiles', 10, refs >= 2 || sameAs >= 2 ? 1 : refs + sameAs >= 1 ? 0.6 : 0.2,
    refs || sameAs ? `${refs} outbound link${refs === 1 ? '' : 's'}${x.socialLinks.length ? ` and ${x.socialLinks.length} social profile${x.socialLinks.length > 1 ? 's' : ''}` : ''}.` : 'No outbound links or social profiles. Pages that exist in isolation are harder to corroborate.'));

  const legal = x.linkMatch(/privacy|terms|legal|imprint|impressum/i);
  T.push(check('legal', 'Privacy or terms page', 10, legal ? 1 : 0.3,
    legal ? 'Privacy or terms page is linked.' : 'No privacy or terms link. A small but consistent credibility signal.'));

  /* ---------------- Extra, unweighted findings ---------------- */
  const extras = [];
  extras.push(check('llms-txt', 'llms.txt', 0, llmsTxtFound ? 1 : 0,
    llmsTxtFound ? 'An /llms.txt file exists. This is an emerging convention and does not affect your score.' : 'No /llms.txt. It is an emerging, optional convention — nice to have, not scored.'));
  if (x.imgs) extras.push(check('alt', 'Image alt text', 0, x.imgsNoAlt ? 0 : 1, x.imgsNoAlt ? `${x.imgsNoAlt} of ${x.imgs} images have no alt attribute.` : `All ${x.imgs} images have alt attributes.`));
  extras.push(check('lang', 'Language declared', 0, x.lang ? 1 : 0, x.lang ? `<html lang="${x.lang}">` : 'No lang attribute on <html>.'));
  if (blockedTraining.length) extras.push(check('training-bots', 'AI training crawlers', 0, 1, `robots.txt blocks ${blockedTraining.join(', ')}. This opts out of model training and is not scored.`));
  extras.push(check('size', 'HTML size', 0, x.htmlBytes < 500000 ? 1 : 0, `${Math.round(x.htmlBytes / 1024)} KB of HTML.`));

  /* ---------------- Assemble ---------------- */
  const cats = {
    access: { name: 'Access', question: 'Can AI reach this page?', checks: A },
    clarity: { name: 'Clarity', question: 'Can a machine tell what this site does?', checks: C },
    answers: { name: 'Answers', question: 'Does the page answer questions directly?', checks: N },
    trust: { name: 'Trust', question: 'Is there enough context to cite it?', checks: T }
  };
  for (const c of Object.values(cats)) c.score = catScore(c.checks);
  // Gating: if the page cannot be fetched or is told not to be indexed, nothing else can compensate.
  const unreachable = status !== 200;
  const deindexed = noindex || !!robotsAll || blockedSearch.length >= 3;
  if (unreachable) cats.access.score = Math.min(cats.access.score, 30);
  else if (deindexed) cats.access.score = Math.min(cats.access.score, 45);
  else if (blockedSearch.length >= 1) cats.access.score = Math.min(cats.access.score, 65);
  cats.access.gate = unreachable ? 'unreachable' : deindexed ? 'deindexed' : null;
  if (unreachable) {
    // The content we got is an error/challenge page, so content categories are not meaningful.
    for (const k of ['clarity', 'answers', 'trust']) { cats[k].score = 0; cats[k].notEvaluated = true; cats[k].checks = []; }
  }
  for (const c of Object.values(cats)) { c.grade = c.notEvaluated ? '–' : grade(c.score); c.label = c.notEvaluated ? 'Not evaluated' : categoryLabel(c); }

  const overall = Math.round(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + cats[k].score * w, 0));

  /* ---------------- What AI sees ---------------- */
  const topicPool = [...h2s.map(h => h.text), ...x.headings.filter(h => h.level === 3).map(h => h.text)]
    .map(t => t.replace(/[?:.!]+$/, '').trim()).filter(t => words(t).length >= 1 && t.length <= 48 && !/^(faq|contact|about|home|menu|footer|links?)$/i.test(t) && !/\b(menu|navigation|cookie|skip to)\b/i.test(t));
  const topics = [...new Set(topicPool)].slice(0, 4);
  let confidence = 'low';
  // High only when the sentence names the site itself, or comes from the description/H1 with a strong score.
  const namesSite = purpose && nameRe && nameRe.test(purpose);
  if (purpose && purposeRatio >= 0.75 && (namesSite || (['meta description', 'main heading'].includes(purposeSource) && ranked[0].sc >= 3))) confidence = 'high';
  else if (purpose) confidence = 'medium';
  const unclear = !purpose;
  // Grounding: `purpose` is a verbatim sentence from the page; `source` says where it came from.
  // The summary hedges when confidence is not high and never rewrites the page's words.
  const quoted = purpose ? truncate(purpose, 140) : null;
  const whatAiSees = {
    siteName,
    purpose: quoted,
    source: purposeSource,
    verbatim: true,
    audience: audience ? truncate(audience, 60) : null,
    topics,
    confidence,
    unclear,
    summary: quoted
      ? (confidence === 'high' ? quoted : `Appears to be about: ${quoted}`)
      : unreachable ? `We couldn’t load ${siteName} (HTTP ${status || 'error'}), so there is nothing for AI to read.` : `We couldn’t confidently tell what ${siteName} does from this page.`
  };

  /* ---------------- Fixes ---------------- */
  const fixes = (unreachable ? f => f.filter(z => z.category === 'access') : f => f)(buildFixes({ cats, x, siteName, purpose, desc, h1, audience, blockedSearch, noindex, robotsTxt, finalUrl, status, robotsAll, sitemapFound }));

  return {
    ok: true,
    url, finalUrl, domain: x.host || safeHost(finalUrl), scannedAt: new Date().toISOString(),
    score: overall, grade: grade(overall), status: statusLabel(overall, cats.access.score),
    categories: cats,
    whatAiSees,
    fixes: fixes.slice(0, 3),
    moreFixes: fixes.slice(3, 8),
    extras,
    meta: { title: x.title, description: desc, h1: x.h1s, wordCount: x.wordCount, httpStatus: status, fetchMs, redirectCount, lang: x.lang, ldTypes: [...new Set(x.ldTypes)] }
  };
}

function safeHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

function categoryLabel(c) {
  const fails = c.checks.filter(k => k.status === 'fail');
  const s = c.score;
  const by = {
    access: s >= 90 ? 'Reachable' : s >= 75 ? 'Mostly reachable' : s >= 50 ? 'Partly blocked' : 'Hard to reach',
    clarity: s >= 90 ? 'Clear' : s >= 75 ? 'Mostly clear' : s >= 50 ? 'Somewhat vague' : 'Vague',
    answers: s >= 90 ? 'Answers directly' : s >= 75 ? 'Fairly direct' : s >= 50 ? 'Could answer more directly' : 'Few direct answers',
    trust: s >= 90 ? 'Well sourced' : s >= 75 ? 'Good signals' : s >= 50 ? 'Some signals missing' : 'Little context'
  };
  if (c.name === 'Access') {
    const failed = new Set(fails.map(f => f.id));
    if (failed.has('status')) return 'Unreachable';
    if (failed.has('noindex') || failed.has('ai-bots') || failed.has('robots')) return 'Blocked';
    if (failed.has('rendered')) return s >= 60 ? 'Reachable, little text' : 'Little to read';
  }
  return by[c.name.toLowerCase()];
}

/* ------------------------------------------------------------------ */
/* Fix generation — grounded in the page, never invents facts         */
/* ------------------------------------------------------------------ */

function buildFixes(ctx) {
  const { cats, x, siteName, purpose, desc, h1, audience, blockedSearch, noindex, robotsTxt, finalUrl, status, robotsAll, sitemapFound } = ctx;
  const F = [];
  const get = (cat, id) => cats[cat].checks.find(c => c.id === id);
  const add = (cat, id, fix) => {
    const c = get(cat, id);
    if (!c || c.status === 'pass') return;
    const lost = (c.weight - c.points) * WEIGHTS[cat];
    F.push({ id, category: cat, categoryName: cats[cat].name, impact: Math.round(lost * 10) / 10, ...fix });
  };
  const P = s => `[${s}]`; // explicit placeholder — never invented facts
  const name = siteName && siteName !== x.host ? siteName : P('Your brand name');
  const nameIn = t => !!(t && siteName && new RegExp(siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t));
  // A page sentence we can reuse as-is (it already names the site), else null.
  const reusable = purpose && nameIn(purpose) && words(purpose).length <= 40 ? purpose : null; // only the vetted purpose sentence
  const bestSentence = purpose || desc || null;
  const pattern = `${name} is ${P('a / an')} ${P('category')} that ${P('does what')} for ${audience || P('who')}.`;
  const quoteNote = bestSentence && !reusable ? `\n\n<!-- Your clearest existing sentence: "${clip(bestSentence, 160)}"\n     Rewrite it so it starts with ${name} and says what it is. -->` : '';

  add('access', 'status', {
    title: 'Get the page to return 200 OK',
    why: `The server returned HTTP ${status || 'error'}. Nothing else matters until crawlers can load the page.`,
    effort: 'Medium', evidence: 'Strong',
    action: { label: 'What to check', kind: 'text', content: `Open ${finalUrl} in a private window and confirm it loads.\nCheck hosting/DNS status and any firewall or bot-protection rules (Cloudflare "Bot Fight Mode", WAF challenges) that may be blocking automated requests.\nMake sure the homepage is not behind a login, geoblock, or age gate.` }
  });
  add('access', 'noindex', {
    title: 'Remove the noindex directive',
    why: 'A noindex tag tells every engine to drop this page. AI search cannot cite what it is told to forget.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show the fix', kind: 'code', content: `<!-- Remove this from <head>: -->\n<meta name="robots" content="noindex">\n\n<!-- Or, if it is a header, remove: -->\nX-Robots-Tag: noindex\n\n<!-- Safe default if you want one: -->\n<meta name="robots" content="index, follow">` }
  });
  add('access', 'ai-bots', {
    title: `Unblock ${blockedSearch.slice(0, 2).join(' and ')}${blockedSearch.length > 2 ? ` and ${blockedSearch.length - 2} more` : ''} in robots.txt`,
    why: 'These crawlers fetch pages for live answers. Blocking them means the answer engine cannot read your site, no matter how good the content is.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show robots.txt fix', kind: 'code', content: `# robots.txt — allow answer-engine crawlers\n${blockedSearch.map(b => `User-agent: ${b}\nAllow: /`).join('\n\n')}\n\n# Blocking training crawlers (GPTBot, ClaudeBot, Google-Extended) is a separate\n# decision and does not affect answer-engine access.` }
  });
  add('access', 'robots', robotsAll ? {
    title: 'Stop robots.txt from blocking everyone',
    why: 'Your robots.txt disallows all crawlers from this page.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show robots.txt fix', kind: 'code', content: `User-agent: *\nAllow: /\n\nSitemap: ${originOf(finalUrl)}/sitemap.xml` }
  } : {
    title: 'Add a simple robots.txt',
    why: 'Not required, but it tells crawlers you are open and points them to your sitemap.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Show robots.txt', kind: 'code', content: `User-agent: *\nAllow: /\n\nSitemap: ${originOf(finalUrl)}/sitemap.xml` }
  });
  add('access', 'rendered', !x.jsApp && status === 200 ? {
    title: 'Give the homepage real text',
    why: `About ${x.wordCount} words are visible. There is very little for an AI system to read, let alone quote.`,
    effort: 'Medium', evidence: 'Strong',
    action: { label: 'What to add', kind: 'text', content: 'Add short sections that answer: what it is, who it is for, how it works, what it costs. Aim for 300–800 words of real information, in HTML paragraphs rather than images.' }
  } : {
    title: 'Put your main content in the HTML, not only in JavaScript',
    why: `Only about ${x.wordCount} words are present before JavaScript runs. Several AI crawlers do not execute JavaScript, so they see a nearly blank page.`,
    effort: 'Hard', evidence: 'Strong',
    action: { label: 'What to do', kind: 'text', content: `Use server-side rendering or static generation for the homepage (Next.js, Astro, Nuxt, SvelteKit, Hugo, or plain HTML all work).\nAt minimum, render the H1, the opening paragraph, and navigation in the initial HTML.\nTest with "view source" — if you cannot find your headline there, neither can most crawlers.` }
  });
  add('access', 'sitemap', {
    title: 'Publish a sitemap.xml and reference it in robots.txt',
    why: 'A sitemap helps crawlers find every page, not just the ones linked from the homepage.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Show sitemap', kind: 'code', content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${originOf(finalUrl)}/</loc></url>\n  <!-- add one <url> per public page -->\n</urlset>\n\n# then in robots.txt:\nSitemap: ${originOf(finalUrl)}/sitemap.xml` }
  });
  add('access', 'https', {
    title: 'Serve the site over HTTPS',
    why: 'Modern crawlers prefer HTTPS and some refuse plain HTTP entirely.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'What to do', kind: 'text', content: 'Most hosts (Cloudflare, Netlify, Vercel, GitHub Pages) provide free certificates. Enable HTTPS, then redirect http:// to https:// with a single 301.' }
  });

  // CLARITY
  const suggestedH1 = purpose && !h1 ? truncate(purpose.split(/(?<=[.!?])\s/)[0].replace(/[.]$/, ''), 70) : desc ? truncate(desc.split(/[.!?]/)[0], 70) : `${name} ${P('does what')} for ${audience || P('who')}`;
  add('clarity', 'h1', {
    title: h1 ? 'Make the H1 say what you do' : 'Add one clear H1',
    why: h1 ? `Your H1 is "${clip(h1, 60)}". Machines treat the H1 as the topic of the page; a greeting or slogan gives them nothing.` : 'There is no H1. The H1 is the sentence engines treat as "what this page is about".',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show a better H1', kind: 'code', content: `<h1>${suggestedH1}</h1>\n\n<!-- Pattern: [what you offer] for [who it is for].\n     Anything in [brackets] is a placeholder — we did not find that fact on your page. -->` }
  });
  add('clarity', 'purpose', {
    title: 'Say what you do in one plain sentence near the top',
    why: purpose ? 'The top of the page relies on vague language. Concrete nouns and verbs tell AI what you actually offer.' : 'The first screen does not state what this site sells or does. AI systems and first-time visitors should not have to infer it.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Write a clearer sentence', kind: 'code', content: `<p>${reusable || pattern}</p>${quoteNote}\n\n<!-- Put this directly under the H1. One sentence, no adjectives you would not say out loud. -->` }
  });
  add('clarity', 'title', {
    title: x.title ? 'Rewrite the page title' : 'Add a page title',
    why: x.title ? `The title is "${clip(x.title, 50)}". It should name the site and what it does.` : 'The page has no <title>, which is the first thing every engine reads.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Suggest a title', kind: 'code', content: `<title>${name} – ${purpose ? clip(purpose.replace(/[.]$/, ''), 45) : P('what you do in 5–7 words')}</title>` }
  });
  add('clarity', 'description', {
    title: desc ? 'Tighten the meta description' : 'Add a meta description',
    why: 'Engines use it as your one-line summary when they have nothing better.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Suggest a description', kind: 'code', content: `<meta name="description" content="${purpose ? clip(purpose, 150) : `${name} ${P('what it does')} for ${audience || P('who')}. ${P('one concrete detail')}.`}">` }
  });
  add('clarity', 'audience', {
    title: 'Say who the site is for',
    why: 'Answer engines match pages to questions partly by audience. "For freelancers" or "for clinics" is a cheap, high-value signal.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Show an example', kind: 'text', content: `Add a short line under the headline:\n"Built for ${P('audience')} who ${P('need / want')} ${P('outcome')}."` }
  });
  add('clarity', 'sitename', {
    title: 'Declare the site name explicitly',
    why: `We inferred the name "${name}". Making it explicit removes guesswork for every engine.`,
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Show the code', kind: 'code', content: `<meta property="og:site_name" content="${name}">\n<script type="application/ld+json">\n{ "@context": "https://schema.org", "@type": "WebSite", "name": "${name}", "url": "${originOf(finalUrl)}/" }\n</script>` }
  });
  add('clarity', 'headings', {
    title: 'Use H2 headings to outline the page',
    why: 'Headings are how machines split a page into topics. Without them the page is one undifferentiated block.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show stronger headings', kind: 'text', content: `Give each section a heading that would make sense on its own, for example:\n• What ${name} does\n• Who it is for\n• How it works\n• Pricing\n• Questions people ask` }
  });
  add('clarity', 'semantic', {
    title: 'Add semantic landmarks',
    why: 'main, nav, header and footer tell parsers which part is the content and which is chrome.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Show the structure', kind: 'code', content: `<header>…logo and <nav>…</nav></header>\n<main>\n  <h1>…</h1>\n  …page content…\n</main>\n<footer>…</footer>` }
  });

  // ANSWERS
  add('answers', 'answer-first', {
    title: 'Open with a direct answer',
    why: 'Answer engines quote the first clean, self-contained paragraph. Yours is missing, too short, or too long.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Draft an answer-first paragraph', kind: 'code', content: `<p>${reusable || pattern} ${P('One sentence on how it works or what makes it different.')}</p>${quoteNote}` }
  });
  add('answers', 'question-headings', {
    title: 'Consider phrasing a heading or two as questions',
    why: 'Only where a section genuinely answers a question people ask. "What does it cost?" followed by a direct answer is easy to extract; do not retrofit every heading.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show example headings', kind: 'text', content: `• What is ${name}?\n• Who is it for?\n• How does it work?\n• What does it cost?\n• How is it different from ${P('alternative')}?` }
  });
  add('answers', 'faq', {
    title: 'Answer common questions directly',
    why: 'Not required. If customers ask the same few questions about this page’s topic, three to six short, direct answers give engines ready-made quotes.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show FAQ markup', kind: 'code', content: `<section>\n  <h2>Questions people ask</h2>\n  <h3>What is ${name}?</h3>\n  <p>${P('Two-sentence answer.')}</p>\n  <h3>Who is it for?</h3>\n  <p>${P('Two-sentence answer.')}</p>\n</section>\n\n<script type="application/ld+json">\n{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [\n  { "@type": "Question", "name": "What is ${name}?", "acceptedAnswer": { "@type": "Answer", "text": "${P('answer')}" } }\n] }\n</script>` }
  });
  add('answers', 'chunks', {
    title: 'Write self-contained paragraphs',
    why: 'Most of your text is either one-line fragments or long blocks. Paragraphs of 25–120 words that make sense on their own are what gets quoted.',
    effort: 'Medium', evidence: 'Moderate',
    action: { label: 'How to do it', kind: 'text', content: 'For each section: one heading, then one paragraph that could stand alone if copied out. Name the subject in the first sentence instead of using "it" or "this".' }
  });
  add('answers', 'lists', {
    title: 'Turn steps and options into lists',
    why: 'Where content is naturally a sequence or a set of options, a list is easier to extract and to scan.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Example', kind: 'code', content: `<h2>How it works</h2>\n<ol>\n  <li>${P('Step one')}</li>\n  <li>${P('Step two')}</li>\n  <li>${P('Step three')}</li>\n</ol>` }
  });
  add('answers', 'definitions', {
    title: 'State plainly what your product or key term is',
    why: 'Optional. One natural "X is a …" sentence is easy to quote. Do not turn the page into a glossary.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Example', kind: 'text', content: `"${name} is a ${P('category')} that ${P('does what')}."\n"${P('Your key term')} is ${P('a one-sentence definition')}."` }
  });
  if (get('access', 'rendered').status === 'pass' || x.jsApp) add('answers', 'depth', {
    title: 'Give the page more substance',
    why: `About ${x.wordCount} words is thin. Engines cannot answer questions from content that is not there.`,
    effort: 'Medium', evidence: 'Strong',
    action: { label: 'What to add', kind: 'text', content: 'Add sections that answer: what it is, who it is for, how it works, what it costs, and how it compares. Aim for 300–800 words of real information on the homepage.' }
  });
  add('answers', 'concise', {
    title: 'Shorten your sentences',
    why: 'Long sentences are harder to quote accurately. Aim for under 22 words on average.',
    effort: 'Medium', evidence: 'Moderate',
    action: { label: 'How', kind: 'text', content: 'Split any sentence with more than one "and", "which", or comma clause. One idea per sentence.' }
  });

  // TRUST
  add('trust', 'about', {
    title: 'Link to an About page',
    why: 'Engines look for who is behind a site before treating it as a source.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'What to include', kind: 'text', content: `Create /about/ with: who runs ${name}, since when, where you are based, and how to reach you. Link it from the header or footer.` }
  });
  add('trust', 'contact', {
    title: 'Add a visible contact path',
    why: 'A contact page, email, or phone number is a basic legitimacy signal for engines and people.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Example', kind: 'code', content: `<footer>\n  <a href="/contact/">Contact</a> · <a href="mailto:${P('you@yourdomain')}">${P('you@yourdomain')}</a>\n</footer>` }
  });
  add('trust', 'identity', {
    title: x.copyright ? 'Make the owner explicit' : 'State who owns the site',
    why: x.copyright ? `A copyright line names "${clip(x.copyright, 40)}", but there is no address or Organization structured data to confirm it.` : 'Nothing on the page says which organization or person is behind it.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show a trust block', kind: 'code', content: `<footer>\n  <p>© ${new Date().getFullYear()} ${name}. ${P('City, Country')}.</p>\n  <p><a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a></p>\n</footer>` }
  });
  add('trust', 'schema', {
    title: 'Add Organization and WebSite structured data',
    why: 'Optional, but JSON-LD is an unambiguous way to state your name, logo and official links to engines that read it.',
    effort: 'Easy', evidence: 'Strong',
    action: { label: 'Show JSON-LD', kind: 'code', content: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@graph": [\n    { "@type": "Organization", "name": "${name}", "url": "${originOf(finalUrl)}/", "logo": "${originOf(finalUrl)}/${P('logo.png')}",\n      "sameAs": [${[...new Set(x.socialLinks.map(l => l.href.replace(/\/$/, '')))].slice(0, 3).map(h => `"${h}"`).join(', ') || `"${P('https://linkedin.com/company/…')}"`}] },\n    { "@type": "WebSite", "name": "${name}", "url": "${originOf(finalUrl)}/" }\n  ]\n}\n</script>` }
  });
  add('trust', 'references', {
    title: 'Link to your profiles and sources',
    why: 'Pages with no outbound links are harder to corroborate. Social profiles and sources you cite both help.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'What to add', kind: 'text', content: 'Link your official profiles (LinkedIn, GitHub, X, etc.) in the footer and in Organization sameAs. When you state facts or numbers, link the source.' }
  });
  add('trust', 'legal', {
    title: 'Add a privacy or terms page',
    why: 'A small, consistent credibility signal that engines and people both check.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'What to do', kind: 'text', content: 'Publish /privacy/ (what you collect and why) and link it from the footer.' }
  });
  add('trust', 'dates', {
    title: 'Show when content was last updated',
    why: 'Engines prefer fresh sources. Optional for a homepage, important for articles and guides.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Example', kind: 'code', content: `<p>Last updated <time datetime="${new Date().toISOString().slice(0, 10)}">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time></p>` }
  });
  add('trust', 'author', {
    title: 'Name the people behind the content',
    why: 'Bylines and author pages let engines judge expertise. Optional for a business homepage.',
    effort: 'Easy', evidence: 'Moderate',
    action: { label: 'Example', kind: 'code', content: `<p>By <a href="/about/">${P('Name')}</a>, ${P('role')} at ${name}</p>` }
  });

  // Order by points lost (impact). Gating problems (unreachable, blocked, JS-only shell) always come first,
  // because content fixes are moot until crawlers can actually read the page.
  const GATES = ['status', 'noindex', 'ai-bots', ...(robotsAll ? ['robots'] : []), ...(get('access', 'rendered').status === 'fail' && x.jsApp ? ['rendered'] : [])];
  return F.sort((a, b) => {
    const ga = GATES.indexOf(a.id), gb = GATES.indexOf(b.id);
    const pa = ga === -1 ? 99 : ga, pb = gb === -1 ? 99 : gb;
    return pa !== pb ? pa - pb : b.impact - a.impact;
  });
}

function originOf(u) { try { return new URL(u).origin; } catch { return 'https://example.com'; } }
