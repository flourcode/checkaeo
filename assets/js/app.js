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
  const slot = $('#panel-slot');
  const caption = $('#panel-caption');
  const report = $('#report');
  const live = $('#live');
  const toast = $('#toast');

  let current = null;
  let demoKey = null;
  let lastUrl = null;

  const STATUS = { ok: ['Ready', 'ok'], fix: ['Needs fix', 'fix'], missing: ['Missing', 'missing'], optional: ['Optional', 'optional'] };
  const ORDER = ['llms', 'jsonld', 'robots', 'catalog'];

  /* ---------------- Boot: the example files are the placeholder ---------------- */
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
    slot.innerHTML = renderPanel(ex, 'example');
    wirePanel(ex);
    caption.hidden = false;
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

  /* ---------------- Scan flow: the panel fills in place ---------------- */
  const STEPS = ['Reaching the site', 'Reading robots.txt and headers', 'Reading the page and sitemap', 'Checking your llms.txt and AI catalog', 'Writing your AI files'];

  async function startScan(raw, fresh = false) {
    const n = normalizeUrl(raw);
    if (n.error) { formError.textContent = n.error; input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
    formError.textContent = ''; input.removeAttribute('aria-invalid');
    const url = n.url; lastUrl = url;
    const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    history.replaceState(null, '', '?url=' + encodeURIComponent(domain));
    track('scan_start', { fresh });
    if (!apiConfigured()) { showError(domain, 'The live scanner is not connected on this copy of the site.'); return; }

    submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true');
    slot.innerHTML = renderLoading(domain);
    caption.hidden = true; report.hidden = true;
    slot.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    announce('Checking ' + domain);
    let i = 0;
    const stepTimer = setInterval(() => { const el = $('#fp-step'); if (el && i < STEPS.length - 1) el.textContent = STEPS[++i]; }, 1500);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), CFG.SCAN_TIMEOUT_MS || 25000);
      const res = await fetch(CFG.SCAN_API_URL.replace(/\/$/, '') + '/scan' + (fresh ? '?fresh=1' : ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: ctrl.signal });
      clearTimeout(t);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { showError(domain, data.error || `The scanner returned an error (${res.status}).`); track('scan_error', { reason: data.error || res.status }); return; }
      demoKey = null;
      showResult(data);
      track('scan_complete', { ready: data.aiFiles ? data.aiFiles.ready : null, blocked: !!data.blocked });
    } catch (err) {
      showError(domain, err && err.name === 'AbortError' ? 'The check took too long. The site may be slow or blocking automated requests.' : 'We could not reach the scanner. Check your connection and try again.');
      track('scan_error', { reason: err && err.name });
    } finally {
      clearInterval(stepTimer);
      submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy');
    }
  }

  function showError(domain, message) {
    slot.innerHTML = `<section class="fp" data-mode="error" aria-labelledby="fp-domain">
      <header class="fp__head"><div><p class="fp__kick">Couldn’t check this site</p><h2 class="fp__domain" id="fp-domain">${esc(domain)}</h2><p class="fp__summary">${esc(message)}</p></div></header>
      <div class="fp__actions"><button class="btn btn--primary btn--sm" type="button" id="retry-btn">Try again</button><button class="btn btn--ghost btn--sm" type="button" data-demo="">See an example</button></div>
    </section>`;
    caption.hidden = true; report.hidden = true;
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

  function showResult(r) {
    current = r;
    slot.innerHTML = r.blocked ? renderBlocked(r) : renderPanel(r, r.demo ? 'demo' : 'result');
    if (!r.blocked) wirePanel(r);
    $('#retry-btn')?.addEventListener('click', () => startScan(lastUrl || r.domain, true));
    caption.hidden = true;
    renderReport(r);
    document.body.classList.add('results-mode');
    announce(r.blocked ? `${r.domain} blocked our scanner. ${R.knownText(r.familiarity) || ''}` : `${r.domain}: ${summaryLine(r)}. Your AI files are ready to copy or download.`);
  }

  /* ---------------- The files panel ---------------- */
  function summaryLine(r) {
    const F = r.aiFiles; if (!F) return '';
    const missing = F.files.filter(f => f.id !== 'catalog' && f.status !== 'ok').length;
    if (!missing) return 'All AI files ready';
    return `${missing} of ${F.total} files ${missing === 1 ? 'needs' : 'need'} work`;
  }
  const orderFiles = F => ORDER.map(id => F.files.find(f => f.id === id)).filter(Boolean);
  const firstToShow = F => (orderFiles(F).find(f => f.status === 'missing' || f.status === 'fix') || orderFiles(F)[0]).id;
  const pill = st => `<span class="fstatus fstatus--${STATUS[st][1]}">${STATUS[st][0]}</span>`;
  const hasPlaceholder = t => /\[[^\]\n]+\](?!\()/.test(t);

  function renderPanel(r, mode) {
    const F = r.aiFiles, files = orderFiles(F), sel = firstToShow(F);
    const known = R.knownText(r.familiarity);
    const kick = mode === 'example' ? 'Example' : mode === 'demo' ? 'Example result' : 'Your AI files';
    const tab = f => `<li role="presentation"><button class="ftab" role="tab" id="ftab-${f.id}" aria-controls="fpanel-${f.id}" aria-selected="${f.id === sel}" tabindex="${f.id === sel ? 0 : -1}" data-file="${f.id}">
        <span class="ftab__name">${esc(f.name)}</span>${pill(f.status)}</button></li>`;
    const view = f => `<div class="fview" role="tabpanel" id="fpanel-${f.id}" aria-labelledby="ftab-${f.id}" ${f.id === sel ? '' : 'hidden'}>
        <div class="fview__bar"><span>${esc(f.status === 'ok' ? 'Found on your site · a refreshed draft' : f.id === 'robots' && f.status !== 'missing' ? 'Add to your robots.txt' : 'Ready to install')} · <code>${esc(f.path)}</code></span>
          <span class="fview__tools"><button class="btn btn--sm fbtn" type="button" data-fcopy="${f.id}">${icon('copy')} Copy</button><button class="btn btn--sm fbtn" type="button" data-fdl="${f.id}">${icon('download')} Download</button></span></div>
        <pre class="fview__code" tabindex="0" aria-label="${esc(f.name)} contents"><code>${esc(f.generated)}</code></pre>
        <div class="fview__info">
          <p>${esc(f.what)}</p>
          ${f.optionalNote ? `<p class="muted">${esc(f.optionalNote)}</p>` : ''}
          ${(f.issues || []).length || (f.notes || []).length ? `<ul class="fview__issues">${(f.issues || []).map(t => `<li class="is-issue">${esc(t)}</li>`).join('')}${(f.notes || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <p><strong>Where it goes:</strong> ${esc(f.install)}</p>
          ${hasPlaceholder(f.generated) ? `<p class="muted">Anything in [brackets] is a placeholder: we didn’t find that fact on your site, so we didn’t invent it.</p>` : ''}
          ${f.template ? `<details class="fview__more"><summary>Template entry for when you launch an MCP server or agent</summary><pre class="fview__code fview__code--sm"><code>${esc(f.template)}</code></pre></details>` : ''}
        </div>
      </div>`;
    return `<section class="fp" data-mode="${mode}" aria-labelledby="fp-domain">
      <header class="fp__head">
        <div>
          <p class="fp__kick">${kick}</p>
          <h2 class="fp__domain" id="fp-domain">${esc(r.domain).replace(/\./g, '.<wbr>')}</h2>
          <p class="fp__summary"><strong>${esc(summaryLine(r))}</strong>${known ? ` <span class="fp__dot" aria-hidden="true">·</span> <span class="fp__known${r.familiarity.known ? ' is-known' : ''}">${esc(known)}</span>` : ''}</p>
        </div>
        ${mode === 'example' ? '' : `<button class="btn btn--primary" type="button" id="files-zip">${icon('download')} Download all files</button>`}
      </header>
      <div class="fp__body">
        <ul class="fp__list" role="tablist" aria-label="AI files" aria-orientation="vertical">${files.map(tab).join('')}</ul>
        <div class="fp__views">${files.map(view).join('')}</div>
      </div>
    </section>`;
  }

  function renderLoading(domain) {
    const names = ['llms.txt', 'Structured data', 'robots.txt rules', 'ai-catalog.json'];
    return `<section class="fp" data-mode="loading" aria-busy="true" aria-labelledby="fp-domain">
      <header class="fp__head"><div><p class="fp__kick">Checking</p><h2 class="fp__domain" id="fp-domain">${esc(domain).replace(/\./g, '.<wbr>')}</h2><p class="fp__summary" id="fp-step">${STEPS[0]}</p></div></header>
      <div class="fp__body">
        <ul class="fp__list">${names.map(n => `<li><span class="ftab is-idle"><span class="ftab__name">${n}</span><span class="fstatus fstatus--idle">Checking…</span></span></li>`).join('')}</ul>
        <div class="fp__views"><div class="fview"><div class="fview__bar"><span>Your files appear here in about 30 seconds</span></div><pre class="fview__code fview__code--idle" aria-hidden="true"><code># ……………………\n\n&gt; ……………………………………………………\n\n## Pages\n\n- [……………](………………)\n- [……………](………………)</code></pre></div></div>
      </div>
    </section>`;
  }

  function renderBlocked(r) {
    const b = r.blocked, known = R.knownText(r.familiarity);
    const bots = r.aiBots ? `<ul class="fp__bots">${r.aiBots.map(x => `<li><span>${esc(x.name)}</span><span class="fstatus fstatus--${x.allowed ? 'ok' : 'missing'}">${x.allowed ? 'Allowed' : 'Blocked'}</span></li>`).join('')}</ul>` : '<p class="muted">We couldn’t read its robots.txt either.</p>';
    return `<section class="fp" data-mode="blocked" aria-labelledby="fp-domain">
      <header class="fp__head"><div>
        <p class="fp__kick fp__kick--warn">Couldn’t read this site · HTTP ${esc(b.status)}</p>
        <h2 class="fp__domain" id="fp-domain">${esc(r.domain).replace(/\./g, '.<wbr>')}</h2>
        <p class="fp__summary">${esc(r.domain)} ${esc(b.reason)}. Large sites often block unknown bots, so this is <strong>not</strong> a sign that ChatGPT, Claude or Gemini are blocked.${known ? ` <span class="fp__known${r.familiarity.known ? ' is-known' : ''}">${esc(known)}.</span>` : ''}</p>
      </div></header>
      <div class="fp__blocked">
        <div><h3>What its robots.txt tells AI crawlers</h3>${bots}</div>
        <div><h3>Is this your site?</h3><p>Allow <code>AeodenBot</code> in your bot protection (Cloudflare, Akamai, etc.) and check again to get your AI files.</p>
          <div class="fp__actions"><button class="btn btn--primary btn--sm" type="button" id="retry-btn">Check again</button><button class="btn btn--ghost btn--sm" type="button" data-demo="">See an example</button></div></div>
      </div>
    </section>`;
  }

  function wirePanel(r) {
    const F = r.aiFiles; if (!F) return;
    const byId = id => F.files.find(f => f.id === id);
    const tabs = [...slot.querySelectorAll('.ftab[role="tab"]')];
    const select = (t, focus) => {
      tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; document.getElementById('fpanel-' + x.dataset.file).hidden = !on; });
      if (focus) t.focus();
      track('ai_file_tab', { file: t.dataset.file });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const k = e.key, n = tabs.length; let j = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % n; else if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + n) % n; else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
        if (j != null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    slot.querySelectorAll('[data-fcopy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(byId(b.dataset.fcopy).generated); showToast('Copied'); track('ai_file_copy', { file: b.dataset.fcopy }); } catch { showToast('Could not copy.'); }
    }));
    slot.querySelectorAll('[data-fdl]').forEach(b => b.addEventListener('click', () => {
      const f = byId(b.dataset.fdl); saveBlob(new Blob([f.generated], { type: 'text/plain' }), f.filename); track('ai_file_download', { file: f.id });
    }));
    $('#files-zip')?.addEventListener('click', () => {
      const readme = `AI files for ${r.domain}\nGenerated by Aeoden (aeoden.com) on ${new Date().toISOString().slice(0, 10)}.\n\n` +
        orderFiles(F).map(f => `${f.id === 'catalog' ? '.well-known/ai-catalog.json' : f.filename}\n  ${f.name} \u2014 ${f.what}\n  Where it goes: ${f.install}\n`).join('\n') +
        `\nAnything in [brackets] is a placeholder: we didn't find that fact on your site, so we didn't invent it.\nWhen you've installed them, check again at https://aeoden.com/?url=${encodeURIComponent(r.domain)}\n`;
      const entries = [...orderFiles(F).map(f => ({ name: f.id === 'catalog' ? '.well-known/ai-catalog.json' : f.filename, text: f.generated })), { name: 'README.txt', text: readme }];
      saveBlob(zipStore(entries), `${r.domain.replace(/[^a-z0-9.-]/gi, '')}-ai-files.zip`);
      showToast('AI files downloaded'); track('ai_files_zip');
    });
  }

  /* ---------------- Below the panel: what we noticed, what AI sees, after you install ---------------- */
  const EFFORT_WORD = { Easy: 'Easy fix', Medium: 'Medium effort', Hard: 'Bigger job' };
  function renderReport(r) {
    if (r.blocked) { report.innerHTML = `<div class="wrap"><div class="next">${renderMark(r)}</div></div>`; report.hidden = false; return; }
    const sees = r.whatAiSees, f = r.familiarity;
    const noticed = [...(r.fixes || []), ...(r.moreFixes || [])].slice(0, 5);
    const ready = R.isReady(r);
    report.innerHTML = `<div class="wrap">
      <div class="next">
        <section class="ncard ncard--wide" aria-labelledby="noticed-h">
          <h2 class="ncard__h" id="noticed-h">What we noticed</h2>
          <p class="ncard__sub">Beyond the files: the changes on your page that help AI most.</p>
          ${noticed.length ? `<ol class="fixes">${noticed.map((x, i) => renderFix(x, i + 1)).join('')}</ol>` : `<p class="ncard__sub">Nothing stood out. Your page is in good shape for AI to read.</p>`}
        </section>
        <section class="ncard" aria-labelledby="sees-h">
          <h2 class="ncard__h" id="sees-h">What AI sees</h2>
          ${sees.unclear ? `<p class="sees__quote">${esc(sees.summary)}</p>` : `<p class="sees__quote"><q>${esc(sees.purpose)}</q></p><p class="sees__src">Quoted from your page’s ${esc(sees.source || 'text')}, never rewritten.</p>`}
          <dl class="sees__list">
            <div><dt>Known to AI</dt><dd>${f ? (f.known ? `${esc(f.level)} · <a href="https://www.wikidata.org/wiki/${esc(f.id)}" target="_blank" rel="noopener">Wikidata ${esc(f.id)}</a>` : 'Not yet. AI learns entities from knowledge graphs like Wikidata and Wikipedia; this grows with real coverage.') : 'We couldn’t check this time.'}</dd></div>
            <div><dt>Site name</dt><dd>${esc(sees.siteName || 'Not found')}</dd></div>
            <div><dt>Audience</dt><dd>${esc(sees.audience || 'Not stated')}</dd></div>
          </dl>
        </section>
        <section class="ncard" aria-labelledby="after-h">
          <h2 class="ncard__h" id="after-h">${ready ? 'You’re AI-ready' : 'After you install'}</h2>
          <p class="ncard__sub">${ready ? 'Every core file is in place. Share it, or check again any time you change your site.' : 'Check again to turn Missing into Ready. When everything is in place, share your AI-ready card.'}</p>
          <div class="ncard__actions">
            ${r.demo ? `<a class="btn btn--primary btn--sm" href="#hero" data-cta="try-own">Check my site</a>` : `<button class="btn btn--primary btn--sm" type="button" id="recheck-btn">${icon('refresh')} Check again</button>`}
            <div class="menu-wrap">
              <button class="btn btn--ghost btn--sm" type="button" id="dl-btn" aria-haspopup="true" aria-expanded="false" aria-controls="dl-menu">${icon('download')} ${ready ? 'AI-ready card' : 'Status card'}</button>
              <div class="menu" id="dl-menu" hidden role="menu" aria-label="Choose a size">
                ${Object.entries(X.SIZES).map(([k, s]) => `<button type="button" role="menuitem" data-size="${k}"><strong>${esc(s.label)}</strong><span>${esc(s.hint)}</span></button>`).join('')}
              </div>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" id="share-btn">${icon('share')} Share</button>
          </div>
        </section>
        ${renderMark(r)}
      </div>
    </div>`;
    report.hidden = false;
    report.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', () => {
      const p = document.getElementById(b.dataset.reveal), open = p.hidden;
      p.hidden = !open; b.setAttribute('aria-expanded', String(open));
    }));
    report.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(document.getElementById(b.dataset.copy).querySelector('.snippet').textContent); showToast('Copied'); } catch { showToast('Could not copy.'); }
    }));
    $('#recheck-btn')?.addEventListener('click', () => { track('recheck'); window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); startScan(lastUrl || r.domain, true); });
    wireShare(r);
  }

  function renderMark(r) {
    const cal = CFG.CALENDLY_URL, li = CFG.LINKEDIN_URL;
    if (!cal && !li) return '';
    const ask = r.demo ? 'Questions about your own site?' : r.aiFiles && r.aiFiles.ready === r.aiFiles.total ? 'Want a second pair of eyes?' : 'Want help installing these?';
    return `<aside class="mark results__mark" aria-labelledby="mark-h">
      <div class="mark__bar"><span class="lbl"><b>Follow-up</b></span><span class="lbl">Mark Flournoy</span></div>
      <div class="mark__body">
        <img class="mark__photo" src="assets/img/mark.jpg" width="88" height="88" alt="Mark Flournoy" loading="lazy">
        <div>
          <span class="lbl lbl--signal">${esc(ask)}</span>
          <h3 class="mark__name" id="mark-h">Talk it through with Mark.</h3>
          <p>I built Aeoden after watching AI answers change the value of a click. If you'd like a hand installing these files, or want to talk through what AI makes of your site, I'm happy to help.</p>
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
        <h3 class="fix__title">${esc(f.title)}</h3>
        <p class="fix__why">${esc(f.why)}</p>
        ${f.action ? `<button class="fix__toggle" type="button" aria-expanded="false" aria-controls="${id}" data-reveal="${id}">${esc(f.action.label)}</button>
        <div class="fix__reveal" id="${id}" hidden>
          ${f.action.kind === 'code' ? `<pre class="snippet"><code>${esc(f.action.content)}</code></pre>` : `<div class="snippet snippet--text">${esc(f.action.content)}</div>`}
          <div class="fix__tools"><button class="btn btn--ghost btn--sm" type="button" data-copy="${id}">Copy</button></div>
        </div>` : ''}
      </div>
    </li>`;
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-cta]');
    if (a) track('cta_' + a.dataset.cta, { location: a.closest('.results') ? 'results' : a.closest('.site-head') ? 'nav' : 'page', score: current ? current.score : undefined });
  });

  /* ---------------- Card + share ---------------- */
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

  function wireShare(r) {
    const dlBtn = $('#dl-btn'), dlMenu = $('#dl-menu');
    if (dlBtn && dlMenu) {
      wireMenu(dlBtn, dlMenu);
      dlMenu.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', async () => {
        closeMenus(); dlBtn.focus(); busy(dlBtn, true);
        try { await X.downloadPNG(r, b.dataset.size); showToast('Card downloaded'); track('export_png', { size: b.dataset.size }); }
        catch (err) { showToast('Could not create the image. Try another browser.'); console.error(err); }
        finally { busy(dlBtn, false); }
      }));
    }
    $('#share-btn')?.addEventListener('click', async () => {
      const shareUrl = r.demo ? `${CFG.SITE_URL}/#demo=${demoKey || 'quotabird'}` : `${CFG.SITE_URL}/?url=${encodeURIComponent(r.domain)}`;
      const text = R.isReady(r) ? `${r.domain} is AI-ready: llms.txt, structured data and AI crawler rules all in place.` : `Checked ${r.domain} for the files AI reads. Get yours free:`;
      if (navigator.share) { try { await navigator.share({ title: `${r.domain} on Aeoden`, text, url: shareUrl }); track('share', { method: 'native' }); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); showToast('Link copied'); track('share', { method: 'copy_link' }); } catch { showToast('Could not copy the link.'); } }
    });
  }

  function checkAnother() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    input.focus(); input.select();
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
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
      refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>',
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
