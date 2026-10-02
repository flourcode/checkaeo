"use strict";

// Replace with your Lambda Function URL (or API Gateway URL).
const CHECK_API_URL = "LAMBDA_URL";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  defaultTlds: ["com", "io", "ai", "co", "app", "dev", "net"],
  extraTlds: ["org", "xyz", "so", "sh", "gg", "me", "tech", "tools", "studio", "inc", "us", "ca", "uk", "de"],
  // One batch request covers every domain and handle in a check. The Lambda caps
  // each upstream check at ~20 s, so allow a little more for the whole batch.
  requestTimeoutMs: 35000,
  maxBatch: 30, // must match MAX_BATCH in lambda/index.mjs
  recentKey: "namercheck:recent",
  recentMax: 8,
  // Idea testing (Gemini runs in the Lambda; the key never reaches the browser)
  ideaTimeoutMs: 40000,
  ideaMinLength: 8,
  ideaMaxLength: 1000,
  // Plain, non-affiliate links. Swap these if you prefer another registrar or lookup tool.
  registrarUrl: (domain) => `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
  lookupUrl: (domain) => `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(domain)}`,
  fallbackHandles: [(s) => `get${s}`, (s) => `use${s}`, (s) => `${s}app`],
};

// Display config for social platforms. The Lambda has the matching checkers.
// Add or remove platforms here (and in lambda/index.mjs).
const PLATFORMS = {
  youtube:   { name: "YouTube",   url: (h) => `https://www.youtube.com/@${h}`,       display: (h) => `@${h}` },
  x:         { name: "X",         url: (h) => `https://x.com/${h}`,                  display: (h) => `@${h}` },
  facebook:  { name: "Facebook",  url: (h) => `https://www.facebook.com/${h}`,       display: (h) => `facebook.com/${h}` },
  instagram: { name: "Instagram", url: (h) => `https://www.instagram.com/${h}/`,     display: (h) => `@${h}` },
  tiktok:    { name: "TikTok",    url: (h) => `https://www.tiktok.com/@${h}`,        display: (h) => `@${h}` },
  github:    { name: "GitHub",    url: (h) => `https://github.com/${h}`,             display: (h) => `github.com/${h}` },
  reddit:    { name: "Reddit",    url: (h) => `https://www.reddit.com/user/${h}`,    display: (h) => `u/${h}` },
  bluesky:   { name: "Bluesky",   url: (h) => `https://bsky.app/profile/${h}.bsky.social`, display: (h) => `@${h}.bsky.social` },
  threads:   { name: "Threads",   url: (h) => `https://www.threads.com/@${h}`,       display: (h) => `@${h}` },
};

const STATUS_LABEL = {
  available: "Available",
  likely_available: "Likely available",
  taken: "Taken",
  unknown: "Unable to verify",
  pending: "Checking…",
};
const VALID_STATUSES = new Set(["available", "likely_available", "taken", "unknown"]);
const OPEN_STATUSES = new Set(["available", "likely_available"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "className") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function apiConfigured() {
  return typeof CHECK_API_URL === "string" && /^https?:\/\//.test(CHECK_API_URL);
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

function normalizeName(raw) {
  const brand = String(raw || "").replace(/\s+/g, " ").trim();
  const folded = brand.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const stem = folded.replace(/[^a-z0-9]/g, "");
  const dropped = [...new Set(folded.replace(/[a-z0-9\s]/g, "").split(""))].filter(Boolean);
  const accented = brand !== brand.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return { brand, stem, handle: stem, dropped, hadSpaces: /\s/.test(brand), accented };
}

function describeNormalization(n) {
  const parts = [];
  if (n.hadSpaces) parts.push("spaces");
  if (n.dropped.length) parts.push(n.dropped.map((c) => `"${c}"`).join(" "));
  let msg = "";
  if (parts.length) msg = `Removed ${parts.join(" and ")} for the domain and handle.`;
  if (n.accented) msg += `${msg ? " " : ""}Accents were simplified.`;
  return msg;
}

function fallbackHandles(stem) {
  const seen = new Set([stem]);
  const out = [];
  for (const make of CONFIG.fallbackHandles) {
    const h = make(stem);
    if (!seen.has(h) && h.length <= 30 && !/^(get|use)(get|use)/.test(h) && !/appapp$/.test(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Distinctiveness score (local heuristic; not legal clearance)
// ---------------------------------------------------------------------------

const NAMING = {
  prefixes: ["get", "use", "try", "my", "go", "hey", "hi", "meet", "join", "the", "smart", "super", "hello", "open", "true", "simple", "just", "we"],
  suffixes: ["ly", "ify", "fy", "hub", "kit", "labs", "lab", "stack", "base", "flow", "app", "ai", "hq", "bot", "desk", "sync", "cloud", "wise", "ster", "able", "verse", "works", "pad", "box", "loop", "iq", "pilot", "mate", "buddy", "nest", "spot", "genie", "ops", "io"],
  crowded: ["flow", "sync", "cloud", "data", "smart", "pulse", "spark", "nova", "zen", "nexus", "quantum", "pixel", "signal", "insight", "metric", "lead", "growth", "bright", "swift", "stack", "vault", "forge", "craft", "bolt", "beacon", "orbit", "apex", "peak", "launch", "rocket", "ninja", "genius", "mind", "brain", "core", "mesh", "loop", "wave", "shift", "hive", "hub", "logic", "sense", "scale", "boost", "track", "task", "desk", "mail", "chat", "meta", "verse", "labs", "base", "point", "link", "path", "lumen", "lume", "aura", "echo"],
  famous: ["slack", "notion", "stripe", "zoom", "figma", "asana", "trello", "hubspot", "salesforce", "shopify", "zapier", "airtable", "calendly", "loom", "linear", "vercel", "netlify", "github", "gitlab", "dropbox", "intercom", "mailchimp", "canva", "miro", "monday", "clickup", "basecamp", "zendesk", "freshdesk", "twilio", "segment", "mixpanel", "amplitude", "datadog", "sentry", "supabase", "firebase", "heroku", "retool", "webflow", "framer", "gumroad", "substack", "buffer", "hootsuite", "typeform", "jotform", "docusign", "pandadoc", "gong", "apollo", "attio", "pipedrive", "lemlist", "superhuman", "raycast", "obsidian", "todoist", "evernote", "grammarly", "jasper", "midjourney", "perplexity", "anthropic", "openai", "discord", "telegram", "whatsapp", "twitch", "spotify", "gusto", "rippling", "brex", "ramp", "mercury", "plaid", "revolut", "paypal", "square", "klaviyo", "postman", "docker", "cloudflare", "atlassian", "jira", "confluence", "coda", "craft", "loops", "resend", "posthog", "plausible", "fathom", "tally", "carrd", "bubble", "glide", "softr", "lovable", "cursor", "replit", "deel", "remote", "loom", "airbnb", "uber", "lyft", "google", "amazon", "microsoft", "apple", "meta", "netflix", "tesla", "oracle", "adobe"],
};

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) || 0);
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function similarity(a, b) {
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return Math.max(dice(a, b), lev);
}

// Rough English phonetic key: catches "kwota"/"quota", "lyft"/"lift", "flickr"/"flicker".
function phoneticKey(s) {
  let t = s.toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return "";
  t = t
    .replace(/ph/g, "f").replace(/ck/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k")
    .replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "s").replace(/wh/g, "w")
    .replace(/^kn/, "n").replace(/gh/g, "g").replace(/dg/g, "j").replace(/y/g, "i");
  const first = /[aeiou]/.test(t[0]) ? "a" : t[0];
  const rest = t.slice(1).replace(/[aeiouhw]/g, "");
  return (first + rest).replace(/(.)\1+/g, "$1");
}

function soundsAlike(a, b) {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  return ka.length >= 3 && ka === kb;
}

function parseKeywords(raw) {
  return [...new Set(
    String(raw || "")
      .split(/[,\n;]+/)
      .map((k) => k.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((k) => k.length >= 2)
  )].slice(0, 30);
}

function scoreName(stem, keywordsRaw) {
  const findings = [];
  const add = (points, title, detail) => findings.push({ points, title, detail });
  const s = stem;

  // Length
  if (s.length <= 3) add(-12, "Very short", "Names this short are almost always taken everywhere.");
  else if (s.length >= 15) add(-10, "Long name", "Long names are harder to remember, type and fit into handles.");
  else if (s.length >= 12) add(-4, "On the long side", "Still workable, but shorter names travel better.");

  // Common SaaS prefixes and suffixes
  const prefix = NAMING.prefixes.find((p) => s.startsWith(p) && s.length >= p.length + 3);
  if (prefix) add(-10, `Starts with "${prefix}"`, "A very common startup prefix, so it blends in with many names.");
  const suffix = NAMING.suffixes
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((x) => s.endsWith(x) && s.length >= x.length + 3);
  if (suffix) add(-10, `Ends with "${suffix}"`, "A very common SaaS ending, so many products share it.");

  // Crowded startup words
  const crowded = NAMING.crowded.filter((w) => w.length >= 3 && s.includes(w) && w !== suffix);
  for (const w of crowded.slice(0, 3)) {
    add(-7, `Uses "${w}"`, "One of the most overused words in startup names.");
  }

  // Vowel dropping (Flickr, Tumblr pattern)
  if (s.length >= 4 && /[bcdfghjklmnpqstvwxz]r$/.test(s)) {
    add(-10, "Dropped vowel", "The \"-r\" ending without a vowel is a dated pattern and people misspell it.");
  } else {
    const letters = s.replace(/[^a-z]/g, "");
    const vowels = (letters.match(/[aeiouy]/g) || []).length;
    if (letters.length >= 5 && vowels / letters.length < 0.2) {
      add(-6, "Few vowels", "Hard to say out loud, which makes word of mouth harder.");
    }
  }

  // Pronounceability
  if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(s)) add(-6, "Consonant cluster", "Four or more consonants in a row are hard to pronounce.");
  if (/\d/.test(s)) add(-5, "Contains numbers", "Spoken aloud, people won't know whether to spell the number out.");

  // Closeness to well-known products (keep only the strongest hit)
  let famousHit = null;
  for (const f of NAMING.famous) {
    let hit = null;
    if (s === f) hit = { points: -55, title: `Same as ${cap(f)}`, detail: "This exact name belongs to a well-known product." };
    else if (soundsAlike(s, f)) hit = { points: -22, title: `Sounds like ${cap(f)}`, detail: "Spoken aloud, people may hear the existing brand." };
    else if (f.length >= 5 && s.includes(f)) hit = { points: -14, title: `Contains ${cap(f)}`, detail: "Building on a famous brand name invites confusion and legal trouble." };
    else {
      const sim = similarity(s, f);
      if (sim >= 0.8) hit = { points: -22, title: `Looks very close to ${cap(f)}`, detail: "Easy to confuse with a well-known product." };
      else if (sim >= 0.7) hit = { points: -10, title: `Resembles ${cap(f)}`, detail: "Some people may confuse the two." };
    }
    if (hit && (!famousHit || hit.points < famousHit.points)) famousHit = hit;
  }
  if (famousHit) add(famousHit.points, famousHit.title, famousHit.detail);

  // Competitor and niche keywords (optional)
  let kwPenalty = 0;
  const kwFindings = [];
  for (const kw of parseKeywords(keywordsRaw)) {
    let hit = null;
    if (s === kw) hit = { points: -30, title: `Same as "${kw}"`, detail: "Identical to a competitor or niche term you entered." };
    else if (kw.length >= 3 && s.includes(kw)) hit = { points: -8, title: `Uses the niche word "${kw}"`, detail: "Descriptive names are common in a niche and harder to stand out with." };
    else if (soundsAlike(s, kw)) hit = { points: -14, title: `Sounds like "${kw}"`, detail: "Close enough when spoken to cause confusion." };
    else {
      const sim = similarity(s, kw);
      if (sim >= 0.78) hit = { points: -18, title: `Very close to "${kw}"`, detail: "Easy to confuse with a name you listed." };
      else if (sim >= 0.65) hit = { points: -9, title: `Similar to "${kw}"`, detail: "Shares a lot of its spelling with a name you listed." };
    }
    if (hit) kwFindings.push(hit);
  }
  kwFindings.sort((a, b) => a.points - b.points);
  for (const f of kwFindings) {
    const room = -36 - kwPenalty;
    if (room >= 0) break;
    const pts = Math.max(f.points, room);
    kwPenalty += pts;
    add(pts, f.title, f.detail);
  }

  const total = findings.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, 100 + total));

  if (!findings.length) {
    findings.push({ points: 0, title: "No crowded patterns found", detail: "No common prefixes, suffixes, overused words, or look-alikes of well-known products." });
  }

  let label, band, summary;
  if (score >= 85) {
    label = "Distinctive"; band = "high";
    summary = "Nothing about this name follows a crowded pattern. It should be easy to remember and hard to confuse.";
  } else if (score >= 70) {
    label = "Fairly distinctive"; band = "mid";
    summary = "Mostly distinctive, with a pattern or two that plenty of startups share.";
  } else if (score >= 50) {
    label = "Crowded"; band = "low";
    summary = "This name leans on patterns many products already use, so expect neighbors in search results.";
  } else {
    label = "Generic"; band = "poor";
    summary = "This name sits in a crowded or confusable space. Expect mix-ups and a harder time owning search results.";
  }

  findings.sort((a, b) => a.points - b.points);
  return { score, label, band, summary, findings };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// API calls: one batch request per check
// ---------------------------------------------------------------------------

function unknownResult(note) {
  return { status: "unknown", confidence: "none", method: "client", note };
}

// Sends every check in one request and always resolves to an array with one
// result per check, in order. Anything missing or malformed becomes "unknown".
async function callBatch(checks) {
  const allUnknown = (note) => checks.map(() => unknownResult(note));
  if (!apiConfigured()) {
    return allUnknown("Not checked: the checking service isn't connected. Use the link to check manually.");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);
  try {
    // text/plain keeps this a "simple" CORS request (no preflight). The Lambda parses it as JSON.
    const res = await fetch(CHECK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ checks }),
      signal: ctrl.signal,
    });
    if (res.status === 429) return allUnknown("Too many checks in a short time. Wait a minute, then try again.");
    if (!res.ok) return allUnknown(`The checking service returned an error (HTTP ${res.status}).`);
    const data = await res.json();
    const list = Array.isArray(data?.results) ? data.results : null;
    if (!list) return allUnknown("The checking service sent an unexpected answer.");
    return checks.map((_, i) => {
      const r = list[i];
      return r && VALID_STATUSES.has(r.status) ? r : unknownResult("The checking service sent an unexpected answer for this item.");
    });
  } catch (err) {
    return allUnknown(err?.name === "AbortError" ? "The check took too long." : "Couldn't reach the checking service.");
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let runId = 0;
let current = null; // { n, keywords, tlds }
const rowMeta = new Map(); // key -> { type, domain?, platformId?, handle?, group }
const rowResults = new Map(); // key -> result
const rowEls = new Map(); // key -> <li>
const selectedTlds = new Set(CONFIG.defaultTlds);

// ---------------------------------------------------------------------------
// Rendering: rows
// ---------------------------------------------------------------------------

function makeRow(key, title, subtitle) {
  const li = el("li", { className: "row", dataset: { key, status: "pending" } });
  const id = el("div", { className: "row-id" });
  id.append(el("span", { className: "row-title" }, title));
  if (subtitle) id.append(el("span", { className: "row-sub" }, subtitle));

  const status = el("span", { className: "status", dataset: { status: "pending" } });
  status.append(el("span", { className: "status-dot", "aria-hidden": "true" }), el("span", { className: "status-text" }, STATUS_LABEL.pending));

  li.append(id, status, el("div", { className: "row-actions" }), el("p", { className: "row-note" }));
  rowEls.set(key, li);
  return li;
}

function link(href, text, label) {
  return el("a", { href, target: "_blank", rel: "noopener nofollow", "aria-label": label }, text);
}

function renderActions(li, meta, status) {
  const box = $(".row-actions", li);
  box.replaceChildren();
  if (meta.type === "domain") {
    const d = meta.domain;
    if (status === "taken") {
      box.append(link(`https://${d}`, "View", `View ${d}`), link(CONFIG.lookupUrl(d), "Registration", `Registration details for ${d}`));
    } else if (OPEN_STATUSES.has(status)) {
      box.append(link(CONFIG.registrarUrl(d), "Check registrar", `Check ${d} at a registrar`));
    } else {
      box.append(link(CONFIG.lookupUrl(d), "Look it up", `Look up ${d}`));
    }
  } else {
    const p = PLATFORMS[meta.platformId];
    const text = status === "taken" ? "View profile" : status === "unknown" ? "Check manually" : "Open";
    box.append(link(p.url(meta.handle), text, `${text} on ${p.name}`));
  }
  if (status === "unknown" && apiConfigured() && !meta.invalid) {
    const retry = el("button", { type: "button", className: "retry-btn" }, "Try again");
    retry.addEventListener("click", () => runBatch([li.dataset.key], runId));
    box.append(retry);
  }
}

function updateRow(key, result) {
  const li = rowEls.get(key);
  const meta = rowMeta.get(key);
  if (!li || !meta) return;
  const status = result ? result.status : "pending";
  li.dataset.status = status;
  const pill = $(".status", li);
  pill.dataset.status = status;
  $(".status-text", pill).textContent = STATUS_LABEL[status];

  let note = result?.note || "";
  if (result && status === "likely_available" && result.confidence === "low") note += " Low confidence.";
  if (result?.invalid) meta.invalid = true;
  $(".row-note", li).textContent = note.trim();
  renderActions(li, meta, status);
}

// ---------------------------------------------------------------------------
// Running checks
// ---------------------------------------------------------------------------

function payloadFor(meta) {
  return meta.type === "domain"
    ? { kind: "domain", domain: meta.domain }
    : { kind: "social", platform: meta.platformId, handle: meta.handle };
}

// Marks every row as checking, sends ONE request for all of them, then fills rows in.
async function runBatch(keys, id) {
  keys = keys.filter((k) => rowMeta.has(k));
  if (!keys.length) return;
  for (const key of keys) {
    rowResults.delete(key);
    updateRow(key, null);
  }
  updateTally();

  const chunks = [];
  for (let i = 0; i < keys.length; i += CONFIG.maxBatch) chunks.push(keys.slice(i, i + CONFIG.maxBatch));
  for (const chunk of chunks) {
    const results = await callBatch(chunk.map((k) => payloadFor(rowMeta.get(k))));
    if (id !== runId) return; // a newer check started; drop stale answers
    chunk.forEach((key, i) => {
      rowResults.set(key, results[i]);
      updateRow(key, results[i]);
    });
    updateTally();
  }
}

function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function startCheck(rawName, keywordsRaw, { updateUrl = true } = {}) {
  const n = normalizeName(rawName);
  const input = $("#name-input");
  if (!n.brand) return showError("Enter a product or brand name to check.");
  if (!n.stem) return showError("Use at least one letter or number. Domains and handles can't be built from symbols alone.");
  if (n.stem.length > 63) return showError("Keep the name under 63 letters and numbers so it fits in a domain.");
  hideError();
  input.removeAttribute("aria-invalid");

  if (ideaReport) {
    landingName = n.brand;
    renderLandingPrompt();
  }

  const id = ++runId;
  rowMeta.clear();
  rowResults.clear();
  rowEls.clear();
  const tlds = [...selectedTlds];
  current = { n, keywords: keywordsRaw, tlds };

  // Summary
  $("#result-name").textContent = n.brand.toUpperCase();
  const variants = $("#result-variants");
  variants.replaceChildren(
    document.createTextNode("Domain stem "), el("strong", {}, n.stem),
    document.createTextNode(", primary handle "), el("strong", {}, `@${n.handle}`), document.createTextNode(".")
  );
  const normNote = describeNormalization(n);
  if (normNote) variants.append(document.createTextNode(` ${normNote}`));

  renderScore(scoreName(n.stem, keywordsRaw));
  $("#handle-label").textContent = `@${n.handle}`;

  // Rows
  const domainList = $("#domain-rows");
  const socialList = $("#social-rows");
  domainList.replaceChildren();
  socialList.replaceChildren();

  const domainKeys = tlds.map((tld) => {
    const domain = `${n.stem}.${tld}`;
    const key = `d:${domain}`;
    rowMeta.set(key, { type: "domain", domain, group: "domains" });
    domainList.append(makeRow(key, domain));
    updateRow(key, null);
    return key;
  });

  const socialKeys = Object.entries(PLATFORMS).map(([platformId, p]) => {
    const key = `s:${platformId}:${n.handle}`;
    rowMeta.set(key, { type: "social", platformId, handle: n.handle, group: "primary" });
    socialList.append(makeRow(key, p.name, p.display(n.handle)));
    updateRow(key, null);
    return key;
  });

  // Fallbacks reset
  $("#fallback-groups").replaceChildren();
  const fbBtn = $("#fallback-btn");
  const fbs = fallbackHandles(n.stem);
  fbBtn.disabled = fbs.length === 0;
  fbBtn.hidden = false;
  fbBtn.textContent = fbs.length ? `Check ${fbs.map((h) => "@" + h).join(", ")}` : "No fallback handles for this name";

  $("#setup-notice").hidden = apiConfigured();
  $("#results").hidden = false;
  updateTally();

  if (updateUrl) writeUrl(n.brand, keywordsRaw, tlds);

  const heading = $("#result-name");
  heading.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });

  saveRecent(n.brand);
  runBatch(interleave(domainKeys, socialKeys), id);
}

function checkFallbacks() {
  if (!current) return;
  const id = runId;
  const groups = $("#fallback-groups");
  const btn = $("#fallback-btn");
  btn.hidden = true;
  groups.replaceChildren();
  const keys = [];
  for (const handle of fallbackHandles(current.n.stem)) {
    const section = el("section", { className: "fallback-group" });
    section.append(el("h3", {}, `@${handle}`));
    const list = el("ul", { className: "rows" });
    section.append(list);
    groups.append(section);
    for (const [platformId, p] of Object.entries(PLATFORMS)) {
      const key = `s:${platformId}:${handle}`;
      rowMeta.set(key, { type: "social", platformId, handle, group: "fallback" });
      list.append(makeRow(key, p.name, p.display(handle)));
      updateRow(key, null);
      keys.push(key);
    }
  }
  runBatch(keys, id); // one request for every fallback handle on every platform
}

// ---------------------------------------------------------------------------
// Summary rendering
// ---------------------------------------------------------------------------

function renderScore(result) {
  const box = $(".score");
  box.dataset.band = result.band;
  $("#score-label").textContent = result.label;
  $("#interpretation").textContent = result.summary;

  const valueEl = $("#score-value");
  if (prefersReducedMotion()) {
    valueEl.textContent = String(result.score);
  } else {
    const start = performance.now();
    const dur = 650;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      valueEl.textContent = String(Math.round(result.score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const list = $("#findings");
  list.replaceChildren();
  for (const f of result.findings) {
    const li = el("li");
    li.append(el("span", { className: `finding-points${f.points === 0 ? " is-zero" : ""}` }, f.points === 0 ? "0" : String(f.points)));
    const body = el("span");
    body.append(el("span", { className: "finding-title" }, f.title), el("span", { className: "finding-detail" }, f.detail));
    li.append(body);
    list.append(li);
  }
}

function tallyFor(group) {
  let total = 0, done = 0, open = 0, taken = 0, unknown = 0;
  for (const [key, meta] of rowMeta) {
    if (meta.group !== group) continue;
    total++;
    const r = rowResults.get(key);
    if (!r) continue;
    done++;
    if (OPEN_STATUSES.has(r.status)) open++;
    else if (r.status === "taken") taken++;
    else unknown++;
  }
  return { total, done, open, taken, unknown };
}

function tallySentence(noun, t) {
  if (!t.total) return "";
  if (t.done < t.total) return `Checking ${noun}: ${t.done} of ${t.total} done.`;
  let s = `${cap(noun)}: ${t.open} of ${t.total} look open`;
  if (t.taken) s += `, ${t.taken} taken`;
  if (t.unknown) s += `, ${t.unknown} couldn't be verified`;
  return s + ".";
}

function updateTally() {
  const d = tallyFor("domains");
  const s = tallyFor("primary");
  $("#tally").textContent = [tallySentence("domains", d), tallySentence("handles", s)].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Recent checks (localStorage). Stores only { name, checkedAt }.
// Availability results are never stored; "Check again" always runs fresh checks.
// ---------------------------------------------------------------------------

function storageAvailable() {
  try {
    const k = "namercheck:probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
const HAS_STORAGE = storageAvailable();

function loadRecent() {
  if (!HAS_STORAGE) return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(CONFIG.recentKey) || "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.name === "string" && r.name.trim() && Number.isFinite(r.checkedAt))
      .map((r) => ({ name: r.name.slice(0, 60), checkedAt: r.checkedAt }))
      .slice(0, CONFIG.recentMax);
  } catch {
    return [];
  }
}

function storeRecent(list) {
  if (!HAS_STORAGE) return;
  try {
    if (list.length) window.localStorage.setItem(CONFIG.recentKey, JSON.stringify(list));
    else window.localStorage.removeItem(CONFIG.recentKey);
  } catch {
    // Storage full or blocked: the tool keeps working without history.
  }
}

function saveRecent(name) {
  if (!HAS_STORAGE) return;
  const lower = name.toLowerCase();
  const list = loadRecent().filter((r) => r.name.toLowerCase() !== lower);
  list.unshift({ name, checkedAt: Date.now() });
  storeRecent(list.slice(0, CONFIG.recentMax));
  renderRecent();
}

function removeRecent(name) {
  storeRecent(loadRecent().filter((r) => r.name !== name));
  renderRecent();
}

const recentDateFormat = (() => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
})();

function renderRecent() {
  const section = $("#recent");
  if (!section) return;
  const list = loadRecent();
  section.hidden = !HAS_STORAGE || list.length === 0;
  const ul = $("#recent-list");
  ul.replaceChildren();
  for (const item of list) {
    const li = el("li", { className: "recent-item" });
    const id = el("div", { className: "recent-id" });
    id.append(el("span", { className: "recent-name" }, item.name));
    const when = new Date(item.checkedAt);
    const time = el("time", { className: "recent-time", datetime: when.toISOString() },
      recentDateFormat ? recentDateFormat.format(when) : when.toLocaleString());
    id.append(time);

    const actions = el("div", { className: "recent-actions" });
    const again = el("button", { type: "button", className: "retry-btn", "aria-label": `Check ${item.name} again` }, "Check again");
    again.addEventListener("click", () => {
      $("#name-input").value = item.name;
      updatePlate();
      startCheck(item.name, $("#keywords-input").value);
    });
    const remove = el("button", { type: "button", className: "retry-btn is-quiet", "aria-label": `Remove ${item.name} from recent checks` }, "Remove");
    remove.addEventListener("click", () => {
      removeRecent(item.name);
      $("#recent-heading")?.focus();
    });
    actions.append(again, remove);
    li.append(id, actions);
    ul.append(li);
  }
}

// ---------------------------------------------------------------------------
// Side hustle idea test. One AI request, then one batch request for the .com
// of every suggested name. The AI never decides availability.
// ---------------------------------------------------------------------------

const VERDICT_LABEL = {
  promising: "Promising",
  needs_sharpening: "Needs sharpening",
  tough_road: "Tough road",
  not_a_business_idea: "Not a business idea yet",
};

let ideaRun = 0;
let ideaReport = null;
let landingName = null; // the name the person checked after testing the idea; fills the landing page prompt
let autoKeywords = ""; // keywords we filled in from the idea, so we don't overwrite the user's own

async function callIdea(idea) {
  if (!apiConfigured()) {
    return { error: "The idea tester isn't connected yet. Set CHECK_API_URL in app.js to the Lambda URL." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.ideaTimeoutMs);
  try {
    const res = await fetch(CHECK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ kind: "idea", idea }),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* handled below */ }
    if (!res.ok || !data?.idea) {
      const msg = typeof data?.error === "string" && data.error.length < 200 ? data.error : null;
      return { error: msg || `The idea tester returned an error (HTTP ${res.status}). Try again.` };
    }
    return { report: data.idea };
  } catch (err) {
    return { error: err?.name === "AbortError" ? "The AI took too long. Try again." : "Couldn't reach the idea tester. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

function setIdeaBusy(on) {
  const btn = $("#idea-btn");
  btn.disabled = on;
  btn.setAttribute("aria-busy", on ? "true" : "false");
  btn.textContent = on ? "Testing your idea…" : "Test my idea";
}

function showIdeaError(msg) {
  const e = $("#idea-error");
  e.textContent = msg;
  e.hidden = false;
}

function fillGrid(dl, pairs) {
  dl.replaceChildren();
  for (const [label, value] of pairs) {
    if (!value) continue;
    const row = el("div");
    row.append(el("dt", {}, label), el("dd", {}, value));
    dl.append(row);
  }
  dl.closest(".block").hidden = dl.children.length === 0;
}

function fillList(ul, items) {
  ul.replaceChildren(...items.map((t) => el("li", {}, t)));
}

async function runIdea(raw) {
  const idea = String(raw || "").replace(/\s+/g, " ").trim();
  const input = $("#idea-input");
  $("#idea-error").hidden = true;
  input.removeAttribute("aria-invalid");
  if (idea.length < CONFIG.ideaMinLength) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return showIdeaError("Describe your idea in at least a few words, like who it's for and what it does.");
  }
  if (idea.length > CONFIG.ideaMaxLength) {
    input.setAttribute("aria-invalid", "true");
    return showIdeaError(`Keep it under ${CONFIG.ideaMaxLength} characters. A sentence is plenty.`);
  }

  const id = ++ideaRun;
  setIdeaBusy(true);
  const status = $("#idea-status");
  status.textContent = "Reading your idea. This usually takes 5 to 15 seconds.";
  const slow = setTimeout(() => {
    if (id === ideaRun) status.textContent = "Still working on it…";
  }, 12000);

  const { report, error } = await callIdea(idea);
  clearTimeout(slow);
  if (id !== ideaRun) return;
  setIdeaBusy(false);
  status.textContent = "";
  if (error) return showIdeaError(error);

  ideaReport = report;
  landingName = null; // a new idea starts without a chosen name
  renderIdea(report, id);
}

function renderIdea(r, id) {
  const verdict = $("#idea-verdict");
  verdict.dataset.verdict = r.verdict;
  verdict.textContent = VERDICT_LABEL[r.verdict] || "First read";
  $("#idea-title").textContent = r.sharpenedIdea || "Your idea";
  $("#idea-verdict-reason").textContent = r.verdictReason || "";

  const assumptions = Array.isArray(r.assumptions) ? r.assumptions : [];
  fillList($("#idea-assumptions"), assumptions);
  $("#idea-assumptions-wrap").hidden = assumptions.length === 0;

  const notIdea = r.verdict === "not_a_business_idea";
  $("#idea-body").hidden = notIdea;

  if (!notIdea) {
    fillGrid($("#idea-fit"), [
      ["Who pays", r.targetCustomer],
      ["The pain", r.painPoint],
      ["Why they'd pick you", r.valueProposition],
      ["How it makes money", r.revenueModel],
      ["What they use today", r.existingAlternatives],
      ["Around a 9-to-5", r.fitsAround9to5],
    ]);
    const v = r.validation || {};
    fillGrid($("#idea-test"), [
      ["The test", v.sevenDayTest],
      ["Keep going if", v.successSignal],
      ["Change course if", v.pivotSignal],
    ]);
    const t = r.timeline || {};
    fillGrid($("#idea-evenings"), [
      ["Evening 1", t.day1],
      ["Evening 2", t.day2],
    ]);
    const customers = Array.isArray(r.firstCustomers) ? r.firstCustomers : [];
    fillList($("#idea-customers"), customers);
    $("#idea-customers-wrap").hidden = customers.length === 0;
    fillList($("#idea-risks"), Array.isArray(r.risks) ? r.risks : []);
    $("#idea-reality").textContent = r.realityCheck || "";
    renderNameIdeas(r, id);
    renderLandingPrompt();
  }

  $("#idea-results").hidden = false;
  const title = $("#idea-title");
  title.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  title.focus({ preventScroll: true });
}

function renderNameIdeas(r, id) {
  const list = $("#name-ideas");
  list.replaceChildren();
  const niche = (Array.isArray(r.nicheWords) ? r.nicheWords : []).join(", ");
  const ideas = (Array.isArray(r.nameIdeas) ? r.nameIdeas : [])
    .map((it) => {
      const n = normalizeName(it.name);
      return n.stem ? { ...it, n, score: scoreName(n.stem, niche) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score.score - a.score.score);

  $("#name-ideas-block").hidden = ideas.length === 0;
  if (!ideas.length) return;

  const pills = [];
  for (const it of ideas) {
    const li = el("li", { className: "row", dataset: { status: "pending" } });
    const idBox = el("div", { className: "row-id" });
    idBox.append(el("span", { className: "row-title" }, it.n.brand), el("span", { className: "row-sub" }, it.why || ""));

    const pill = el("span", { className: "status", dataset: { status: "pending" } });
    pill.append(el("span", { className: "status-dot", "aria-hidden": "true" }), el("span", { className: "status-text" }, `.com ${STATUS_LABEL.pending}`));
    pills.push({ pill, li, stem: it.n.stem });

    const actions = el("div", { className: "row-actions" });
    actions.append(el("span", { className: "name-idea-score" }, `${it.score.score} / 100`));
    const pick = el("button", { type: "button", className: "pick-btn", "aria-label": `Check ${it.n.brand} everywhere` }, "Check this name");
    pick.addEventListener("click", () => pickName(it.n.brand, niche));
    actions.append(pick);

    const note = el("p", { className: "row-note" }, `${it.score.label}. ${it.n.stem}.com`);
    li.append(idBox, pill, actions, note);
    list.append(li);
  }
  $("#name-ideas-note").textContent =
    "Scores are the local distinctiveness heuristic, not legal clearance. Only .com is checked here; pick a name to check every domain and handle.";

  // One batch request for every suggested .com
  callBatch(pills.map((p) => ({ kind: "domain", domain: `${p.stem}.com` }))).then((results) => {
    if (id !== ideaRun) return;
    results.forEach((res, i) => {
      const { pill, li } = pills[i];
      pill.dataset.status = res.status;
      li.dataset.status = res.status;
      $(".status-text", pill).textContent = `.com ${STATUS_LABEL[res.status]}`;
    });
  });
}

function pickName(name, niche) {
  const input = $("#name-input");
  const keywords = $("#keywords-input");
  input.value = name;
  if (niche && (!keywords.value.trim() || keywords.value === autoKeywords)) {
    keywords.value = niche;
    autoKeywords = niche;
  }
  updatePlate();
  startCheck(name, keywords.value);
}

// The landing page prompt is assembled here from the report's fields instead of
// being written by the AI. That keeps the AI reply short (cheaper, faster, less
// likely to be cut off) and lets the prompt use the name the person actually checked.
function buildLandingPrompt(r, name) {
  const product = name || "[YOUR PRODUCT NAME]";
  const v = r.validation || {};
  const benefits = Array.isArray(r.benefits) ? r.benefits.filter(Boolean) : [];
  const line = (label, value) => (value ? `${label}: ${value}` : null);
  const lines = [
    `Build a one-page landing page for "${product}" as a single index.html file: HTML, CSS and vanilla JavaScript only, under 40KB, no frameworks, no build step.`,
    "",
    line("What it is", r.sharpenedIdea),
    line("Headline", r.headline),
    line("Who it's for", r.targetCustomer),
    line("Their problem", r.painPoint),
    line("Why it beats what they do now", r.valueProposition),
    "",
    "Page sections, in this order:",
    "1. Hero: the headline, one plain sentence under it, and one call-to-action button.",
    benefits.length
      ? `2. Three benefits:\n${benefits.map((b) => `   - ${b}`).join("\n")}`
      : "2. Three short benefits written for this buyer.",
    `3. Pricing: one plan${r.price ? ` at ${r.price}` : ""}. Show the price clearly, so clicks reflect real buying intent.`,
    "4. A short FAQ with 3 or 4 questions this buyer would actually ask.",
    "5. A simple footer.",
    "",
    v.sevenDayTest ? `The page exists to run this 7-day test: ${v.sevenDayTest}` : null,
    "Point every call-to-action button at the placeholder FORM_LINK_URL. I'll replace it with a signup form or payment link. Don't build a backend, login or database.",
    "",
    `Style: clean, modern, fast and mobile-first. Accessible: real labels, visible focus states, good contrast. Plain English, no hype, no filler. Someone who has never heard of ${product} should understand what it does within five seconds.`,
  ];
  return lines
    .filter((l) => l !== null)
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")) // no double blank lines
    .join("\n")
    .trim();
}

function renderLandingPrompt() {
  if (!ideaReport || ideaReport.verdict === "not_a_business_idea") return;
  $("#idea-mvp").textContent = buildLandingPrompt(ideaReport, landingName);
  $("#idea-mvp-name").textContent = landingName
    ? `Using the name ${landingName}. Check another name to switch.`
    : "Check one of the names above to fill in the product name.";
}

async function copyMvp() {
  const btn = $("#copy-mvp");
  try {
    await navigator.clipboard.writeText($("#idea-mvp").textContent);
    btn.textContent = "Prompt copied";
  } catch {
    btn.textContent = "Copy failed. Select the text instead.";
  }
  setTimeout(() => { btn.textContent = "Copy prompt"; }, 2200);
}

// ---------------------------------------------------------------------------
// Form, nameplate preview, URL state
// ---------------------------------------------------------------------------

function showError(msg) {
  const e = $("#form-error");
  e.textContent = msg;
  e.hidden = false;
  $("#name-input").setAttribute("aria-invalid", "true");
  $("#name-input").focus();
}

function hideError() {
  $("#form-error").hidden = true;
}

function updatePlate() {
  const raw = $("#name-input").value;
  const n = normalizeName(raw);
  const plate = $("#plate-name");
  if (!n.brand) {
    plate.textContent = "QuotaBird";
    plate.classList.add("is-placeholder");
    $("#plate-stem").textContent = "quotabird";
    $("#plate-handle").textContent = "@quotabird";
    $("#plate-note").hidden = true;
    return;
  }
  plate.classList.remove("is-placeholder");
  plate.textContent = n.brand;
  $("#plate-stem").textContent = n.stem || "(needs letters or numbers)";
  $("#plate-handle").textContent = n.stem ? `@${n.handle}` : "(needs letters or numbers)";
  const note = describeNormalization(n);
  $("#plate-note").textContent = note;
  $("#plate-note").hidden = !note;
}

function buildTldPicker() {
  const box = $("#tld-picker");
  for (const tld of [...CONFIG.defaultTlds, ...CONFIG.extraTlds]) {
    const label = el("label", { className: "tld-chip" });
    const cb = el("input", { type: "checkbox", value: tld });
    cb.checked = selectedTlds.has(tld);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedTlds.add(tld);
      else if (selectedTlds.size > 1) selectedTlds.delete(tld);
      else cb.checked = true; // keep at least one
      $("#tld-count").textContent = String(selectedTlds.size);
    });
    label.append(cb, el("span", {}, `.${tld}`));
    box.append(label);
  }
  $("#tld-count").textContent = String(selectedTlds.size);
}

function syncTldPicker() {
  for (const cb of document.querySelectorAll("#tld-picker input")) cb.checked = selectedTlds.has(cb.value);
  $("#tld-count").textContent = String(selectedTlds.size);
}

function writeUrl(brand, keywords, tlds) {
  const params = new URLSearchParams();
  params.set("name", brand);
  if (keywords.trim()) params.set("kw", keywords.trim());
  const isDefault = tlds.length === CONFIG.defaultTlds.length && tlds.every((t) => CONFIG.defaultTlds.includes(t));
  if (!isDefault) params.set("tlds", tlds.join(","));
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  const name = p.get("name") || "";
  const kw = p.get("kw") || "";
  const tlds = (p.get("tlds") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
    .filter((t) => CONFIG.defaultTlds.includes(t) || CONFIG.extraTlds.includes(t));
  return { name, kw, tlds };
}

async function copyLink() {
  const btn = $("#copy-link");
  try {
    await navigator.clipboard.writeText(location.href);
    btn.textContent = "Link copied";
  } catch {
    btn.textContent = "Copy failed. Use the address bar.";
  }
  setTimeout(() => { btn.textContent = "Copy link to this check"; }, 2200);
}

function init() {
  buildTldPicker();

  const form = $("#check-form");
  const input = $("#name-input");
  const keywords = $("#keywords-input");

  input.addEventListener("input", () => {
    updatePlate();
    if (!$("#form-error").hidden) hideError();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startCheck(input.value, keywords.value);
  });
  $("#fallback-btn").addEventListener("click", checkFallbacks);

  const ideaInput = $("#idea-input");
  $("#idea-form").addEventListener("submit", (e) => {
    e.preventDefault();
    runIdea(ideaInput.value);
  });
  ideaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runIdea(ideaInput.value);
    }
  });
  ideaInput.addEventListener("input", () => {
    if (!$("#idea-error").hidden) $("#idea-error").hidden = true;
    ideaInput.removeAttribute("aria-invalid");
  });
  for (const btn of document.querySelectorAll(".example-btn")) {
    btn.addEventListener("click", () => {
      ideaInput.value = btn.textContent;
      runIdea(btn.textContent);
    });
  }
  $("#copy-mvp").addEventListener("click", copyMvp);
  $("#copy-link").addEventListener("click", copyLink);
  $("#recent-clear").addEventListener("click", () => {
    storeRecent([]);
    renderRecent();
    $("#name-input").focus();
  });
  renderRecent();

  const { name, kw, tlds } = readUrl();
  if (tlds.length) {
    selectedTlds.clear();
    for (const t of tlds.slice(0, 25)) selectedTlds.add(t);
    syncTldPicker();
  }
  if (kw) {
    keywords.value = kw;
    $("#keywords-details").open = true;
  }
  if (name) {
    input.value = name;
    updatePlate();
    startCheck(name, kw, { updateUrl: false });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
