/* ============================================================
   CheckAEO export — turns the SVG card object into a crisp PNG.
   No screenshotting, no third-party libraries.
   ============================================================ */
(function () {
  'use strict';

  const SIZES = {
    square: { w: 1080, h: 1080, label: 'Square', hint: '1080×1080 · Share card for LinkedIn, X' },
    portrait: { w: 1080, h: 1350, label: 'Portrait', hint: '1080×1350 · Detail card, full interpretation' },
    landscape: { w: 1600, h: 900, label: 'Landscape', hint: '1600×900 · Slides, email, reports' }
  };
  const SCALE = 2; // 2× for crisp text on retina + LinkedIn re-compression

  /* The export needs the fonts inside the SVG. fonts.js (embedded data URIs) is loaded on demand,
     which works on http(s) and file:// alike and costs nothing until someone exports a card. */
  let fontCssPromise = null;
  function fontCss() {
    if (window.CHECKAEO_FONT_CSS) return Promise.resolve(window.CHECKAEO_FONT_CSS);
    if (fontCssPromise) return fontCssPromise;
    fontCssPromise = new Promise(resolve => {
      const base = (document.querySelector('link[href$="assets/css/main.css"]') || {}).href || 'assets/css/main.css';
      const sc = document.createElement('script');
      sc.src = base.replace(/css\/main\.css$/, 'fonts/fonts.js');
      sc.onload = () => resolve(window.CHECKAEO_FONT_CSS || '');
      sc.onerror = () => resolve('');
      document.head.appendChild(sc);
    });
    return fontCssPromise;
  }

  async function ensureFontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    try { await Promise.all(['800 100px Archivo', '600 24px Archivo', '400 24px Archivo', '400 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch { /* fine */ }
  }

  async function renderPNG(result, size = 'square') {
    await ensureFontsReady();
    const css = await fontCss();
    const svg = window.AEOCardRender.buildCardSVG(result, size, css);
    const dims = SIZES[size] || SIZES.square;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = dims.w * SCALE;
      canvas.height = dims.h * SCALE;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#E4DFD6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'sync';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not render the card image'));
      img.src = src;
    });
  }

  function filename(result, size) {
    const d = (result.domain || 'site').replace(/[^a-z0-9.-]/gi, '_');
    return `aeo-card-${d}-${size}-${result.score}.png`;
  }

  async function downloadPNG(result, size = 'square') {
    const blob = await renderPNG(result, size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename(result, size);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function canCopyImage() {
    return !!(navigator.clipboard && window.ClipboardItem && (!ClipboardItem.supports || ClipboardItem.supports('image/png')));
  }

  async function copyPNG(result, size = 'square') {
    if (!canCopyImage()) throw new Error('unsupported');
    // Pass a promise so Safari keeps the user gesture alive.
    const item = new ClipboardItem({ 'image/png': renderPNG(result, size) });
    await navigator.clipboard.write([item]);
  }

  async function downloadSVG(result, size = 'square') {
    const css = await fontCss();
    const svg = window.AEOCardRender.buildCardSVG(result, size, css);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename(result, size).replace(/\.png$/, '.svg');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.AEOCardExport = { SIZES, renderPNG, downloadPNG, copyPNG, downloadSVG, canCopyImage };
})();
