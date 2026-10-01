/* ============================================================
   Aeoden — the AI-ready card (shareable image)
   Domain, the four AI files with their status, and "AI-ready" once the
   core files are in place. No score: just what's installed and what isn't.
   buildCardSVG(result, size, fontCss) → standalone SVG for PNG export
   ============================================================ */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = { bg: '#12372A', line: '#2A5646', ink: '#EEF4E2', ink2: '#D6E3CB', ink3: '#A9BFAC', lime: '#A3D93F', cream: '#E4F0D0',
    ok: '#A3D93F', okBg: '#24533F', fix: '#F2B65B', fixBg: '#4A4A2C', miss: '#FF9478', missBg: '#4F3A30', opt: '#A9BFAC', optBg: '#1F4736' };
  const STATUS = { ok: ['Ready', C.ok, C.okBg], fix: ['Needs fix', C.fix, C.fixBg], missing: ['Missing', C.miss, C.missBg], optional: ['Optional', C.opt, C.optBg] };
  const WORDMARK = `<path d="M18.67 1432Q18.67 1432 18.67 1432Q18.67 1432 18.67 1432L566.67 0Q566.67 0 566.67 0Q566.67 0 566.67 0H821.33Q821.33 0 821.33 0Q821.33 0 821.33 0L1366.66 1432Q1366.66 1432 1366.66 1432Q1366.66 1432 1366.66 1432H1074.34Q1074.34 1432 1074.34 1432Q1074.34 1432 1074.34 1432L749.33 501.66L694.33 323.99H687.67L632.67 500.99L304.66 1432Q304.66 1432 304.66 1432Q304.66 1432 304.66 1432H18.67ZM272.67 1115.33 348.33 908.66H1002.67L1081.33 1115.33H272.67Z" fill="#12372A"/><path d="M1908.33 1466Q1668.33 1466 1523 1313.67Q1377.67 1161.33 1377.67 921.33Q1377.67 683.67 1524.67 529.17Q1671.67 374.67 1908.33 374.67Q2127 374.67 2269 519.83Q2411 665 2411 904.67Q2411 929.33 2409.33 947.17Q2407.66 965 2403 995.33Q2403 995.33 2403 995.33Q2403 995.33 2403 995.33L1507.67 996V796.67H2153Q2141 704.67 2077.33 645Q2013.67 585.33 1907.67 585.33Q1787.66 585.33 1712.66 672.33Q1637.66 759.33 1637.66 911.33Q1637.66 1074.67 1721.5 1169Q1805.33 1263.34 1941.3 1263.34Q2031.33 1263.34 2100.33 1224.67Q2169.33 1186 2227 1106Q2227 1106 2227 1106Q2227 1106 2227 1106L2384.66 1231.33Q2384.66 1231.33 2384.66 1231.33Q2384.66 1231.33 2384.66 1231.33Q2302 1347.33 2188.67 1406.67Q2075.33 1466 1908.33 1466Z" fill="#12372A"/><path d="M3063.67 1466Q2823.67 1466 2668.17 1310.83Q2512.67 1155.67 2512.67 919.33Q2512.67 679.33 2668.5 526Q2824.33 372.67 3063.67 372.67Q3302.33 372.67 3458.5 527Q3614.66 681.33 3614.66 919.33Q3614.66 1155.67 3459.5 1310.83Q3304.33 1466 3063.67 1466ZM3063.83 1240.34Q3188 1240.34 3271.67 1150Q3355.34 1059.67 3355.34 919.07Q3355.34 776 3271 687.16Q3186.67 598.33 3063.83 598.33Q2939.33 598.33 2855.33 687.5Q2771.33 776.66 2771.33 918.99Q2771.33 1059.67 2854.66 1150Q2938 1240.34 3063.83 1240.34Z" fill="#12372A"/><path d="M4194.47 1466Q3986 1466 3849.83 1315.67Q3713.67 1165.33 3713.67 921Q3713.67 679.33 3852.67 526.67Q3991.67 374 4204 374Q4306.79 374 4393.23 418.33Q4479.67 462.67 4522.67 534.34H4529.34V0Q4529.34 0 4529.34 0Q4529.34 0 4529.34 0H4791.66Q4791.66 0 4791.66 0Q4791.66 0 4791.66 0V1432Q4791.66 1432 4791.66 1432Q4791.66 1432 4791.66 1432H4538.34Q4538.34 1432 4538.34 1432Q4538.34 1432 4538.34 1432V1258.67L4565 1298.67H4531.67Q4485.33 1374.67 4394.5 1420.33Q4303.67 1466 4194.47 1466ZM4254.17 1242Q4374 1242 4455.17 1151.13Q4536.34 1060.26 4536.34 919Q4536.34 777.33 4454.5 688.33Q4372.67 599.33 4254.17 599.33Q4135.66 599.33 4053.66 688.33Q3971.66 777.33 3971.66 919.66Q3971.66 1060.34 4053 1151.17Q4134.33 1242 4254.17 1242Z" fill="#12372A"/><path d="M5483.33 1466Q5243.33 1466 5098 1313.67Q4952.67 1161.33 4952.67 921.33Q4952.67 683.67 5099.67 529.17Q5246.67 374.67 5483.33 374.67Q5702 374.67 5844 519.83Q5986 665 5986 904.67Q5986 929.33 5984.33 947.17Q5982.66 965 5978 995.33Q5978 995.33 5978 995.33Q5978 995.33 5978 995.33L5082.67 996V796.67H5728Q5716 704.67 5652.33 645Q5588.67 585.33 5482.67 585.33Q5362.66 585.33 5287.66 672.33Q5212.66 759.33 5212.66 911.33Q5212.66 1074.67 5296.5 1169Q5380.33 1263.34 5516.3 1263.34Q5606.33 1263.34 5675.33 1224.67Q5744.33 1186 5802 1106Q5802 1106 5802 1106Q5802 1106 5802 1106L5959.66 1231.33Q5959.66 1231.33 5959.66 1231.33Q5959.66 1231.33 5959.66 1231.33Q5877 1347.33 5763.67 1406.67Q5650.33 1466 5483.33 1466Z" fill="#12372A"/><path d="M6148.67 1432V406.67Q6148.67 406.67 6148.67 406.67Q6148.67 406.67 6148.67 406.67H6401.99Q6401.99 406.67 6401.99 406.67Q6401.99 406.67 6401.99 406.67V593L6372.33 556.33H6408.66Q6456.66 472.67 6550.49 422.67Q6644.33 372.67 6744.66 372.67Q6918.66 372.67 7017.99 477Q7117.33 581.33 7117.33 761V1432Q7117.33 1432 7117.33 1432Q7117.33 1432 7117.33 1432H6852.33Q6852.33 1432 6852.33 1432Q6852.33 1432 6852.33 1432V818Q6852.33 708 6799.17 651.16Q6746 594.33 6643.33 594.33Q6545 594.33 6479.33 670.5Q6413.66 746.67 6413.66 855.33V1432Q6413.66 1432 6413.66 1432Q6413.66 1432 6413.66 1432H6148.67Q6148.67 1432 6148.67 1432Q6148.67 1432 6148.67 1432Z" fill="#12372A"/><path d="M7472.66 1447.33Q7400.67 1447.33 7351 1398.1Q7301.33 1348.86 7301.33 1277Q7301.33 1206.34 7351 1157.17Q7400.67 1108.01 7472.66 1108.01Q7544.66 1108.01 7594.33 1157.17Q7644 1206.34 7644 1277Q7644 1348.86 7594.33 1398.1Q7544.66 1447.33 7472.66 1447.33Z" fill="#5E9A1E"/>`;
  const FONT = "'Google Sans Flex', Helvetica, Arial, sans-serif";

  function scannedLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return 'Checked today';
    return 'Checked ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function knownText(f) {
    if (!f) return null;
    if (!f.known) return 'Not yet a known entity to AI';
    return `${f.level} to AI${f.sitelinks ? ` · ${f.sitelinks} Wikipedia editions` : ''}`;
  }
  const isReady = r => r.aiFiles && r.aiFiles.ready === r.aiFiles.total;
  const headline = r => !r.aiFiles ? 'AI files' : isReady(r) ? 'AI-ready' : `${r.aiFiles.ready} of ${r.aiFiles.total} AI files ready`;

  let mctx = null;
  function measure(text, size, weight) { if (!mctx) mctx = document.createElement('canvas').getContext('2d'); mctx.font = `${weight} ${size}px ${FONT}`; return mctx.measureText(text).width; }
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${FONT.replace(/'/g, '&apos;')}" font-size="${o.size || 24}" font-weight="${o.weight || 400}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'start'}" letter-spacing="${o.ls ?? 0}">${esc(s)}</text>`;
  const Rr = (x, y, w, h, rx, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
  const Ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.line}" stroke-width="2"/>`;

  function buildCardSVG(r, size = 'square', fontCss = '') {
    const [W, H] = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1600, 900] }[size] || [1080, 1080];
    const M = size === 'landscape' ? 88 : 80, x1 = W - M, P = [Rr(0, 0, W, H, 0, C.bg)];
    // header pill
    P.push(Rr(M - 24, 42, W - 2 * M + 48, 76, 38, C.cream));
    P.push(`<g transform="translate(${M} 66) scale(${30 / 1432})">${WORDMARK}</g>`);
    P.push(T(x1, 90, r.demo ? 'Example' : scannedLabel(r.scannedAt), { size: 22, fill: '#2B4A3D', anchor: 'end' }));
    // domain
    let ds = size === 'landscape' ? 64 : 72;
    while (ds > 36 && measure(r.domain, ds, 600) > (size === 'landscape' ? 640 : W - 2 * M)) ds -= 2;
    P.push(T(M, 230, r.domain, { size: ds, weight: 600, ls: -ds * 0.02 }));
    const kt = knownText(r.familiarity);
    if (kt) P.push(T(M, 274, kt, { size: 24, weight: 500, fill: r.familiarity.known ? C.lime : C.ink3 }));
    // headline: "AI-ready" or "2 of 3 AI files ready"
    const ready = isReady(r);
    const hSize = ready ? (size === 'landscape' ? 150 : 170) : (size === 'landscape' ? 64 : 72);
    const hy = (size === 'landscape' ? 430 : 420) + (ready ? 60 : 0);
    P.push(T(M - 4, hy, headline(r), { size: hSize, weight: 700, fill: ready ? C.lime : C.ink, ls: -hSize * 0.035 }));
    if (!ready && r.aiFiles) P.push(T(M, hy + 52, 'Written from the site itself. Get yours free at aeoden.com', { size: 26, fill: C.ink3 }));
    // file checklist
    const files = r.aiFiles ? r.aiFiles.files : [];
    let lx = M, ly, lw = W - 2 * M, rowH = 84;
    if (size === 'landscape') { lx = 860; lw = x1 - 860; ly = 170; rowH = 112; }
    else ly = size === 'portrait' ? 640 : 560;
    files.forEach((f, i) => {
      const y = ly + i * rowH, mid = y + rowH / 2, st = STATUS[f.status] || STATUS.missing;
      if (i) P.push(Ln(lx, y, lx + lw, y));
      P.push(T(lx, mid + 10, f.name, { size: 32, weight: 600 }));
      const label = st[0], pw = measure(label, 24, 600) + 40;
      P.push(Rr(lx + lw - pw, mid - 22, pw, 44, 22, st[2]));
      P.push(T(lx + lw - pw / 2, mid + 8, label, { size: 24, weight: 600, fill: st[1], anchor: 'middle' }));
    });
    // footer
    const fy = H - 64;
    P.push(Ln(M, fy - 44, x1, fy - 44));
    P.push(T(M, fy, 'aeoden.com', { size: 24, weight: 600 }));
    P.push(T(x1, fy, 'Make your website readable to AI', { size: 22, fill: C.ink3, anchor: 'end' }));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${fontCss ? `<style>${fontCss}</style>` : ''}<title>${esc(r.domain)}: ${esc(headline(r))}</title>${P.join('')}</svg>`;
  }

  function summaryText(r) {
    const files = r.aiFiles ? r.aiFiles.files.map(f => `${f.name}: ${(STATUS[f.status] || STATUS.missing)[0]}`).join('\n') : '';
    return `${r.domain}: ${headline(r)}\n${files}\n\nChecked with Aeoden (aeoden.com). Make your website readable to AI.`;
  }

  window.AEOCardRender = { buildCardSVG, summaryText, scannedLabel, knownText, headline, isReady, STATUS_LABEL: Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v[0]])) };
})();
