/* ============================================================
   Aeoden app — homepage checker + results
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.CHECKAEO_CONFIG || {};
  const R = window.AEOCardRender;
  const X = window.AEOCardExport;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const apiConfigured = () => /^https?:\/\//i.test(CFG.SCAN_API_URL || '');

  /* ---------------- Analytics (only if configured) ---------------- */
  function track(event, params = {}) {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
  }
  (function initGA() {
    const id = CFG.GA4_MEASUREMENT_ID;
    if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  })();

  /* ---------------- Elements ---------------- */
  const form = $('#scan-form');
  const input = $('#url-input');
  const submitBtn = $('#scan-submit');
  const formError = $('#form-error');
  const slot = $('#card-slot');
  const caption = $('#card-caption');
  const actions = $('#card-actions');
  const report = $('#report');
  const live = $('#live');
  const toast = $('#toast');

  let current = null;
  let demoKey = null;
  let lastUrl = null;

  /* ---------------- Boot: the example card is the placeholder ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    if (location.hash.startsWith('#demo')) showDemo(location.hash.split('=')[1] || null);
    else {
      showExample();
      if (params.get('url')) { input.value = params.get('url'); startScan(params.get('url')); }
    }
    if (!apiConfigured()) $('#demo-hint')?.removeAttribute('hidden');
    document.addEventListener('click', e => {
      const d = e.target.closest('[data-demo]');
      if (d) { e.preventDefault(); showDemo(d.dataset.demo || null); }
    });
  });

  form?.addEventListener('submit', e => { e.preventDefault(); startScan(input.value); });
  input?.addEventListener('input', () => { if (formError.textContent) { formError.textContent = ''; input.removeAttribute('aria-invalid'); } });

  function firstDemo(key) { const d = window.CHECKAEO_DEMOS || {}; return d[key] || d.quotabird || Object.values(d)[0] || null; }

  function showExample() {
    const ex = firstDemo();
    if (!ex) return;
    current = null;
    slot.innerHTML = R.renderCardHTML(ex);
    caption.hidden = false;
    actions.hidden = true;
    report.hidden = true; report.innerHTML = '';
    document.body.classList.remove('results-mode');
  }

  /* ---------------- URL handling ---------------- */
  function normalizeUrl(raw) {
    let s = (raw || '').trim();
    if (!s) return { error: 'Enter a URL to check.' };
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch { return { error: 'That does not look like a web address. Try something like example.com.' }; }
    if (!u.hostname.includes('.')) return { error: 'Enter a full domain, like example.com.' };
    if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) || /\.(local|internal)$/.test(u.hostname)) return { error: 'Local and private addresses cannot be scanned.' };
    return { url: u.href };
  }

  /* ---------------- Scan flow: the card fills in place ---------------- */
  const STEPS = ['Reaching the site', 'Reading robots.txt and headers', 'Reading the public HTML', 'Scoring the four checks', 'Writing your AEO Card'];

  async function startScan(raw) {
    const n = normalizeUrl(raw);
    if (n.error) { formError.textContent = n.error; input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
    formError.textContent = ''; input.removeAttribute('aria-invalid');
    const url = n.url; lastUrl = url;
    const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    history.replaceState(null, '', '?url=' + encodeURIComponent(domain));
    track('scan_start');
    if (!apiConfigured()) { showError(domain, 'The live scanner is not connected on this copy of the site.'); return; }

    submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true');
    slot.innerHTML = R.renderCardLoading(domain);
    caption.hidden = true; actions.hidden = true; report.hidden = true;
    announce('Checking ' + domain);
    let i = 0;
    const stepTimer = setInterval(() => { const el = $('#acard-step'); if (el && i < STEPS.length - 1) el.textContent = STEPS[++i]; }, 1500);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), CFG.SCAN_TIMEOUT_MS || 25000);
      const res = await fetch(CFG.SCAN_API_URL.replace(/\/$/, '') + '/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: ctrl.signal });
      clearTimeout(t);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { showError(domain, data.error || `The scanner returned an error (${res.status}).`); track('scan_error', { reason: data.error || res.status }); return; }
      demoKey = null;
      showResult(data);
      track('scan_complete', { score: data.score, grade: data.grade });
    } catch (err) {
      showError(domain, err && err.name === 'AbortError' ? 'The scan took too long. The site may be slow or blocking automated requests.' : 'We could not reach the scanner. Check your connection and try again.');
      track('scan_error', { reason: err && err.name });
    } finally {
      clearInterval(stepTimer);
      submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy');
    }
  }

  function showError(domain, message) {
    slot.innerHTML = R.renderCardError(domain, message);
    caption.hidden = true; actions.hidden = true; report.hidden = true;
    $('#retry-btn')?.addEventListener('click', () => startScan(lastUrl || domain));
    announce(message);
  }

  function showDemo(key) {
    const demos = window.CHECKAEO_DEMOS || {};
    demoKey = demos[key] ? key : 'quotabird';
    const data = firstDemo(demoKey);
    if (!data) return;
    history.replaceState(null, '', '#demo=' + demoKey);
    input.value = '';
    showResult(data);
    track('demo_view', { key: demoKey });
  }

  /* Result: fill the card, count the score up once, reveal actions + report below */
  function showResult(r) {
    current = r;
    slot.innerHTML = R.renderCardHTML(r);
    caption.hidden = true;
    if (r.blocked) {
      actions.hidden = true;
      renderBlockedReport(r);
      $('#retry-btn')?.addEventListener('click', () => startScan(lastUrl || r.domain));
      document.body.classList.add('results-mode');
      announce(`${r.domain} blocked our scanner, so there is no score. ${R.knownText(r.familiarity) || ''}`);
      return;
    }
    actions.hidden = false;
    renderActions(r);
    renderReport(r);
    document.body.classList.add('results-mode');
    countUp();
    announce(`${r.demo ? 'Example' : 'Your'} AEO Card: ${r.domain} scored ${r.score} out of 100, ${r.status}.`);
  }

  function countUp() {
    const el = slot.querySelector('.acard__num[data-count]');
    if (!el || prefersReducedMotion()) return;
    const target = +el.dataset.count, t0 = performance.now(), dur = 700;
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(target * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function renderActions(r) {
    actions.innerHTML = `
      <div class="menu-wrap">
        <button class="btn btn--ghost btn--sm" type="button" id="dl-btn" aria-haspopup="true" aria-expanded="false" aria-controls="dl-menu">${icon('download')} Download card</button>
        <div class="menu" id="dl-menu" hidden role="menu" aria-label="Choose a size">
          ${Object.entries(X.SIZES).map(([k, s]) => `<button type="button" role="menuitem" data-size="${k}"><strong>${esc(s.label)}</strong><span>${esc(s.hint)}</span></button>`).join('')}
        </div>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" id="share-btn">${icon('share')} Share</button>
      <div class="menu-wrap">
        <button class="btn btn--ghost btn--sm btn--icon" type="button" id="more-btn" aria-label="More options" aria-haspopup="true" aria-expanded="false" aria-controls="more-menu">${icon('more')}</button>
        <div class="menu menu--end" id="more-menu" hidden role="menu" aria-label="More options">
          ${X.canCopyImage() ? `<button type="button" role="menuitem" data-act="copy-img"><strong>Copy image</strong><span>Paste straight into a post</span></button>` : ''}
          <button type="button" role="menuitem" data-act="copy-txt"><strong>Copy summary</strong><span>Plain text for an email or post</span></button>
          <button type="button" role="menuitem" data-act="svg"><strong>Download SVG</strong><span>Vector, editable</span></button>
        </div>
      </div>
      ${r.aiFiles ? `<a class="btn btn--primary btn--sm" href="#ai-files" data-cta="ai-files">Get your AI files <span class="files-count">${r.aiFiles.ready}/${r.aiFiles.total} ready</span></a>` : ''}
      <a class="actions__report" href="#report">Full report <span aria-hidden="true">↓</span></a>`;
    wireActions(r);
  }

  const EFFORT_WORD = { Easy: 'Easy fix', Medium: 'Medium effort', Hard: 'Bigger job' };

  function renderBlockedReport(r) {
    const f = r.familiarity, bots = r.aiBots;
    report.innerHTML = `<div class="wrap"><div class="report__grid">
      <section aria-labelledby="bots-h">
        <h2 class="report__h" id="bots-h">What we could verify</h2>
        <p class="report__sub">Its robots.txt, which is what AI crawlers actually obey.</p>
        ${bots ? `<ul class="checks mt-2">${bots.map(b => `<li class="check" data-status="${b.allowed ? 'pass' : 'fail'}"><span class="check__dot" aria-hidden="true"></span><div><p class="check__title">${esc(b.name)}: ${b.allowed ? 'allowed' : 'blocked'}</p><p class="check__detail">${b.kind === 'search' ? 'Answers and citations' : 'Model training'}</p></div></li>`).join('')}</ul>` : '<p class="report__empty">We couldn’t read its robots.txt either.</p>'}
      </section>
      <aside class="report__side">${familiarityBlock(f)}${renderMark(r)}</aside>
    </div></div>`;
    report.hidden = false;
  }

  function familiarityBlock(f, r) {
    if (!f) return `<section class="sees"><h2 class="report__h report__h--sm">AI familiarity</h2><p class="sees__src">We couldn’t reach Wikidata during this scan, so the score uses page readiness only.</p></section>`;
    return `<section class="sees" aria-labelledby="fam-h">
      <h2 class="report__h report__h--sm" id="fam-h">AI familiarity</h2>
      ${f.known ? `<p class="sees__quote">${esc(f.label || '')}${f.description ? ` <span class="muted">— ${esc(f.description)}</span>` : ''}</p>
        <p class="sees__src">${esc(f.level)}: a Wikidata entity with ${f.sitelinks} Wikipedia editions. <a href="https://www.wikidata.org/wiki/${esc(f.id)}" target="_blank" rel="noopener">${esc(f.id)}</a></p>`
      : `<p class="sees__quote">Not yet a known entity.</p><p class="sees__src">We didn’t find this site as the official website of any Wikidata entity. AI systems lean on knowledge graphs like Wikidata and Wikipedia; for most young or small sites this is normal, and it builds with coverage over time.</p>`}
      ${r && r.readiness != null ? `<dl class="sees__list"><div><dt>Page readiness</dt><dd>${r.readiness} / 100 · 75% of the score</dd></div><div><dt>AI familiarity</dt><dd>${f.score} / 100 · 25% of the score</dd></div></dl>` : ''}
    </section>`;
  }

  /* ---------------- AI files: validate, generate, install ---------------- */
  const FILE_STATUS = { ok: ['Ready', 'ok'], fix: ['Needs fix', 'fix'], missing: ['Missing', 'missing'], optional: ['Optional', 'optional'] };
  function renderFiles(r) {
    const F = r.aiFiles; if (!F) return '';
    const tab = (f, i) => `<button class="ftab" role="tab" id="ftab-${f.id}" aria-controls="fpanel-${f.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-file="${f.id}">
        <span class="ftab__name">${esc(f.name)}</span><span class="fstatus fstatus--${FILE_STATUS[f.status][1]}">${FILE_STATUS[f.status][0]}</span></button>`;
    const panel = (f, i) => `<div class="fpanel" role="tabpanel" id="fpanel-${f.id}" aria-labelledby="ftab-${f.id}" ${i === 0 ? '' : 'hidden'}>
        <p class="fpanel__what">${esc(f.what)}</p>
        ${f.optionalNote ? `<p class="fpanel__note">${esc(f.optionalNote)}</p>` : ''}
        ${(f.issues || []).length || (f.notes || []).length ? `<ul class="fpanel__issues">${(f.issues || []).map(t => `<li class="is-issue">${esc(t)}</li>`).join('')}${(f.notes || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
          : f.status === 'ok' ? `<p class="fpanel__note">We found a valid ${esc(f.name)} on your site. The version below is a refreshed draft built from your pages, if you want it.</p>` : ''}
        <div class="fcode"><div class="fcode__bar"><span>${esc(f.status === 'ok' ? 'Suggested refresh' : f.id === 'robots' && f.status !== 'missing' ? 'Add to your robots.txt' : 'Ready to install')} · <code>${esc(f.path)}</code></span>
          <span class="fcode__tools"><button class="btn btn--ghost btn--sm" type="button" data-fcopy="${f.id}">Copy</button><button class="btn btn--ghost btn--sm" type="button" data-fdl="${f.id}">Download</button></span></div>
          <pre class="fcode__pre" tabindex="0"><code>${esc(f.generated)}</code></pre></div>
        ${f.template ? `<details class="fpanel__more"><summary>Template entry for when you launch an MCP server or agent</summary><pre class="fcode__pre fcode__pre--sm"><code>${esc(f.template)}</code></pre></details>` : ''}
        <p class="fpanel__install"><strong>Where it goes:</strong> ${esc(f.install)}</p>
        ${/\[[^\]\n]+\](?!\()/.test(f.generated) ? `<p class="fpanel__note">Anything in [brackets] is a placeholder: we didn’t find that fact on your site, so we didn’t invent it.</p>` : ''}
      </div>`;
    return `<section class="files" id="ai-files" aria-labelledby="files-h">
      <div class="files__head">
        <div><h2 class="report__h" id="files-h">Your AI files</h2>
          <p class="report__sub">Written from your own site. ${F.ready} of ${F.total} ready today; the AI catalog is optional.</p></div>
        <button class="btn btn--primary" type="button" id="files-zip">${icon('download')} Download all (.zip)</button>
      </div>
      <div class="ftabs" role="tablist" aria-label="AI files">${F.files.map(tab).join('')}</div>
      ${F.files.map(panel).join('')}
      <p class="files__honest">These files make your site easier for AI tools and agents to read. They don’t guarantee you’ll be cited: no file can. <a href="methodology/index.html#ai-files">How we build them</a></p>
    </section>`;
  }

  function wireFiles(r) {
    const F = r.aiFiles; if (!F) return;
    const byId = id => F.files.find(f => f.id === id);
    const tabs = [...report.querySelectorAll('.ftab')];
    const select = t => {
      tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; document.getElementById('fpanel-' + x.dataset.file).hidden = !on; });
      track('ai_file_tab', { file: t.dataset.file });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const k = e.key; let j = null;
        if (k === 'ArrowRight') j = (i + 1) % tabs.length; else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length; else if (k === 'Home') j = 0; else if (k === 'End') j = tabs.length - 1;
        if (j != null) { e.preventDefault(); tabs[j].focus(); select(tabs[j]); }
      });
    });
    report.querySelectorAll('[data-fcopy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(byId(b.dataset.fcopy).generated); showToast('Copied'); track('ai_file_copy', { file: b.dataset.fcopy }); } catch { showToast('Could not copy.'); }
    }));
    report.querySelectorAll('[data-fdl]').forEach(b => b.addEventListener('click', () => {
      const f = byId(b.dataset.fdl); saveBlob(new Blob([f.generated], { type: 'text/plain' }), f.filename); track('ai_file_download', { file: f.id });
    }));
    $('#files-zip')?.addEventListener('click', () => {
      const readme = `AI files for ${r.domain}\nGenerated by Aeoden (aeoden.com) on ${new Date().toISOString().slice(0, 10)}.\n\n` +
        F.files.map(f => `${f.filename}\n  ${f.name} — ${f.what}\n  Where it goes: ${f.install}\n`).join('\n') +
        `\nAnything in [brackets] is a placeholder: we didn't find that fact on your site, so we didn't invent it.\n`;
      const entries = [...F.files.map(f => ({ name: f.id === 'catalog' ? '.well-known/ai-catalog.json' : f.filename, text: f.generated })), { name: 'README.txt', text: readme }];
      saveBlob(zipStore(entries), `${r.domain.replace(/[^a-z0-9.-]/gi, '')}-ai-files.zip`);
      showToast('AI files downloaded'); track('ai_files_zip');
    });
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* Minimal ZIP writer (stored, no compression): small text files only */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = bytes => { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dosTime, 2], [12, dosDate, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, n]) => n === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true));
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dosTime, 2], [14, dosDate, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([o, v, n]) => n === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true));
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdSize, 4], [16, offset, 4], [20, 0, 2]].forEach(([o, v, n]) => n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  function renderReport(r) {
    const sees = r.whatAiSees, cats = ['access', 'clarity', 'answers', 'trust'];
    report.innerHTML = `
      <div class="wrap">
        ${renderFiles(r)}
        <div class="report__grid">
          <section aria-labelledby="fixes-h">
            <h2 class="report__h" id="fixes-h">Fix these first</h2>
            <p class="report__sub">Ranked by how many points they cost you.</p>
            ${r.fixes.length ? `<ol class="fixes">${r.fixes.map((f, i) => renderFix(f, i + 1)).join('')}</ol>` : `<p class="report__empty">Nothing urgent. Every weighted check passes.</p>`}
            ${r.moreFixes && r.moreFixes.length ? `<details class="more-fixes"><summary>${r.moreFixes.length} more improvements</summary><ul>${r.moreFixes.map(f => `<li><span>${esc(f.title)}</span><span>${esc(f.categoryName)}</span></li>`).join('')}</ul></details>` : ''}
          </section>
          <aside class="report__side">
            <section class="sees" aria-labelledby="sees-h">
              <h2 class="report__h report__h--sm" id="sees-h">What AI sees</h2>
              ${sees.unclear ? `<p class="sees__quote">${esc(sees.summary)}</p>` : `<p class="sees__quote"><q>${esc(sees.purpose)}</q></p><p class="sees__src">Quoted from the page's ${esc(sees.source || 'text')}, never rewritten. Confidence: ${esc(sees.confidence)}.</p>`}
              <dl class="sees__list">
                <div><dt>Site name</dt><dd>${esc(sees.siteName || 'Not found')}</dd></div>
                <div><dt>Audience</dt><dd>${esc(sees.audience || 'Not stated')}</dd></div>
                <div><dt>Topics</dt><dd>${esc(sees.topics && sees.topics.length ? sees.topics.join(', ') : 'No clear sections')}</dd></div>
              </dl>
            </section>
            ${familiarityBlock(r.familiarity, r)}
            ${renderMark(r)}
          </aside>
        </div>
        <section class="report__checks" aria-labelledby="checks-h">
          <h2 class="report__h" id="checks-h">Every check</h2>
          <p class="report__sub">Open a category to see what passed and what needs attention.</p>
          <div class="acc">
            ${cats.map(k => renderCat(r.categories[k], k)).join('')}
            ${r.extras && r.extras.length ? `<details class="acc__row acc__row--plain"><summary><span class="acc__name">Also noted</span><span class="acc__label">Not scored</span><span class="acc__chev" aria-hidden="true"></span></summary><div class="acc__body"><ul class="checks">${r.extras.map(renderCheck).join('')}</ul></div></details>` : ''}
          </div>
          <p class="report__note">A diagnostic score, not a guarantee. <a href="methodology/index.html">How the score works</a></p>
        </section>
        <p class="report__again"><button class="btn btn--ghost" type="button" id="again-btn">${r.demo ? 'Check my site' : 'Check another site'}</button></p>
      </div>`;
    report.hidden = false;
    wireFiles(r);
    report.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', () => {
      const p = document.getElementById(b.dataset.reveal), open = p.hidden;
      p.hidden = !open; b.setAttribute('aria-expanded', String(open));
      if (open) track('show_fix', { fix: b.dataset.reveal });
    }));
    report.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).querySelector('.snippet').textContent); showToast('Copied'); } catch { showToast('Could not copy.'); }
    }));
    $('#again-btn').addEventListener('click', checkAnother);
  }

  function renderMark(r) {
    const cal = CFG.CALENDLY_URL, li = CFG.LINKEDIN_URL;
    if (!cal && !li) return '';
    const ask = r.demo ? 'Questions about your own site?' : r.score >= 85 ? 'Want to keep it that way?' : 'Want help with these fixes?';
    return `<aside class="mark results__mark" aria-labelledby="mark-h">
      <div class="mark__bar"><span class="lbl"><b>Follow-up</b></span><span class="lbl">Mark Flournoy</span></div>
      <div class="mark__body">
        <img class="mark__photo" src="assets/img/mark.jpg" width="88" height="88" alt="Mark Flournoy" loading="lazy">
        <div>
          <span class="lbl lbl--signal">${esc(ask)}</span>
          <h3 class="mark__name" id="mark-h">Talk it through with Mark.</h3>
          <p>I built Aeoden after watching AI answers change the value of a click. If your card has more to fix than you'd like, I'm happy to walk through it with you.</p>
        </div>
      </div>
      <div class="mark__actions">
        ${cal ? `<a class="btn arrow" href="${esc(cal)}" target="_blank" rel="noopener" data-cta="calendly">Talk to Mark</a>` : ''}
        ${li ? `<a class="btn btn--ghost" href="${esc(li)}" target="_blank" rel="noopener" data-cta="linkedin">Message on LinkedIn</a>` : ''}
      </div>
    </aside>`;
  }

  function renderFix(f, n) {
    const id = 'fix-' + f.id;
    return `<li class="fix">
      <span class="fix__n" aria-hidden="true">${n}</span>
      <div class="fix__body">
        <h3 class="fix__title">${esc(n === 1 ? R.shareFix(current) : f.title)}</h3>
        <p class="fix__why">${esc(f.why)}</p>
        <p class="fix__meta">${esc(f.categoryName)} · ${esc(EFFORT_WORD[f.effort] || f.effort)}</p>
        ${f.action ? `<button class="fix__toggle" type="button" aria-expanded="false" aria-controls="${id}" data-reveal="${id}">${esc(f.action.label)}</button>
        <div class="fix__reveal" id="${id}" hidden>
          ${f.action.kind === 'code' ? `<pre class="snippet"><code>${esc(f.action.content)}</code></pre>` : `<div class="snippet snippet--text">${esc(f.action.content)}</div>`}
          <div class="fix__tools"><button class="btn btn--ghost btn--sm" type="button" data-copy="${id}">Copy</button>
          ${/\[/.test(f.action.content) ? `<span class="snippet__note">Anything in [brackets] is a placeholder. We did not find that fact on your page, so we did not invent it.</span>` : ''}</div>
        </div>` : ''}
      </div>
    </li>`;
  }

  function renderCat(c, k) {
    const needs = c.checks.filter(k => k.status !== 'pass');
    const passing = c.checks.filter(k => k.status === 'pass');
    const pct = c.notEvaluated ? 0 : c.score;
    let body;
    if (!c.checks.length) body = `<p class="acc__empty">Not evaluated because the page could not be loaded. Fix access first, then scan again.</p>`;
    else {
      body = needs.length ? `<ul class="checks">${needs.map(renderCheck).join('')}</ul>` : `<p class="acc__empty">Everything in this category passes.</p>`;
      if (passing.length) body += `<details class="acc__passing"><summary>Show ${passing.length} passing check${passing.length === 1 ? '' : 's'}</summary><ul class="checks">${passing.map(renderCheck).join('')}</ul></details>`;
    }
    return `<details class="acc__row" id="cat-${k || c.name.toLowerCase()}">
      <summary>
        <span class="acc__name">${esc(c.name)}</span>
        <span class="acc__score">${c.notEvaluated ? '–' : c.score}</span>
        <span class="acc__chev" aria-hidden="true"></span>
        <span class="seg${['C', 'D', 'F'].includes(c.grade) ? ' is-weak' : ''}" aria-hidden="true">${Array.from({ length: 20 }, (_, i) => `<i${i < Math.round(pct / 5) ? ' class="on"' : ''}></i>`).join('')}</span>
        <span class="acc__label">${esc(c.label)}${needs.length && c.checks.length ? ` · ${needs.length} to review` : ''}</span>
        <span class="sr-only">${c.notEvaluated ? 'not evaluated' : `${c.score} out of 100`}</span>
      </summary>
      <div class="acc__body"><p class="acc__q">${esc(c.question)}</p>${body}</div>
    </details>`;
  }

  const STATUS_WORD = { pass: 'Pass', warn: 'Partial', fail: 'Missing', info: 'Note' };
  const STATUS_GLYPH = { pass: '✓', warn: '!', fail: '×', info: 'i' };
  function renderCheck(k) {
    return `<li class="check" data-status="${esc(k.status)}">
      <span class="check__dot" aria-hidden="true">${STATUS_GLYPH[k.status] || ''}</span>
      <div>
        <div class="check__title"><span class="sr-only">${STATUS_WORD[k.status] || ''}: </span>${esc(k.title)}</div>
        <div class="check__detail">${esc(k.detail)}${k.evidence && k.status !== 'pass' ? ` <code>${esc(k.evidence)}</code>` : ''}</div>
      </div>
    </li>`;
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-cta]');
    if (a) track('cta_' + a.dataset.cta, { location: a.closest('.results') ? 'results' : a.closest('.site-head') ? 'nav' : 'page', score: current ? current.score : undefined });
  });

  /* ---------------- Actions ---------------- */
  function closeMenus(except) {
    document.querySelectorAll('.menu').forEach(m => { if (m !== except) m.hidden = true; });
    document.querySelectorAll('[aria-haspopup="true"]').forEach(b => { if (!except || b.getAttribute('aria-controls') !== except.id) b.setAttribute('aria-expanded', 'false'); });
  }
  document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
  function wireMenu(btn, menu) {
    btn.addEventListener('click', () => {
      const open = menu.hidden;
      closeMenus(open ? menu : null);
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('button')?.focus();
    });
    menu.addEventListener('keydown', e => {
      const items = [...menu.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }

  function wireActions(r) {
    const dlBtn = $('#dl-btn'), dlMenu = $('#dl-menu'), moreBtn = $('#more-btn'), moreMenu = $('#more-menu');
    wireMenu(dlBtn, dlMenu); wireMenu(moreBtn, moreMenu);
    dlMenu.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', async () => {
      closeMenus(); dlBtn.focus(); busy(dlBtn, true);
      try { await X.downloadPNG(r, b.dataset.size); showToast('Card downloaded'); track('export_png', { size: b.dataset.size }); }
      catch (err) { showToast('Could not create the image. Try another browser.'); console.error(err); }
      finally { busy(dlBtn, false); }
    }));
    moreMenu.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      closeMenus(); moreBtn.focus();
      try {
        if (b.dataset.act === 'copy-img') { await X.copyPNG(r, 'square'); showToast('Card image copied'); track('copy_image'); }
        if (b.dataset.act === 'copy-txt') { await navigator.clipboard.writeText(R.summaryText(r)); showToast('Summary copied'); track('copy_summary'); }
        if (b.dataset.act === 'svg') { await X.downloadSVG(r, 'square'); showToast('SVG downloaded'); track('export_svg'); }
      } catch { showToast(b.dataset.act === 'copy-img' ? 'Your browser blocked image copying. Download instead.' : 'That did not work. Try again.'); }
    });
    $('#share-btn').addEventListener('click', async () => {
      const shareUrl = r.demo ? `${CFG.SITE_URL}/#demo=${demoKey || 'quotabird'}` : `${CFG.SITE_URL}/?url=${encodeURIComponent(r.domain)}`;
      const text = `${r.domain} scored ${r.score}/100 (${r.status}) on its AEO Card: how well AI can understand the site.`;
      if (navigator.share) { try { await navigator.share({ title: `AEO Card — ${r.domain}`, text, url: shareUrl }); track('share', { method: 'native' }); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); showToast('Link copied'); track('share', { method: 'copy_link' }); } catch { showToast('Could not copy the link.'); } }
    });
  }

  function checkAnother() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    input.focus(); input.select();
  }

  function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.setAttribute('aria-busy', String(on)); }
  let toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.dataset.show = 'false'; }, 2400);
  }
  function announce(msg) { if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 50); } }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
  function prefersReducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function icon(name) {
    const paths = {
      download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
      image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-7 7"/>',
      text: '<path d="M4 6h16M4 12h10M4 18h13"/>',
      share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
      report: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h6M9 17h6"/>',
      arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
      grid: '<circle cx="6" cy="6" r="1.6" fill="currentColor"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/><circle cx="18" cy="6" r="1.6" fill="currentColor"/><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/><circle cx="6" cy="18" r="1.6" fill="currentColor"/><circle cx="12" cy="18" r="1.6" fill="currentColor"/><circle cx="18" cy="18" r="1.6" fill="currentColor"/>',
      more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }
})();
