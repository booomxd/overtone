// Overtone runtime: runs inside Spotify's UI page. Injected by the launcher
// before the page loads and again on every reload.
(() => {
  if (window.__overtone) return;
  const VERSION = "0.1.0";
  const STORE = "overtone:settings";

  // ---- Colours -------------------------------------------------------------

  const rgb = (hex) => {
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
  const alpha = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, "0");
  const luminance = (c) => {
    const [r, g, b] = rgb(c).map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const isColor = (c) => typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);

  // ---- Themes --------------------------------------------------------------

  /** Colours of a theme: page background, cards and menus, hover, text,
   *  secondary text, accent (play buttons, progress), and the gaps between panels. */
  const FIELDS = [
    ["bg", "Background"],
    ["surface", "Cards & menus"],
    ["highlight", "Hover"],
    ["text", "Text"],
    ["subtext", "Secondary text"],
    ["accent", "Accent"],
    ["appBg", "Window"],
  ];

  const PRESETS = {
    Spotify: { bg: "#121212", surface: "#1f1f1f", highlight: "#2a2a2a", text: "#ffffff", subtext: "#b3b3b3", accent: "#1ed760", appBg: "#000000" },
    Midnight: { bg: "#0f1626", surface: "#18213a", highlight: "#22304f", text: "#e6ecff", subtext: "#9aa8c7", accent: "#6ea8ff", appBg: "#090e1a" },
    "Rosé": { bg: "#191417", surface: "#241c21", highlight: "#31262d", text: "#f4e9ee", subtext: "#b9a3ad", accent: "#f2a5c0", appBg: "#110d0f" },
    Cocoa: { bg: "#1e1e2e", surface: "#262637", highlight: "#313244", text: "#cdd6f4", subtext: "#a6adc8", accent: "#cba6f7", appBg: "#181825" },
    Frost: { bg: "#2e3440", surface: "#3b4252", highlight: "#434c5e", text: "#eceff4", subtext: "#b8c0cf", accent: "#88c0d0", appBg: "#272c36" },
    Ember: { bg: "#1a1410", surface: "#261d16", highlight: "#33271d", text: "#f5e9dc", subtext: "#bba892", accent: "#ff8a3d", appBg: "#120e0b" },
    Amoled: { bg: "#000000", surface: "#0d0d0d", highlight: "#1a1a1a", text: "#ffffff", subtext: "#a0a0a0", accent: "#1ed760", appBg: "#000000" },
    Paper: { bg: "#f6f6f4", surface: "#ffffff", highlight: "#e6e6e2", text: "#161616", subtext: "#5c5c5c", accent: "#1aa34a", appBg: "#e2e2dd" },
  };
  for (const t of Object.values(PRESETS)) Object.assign(t, { radius: 1, font: "" });

  const DEFAULTS = { theme: "Spotify", themes: {}, albumAccent: false };
  let settings;
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    settings = { ...DEFAULTS };
  }
  const save = () => localStorage.setItem(STORE, JSON.stringify(settings));
  const current = () => settings.themes[settings.theme] || PRESETS[settings.theme] || PRESETS.Spotify;
  let albumColor = null;

  /** A theme from untrusted JSON (import, storage), or null. */
  function clean(t) {
    if (!t || typeof t !== "object") return null;
    const out = {};
    for (const [k] of FIELDS) {
      if (!isColor(t[k])) return null;
      out[k] = t[k].toLowerCase();
    }
    out.radius = Math.max(0, Math.min(3, Number(t.radius) || 1));
    out.font = String(t.font || "").replace(/[^\w \-]/g, "").slice(0, 60);
    return out;
  }

  // Unlayered rules beat Spotify's `@layer encore`; `> *` rules skip elements
  // that start another colour set (negative, warning...), which keep theirs.
  const OTHER_SET = ':not([class*="encore-"][class*="-set"])';

  function css(t, accent) {
    const light = luminance(t.bg) > 0.5;
    const onAccent = contrast(accent, "#000000") > contrast(accent, "#ffffff") ? "#000000" : "#ffffff";
    const base = {
      "--background-base": t.bg,
      "--background-highlight": t.highlight,
      "--background-press": t.appBg,
      "--background-elevated-base": t.surface,
      "--background-elevated-highlight": t.highlight,
      "--background-elevated-press": mix(t.surface, t.bg, 0.5),
      "--background-tinted-base": alpha(t.text, 0.1),
      "--background-tinted-highlight": alpha(t.text, 0.14),
      "--background-tinted-press": alpha(t.text, 0.21),
      "--text-base": t.text,
      "--text-subdued": t.subtext,
      "--text-bright-accent": accent,
      "--essential-base": t.text,
      "--essential-subdued": mix(t.subtext, t.bg, 0.3),
      "--essential-bright-accent": accent,
      "--decorative-base": t.text,
      "--decorative-subdued": mix(t.bg, t.text, light ? 0.15 : 0.1),
    };
    const accentSet = {
      "--background-base": accent,
      "--background-highlight": mix(accent, "#ffffff", 0.12),
      "--background-press": mix(accent, "#000000", 0.15),
      "--text-base": onAccent,
      "--text-subdued": onAccent,
      "--essential-base": onAccent,
    };
    const block = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("");
    const radii = { smaller: 2, base: 4, larger: 6, "larger-2": 8, "larger-3": 16 };
    const root = [];
    if (t.radius !== 1) {
      for (const [k, v] of Object.entries(radii)) root.push(`--encore-corner-radius-${k}:${v * t.radius}px;`);
    }
    if (t.font) {
      for (const k of ["body", "title", "variable"]) root.push(`--encore-${k}-font-stack:"${t.font}",var(--fallback-fonts);`);
    }
    return `
.encore-dark-theme, .encore-dark-theme .encore-base-set,
.encore-dark-theme > *${OTHER_SET}, .encore-dark-theme .encore-base-set > *${OTHER_SET} { ${block(base)} }
.encore-dark-theme .encore-bright-accent-set,
.encore-dark-theme .encore-bright-accent-set > *${OTHER_SET} { ${block(accentSet)} }
:root, .encore-dark-theme { ${root.join("")} }
body { background-color: ${t.appBg}; }
${t.font ? `body { font-family: "${t.font}", var(--fallback-fonts); }` : ""}`;
  }

  function apply() {
    let style = document.getElementById("overtone-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "overtone-theme";
      (document.head || document.documentElement).appendChild(style);
    }
    const t = current();
    const accent = (settings.albumAccent && albumColor) || t.accent;
    const untouched = settings.theme === "Spotify" && !settings.themes.Spotify && accent === t.accent;
    style.textContent = untouched ? "" : css(t, accent);
  }

  // ---- Accent from album art -------------------------------------------------

  /** The now-playing bar's cover: the cover-art image nearest the bottom. */
  const nowPlayingCover = () =>
    [...document.querySelectorAll('[data-testid="cover-art-image"]')]
      .filter((img) => img.src && img.getBoundingClientRect().top > innerHeight - 160)
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];

  let lastCover = "";
  function sampleCover() {
    const img = nowPlayingCover();
    if (!settings.albumAccent || !img || img.src === lastCover) return;
    lastCover = img.src;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(probe, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        // Average weighted by saturation, so vivid colours win over greys.
        let [r, g, b, w] = [0, 0, 0, 0];
        for (let i = 0; i < px.length; i += 4) {
          const max = Math.max(px[i], px[i + 1], px[i + 2]), min = Math.min(px[i], px[i + 1], px[i + 2]);
          const weight = ((max - min) / 255) ** 2 + 0.01;
          r += px[i] * weight; g += px[i + 1] * weight; b += px[i + 2] * weight; w += weight;
        }
        let c = hex([r / w, g / w, b / w]);
        // Keep it readable against the theme's background.
        const bg = current().bg, toward = luminance(bg) > 0.5 ? "#000000" : "#ffffff";
        for (let step = 0; step < 10 && contrast(c, bg) < 3; step++) c = mix(c, toward, 0.15);
        albumColor = c;
        apply();
      } catch {
        // The image server didn't allow reading pixels; keep the theme's accent.
      }
    };
    probe.src = img.src;
  }

  // ---- Editor panel ----------------------------------------------------------

  const PANEL_CSS = `
#overtone-button { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-right:8px;
  border:0; border-radius:50%; background:var(--background-tinted-base); color:var(--text-base); cursor:pointer; font:700 13px/1 var(--encore-title-font-stack); }
#overtone-button:hover { background:var(--background-tinted-highlight); transform:scale(1.04); }
#overtone-panel { position:fixed; top:64px; right:16px; z-index:10000; width:300px; max-height:calc(100vh - 160px); overflow:auto;
  padding:16px; border-radius:8px; background:var(--background-elevated-base); color:var(--text-base);
  box-shadow:0 16px 40px #00000080; font:14px/1.4 var(--encore-body-font-stack); }
#overtone-panel[hidden] { display:none; }
#overtone-panel h2 { margin:0 0 12px; font:700 16px var(--encore-title-font-stack); display:flex; align-items:center; gap:8px; }
#overtone-panel h2 small { color:var(--text-subdued); font-weight:400; font-size:12px; }
#overtone-panel h2 button { margin-left:auto; }
#overtone-panel label { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px 0; color:var(--text-subdued); }
#overtone-panel select, #overtone-panel input[type=text] { width:150px; padding:6px 8px; border-radius:4px; border:1px solid var(--decorative-subdued);
  background:var(--background-base); color:var(--text-base); font:inherit; }
#overtone-panel input[type=color] { width:44px; height:26px; padding:0; border:1px solid var(--decorative-subdued); border-radius:4px; background:none; cursor:pointer; }
#overtone-panel input[type=range] { width:150px; accent-color:var(--essential-bright-accent); }
#overtone-panel input[type=checkbox] { accent-color:var(--essential-bright-accent); width:16px; height:16px; }
#overtone-panel hr { border:0; border-top:1px solid var(--decorative-subdued); margin:12px 0; }
#overtone-panel .row { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
#overtone-panel button { padding:6px 10px; border:0; border-radius:999px; background:var(--background-tinted-base); color:var(--text-base); font:inherit; font-size:12px; cursor:pointer; }
#overtone-panel button:hover { background:var(--background-tinted-highlight); }
#overtone-panel button.primary { background:var(--essential-bright-accent); color:var(--background-base); font-weight:700; }
#overtone-panel .note { color:var(--text-subdued); font-size:12px; margin:8px 0 0; min-height:1em; }`;

  const FONTS = ["Segoe UI", "Inter", "Poppins", "Montserrat", "Nunito", "Roboto", "JetBrains Mono", "Cascadia Code", "Consolas", "Georgia"];

  let panel;
  const note = (text) => { panel.querySelector(".note").textContent = text; };

  function buildPanel() {
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
    panel = document.createElement("div");
    panel.id = "overtone-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Overtone theme editor");
    document.body.appendChild(panel);
    render();
  }

  function render() {
    const t = current();
    const names = [...Object.keys(PRESETS), ...Object.keys(settings.themes).filter((n) => !PRESETS[n])];
    const option = (n) => `<option${n === settings.theme ? " selected" : ""}>${escape(n)}</option>`;
    panel.innerHTML = `
<h2>Overtone <small>v${VERSION}</small><button data-act="close" aria-label="Close">✕</button></h2>
<label>Theme <select data-act="theme">${names.map(option).join("")}</select></label>
<hr>
${FIELDS.map(([k, label]) => `<label>${label} <input type="color" data-field="${k}" value="${t[k].length === 4 ? mix(t[k], t[k], 0) : t[k]}"></label>`).join("")}
<label>Accent from album art <input type="checkbox" data-act="album"${settings.albumAccent ? " checked" : ""}></label>
<label>Corner radius <input type="range" min="0" max="3" step="0.25" data-field="radius" value="${t.radius}"></label>
<label>Font <input type="text" data-field="font" list="overtone-fonts" placeholder="Spotify's" value="${escape(t.font)}"></label>
<datalist id="overtone-fonts">${FONTS.map((f) => `<option value="${f}">`).join("")}</datalist>
<div class="row">
  <button class="primary" data-act="saveas">Save as…</button>
  ${settings.themes[settings.theme] ? `<button data-act="delete">${PRESETS[settings.theme] ? "Reset" : "Delete"}</button>` : ""}
  <button data-act="export">Copy theme</button>
  <button data-act="import">Paste theme</button>
</div>
<p class="note"></p>`;
  }

  const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** Edits always go to a stored copy; a preset's copy keeps its name. */
  function edit(field, value) {
    const t = { ...current(), [field]: value };
    settings.themes[settings.theme] = clean(t) || current();
    save();
    apply();
  }

  function onPanel(e) {
    const el = e.target;
    const act = el.dataset.act;
    if (el.dataset.field && e.type === "input") {
      const v = el.dataset.field === "radius" ? Number(el.value) : el.value;
      edit(el.dataset.field, v);
      return;
    }
    if (e.type === "change" && act === "theme") {
      settings.theme = el.value;
      lastCover = "";
      save(); apply(); render(); sampleCover();
      return;
    }
    if (e.type === "change" && act === "album") {
      settings.albumAccent = el.checked;
      albumColor = null; lastCover = "";
      save(); apply(); sampleCover();
      return;
    }
    if (e.type !== "click" || !act) return;
    if (act === "close") toggle(false);
    if (act === "saveas") {
      const name = (prompt("Name for this theme:", settings.theme === "Spotify" ? "My theme" : settings.theme + " 2") || "").trim().slice(0, 40);
      if (!name) return;
      settings.themes[name] = { ...current() };
      settings.theme = name;
      save(); apply(); render(); note(`Saved “${name}”.`);
    }
    if (act === "delete") {
      delete settings.themes[settings.theme];
      if (!PRESETS[settings.theme]) settings.theme = "Spotify";
      save(); apply(); render();
    }
    if (act === "export") {
      navigator.clipboard.writeText(JSON.stringify({ name: settings.theme, ...current() }, null, 2))
        .then(() => note("Theme copied to the clipboard."), () => note("Couldn't access the clipboard."));
    }
    if (act === "import") {
      navigator.clipboard.readText().then((text) => {
        let data;
        try { data = JSON.parse(text); } catch { return note("The clipboard doesn't hold a theme."); }
        const t = clean(data);
        if (!t) return note("That theme is missing colours.");
        const name = String(data.name || "Imported").replace(/[<>]/g, "").slice(0, 40) || "Imported";
        settings.themes[name] = t;
        settings.theme = name;
        save(); apply(); render(); note(`Imported “${name}”.`);
      }, () => note("Couldn't access the clipboard."));
    }
  }

  function toggle(open = panel.hidden) {
    panel.hidden = !open;
    if (open) render();
    document.getElementById("overtone-button")?.setAttribute("aria-expanded", String(open));
  }

  /** The top-bar button, put back whenever Spotify re-renders the bar. */
  function ensureButton() {
    if (document.getElementById("overtone-button")) return;
    const user = document.querySelector('[data-testid="user-widget-link"]');
    if (!user?.parentElement) return;
    const button = document.createElement("button");
    button.id = "overtone-button";
    button.textContent = "O";
    button.title = "Overtone (Ctrl+Shift+O)";
    button.setAttribute("aria-label", "Overtone theme editor");
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.addEventListener("click", () => toggle());
    user.parentElement.insertBefore(button, user);
  }

  // ---- Start -------------------------------------------------------------------

  function start() {
    if (!document.body || !document.getElementById("main")) return setTimeout(start, 250);
    buildPanel();
    for (const type of ["input", "change", "click"]) panel.addEventListener(type, onPanel);
    addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); toggle(); }
      if (e.key === "Escape" && !panel.hidden) toggle(false);
    });
    setInterval(() => { ensureButton(); sampleCover(); }, 1000);
    ensureButton();
  }

  window.__overtone = { version: VERSION, settings: () => settings, apply };
  if (document.readyState === "loading") {
    // Injected before the page exists: theme as soon as there is a document,
    // so Spotify's own colours never flash.
    document.addEventListener("readystatechange", apply, { once: true });
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    apply();
    start();
  }
})();
