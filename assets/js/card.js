/* ============================================================
   CheckAEO — the AEO Card
   A site diagnostic record: catalogue header, record metadata,
   condensed site identity, score + 10×10 dot matrix, four ruled
   diagnostic rows, site interpretation, first-fix strip.
   One accent (signal orange) marks the first fix and weak grades.
   renderCardHTML(r) → page markup · buildCardSVG(r, size, fontCss) → export
   ============================================================ */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stateOf = score => (score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'mixed' : 'poor');
  const CATS = ['access', 'clarity', 'answers', 'trust'];
  const WEAK = g => g === 'C' || g === 'D' || g === 'F';

  const C = { plate: '#E3E0D6', paper: '#F8F7F2', ink: '#111111', ink2: '#3D3B36', ink3: '#66635B', dotOff: '#CFCBC0', rule: '#111111', signal: '#075E45', signalInk: '#075E45', warn: '#9C3B1B', onSignal: '#F8F7F2' };
  /* Signature glyph: a broken, modular C. Body + one offset module (the module can carry the accent).
     viewBox 0 0 152 192. Used in the header, favicon, card, loading and empty states. */
  const GLYPH_BODY = 'M8 63 L48 63 C52 63 54.5 61 57.5 58 L62 53.5 L72 53.5 C64 53.5 55.5 61 55.5 70 L55.5 123 Q55.5 134 66.5 134 L143 134 Q151 134 151 142 L151 183 Q151 191 143 191 L70 191 A70 70 0 0 1 0 121 L0 71 Q0 63 8 63 Z';
  const GLYPH_MOD = '<rect x="63" y="0" width="88" height="54" rx="8"/>';
  const glyphInner = (body = C.ink, mod = C.signal) => `<path class="glyph__body" d="${GLYPH_BODY}" fill="${body}"/><g class="glyph__mod" fill="${mod}">${GLYPH_MOD}</g>`;
  const MARK_INNER = glyphInner();
  const markSVG = (body, mod) => `<svg class="glyph" viewBox="0 0 152 192" aria-hidden="true" focusable="false">${glyphInner(body, mod)}</svg>`;
  const glyphAt = (x, y, h, body, mod) => `<g transform="translate(${x} ${y}) scale(${h / 192})">${glyphInner(body, mod)}</g>`;
  const motifInner = glyphInner;

  // Record identifiers: demos are CA-01; live scans get a stable code from domain + date.
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

  function scannedLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return 'Scanned today';
    return 'Scanned ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function dots(x, y, pitch, r, score) {
    let s = '';
    for (let i = 0; i < 100; i++) {
      const row = Math.floor(i / 10), col = i % 10;
      const fill = i === score - 1 ? C.signal : i < score ? C.ink : C.dotOff;
      s += `<circle cx="${(x + col * pitch + pitch / 2).toFixed(1)}" cy="${(y + row * pitch + pitch / 2).toFixed(1)}" r="${r}" fill="${fill}"/>`;
    }
    return s;
  }

  /* ---------------- On-page card ---------------- */
  function renderCardHTML(r) {
    const id = recordId(r);
    const lines = domainLines(r.domain);
    const fix = r.fixes && r.fixes[0];
    const rows = CATS.map((k, i) => {
      const c = r.categories[k];
      return `<li class="rec__row${WEAK(c.grade) ? ' is-weak' : ''}">
        <span class="rec__idx">0${i + 1}</span>
        <span class="rec__name">${esc(c.name.toUpperCase())}</span>
        <span class="rec__val">${esc(c.label)}</span>
        <span class="rec__g" aria-label="Grade ${esc(c.grade)}, ${c.notEvaluated ? 'not evaluated' : c.score + ' out of 100'}">${esc(c.grade)}</span>
      </li>`;
    }).join('');
    const interp = r.whatAiSees;
    return `<article class="rec" data-state="${stateOf(r.score)}" aria-labelledby="card-title">
      <header class="rec__head"><span class="rec__brand">${markSVG()}CheckAEO</span><span class="rec__id">AEO CARD / ${esc(id)}</span></header>
      <dl class="rec__meta">
        <div><dt>Status</dt><dd>${statusWord(r)}</dd></div>
        <div><dt>Date</dt><dd>${esc(isoDate(r.scannedAt) || '—')}</dd></div>
        <div><dt>Type</dt><dd>HOMEPAGE</dd></div>
      </dl>
      <div class="rec__site">
        <span class="rec__lbl">Site</span>
        <h2 class="rec__domain" id="card-title" style="--dlen:${Math.max(7, ...lines.map(t => t.length))}">${lines.map(esc).join('<wbr>')}</h2>
      </div>
      <div class="rec__score">
        <div class="rec__readout">
          <div class="rec__num" aria-hidden="true">${r.score}<span>/100</span></div>
          <div class="rec__grade" aria-hidden="true">GRADE ${esc(r.grade)} / ${esc(r.status.toUpperCase())}</div>
          <p class="sr-only">Overall AEO score ${r.score} out of 100, grade ${esc(r.grade)}, ${esc(r.status)}.</p>
        </div>
        <div class="rec__matrix"><span class="rec__lbl rec__lbl--mute">Readiness / 0—100</span><svg class="rec__dots" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${dots(0, 0, 20, 7.4, r.score)}</svg></div>
      </div>
      <ol class="rec__rows" aria-label="Diagnostic grades">${rows}</ol>
      <div class="rec__interp">
        <span class="rec__lbl">Site interpretation</span>
        <p>${esc(shortInterp(r))}</p>
        ${interp.source ? `<span class="rec__src">SOURCE / ${esc(srcWord(interp.source))}</span>` : ''}
      </div>
      <div class="rec__fix">
        <span class="rec__lbl">First fix</span>
        <p>${esc(fixText(r))}</p>
      </div>
      <footer class="rec__foot"><span>checkaeo.com</span><span>${esc(id)} / HOMEPAGE / PUBLIC</span><span>Diagnostic score, not a guarantee</span></footer>
    </article>`;
  }

  /* ---------------- SVG export ---------------- */
  const DISPLAY = "Archivo, 'Arial Narrow', Helvetica, Arial, sans-serif";
  const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
  let mctx = null;
  function measure(text, size, weight, family, stretch = '100%', ls = 0) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${weight} ${size}px ${family}`;
    try { mctx.fontStretch = stretch === '75%' ? 'condensed' : 'normal'; } catch { /* older canvases */ }
    return mctx.measureText(text).width + ls * Math.max(0, String(text).length - 1);
  }
  function wrap(text, size, weight, family, maxW, maxLines) {
    const out = []; let line = '';
    for (const w of String(text).split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (measure(t, size, weight, family) <= maxW || !line) line = t; else { out.push(line); line = w; }
    }
    if (line) out.push(line);
    if (out.length > maxLines) {
      const kept = out.slice(0, maxLines); let last = kept[maxLines - 1];
      while (measure(last + '…', size, weight, family) > maxW && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
      kept[maxLines - 1] = last.replace(/[,;:\-–]$/, '') + '…';
      return kept;
    }
    return out;
  }
  const T = (x, y, str, o = {}) => `<text x="${x}" y="${y}" font-family="${(o.mono ? MONO : DISPLAY).replace(/"/g, '&quot;').replace(/'/g, '&apos;')}" font-size="${o.size || 24}" font-weight="${o.weight || 400}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'start'}" letter-spacing="${o.ls ?? 0}"${o.stretch ? ` style="font-stretch:${o.stretch}"` : ''}>${esc(str)}</text>`;
  const Rr = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const Ln = (x1, y1, x2, y2, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.rule}" stroke-width="${w}"/>`;
  const LBL = (x, y, s, fill = C.signalInk) => T(x, y, s.toUpperCase(), { mono: true, size: 18, weight: 600, fill, ls: 1.2 });

  function buildCardSVG(r, size = 'square', fontCss = '') {
    const [W, H] = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1600, 900] }[size] || [1080, 1350];
    const id = recordId(r);
    const M = 48, x0 = M, y0 = M, cw = W - 2 * M, ch = H - 2 * M, x1 = x0 + cw, PX = size === 'landscape' ? 40 : 44;
    const P = [Rr(0, 0, W, H, C.plate), `<rect x="${x0}" y="${y0}" width="${cw}" height="${ch}" rx="6" fill="${C.paper}" stroke="${C.ink}" stroke-width="3"/>`];

    // Header + metadata
    const headH = size === 'landscape' ? 72 : 84, metaH = size === 'landscape' ? 50 : 58;
    P.push(glyphAt(x0 + PX, y0 + headH / 2 - 17, 34));
    P.push(T(x0 + PX + 40, y0 + headH / 2 + 10, 'CheckAEO', { size: 30, weight: 700, ls: -0.5 }));
    P.push(T(x1 - PX, y0 + headH / 2 + 7, `AEO CARD / ${id}`, { mono: true, size: 20, weight: 600, anchor: 'end', ls: 1 }));
    let y = y0 + headH; P.push(Ln(x0, y, x1, y));
    const metas = [['STATUS', statusWord(r)], ['DATE', isoDate(r.scannedAt) || '—'], ['TYPE', 'HOMEPAGE']];
    const mw = cw / 3;
    metas.forEach(([k, v], i) => {
      const mx = x0 + i * mw + (i === 0 ? PX : 28);
      P.push(T(mx, y + metaH / 2 + 7, `${k} / ${v}`, { mono: true, size: 18, weight: 400, fill: C.ink2, ls: 0.8 }));
      if (i) P.push(Ln(x0 + i * mw, y, x0 + i * mw, y + metaH, 1.5));
    });
    y += metaH; P.push(Ln(x0, y, x1, y));

    const footH = size === 'landscape' ? 50 : 56;
    const fixH = { square: 176, portrait: 150, landscape: 120 }[size];
    const bodyBottom = y0 + ch - footH - fixH;
    const shortTxt = shortInterp(r);
    const fxText = fixText(r);

    const drawIdentity = (rx, ry, rw, maxSize, maxLines = 2, oneLineMin = 88) => {
      P.push(LBL(rx, ry + 38, 'Site'));
      let dl = [r.domain.toUpperCase()];
      let ds = maxSize;
      const fits = (lines, sz) => Math.max(...lines.map(t => measure(t, sz, 800, DISPLAY, '75%', -sz * 0.01))) <= rw;
      if (!fits(dl, Math.min(maxSize, oneLineMin)) && maxLines > 1) dl = domainLines(r.domain.toUpperCase()).slice(0, maxLines);
      while (ds > 40 && !fits(dl, ds)) ds -= 2;
      dl.forEach((t, i) => P.push(T(rx, ry + 46 + ds * 0.86 + i * ds * 0.92, t, { size: ds, weight: 800, stretch: '75%', ls: -ds * 0.01 })));
      return ry + 46 + ds * 0.86 + (dl.length - 1) * ds * 0.92 + 28;
    };
    let lastNumberW = 0;
    const drawNumber = (rx, ry, numSize, withLabel = true, stackGrade = false) => {
      if (withLabel) P.push(LBL(rx, ry + 18, 'Readiness / 0—100', C.ink3));
      const top = ry + 30;
      const nw = measure(String(r.score), numSize, 800, DISPLAY, '75%', -numSize * 0.02);
      P.push(T(rx, top + numSize * 0.8, String(r.score), { size: numSize, weight: 800, stretch: '75%', ls: -numSize * 0.02 }));
      P.push(T(rx + nw + 10, top + numSize * 0.8, '/100', { mono: true, size: Math.round(numSize * 0.15), weight: 600, fill: C.ink2 }));
      if (stackGrade) {
        P.push(T(rx, top + numSize * 0.8 + 40, `GRADE ${r.grade}`, { mono: true, size: 21, weight: 600, ls: 1.2 }));
        P.push(T(rx, top + numSize * 0.8 + 68, r.status.toUpperCase(), { mono: true, size: 21, weight: 600, ls: 1.2, fill: C.ink2 }));
      } else P.push(T(rx, top + numSize * 0.8 + 44, `GRADE ${r.grade} / ${r.status.toUpperCase()}`, { mono: true, size: 21, weight: 600, ls: 1.2 }));
      const gw = measure(stackGrade ? r.status.toUpperCase() : `GRADE ${r.grade} / ${r.status.toUpperCase()}`, 21, 600, MONO, '100%', 1.2);
      lastNumberW = Math.max(nw + 10 + measure('/100', Math.round(numSize * 0.15), 600, MONO), gw, measure('READINESS / 0—100', 18, 600, MONO, '100%', 1.2));
      return top + numSize * 0.8 + (stackGrade ? 84 : 60);
    };
    const drawMatrix = (rx, ry, pitch) => { P.push(dots(rx, ry, pitch, pitch * 0.37, r.score)); return ry + pitch * 10; };
    const drawRows = (rx, ry, rw, rowH, gSize, stackedLabel) => {
      CATS.forEach((k, i) => {
        const c = r.categories[k], ty = ry + i * rowH, mid = ty + rowH / 2;
        if (i) P.push(Ln(rx, ty, rx + rw, ty, 1.5));
        const gx = rx + rw;
        P.push(T(gx, mid + gSize * 0.36, c.grade, { size: gSize, weight: 800, anchor: 'end', fill: WEAK(c.grade) ? C.warn : C.ink, stretch: '75%' }));
        if (stackedLabel) {
          P.push(T(rx, mid - 6, `0${i + 1}  ${c.name.toUpperCase()}`, { mono: true, size: 19, weight: 600, ls: 1 }));
          P.push(T(rx, mid + 24, wrap(c.label, 23, 400, DISPLAY, rw - gSize - 24, 1)[0], { size: 23, weight: 400, fill: C.ink2 }));
        } else {
          P.push(T(rx, mid + 7, `0${i + 1}`, { mono: true, size: 18, weight: 400, fill: C.ink3 }));
          P.push(T(rx + 48, mid + 8, c.name.toUpperCase(), { mono: true, size: 22, weight: 600, ls: 1 }));
          const valX = rx + Math.min(250, rw * 0.36);
          P.push(T(valX, mid + 8, wrap(c.label, 24, 400, DISPLAY, gx - gSize - 20 - valX, 1)[0], { size: 24, weight: 400, fill: C.ink2 }));
        }
      });
      return ry + 4 * rowH;
    };
    const drawInterp = (rx, ry, rw, tSize, maxLines, text) => {
      P.push(LBL(rx, ry + 36, 'Site interpretation'));
      if (r.whatAiSees.source) P.push(T(rx + rw, ry + 36, `SOURCE / ${srcWord(r.whatAiSees.source)}`, { mono: true, size: 16, weight: 400, fill: C.ink3, anchor: 'end', ls: 0.8 }));
      const lines = wrap(text, tSize, 500, DISPLAY, rw, maxLines);
      lines.forEach((ln, i) => P.push(T(rx, ry + 44 + tSize + i * tSize * 1.2, ln, { size: tSize, weight: 500, ls: -tSize * 0.01 })));
      return ry + 44 + tSize + (lines.length - 1) * tSize * 1.2 + 24;
    };

    if (size === 'square') {
      // Flagship share card: domain → score + matrix → four grades → one-line read → first fix → brand
      const iw = cw - 2 * PX;
      const yy = drawIdentity(x0 + PX, y, iw, 104, 2, 64);
      P.push(Ln(x0, yy, x1, yy));
      const splitX = x0 + cw * 0.5, interpTop = bodyBottom - 96, midH = interpTop - yy;
      const leftW = splitX - x0 - PX - 28;
      const nSize = Math.min(150, midH * 0.5);
      drawNumber(x0 + PX, yy + 22, nSize, true, true);
      const pitch = Math.min(18, (leftW - lastNumberW - 26) / 10, (midH - 44) / 10);
      drawMatrix(x0 + PX + leftW - pitch * 10, yy + (midH - pitch * 10) / 2 + 6, pitch);
      P.push(Ln(splitX, yy, splitX, interpTop));
      const rowH = (midH - 12) / 4;
      drawRows(splitX + 30, yy + 6, x1 - PX - splitX - 30, rowH, Math.min(58, rowH * 0.62), true);
      P.push(Ln(x0, interpTop, x1, interpTop));
      drawInterp(x0 + PX, interpTop, iw, 28, 1, shortTxt);
    } else if (size === 'portrait') {
      // Detail card: full grounded interpretation
      const iw = cw - 2 * PX;
      let yy = drawIdentity(x0 + PX, y, iw, 104, 2);
      P.push(Ln(x0, yy, x1, yy));
      const nb = drawNumber(x0 + PX, yy + 20, 172);
      drawMatrix(x1 - PX - 200, yy + 42, 20);
      yy = Math.max(nb, yy + 42 + 200) + 18;
      P.push(Ln(x0, yy, x1, yy));
      yy = drawRows(x0 + PX, yy, iw, 58, 44, false);
      P.push(Ln(x0 + PX, yy, x1 - PX, yy, 1.5));
      const room = bodyBottom - yy - 44 - 30 - 12;
      drawInterp(x0 + PX, yy, iw, 28, Math.max(1, Math.min(3, Math.floor(room / 34) + 1)), r.whatAiSees.summary);
    } else {
      // Landscape report card
      const leftW = cw * 0.42, lx = x0 + PX, lw = leftW - PX - 28, rx = x0 + leftW + 28, rw = x1 - PX - rx;
      P.push(Ln(x0 + leftW, y, x0 + leftW, bodyBottom));
      const ly = drawIdentity(lx, y, lw, 84, 2);
      P.push(Ln(x0, ly, x0 + leftW, ly));
      drawNumber(lx, ly + 14, 132);
      drawMatrix(lx + lw - 160, ly + 34, 16);
      const ry = drawRows(rx, y + 8, rw, 56, 42, false);
      P.push(Ln(rx, ry, rx + rw, ry, 1.5));
      drawInterp(rx, ry, rw, 24, 1, shortTxt);
    }

    // FIRST FIX: the second strongest element, a full-bleed signal strip with large type
    const fy = bodyBottom;
    P.push(Ln(x0, fy, x1, fy));
    P.push(Rr(x0 + 1.5, fy + 1, cw - 3, fixH - 2, C.signal));
    const fSize = { square: 44, portrait: 40, landscape: 34 }[size];
    const fl = wrap(fxText, fSize, 700, DISPLAY, cw - 2 * PX, 2);
    P.push(T(x0 + PX, fy + 40, 'FIRST FIX', { mono: true, size: 19, weight: 600, ls: 1.5, fill: C.onSignal }));
    const fTop = fy + 40 + (fixH - 40 - fl.length * fSize * 1.08) / 2 + fSize * 0.8;
    fl.forEach((ln, i) => P.push(T(x0 + PX, fTop + i * fSize * 1.08, ln, { size: fSize, weight: 700, ls: -fSize * 0.015, fill: C.onSignal })));
    const by = fy + fixH; P.push(Ln(x0, by, x1, by));
    const fyT = by + footH / 2 + 6;
    P.push(glyphAt(x0 + PX, fyT - 16, 20));
    P.push(T(x0 + PX + 26, fyT, 'checkaeo.com', { mono: true, size: 18, weight: 600 }));
    P.push(T(x1 - PX, fyT, 'Diagnostic score, not a guarantee', { mono: true, size: 17, weight: 400, fill: C.ink3, anchor: 'end' }));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${fontCss ? `<style>${fontCss}</style>` : ''}
      <title>AEO Card ${esc(id)} for ${esc(r.domain)}: ${r.score} out of 100, ${esc(r.status)}</title>
      ${P.join('\n')}
    </svg>`;
  }

  function summaryText(r) {
    const cats = CATS.map(k => `${r.categories[k].name} ${r.categories[k].grade}`).join(' · ');
    const fix = fixText(r);
    return `AEO Card ${recordId(r)} — ${r.domain}\nScore ${r.score}/100 · Grade ${r.grade} · ${r.status}\n${cats}\n\nSite interpretation: ${r.whatAiSees.summary}\nFirst fix: ${fix}\n\nChecked with CheckAEO (checkaeo.com). Diagnostic score, not a guarantee.`;
  }

  const catIcon = () => '';
  window.AEOCardRender = { renderCardHTML, buildCardSVG, summaryText, stateOf, scannedLabel, recordId, catIcon, motifSVG: markSVG, glyphSVG: markSVG, motifInner, shareFix: fixText };
})();
