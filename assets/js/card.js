/* ============================================================
   Aeoden — the AEO Card
   One compact object with four states: example, loading, result, error.
   The same card is the homepage placeholder and the scan result, so a
   scan fills it in place. Swiss editorial: white, one green ramp,
   one typeface, receipt alignment (labels left, values right).
   ============================================================ */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stateOf = score => (score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'mixed' : 'poor');
  const CATS = ['access', 'clarity', 'answers', 'trust'];
  const WEAK = g => g === 'C' || g === 'D' || g === 'F';

  /* Green ramp + neutrals (mirrors tokens.css) */
  /* Export palette: forest, cream, lime (mirrors .theme-forest) */
  const C = { bg: '#12372A', frame: '#0E2E22', line: '#2A5646', ink: '#EEF4E2', ink2: '#D6E3CB', ink3: '#A9BFAC',
    g50: '#214F3D', g100: '#2D5B48', g200: '#4C7A4F', g500: '#A3D93F', g600: '#B3E25A', g700: '#C6EC7E', g900: '#EEF4E2',
    warn: '#F2B65B', bad: '#FF9478', green: '#A3D93F', cream: '#E4F0D0' };
  const toneOf = score => (score >= 80 ? 'good' : score >= 70 ? 'mixed' : 'poor');
  const gradeColor = g => (g === 'C' ? C.warn : g === 'D' || g === 'F' ? C.bad : C.ink);

  const FIX_SHARE = {
    chunks: 'Write one self-contained paragraph explaining what the site does.',
    'answer-first': 'Open the homepage with one sentence that says what you do.',
    purpose: 'Say what the site does in one plain sentence near the top.',
    h1: 'Make the H1 a plain statement of what the site offers.',
    title: 'Rewrite the page title to name the site and what it does.',
    description: 'Add a meta description that says what the site does.',
    audience: 'Say who the site is for, near the top of the page.',
    rendered: 'Put the homepage text in the HTML, not only in JavaScript.',
    noindex: 'Remove the noindex tag so answer engines can use this page.',
    about: 'Link an About page that says who runs the site.',
    contact: 'Add a visible contact link or email address.',
    identity: 'State who owns the site, with Organization structured data.',
    schema: 'Add Organization and WebSite structured data.',
    faq: 'Answer the questions customers ask most, in plain sentences.',
    'question-headings': 'Phrase key section headings as the questions people ask.',
    lists: 'Turn steps and options into short lists.',
    depth: 'Explain what it is, who it is for, how it works and what it costs.',
    sitemap: 'Publish a sitemap.xml and list it in robots.txt.',
    legal: 'Link a privacy page from the footer.',
    definitions: 'Define the product in one plain "X is a …" sentence.',
    concise: 'Cut sentences to under 22 words.'
  };
  const fixText = r => { const f = r.fixes && r.fixes[0]; return f ? (FIX_SHARE[f.id] || f.title) : 'Nothing urgent. Keep the content current.'; };

  /* 6. Short interpretation for share formats: a verbatim prefix of the page's own sentence (grounding rule) */
  function shortInterp(r, max = 64) {
    const w = r.whatAiSees;
    if (w.unclear) return 'Unclear from the homepage.';
    let t = String(w.purpose || '').trim();
    const cut = t.search(/\s(that|which|who|so that|where)\s|[,;:—–]\s|\s-\s/i);
    if (cut > 18) t = t.slice(0, cut).trim();
    if (t.length > max) { t = t.slice(0, max); t = t.slice(0, t.lastIndexOf(' ')).replace(/[,;:\-–]$/, ''); }
    t = t.replace(/[.]$/, '');
    const complete = t.length >= String(w.purpose || '').replace(/[.]$/, '').length;
    return (w.confidence === 'high' ? '' : 'Appears to be: ') + t + (complete ? '.' : '…');
  }

  const isoDate = iso => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
  function recordId(r) {
    if (r.demo) return 'CA-01';
    const key = (r.domain || '') + isoDate(r.scannedAt);
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'CA-' + ((h >>> 0) % 46656).toString(36).toUpperCase().padStart(3, '0');
  }
  const statusWord = r => (r.demo ? 'SAMPLE' : 'COMPLETE');
  const srcWord = s => String(s || 'page text').toUpperCase();

  // Long domains break at dots; the size is driven by the longest line.
  const domainLines = d => String(d).split(/(?<=\.)/).reduce((a, p) => { if (a.length && (a[a.length - 1] + p).length <= 16) a[a.length - 1] += p; else a.push(p); return a; }, []);


  /* Brand mark: a bold C nested in a checkmark, its lower edge following the check's V at a constant gap.
     Flat, two colours (or one). viewBox 0 4 104 94 */
  const MARK_ON_CREAM = '<path d="M69 13H23V36.59L40 53.59L57.00 36.59" fill="none" stroke="#12372A" stroke-width="14" stroke-linejoin="miter" stroke-miterlimit="4"/><path d="M8 52L40 84L96 28" fill="none" stroke="#5E9A1E" stroke-width="15" stroke-linejoin="miter" stroke-miterlimit="4"/>';
  const MARK_ON_FOREST = '<path d="M69 13H23V36.59L40 53.59L57.00 36.59" fill="none" stroke="#EEF4E2" stroke-width="14" stroke-linejoin="miter" stroke-miterlimit="4"/><path d="M8 52L40 84L96 28" fill="none" stroke="#A3D93F" stroke-width="15" stroke-linejoin="miter" stroke-miterlimit="4"/>';
  const markSVG = (onDark = false) => `<svg class="logo-mark" viewBox="0 4 104 94" aria-hidden="true" focusable="false">${onDark ? MARK_ON_FOREST : MARK_ON_CREAM}</svg>`;
  const glyphAt = (x, y, h, onDark = false) => `<g transform="translate(${x} ${y}) scale(${h / 94}) translate(0 -4)">${onDark ? MARK_ON_FOREST : MARK_ON_CREAM}</g>`;

  function scannedLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return 'Scanned today';
    return 'Scanned ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const bar = (score, n = 20) => Array.from({ length: n }, (_, i) => `<i${i < Math.round(score / (100 / n)) ? ' class="on"' : ''}></i>`).join('');

  /* ---------------- On-page card ---------------- */
  function renderCardHTML(r) {
    if (r.blocked) return renderCardBlocked(r);
    const fix = fixText(r);
    const rows = CATS.map(k => {
      const c = r.categories[k];
      return `<li class="acard__row${WEAK(c.grade) ? ' is-weak' : ''}"><span class="acard__k">${esc(c.name)}</span><span class="acard__l">${esc(c.label)}</span><span class="acard__g" aria-label="grade ${esc(c.grade)}">${esc(c.grade)}</span></li>`;
    }).join('');
    return `<article class="acard" data-mode="${r.demo ? 'example' : 'result'}" data-tone="${toneOf(r.score)}" aria-labelledby="acard-domain">
      <header class="acard__head"><span class="acard__kick">${r.demo ? 'Example result' : 'Your result'}</span><span class="acard__date">${r.demo ? 'Sample, not a live scan' : esc(scannedLabel(r.scannedAt))}</span></header>
      <div class="acard__body">
        <div class="acard__main">
          <h2 class="acard__domain" id="acard-domain">${esc(r.domain).replace(/\./g, '.<wbr>')}</h2>
          ${knownLine(r)}
          <div class="acard__readout">
            <p class="acard__score"><span class="acard__num" data-count="${r.score}">${r.score}</span><span class="acard__of">/100</span></p>
            <div class="acard__meta"><p class="acard__status">${esc(r.status)}<span class="acard__gradeword">Grade ${esc(r.grade)}</span></p><div class="acard__bar" aria-hidden="true">${bar(r.score)}</div></div>
          </div>
          <p class="sr-only">AEO score ${r.score} out of 100, grade ${esc(r.grade)}, ${esc(r.status)}.</p>
        </div>
        <div class="acard__side">
          <ul class="acard__rows" aria-label="Four checks">${rows}</ul>
        </div>
      </div>
      <div class="acard__fix"><span class="acard__fixlbl">First fix</span><p>${esc(fix)}</p></div>
    </article>`;
  }

  /* AI familiarity, in plain words */
  function knownText(f) {
    if (!f) return null;
    if (!f.known) return 'Not yet a known entity to AI';
    return `${f.level} to AI${f.sitelinks ? ` · ${f.sitelinks} Wikipedia editions` : ''}`;
  }
  const knownLine = r => { const t = knownText(r.familiarity); return t ? `<p class="acard__known${r.familiarity.known ? ' is-known' : ''}">${esc(t)}</p>` : ''; };

  /* Blocked scan: report what we could verify, never a made-up number */
  function renderCardBlocked(r) {
    const b = r.blocked, f = r.familiarity;
    const bots = b.allowedSearch == null ? 'We could not read its robots.txt either.' : `Its robots.txt allows ${b.allowedSearch} of ${b.searchTotal} AI search crawlers.`;
    return `<article class="acard" data-mode="blocked" aria-labelledby="acard-domain">
      <header class="acard__head"><span class="acard__kick">Couldn’t read this site</span><span class="acard__date">HTTP ${esc(b.status)}</span></header>
      <div class="acard__body acard__body--error">
        <div class="acard__main">
          <h2 class="acard__domain" id="acard-domain">${esc(r.domain).replace(/\./g, '.<wbr>')}</h2>
          ${knownLine(r)}
          <p class="acard__err">${esc(r.domain)} ${esc(b.reason)}. Large sites often block unknown bots, so this is <strong>not</strong> a sign that ChatGPT, Claude or Gemini are blocked. ${esc(bots)}</p>
          <p class="acard__err acard__err--quiet">We don’t score what we can’t read. If this is your site, allow <code>AeodenBot</code> in your bot protection and scan again.</p>
          <div class="acard__actions"><button class="btn btn--sm" type="button" id="retry-btn">Try again</button><button class="btn btn--ghost btn--sm" type="button" data-demo="">See an example</button></div>
        </div>
      </div>
    </article>`;
  }

  function renderCardLoading(domain) {
    const rows = CATS.map(k => `<li class="acard__row"><span class="acard__k">${k[0].toUpperCase() + k.slice(1)}</span><span class="acard__l">Checking…</span><span class="acard__g">·</span></li>`).join('');
    return `<article class="acard" data-mode="loading" aria-busy="true" aria-labelledby="acard-domain">
      <header class="acard__head"><span class="acard__kick">Checking</span><span class="acard__date" id="acard-step">Reaching the site</span></header>
      <div class="acard__body">
        <div class="acard__main">
          <h2 class="acard__domain" id="acard-domain">${esc(domain).replace(/\./g, '.<wbr>')}</h2>
          <div class="acard__readout">
            <p class="acard__score"><span class="acard__num">—</span><span class="acard__of">/100</span></p>
            <div class="acard__meta"><p class="acard__status">Reading the page</p><div class="acard__bar acard__bar--scan" aria-hidden="true">${bar(0)}</div></div>
          </div>
        </div>
        <div class="acard__side">
          <ul class="acard__rows" aria-label="Four checks">${rows}</ul>
        </div>
      </div>
      <div class="acard__fix acard__fix--idle"><span class="acard__fixlbl">First fix</span><p>Appears here in about 30 seconds.</p></div>
    </article>`;
  }

  function renderCardError(domain, message) {
    return `<article class="acard" data-mode="error" aria-labelledby="acard-domain">
      <header class="acard__head"><span class="acard__kick">Scan stopped</span><span class="acard__date"></span></header>
      <div class="acard__body acard__body--error">
        <div class="acard__main">
          <h2 class="acard__domain" id="acard-domain">${esc(domain).replace(/\./g, '.<wbr>')}</h2>
          <p class="acard__err">${esc(message)}</p>
          <div class="acard__actions"><button class="btn btn--sm" type="button" id="retry-btn">Try again</button><button class="btn btn--ghost btn--sm" type="button" data-demo="">See an example</button></div>
        </div>
      </div>
    </article>`;
  }

  /* ---------------- SVG export (square flagship · portrait · landscape) ---------------- */
  const FONT = "'Google Sans Flex', Helvetica, Arial, sans-serif";
  const SERIF = FONT;
  let mctx = null;
  function measure(text, size, weight, serif) { if (!mctx) mctx = document.createElement('canvas').getContext('2d'); mctx.font = `${weight} ${size}px ${serif ? SERIF : FONT}`; return mctx.measureText(text).width; }
  function wrap(text, size, weight, maxW, maxLines) {
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/)) { const t = line ? line + ' ' + w : w; if (measure(t, size, weight) <= maxW || !line) line = t; else { out.push(line); line = w; } }
    if (line) out.push(line);
    if (out.length > maxLines) { const kept = out.slice(0, maxLines); let last = kept[maxLines - 1]; while (measure(last + '…', size, weight) > maxW && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' ')); kept[maxLines - 1] = last + '…'; return kept; }
    return out;
  }
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${(o.serif ? SERIF : FONT).replace(/'/g, '&apos;')}" font-size="${o.size || 24}" font-weight="${o.weight || 400}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'start'}" letter-spacing="${o.ls ?? 0}"${o.tab ? ' style="font-variant-numeric:tabular-nums"' : ''}>${esc(s)}</text>`;
  const Ln = (x1, y1, x2, y2, c = C.line, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
  const Rr = (x, y, w, h, rx, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;

  function buildCardSVG(r, size = 'square', fontCss = '') {
    const [W, H] = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1600, 900] }[size] || [1080, 1080];
    const M = size === 'landscape' ? 88 : 80, x1 = W - M, P = [Rr(0, 0, W, H, 0, C.bg)];
    // header
    P.push(Rr(M - 24, 42, W - 2 * M + 48, 76, 38, C.cream));
    P.push(`<g transform="translate(${M} 66) scale(${30 / 1432})"><path d="M18.67 1432Q18.67 1432 18.67 1432Q18.67 1432 18.67 1432L566.67 0Q566.67 0 566.67 0Q566.67 0 566.67 0H821.33Q821.33 0 821.33 0Q821.33 0 821.33 0L1366.66 1432Q1366.66 1432 1366.66 1432Q1366.66 1432 1366.66 1432H1074.34Q1074.34 1432 1074.34 1432Q1074.34 1432 1074.34 1432L749.33 501.66L694.33 323.99H687.67L632.67 500.99L304.66 1432Q304.66 1432 304.66 1432Q304.66 1432 304.66 1432H18.67ZM272.67 1115.33 348.33 908.66H1002.67L1081.33 1115.33H272.67Z" fill="#12372A"/><path d="M1908.33 1466Q1668.33 1466 1523 1313.67Q1377.67 1161.33 1377.67 921.33Q1377.67 683.67 1524.67 529.17Q1671.67 374.67 1908.33 374.67Q2127 374.67 2269 519.83Q2411 665 2411 904.67Q2411 929.33 2409.33 947.17Q2407.66 965 2403 995.33Q2403 995.33 2403 995.33Q2403 995.33 2403 995.33L1507.67 996V796.67H2153Q2141 704.67 2077.33 645Q2013.67 585.33 1907.67 585.33Q1787.66 585.33 1712.66 672.33Q1637.66 759.33 1637.66 911.33Q1637.66 1074.67 1721.5 1169Q1805.33 1263.34 1941.3 1263.34Q2031.33 1263.34 2100.33 1224.67Q2169.33 1186 2227 1106Q2227 1106 2227 1106Q2227 1106 2227 1106L2384.66 1231.33Q2384.66 1231.33 2384.66 1231.33Q2384.66 1231.33 2384.66 1231.33Q2302 1347.33 2188.67 1406.67Q2075.33 1466 1908.33 1466Z" fill="#12372A"/><path d="M3063.67 1466Q2823.67 1466 2668.17 1310.83Q2512.67 1155.67 2512.67 919.33Q2512.67 679.33 2668.5 526Q2824.33 372.67 3063.67 372.67Q3302.33 372.67 3458.5 527Q3614.66 681.33 3614.66 919.33Q3614.66 1155.67 3459.5 1310.83Q3304.33 1466 3063.67 1466ZM3063.83 1240.34Q3188 1240.34 3271.67 1150Q3355.34 1059.67 3355.34 919.07Q3355.34 776 3271 687.16Q3186.67 598.33 3063.83 598.33Q2939.33 598.33 2855.33 687.5Q2771.33 776.66 2771.33 918.99Q2771.33 1059.67 2854.66 1150Q2938 1240.34 3063.83 1240.34Z" fill="#12372A"/><path d="M4194.47 1466Q3986 1466 3849.83 1315.67Q3713.67 1165.33 3713.67 921Q3713.67 679.33 3852.67 526.67Q3991.67 374 4204 374Q4306.79 374 4393.23 418.33Q4479.67 462.67 4522.67 534.34H4529.34V0Q4529.34 0 4529.34 0Q4529.34 0 4529.34 0H4791.66Q4791.66 0 4791.66 0Q4791.66 0 4791.66 0V1432Q4791.66 1432 4791.66 1432Q4791.66 1432 4791.66 1432H4538.34Q4538.34 1432 4538.34 1432Q4538.34 1432 4538.34 1432V1258.67L4565 1298.67H4531.67Q4485.33 1374.67 4394.5 1420.33Q4303.67 1466 4194.47 1466ZM4254.17 1242Q4374 1242 4455.17 1151.13Q4536.34 1060.26 4536.34 919Q4536.34 777.33 4454.5 688.33Q4372.67 599.33 4254.17 599.33Q4135.66 599.33 4053.66 688.33Q3971.66 777.33 3971.66 919.66Q3971.66 1060.34 4053 1151.17Q4134.33 1242 4254.17 1242Z" fill="#12372A"/><path d="M5483.33 1466Q5243.33 1466 5098 1313.67Q4952.67 1161.33 4952.67 921.33Q4952.67 683.67 5099.67 529.17Q5246.67 374.67 5483.33 374.67Q5702 374.67 5844 519.83Q5986 665 5986 904.67Q5986 929.33 5984.33 947.17Q5982.66 965 5978 995.33Q5978 995.33 5978 995.33Q5978 995.33 5978 995.33L5082.67 996V796.67H5728Q5716 704.67 5652.33 645Q5588.67 585.33 5482.67 585.33Q5362.66 585.33 5287.66 672.33Q5212.66 759.33 5212.66 911.33Q5212.66 1074.67 5296.5 1169Q5380.33 1263.34 5516.3 1263.34Q5606.33 1263.34 5675.33 1224.67Q5744.33 1186 5802 1106Q5802 1106 5802 1106Q5802 1106 5802 1106L5959.66 1231.33Q5959.66 1231.33 5959.66 1231.33Q5959.66 1231.33 5959.66 1231.33Q5877 1347.33 5763.67 1406.67Q5650.33 1466 5483.33 1466Z" fill="#12372A"/><path d="M6148.67 1432V406.67Q6148.67 406.67 6148.67 406.67Q6148.67 406.67 6148.67 406.67H6401.99Q6401.99 406.67 6401.99 406.67Q6401.99 406.67 6401.99 406.67V593L6372.33 556.33H6408.66Q6456.66 472.67 6550.49 422.67Q6644.33 372.67 6744.66 372.67Q6918.66 372.67 7017.99 477Q7117.33 581.33 7117.33 761V1432Q7117.33 1432 7117.33 1432Q7117.33 1432 7117.33 1432H6852.33Q6852.33 1432 6852.33 1432Q6852.33 1432 6852.33 1432V818Q6852.33 708 6799.17 651.16Q6746 594.33 6643.33 594.33Q6545 594.33 6479.33 670.5Q6413.66 746.67 6413.66 855.33V1432Q6413.66 1432 6413.66 1432Q6413.66 1432 6413.66 1432H6148.67Q6148.67 1432 6148.67 1432Q6148.67 1432 6148.67 1432Z" fill="#12372A"/><path d="M7472.66 1447.33Q7400.67 1447.33 7351 1398.1Q7301.33 1348.86 7301.33 1277Q7301.33 1206.34 7351 1157.17Q7400.67 1108.01 7472.66 1108.01Q7544.66 1108.01 7594.33 1157.17Q7644 1206.34 7644 1277Q7644 1348.86 7594.33 1398.1Q7544.66 1447.33 7472.66 1447.33Z" fill="#5E9A1E"/></g>`);
    P.push(T(x1, 90, r.demo ? 'Example AEO Card' : 'AEO Card · ' + scannedLabel(r.scannedAt).replace('Scanned ', ''), { size: 22, fill: '#2B4A3D', anchor: 'end' }));

    const leftW = size === 'landscape' ? 640 : W - 2 * M;
    // domain
    const dMax = size === 'landscape' ? 64 : 72;
    let dl = [r.domain], ds = dMax;
    const fit = (lines, s) => Math.max(...lines.map(t => measure(t, s, 600, true) - s * 0.01 * t.length)) <= leftW;
    if (!fit(dl, 56)) dl = domainLines(r.domain).slice(0, 2);
    while (ds > 36 && !fit(dl, ds)) ds -= 2;
    dl.forEach((t, i) => P.push(T(M, 224 + i * ds * 1.05, t, { size: ds, weight: 600, ls: -ds * 0.01, serif: true })));
    let dBottom = 224 + (dl.length - 1) * ds * 1.05;
    const kt = knownText(r.familiarity);
    if (kt) { P.push(T(M, dBottom + 42, kt, { size: 24, weight: 500, fill: r.familiarity.known ? C.g600 : C.ink3 })); dBottom += 40; }

    // score — a framed sub-card with a chunky number
    const sq = size === 'square';
    const nSize = size === 'landscape' ? 196 : sq ? 190 : 210;
    const colTop = dBottom + (sq ? 58 : 20);
    const tileX = M, tileY = colTop - (sq ? 14 : 4), tileW = sq ? 410 : (size === 'landscape' ? leftW : W - 2 * M), tileH = nSize * 0.78 + 150;
    P.push(Rr(tileX, tileY, tileW, tileH, 28, '#0F3326'));
    P.push(`<rect x="${tileX + .75}" y="${tileY + .75}" width="${tileW - 1.5}" height="${tileH - 1.5}" rx="28" fill="none" stroke="${C.line}" stroke-width="1.5"/>`);
    const px = tileX + 34;
    const sy = tileY + 28 + nSize * 0.74;
    const nw = measure(String(r.score), nSize, 800) - nSize * 0.055 * (String(r.score).length - 1);
    const tn = toneOf(r.score), tone = tn === 'good' ? C.g500 : tn === 'mixed' ? C.warn : C.bad, toneSoft = tn === 'good' ? C.g100 : tn === 'mixed' ? '#4A4A2C' : '#4F3A30';
    P.push(T(px - 4, sy, String(r.score), { size: nSize, weight: 800, fill: tone, ls: -nSize * 0.055 }));
    P.push(T(px + nw + 10, sy, '/100', { size: 36, weight: 600, fill: C.ink3 }));
    P.push(T(px, sy + 58, `${r.status} · Grade ${r.grade}`, { size: 30, weight: 600, fill: C.ink }));
    // bar
    const by = sy + 84, bw = tileW - 68, segs = 20, gap = 5, sw = (bw - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) P.push(Rr(px + i * (sw + gap), by, sw, 14, 3, i < Math.round(r.score / 5) ? tone : toneSoft));

    // rows (receipt: name left, label, grade right)
    const drawRows = (rx, ry, rw, rowH, gSize) => {
      CATS.forEach((k, i) => {
        const c = r.categories[k], y = ry + i * rowH, mid = y + rowH / 2;
        if (i) P.push(Ln(rx, y, rx + rw, y));
        P.push(T(rx, mid - 4, c.name, { size: 28, weight: 600 }));
        P.push(T(rx, mid + 28, wrap(c.label, 22, 400, rw - gSize - 30, 1)[0], { size: 22, fill: C.ink3 }));
        P.push(T(rx + rw, mid + gSize * 0.36, c.grade, { size: gSize, weight: 700, anchor: 'end', fill: gradeColor(c.grade) }));
      });
    };
    let fixY, fixX = M, fixW = W - 2 * M;
    if (sq) {
      P.push(Ln(M, colTop - 26, x1, colTop - 26));
      const rx = 540, rowH = 88;
      P.push(Ln(rx - 36, colTop - 26, rx - 36, colTop + 4 * rowH));
      drawRows(rx, colTop - 16, x1 - rx, rowH, 56);
      fixY = colTop + 4 * rowH + 30;
    } else if (size === 'portrait') {
      const ry = tileY + tileH + 34; P.push(Ln(M, ry, x1, ry));
      drawRows(M, ry, W - 2 * M, 96, 58);
      fixY = ry + 4 * 96 + 36;
    } else {
      drawRows(800, 180, x1 - 800, 92, 54);
      fixX = 800; fixW = x1 - 800; fixY = 180 + 4 * 92 + 30;
    }
    // first fix
    const fSize = size === 'landscape' ? 32 : 38;
    const fl = wrap(fixText(r), fSize, 600, fixW - 80, 2);
    const fh = 76 + fl.length * fSize * 1.2;
    P.push(Rr(fixX, fixY, fixW, fh, 22, C.g50));
    P.push(T(fixX + 40, fixY + 50, 'First fix', { size: 24, weight: 700, fill: C.g500 }));
    fl.forEach((ln, i) => P.push(T(fixX + 40, fixY + 50 + 20 + fSize + i * fSize * 1.2, ln, { size: fSize, weight: 600, fill: C.ink, ls: -.4 })));
    // footer
    const fy = H - 64;
    P.push(Ln(M, fy - 44, x1, fy - 44));
    P.push(T(M, fy, 'aeoden.com', { size: 24, weight: 600 }));
    P.push(T(x1, fy, 'Diagnostic score, not a guarantee', { size: 22, fill: C.ink3, anchor: 'end' }));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${fontCss ? `<style>${fontCss}</style>` : ''}<title>AEO Card for ${esc(r.domain)}: ${r.score} out of 100, ${esc(r.status)}</title>${P.join('')}</svg>`;
  }

  function summaryText(r) {
    const cats = CATS.map(k => `${r.categories[k].name} ${r.categories[k].grade}`).join(' · ');
    return `AEO Card — ${r.domain}\nScore ${r.score}/100 · ${r.status} · Grade ${r.grade}\n${cats}\n\nFirst fix: ${fixText(r)}\nWhat AI sees: ${r.whatAiSees.summary}\n\nChecked with Aeoden (aeoden.com). Diagnostic score, not a guarantee.`;
  }

  window.AEOCardRender = { renderCardHTML, knownText, toneOf, renderCardLoading, renderCardError, buildCardSVG, summaryText, stateOf, scannedLabel, recordId, glyphSVG: markSVG, shareFix: fixText };
})();
