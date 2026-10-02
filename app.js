"use strict";

// Shared Lambda Function URL (the same Lambda also serves the Idea Sifter).
const CHECK_API_URL = "https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws/";

const CONFIG = {
  timeoutMs: 40000,
  minLength: 3,
  maxLength: 500,
  maxNames: 6, // show at most this many open .com names
  // Plain, non-affiliate links.
  registrarUrl: (domain) => `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
  searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
};

const VERDICT_LABEL = {
  great: "Great idea",
  worth_a_shot: "Worth a shot",
  crowded: "Crowded market",
  nah: "Nah, brah",
  cant_help: "Can't help with that one",
};

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "className") node.className = v;
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Ask the Lambda (one request: Gemini plus live .com checks)
// ---------------------------------------------------------------------------

async function ask(idea) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);
  try {
    // text/plain keeps this a "simple" CORS request (no preflight). The Lambda parses it as JSON.
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
      return { error: msg || "Something went wrong. Try again." };
    }
    return { report: data.idea };
  } catch (err) {
    return { error: err?.name === "AbortError" ? "That took too long. Try again." : "Couldn't connect. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Run a check
// ---------------------------------------------------------------------------

let runId = 0;
let lastIdea = "";
let justChecked = false; // after a result, the next click into the box selects it so typing replaces it

async function check(raw) {
  const idea = String(raw || "").replace(/\s+/g, " ").trim();
  const input = $("#idea-input");
  const error = $("#idea-error");
  error.hidden = true;
  input.removeAttribute("aria-invalid");
  if (idea.length < CONFIG.minLength) return showError("Type an idea first. A few words is enough.");
  if (idea.length > CONFIG.maxLength) return showError(`Keep it under ${CONFIG.maxLength} characters. One line is plenty.`);

  const id = ++runId;
  lastIdea = idea;
  setBusy(true);
  $("#status").textContent = "Thinking it over…";
  const step = setTimeout(() => { if (id === runId) $("#status").textContent = "Checking which .com names are open…"; }, 4500);

  const { report, error: err } = await ask(idea);
  clearTimeout(step);
  if (id !== runId) return;
  setBusy(false);
  $("#status").textContent = "";
  if (err) return showError(err);
  render(report);
  justChecked = true;
}

function showError(msg) {
  const e = $("#idea-error");
  e.textContent = msg;
  e.hidden = false;
  $("#idea-input").setAttribute("aria-invalid", "true");
}

function setBusy(on) {
  const btn = $("#idea-btn");
  btn.disabled = on;
  btn.textContent = on ? "Checking…" : "Check it";
}

// ---------------------------------------------------------------------------
// Render the answer card
// ---------------------------------------------------------------------------

function render(r) {
  const card = $("#result");
  card.dataset.verdict = r.verdict;

  const wrote = $("#you-wrote");
  wrote.replaceChildren(document.createTextNode("You asked about "), el("q", {}, lastIdea));
  $("#verdict").textContent = VERDICT_LABEL[r.verdict] || "Here's the read";
  $("#reason").textContent = r.verdictReason || "";

  // Quick facts: the sharper version, who pays, the first move
  const facts = $("#facts");
  facts.replaceChildren();
  for (const [label, value] of [["Sharper version", r.sharpenedIdea], ["Who pays", r.whoPays], ["Try this first", r.firstMove]]) {
    if (!value) continue;
    const row = el("div");
    row.append(el("dt", {}, label), el("dd", {}, value));
    facts.append(row);
  }

  renderYours(r.yourName);
  renderNames(Array.isArray(r.names) ? r.names : [], r.verdict);
  $("#names-title").textContent = r.yourName ? "Other names with an open .com" : "Names with an open .com";

  // Related searches: open Google so people can see the competition themselves
  const kws = r.verdict === "cant_help" || !Array.isArray(r.keywords) ? [] : r.keywords;
  $("#keywords").replaceChildren(...kws.map((k) => {
    const li = el("li");
    li.append(el("a", { className: "chip", href: CONFIG.searchUrl(k), target: "_blank", rel: "noopener", "aria-label": `Search Google for ${k}` }, k));
    return li;
  }));
  $("#keywords-part").hidden = kws.length === 0;

  // Other ideas: one click checks the next one
  const alts = Array.isArray(r.alternatives) ? r.alternatives : [];
  $("#alts").replaceChildren(...alts.map((text) => {
    const li = el("li");
    const btn = el("button", { type: "button", className: "chip" }, text);
    btn.addEventListener("click", () => tryIdea(text));
    li.append(btn);
    return li;
  }));
  $("#alts-title").textContent = r.verdict === "cant_help" ? "Ideas we can help with" : "Try one of these instead";
  $("#alts-part").hidden = alts.length === 0;

  card.hidden = false;
  const heading = $("#verdict");
  card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

// The name the person typed or mentioned, checked live: always shown, open or not.
function renderYours(y) {
  const part = $("#yours-part");
  const box = $("#yours");
  box.replaceChildren();
  part.hidden = !y;
  if (!y) return;

  const pillText = {
    likely_available: "Looks open",
    taken: y.registeredYear ? `Taken since ${y.registeredYear}` : "Taken",
    unknown: "Couldn't check right now",
  }[y.status] || "Couldn't check right now";

  box.append(
    el("span", { className: "name-word" }, y.name),
    el("span", { className: "sr-only" }, ", "),
    el("span", { className: "name-domain" }, y.domain),
    el("span", { className: "sr-only" }, ", "),
    el("span", { className: "pill", "data-status": y.status }, pillText),
    el("span", { className: "sr-only" }, ", "),
  );
  if (y.status === "likely_available") {
    box.append(el("a", { href: CONFIG.registrarUrl(y.domain), target: "_blank", rel: "noopener" }, "Register it"));
  } else if (y.status === "taken") {
    box.append(el("a", { href: `https://${y.domain}`, target: "_blank", rel: "noopener nofollow" }, "See who has it"));
  } else {
    box.append(el("a", { href: CONFIG.registrarUrl(y.domain), target: "_blank", rel: "noopener" }, "Look it up"));
  }

  const takenHint = y.status === "taken" ? " The open names below are close alternatives." : "";
  $("#yours-note").textContent = `${y.comment || ""}${takenHint}`.trim();
}

// Only names the registry shows as open are listed. If none are open, say so
// plainly; if the registry couldn't be reached, show a few names marked as unchecked.
function renderNames(names, verdict) {
  const part = $("#names-part");
  const list = $("#names");
  const note = $("#names-note");
  list.replaceChildren();
  note.textContent = "";
  if (verdict === "cant_help" || names.length === 0) { part.hidden = true; return; }
  part.hidden = false;

  const open = names.filter((n) => n.status === "likely_available");
  const unknown = names.filter((n) => n.status === "unknown");
  const shown = (open.length ? open : unknown).slice(0, CONFIG.maxNames);

  for (const n of shown) {
    const li = el("li", { "data-status": n.status });
    li.append(
      el("span", { className: "name-word" }, n.name),
      el("span", { className: "sr-only" }, ", "),
      el("span", { className: "name-domain" }, n.domain),
      el("span", { className: "sr-only" }, ", "),
    );
    li.append(el("a", { href: CONFIG.registrarUrl(n.domain), target: "_blank", rel: "noopener", "aria-label": `Register ${n.domain}` }, open.length ? "Register" : "Look it up"));
    list.append(li);
  }

  if (!open.length && !unknown.length) {
    note.textContent = `All ${names.length} names we came up with already have their .com taken. Check it again for a fresh batch.`;
  } else if (!open.length) {
    note.textContent = "Couldn't reach the .com registry just now, so these aren't checked yet.";
  } else {
    const taken = names.filter((n) => n.status === "taken").length;
    const takenText = taken ? `; ${taken} ${taken === 1 ? "was" : "were"} taken` : "";
    note.textContent = `We came up with ${names.length} names and checked each .com live${takenText}. Grab one fast: open names don't stay open.`;
  }
}

// Empty the box and put the cursor in it, ready for the next idea.
function newIdea({ scroll = false } = {}) {
  const input = $("#idea-input");
  input.value = "";
  autosize(input);
  syncClear();
  justChecked = false;
  $("#idea-error").hidden = true;
  input.removeAttribute("aria-invalid");
  if (scroll) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  input.focus({ preventScroll: scroll });
}

function syncClear() {
  $("#idea-clear").hidden = $("#idea-input").value.trim() === "";
}

function tryIdea(text) {
  const input = $("#idea-input");
  input.value = text;
  autosize(input);
  syncClear();
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  check(text);
}

function autosize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------

function init() {
  const input = $("#idea-input");
  $("#idea-form").addEventListener("submit", (e) => {
    e.preventDefault();
    check(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { // Enter checks; Shift+Enter adds a line
      e.preventDefault();
      check(input.value);
    } else if (e.key === "Escape" && input.value) { // Escape clears the box
      e.preventDefault();
      newIdea();
    }
  });
  // After a result, clicking or tabbing into the box selects the old idea,
  // so just typing replaces it. No need to backspace.
  const selectIfStale = () => {
    if (justChecked && input.value.trim() === lastIdea) input.select();
  };
  input.addEventListener("focus", selectIfStale);
  input.addEventListener("click", selectIfStale);
  $("#idea-clear").addEventListener("click", () => newIdea());
  $("#again").addEventListener("click", () => newIdea({ scroll: true }));

  input.addEventListener("input", () => {
    justChecked = false;
    syncClear();
    autosize(input);
    if (!$("#idea-error").hidden) $("#idea-error").hidden = true;
    input.removeAttribute("aria-invalid");
  });
  for (const btn of document.querySelectorAll("#examples .chip")) {
    btn.addEventListener("click", () => tryIdea(btn.textContent));
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
