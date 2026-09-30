/* ============================================================
   CheckAEO app — homepage checker + results
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
  const hero = $('#hero');
  const heroExample = $('#hero-example');
  const heroAside = $('#hero-aside');
  const scanState = $('#scan-state');
  const results = $('#results');
  const live = $('#live');
  const toast = $('#toast');

  let current = null;       // current result
  let demoKey = null;

  /* ---------------- Boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Example card in the hero, always rendered from bundled data.
    const demo = firstDemo();
    if (heroExample && demo) heroExample.insertAdjacentHTML('beforeend', R.renderCardHTML(demo));
    if (!apiConfigured()) $('#demo-hint')?.removeAttribute('hidden');

    const params = new URLSearchParams(location.search);
    if (location.hash.startsWith('#demo')) {
      showDemo(location.hash.split('=')[1] || null);
    } else if (params.get('url')) {
      input.value = params.get('url');
      startScan(params.get('url'));
    }
    document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => showDemo(b.dataset.demo || null)));
    document.querySelectorAll('[data-example-url]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.exampleUrl; input.focus(); }));
  });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    startScan(input.value);
  });

  function firstDemo(key) {
    const demos = window.CHECKAEO_DEMOS || {};
    return demos[key] || demos.quotabird || Object.values(demos)[0] || null;
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

  /* ---------------- Scan flow ---------------- */
  const STEPS = ['Reach site', 'Read robots.txt + headers', 'Read public HTML', 'Score access / clarity / answers / trust', 'Write AEO Card'];

  async function startScan(raw) {
    const n = normalizeUrl(raw);
    if (n.error) { formError.textContent = n.error; input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
    formError.textContent = '';
    input.removeAttribute('aria-invalid');
    const url = n.url;
    history.replaceState(null, '', '?url=' + encodeURIComponent(url.replace(/^https:\/\//, '').replace(/\/$/, '')));
    track('scan_start');

    if (!apiConfigured()) { showUnavailable(url, 'The live scanner is not configured yet.'); return; }

    setScanning(url);
    let stepTimer = animateSteps();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), CFG.SCAN_TIMEOUT_MS || 25000);
      const res = await fetch(CFG.SCAN_API_URL.replace(/\/$/, '') + '/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: ctrl.signal
      });
      clearTimeout(t);
      const data = await res.json().catch(() => ({}));
      clearInterval(stepTimer);
      if (!res.ok || !data.ok) {
        showUnavailable(url, data.error || `The scanner returned an error (${res.status}).`, true);
        track('scan_error', { reason: data.error || res.status });
        return;
      }
      demoKey = null;
      renderResults(data);
      track('scan_complete', { score: data.score, grade: data.grade });
    } catch (err) {
      clearInterval(stepTimer);
      const msg = err && err.name === 'AbortError' ? 'The scan took too long. The site may be slow or blocking automated requests.' : 'We could not reach the scanner. Check your connection and try again.';
      showUnavailable(url, msg, true);
      track('scan_error', { reason: err && err.name });
    }
  }

  function setScanning(url) {
    document.body.classList.remove('results-mode');
    submitBtn.disabled = true;
    hero.classList.add('hero--compact');
    heroAside.innerHTML = `<div class="scanning" role="status" aria-live="polite">
      <div class="scan-glyph" aria-hidden="true">${R.glyphSVG()}</div><span class="lbl lbl--signal">Status / Running</span>
      <div class="scanning__domain">${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div>
      <ol class="scanning__steps" id="scan-steps">${STEPS.map((s, i) => `<li data-state="${i === 0 ? 'active' : ''}">${esc(s)}</li>`).join('')}</ol>
    </div>`;
    results.hidden = true;
    results.innerHTML = '';
    announce('Scanning ' + url);
  }
  function animateSteps() {
    let i = 0;
    return setInterval(() => {
      const items = document.querySelectorAll('#scan-steps li');
      if (!items.length) return;
      if (i < items.length - 1) { items[i].dataset.state = 'done'; i++; items[i].dataset.state = 'active'; }
    }, 1400);
  }

  function showUnavailable(url, message, isError) {
    document.body.classList.remove('results-mode');
    results.hidden = true;
    submitBtn.disabled = false;
    hero.classList.add('hero--compact');
    heroAside.innerHTML = `<div class="notice ${isError ? 'notice--error' : ''}" role="alert">
      <span class="lbl lbl--signal">Status / Stopped</span><p class="mt-1"><strong>${esc(message)}</strong></p><p class="small muted mt-1">You can still look at an example AEO Card while you sort it out.</p>
    </div>
    <div class="card-actions">
      <button class="btn" type="button" data-demo="">See an example AEO Card</button>
      <button class="btn btn--ghost" type="button" id="retry-btn">Try again</button>
    </div>`;
    heroAside.querySelector('[data-demo]').addEventListener('click', () => showDemo(null));
    $('#retry-btn')?.addEventListener('click', () => startScan(url));
    announce(message);
  }

  function showDemo(key) {
    const demos = window.CHECKAEO_DEMOS || {};
    demoKey = demos[key] ? key : 'quotabird';
    const data = firstDemo(demoKey);
    if (!data) return;
    history.replaceState(null, '', '#demo=' + demoKey);
    input.value = '';
    renderResults(data);
    track('demo_view', { key: demoKey });
  }

  /* ---------------- Results ----------------
     Mobile-first order: slim scan bar → the AEO Card → two actions → 3 fixes → all checks (collapsed).
     The hero and homepage marketing are hidden while a result is on screen, so the card is the first thing seen. */
  const EFFORT_WORD = { Easy: 'Easy fix', Medium: 'Medium effort', Hard: 'Bigger job' };

  function renderResults(r) {
    current = r;
    submitBtn.disabled = false;
    document.body.classList.add('results-mode');
    results.hidden = false;
    const cats = ['access', 'clarity', 'answers', 'trust'];
    const againLabel = r.demo ? 'Check my site' : 'Check another site';

    results.innerHTML = `
      <div class="wrap results__grid">
        <div class="scanbar">
          <div>
            <span class="lbl lbl--signal">AEO Card / ${esc(R.recordId(r))} / ${r.demo ? 'Sample' : 'Complete'}</span>
            <h1 class="scanbar__title" id="your-card-h" tabindex="-1">${r.demo ? 'Example AEO Card' : 'Your AEO Card'}</h1>
            <p class="scanbar__meta">${r.demo ? 'Sample result, not a live scan' : esc(r.domain)}</p>
          </div>
          <button class="btn btn--tonal btn--sm" type="button" id="scanbar-again">${againLabel}</button>
        </div>

        <div class="results__card-wrap">
          <div id="card-mount">${R.renderCardHTML(r)}</div>
          <div class="card-actions" aria-label="Card actions">
            <div class="menu-wrap menu-wrap--grow">
              <button class="btn btn--accent" type="button" id="dl-btn" aria-haspopup="true" aria-expanded="false" aria-controls="dl-menu">${icon('download')} Download card</button>
              <div class="menu" id="dl-menu" hidden role="menu" aria-label="Choose a size">
                ${Object.entries(X.SIZES).map(([k, s]) => `<button type="button" role="menuitem" data-size="${k}"><strong>${esc(s.label)}</strong><span>${esc(s.hint)}</span></button>`).join('')}
              </div>
            </div>
            <button class="btn btn--tonal" type="button" id="share-btn">${icon('share')} Share</button>
            <div class="menu-wrap">
              <button class="btn btn--tonal btn--icon" type="button" id="more-btn" aria-label="More options" aria-haspopup="true" aria-expanded="false" aria-controls="more-menu">${icon('more')}</button>
              <div class="menu menu--end" id="more-menu" hidden role="menu" aria-label="More options">
                ${X.canCopyImage() ? `<button type="button" role="menuitem" data-act="copy-img"><strong>Copy image</strong><span>paste straight into a post</span></button>` : ''}
                <button type="button" role="menuitem" data-act="copy-txt"><strong>Copy summary</strong><span>plain text for an email or post</span></button>
                <button type="button" role="menuitem" data-act="svg"><strong>Download SVG</strong><span>vector, editable</span></button>
              </div>
            </div>
          </div>
        </div>

        <section class="results__fixes" aria-labelledby="fixes-h" id="full-report">
          <span class="lbl lbl--signal">Priority</span>
          <h2 class="results__h" id="fixes-h">Fix these 3 things first</h2>
          <p class="results__sub">Ranked by how many points they cost you.</p>
          ${r.fixes.length ? `<ol class="fixes">${r.fixes.map((f, i) => renderFix(f, i + 1)).join('')}</ol>` : `<div class="empty">${R.motifSVG()}<p><strong>Nothing urgent.</strong> Every weighted check passes. Keep the content current and specific.</p></div>`}
          ${r.moreFixes && r.moreFixes.length ? `<details class="more-fixes"><summary>${r.moreFixes.length} more improvements</summary><ul>${r.moreFixes.map(f => `<li><strong>${esc(f.title)}</strong><span>${esc(f.categoryName)} · ${esc(EFFORT_WORD[f.effort] || f.effort)}</span></li>`).join('')}</ul></details>` : ''}
        </section>

        ${renderMark(r)}

        <section class="results__checks" aria-labelledby="checks-h">
          <span class="lbl lbl--signal">All checks</span>
          <h2 class="results__h" id="checks-h">Every check, in plain English</h2>
          <p class="results__sub">Open a category to see what needs attention.</p>
          <div class="acc">
            ${cats.map(k => renderCat(r.categories[k])).join('')}
            ${renderSees(r.whatAiSees)}
            ${r.extras && r.extras.length ? `<details class="acc__row acc__row--plain"><summary><span class="acc__name">Also noted</span><span class="acc__label">Not scored</span><span class="acc__chev" aria-hidden="true"></span></summary><div class="acc__body"><ul class="checks">${r.extras.map(renderCheck).join('')}</ul></div></details>` : ''}
          </div>
          <p class="results__method">A diagnostic score, not a guarantee. <a href="methodology/index.html">How the score works</a></p>
          <p class="again"><button class="btn btn--text" type="button" id="again-btn">${againLabel}</button></p>
        </section>
      </div>`;

    wireActions(r);
    window.scrollTo({ top: 0, behavior: 'auto' });
    $('#your-card-h')?.focus({ preventScroll: true });
    announce(`AEO Card ready. ${r.domain} scored ${r.score} out of 100, ${r.status}.`);
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
          <h2 class="mark__name" id="mark-h">Talk it through with Mark.</h2>
          <p>I built CheckAEO after watching AI answers change the value of a click. If your record has more to fix than you'd like, I'm happy to walk through it with you.</p>
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
      <span class="fix__n" aria-hidden="true">0${n}</span>
      <div class="fix__body">
        <h3 class="fix__title">${esc(n === 1 ? R.shareFix(current) : f.title)}</h3>
        <p class="fix__why">${esc(f.why)}</p>
        <p class="fix__meta">${esc(f.categoryName)} · ${esc(EFFORT_WORD[f.effort] || f.effort)}</p>
        ${f.action ? `<button class="btn btn--text btn--sm fix__toggle" type="button" aria-expanded="false" aria-controls="${id}" data-reveal="${id}">${esc(f.action.label)}</button>
        <div class="fix__reveal" id="${id}" hidden>
          ${f.action.kind === 'code' ? `<pre class="snippet"><code>${esc(f.action.content)}</code></pre>` : `<div class="snippet snippet--text">${esc(f.action.content)}</div>`}
          <div class="fix__tools">
            <button class="btn btn--tonal btn--sm" type="button" data-copy="${id}">Copy</button>
            ${/\[/.test(f.action.content) ? `<span class="snippet__note">Anything in [brackets] is a placeholder. We did not find that fact on your page, so we did not invent it.</span>` : ''}
          </div>
        </div>` : ''}
      </div>
    </li>`;
  }

  function renderCat(c) {
    const needs = c.checks.filter(k => k.status !== 'pass');
    const passing = c.checks.filter(k => k.status === 'pass');
    const pct = c.notEvaluated ? 0 : c.score;
    let body;
    if (!c.checks.length) body = `<p class="acc__empty">Not evaluated because the page could not be loaded. Fix access first, then scan again.</p>`;
    else {
      body = needs.length ? `<ul class="checks">${needs.map(renderCheck).join('')}</ul>` : `<p class="acc__empty">Everything in this category passes.</p>`;
      if (passing.length) body += `<details class="acc__passing"><summary>Show ${passing.length} passing check${passing.length === 1 ? '' : 's'}</summary><ul class="checks">${passing.map(renderCheck).join('')}</ul></details>`;
    }
    return `<details class="acc__row">
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

  function renderSees(sees) {
    const row = (k, v, empty) => `<div><dt>${esc(k)}</dt><dd class="${v ? '' : 'muted'}">${esc(v || empty)}</dd></div>`;
    return `<details class="acc__row acc__row--plain">
      <summary><span class="acc__name">Site interpretation</span><span class="acc__label">Confidence: ${esc(cap(sees.confidence))}</span><span class="acc__chev" aria-hidden="true"></span></summary>
      <div class="acc__body">
        ${sees.unclear ? `<p class="acc__q">${esc(sees.summary)}</p>` : `<p class="acc__quote"><q>${esc(sees.purpose)}</q></p><p class="acc__q">Quoted from the page's ${esc(sees.source || 'text')}. We show the page's own words, never a rewrite.</p>`}
        <dl class="sees__list">
          ${row('Site name', sees.siteName, 'Not found')}
          ${row('Likely audience', sees.audience, 'Not stated')}
          ${row('Likely topics', sees.topics && sees.topics.length ? sees.topics.join(', ') : '', 'No clear sections')}
        </dl>
      </div>
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
    wireMenu(dlBtn, dlMenu);
    wireMenu(moreBtn, moreMenu);

    dlMenu.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', async () => {
      closeMenus(); dlBtn.focus();
      busy(dlBtn, true);
      try { await X.downloadPNG(r, b.dataset.size); showToast('Card downloaded'); track('export_png', { size: b.dataset.size }); }
      catch (err) { showToast('Could not create the image. Try another browser.'); console.error(err); }
      finally { busy(dlBtn, false); }
    }));

    moreMenu.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      closeMenus(); moreBtn.focus();
      const act = b.dataset.act;
      try {
        if (act === 'copy-img') { await X.copyPNG(r, 'square'); showToast('Card image copied'); track('copy_image'); }
        if (act === 'copy-txt') { await navigator.clipboard.writeText(R.summaryText(r)); showToast('Summary copied'); track('copy_summary'); }
        if (act === 'svg') { await X.downloadSVG(r, 'square'); showToast('SVG downloaded'); track('export_svg'); }
      } catch {
        showToast(act === 'copy-img' ? 'Your browser blocked image copying. Download instead.' : 'That did not work. Try again.');
      }
    });

    $('#share-btn').addEventListener('click', async () => {
      const shareUrl = r.demo ? `${CFG.SITE_URL}/#demo=${demoKey || 'quotabird'}` : `${CFG.SITE_URL}/?url=${encodeURIComponent(r.domain)}`;
      const text = `${r.domain} scored ${r.score}/100 (${r.status}) on its AEO Card — how ready it is for AI search.`;
      if (navigator.share) {
        try { await navigator.share({ title: `AEO Card — ${r.domain}`, text, url: shareUrl }); track('share', { method: 'native' }); } catch { /* cancelled */ }
      } else {
        try { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); showToast('Link copied'); track('share', { method: 'copy_link' }); } catch { showToast('Could not copy the link.'); }
      }
    });

    document.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', () => {
      const panel = document.getElementById(b.dataset.reveal);
      const open = panel.hidden;
      panel.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      if (open) track('show_fix', { fix: b.dataset.reveal });
    }));
    document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      const text = document.getElementById(b.dataset.copy).querySelector('.snippet').textContent;
      try { await navigator.clipboard.writeText(text); showToast('Copied'); } catch { showToast('Could not copy.'); }
    }));
    $('#again-btn').addEventListener('click', backToChecker);
    $('#scanbar-again').addEventListener('click', backToChecker);
  }

  function backToChecker() {
    document.body.classList.remove('results-mode');
    results.hidden = true;
    results.innerHTML = '';
    hero.classList.remove('hero--compact');
    heroAside.innerHTML = `<div class="hero__example" id="hero-example"><div class="specimen__bar"><span class="lbl"><b>AEO Card</b> / Object CA-01</span><span class="lbl">Status / Sample record</span></div>${R.renderCardHTML(firstDemo())}</div>`;
    history.replaceState(null, '', location.pathname);
    input.value = '';
    window.scrollTo({ top: 0, behavior: 'auto' });
    input.focus();
  }

  /* ---------------- Utilities ---------------- */
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
      more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }
})();
