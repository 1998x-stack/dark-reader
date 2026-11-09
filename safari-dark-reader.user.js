// ==UserScript==
// @name         Safari Dark Reader — Adaptive Site Controls
// @namespace    https://github.com/1998x-stack/dark-reader
// @version      2.0.0
// @description  Dark Reader for Safari: per-site Auto/On/Off, native-theme protection, floating controls and keyboard shortcuts.
// @author       1998x-stack contributors
// @license      MIT
// @homepageURL  https://github.com/1998x-stack/dark-reader
// @supportURL   https://github.com/1998x-stack/dark-reader/issues
// @downloadURL  https://raw.githubusercontent.com/1998x-stack/dark-reader/main/safari-dark-reader.user.js
// @updateURL    https://raw.githubusercontent.com/1998x-stack/dark-reader/main/safari-dark-reader.user.js
// @match        http://*/*
// @match        https://*/*
// @exclude      https://docs.google.com/*
// @exclude      https://sheets.google.com/*
// @exclude      https://slides.google.com/*
// @exclude      https://maps.google.com/*
// @noframes
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/darkreader@4.9.135/darkreader.js
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(() => {
  'use strict';

  // Dark Reader (MIT) is a separate upstream library loaded by the pinned @require.
  // This script contains *only* preferences, Safari controls and lifecycle logic.
  const ID = 'sdr-control-host';
  const PREFIX = 'safari-dark-reader:v2:';
  const SITE_KEY = `${PREFIX}site:${location.hostname.toLowerCase()}`;
  const THEME_KEY = `${PREFIX}theme`;
  const MODES = ['auto', 'on', 'off'];
  const DEFAULT_THEME = Object.freeze({ brightness: 100, contrast: 90, sepia: 10 });
  const THEME_RANGES = Object.freeze({
    brightness: [75, 125], contrast: [70, 115], sepia: [0, 40],
  });
  const EXCLUDED_HOSTS = [
    'docs.google.com', 'sheets.google.com', 'slides.google.com',
    'maps.google.com', 'figma.com', 'canva.com', 'miro.com',
  ];
  const hostname = location.hostname.toLowerCase();
  if (EXCLUDED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))) return;
  if (document.contentType && !/^(text\/html|application\/xhtml\+xml)$/i.test(document.contentType)) return;

  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const library = typeof DarkReader !== 'undefined' ? DarkReader : null;
  const state = { mode: 'auto', theme: { ...DEFAULT_THEME }, enabled: false,
    native: false, error: '', saved: true, ready: false, menuOpen: false };
  let toggleButton;
  let menuButton;
  let menu;
  let stateLine;
  let themeTimer;
  let rootObserver;
  let rootTimer;
  let preferenceWrite = Promise.resolve();
  let previousSignature = '';

  function normalizeMode(value) {
    return MODES.includes(value) ? value : 'auto';
  }

  function normalizedTheme(value) {
    const next = { ...DEFAULT_THEME };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return next;
    for (const [key, [min, max]] of Object.entries(THEME_RANGES)) {
      const n = Number(value[key]);
      if (Number.isFinite(n) && value[key] !== null && value[key] !== '') {
        next[key] = Math.round(Math.min(max, Math.max(min, n)));
      }
    }
    return next;
  }

  // GM storage persists across subdomains without exposing preferences to site JS.
  // localStorage is only a fallback for non-Tampermonkey userscript managers.
  async function readSetting(key, fallback) {
    try {
      if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
        return await GM.getValue(key, fallback);
      }
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  }

  async function writeSetting(key, value) {
    try {
      if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') {
        await GM.setValue(key, value);
      } else if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      state.saved = true;
    } catch (_) {
      state.saved = false;
      updateUI();
    }
  }

  function parseColor(input) {
    const match = /^rgba?\(\s*(\d{1,3})(?:\s*,\s*|\s+)(\d{1,3})(?:\s*,\s*|\s+)(\d{1,3})(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(input || '');
    if (!match) return null;
    const [, r, g, b, alpha] = match;
    return { r: +r, g: +g, b: +b, a: alpha === undefined ? 1 : +alpha };
  }

  function luminance(color) {
    const linear = (c) => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    return .2126 * linear(color.r) + .7152 * linear(color.g) + .0722 * linear(color.b);
  }

  function nativeDarkTheme() {
    if (!document.documentElement) return false;
    // Authored dark color-scheme is meaningful only when system is actually dark.
    const surfaces = [document.documentElement, document.body].filter(Boolean);
    try {
      for (const el of surfaces) {
        const css = getComputedStyle(el);
        if (media?.matches && /^(?:only\s+)?dark$/i.test(css.colorScheme.trim())) return true;
        const bg = parseColor(css.backgroundColor);
        const fg = parseColor(css.color);
        if (bg && fg && bg.a >= .9 && luminance(bg) < .13 && luminance(fg) > .38) return true;
      }
    } catch (_) { /* Some documents don't permit computed style access. */ }
    return false;
  }

  function shouldEnable() {
    if (state.mode === 'off') return false;
    if (state.mode === 'on') return true;
    return Boolean(media?.matches) && !state.native;
  }

  function updateUI() {
    if (!toggleButton) return;
    const modeLabel = { auto: '自动', on: '开启', off: '关闭' }[state.mode];
    const suffix = state.error ? ' · 错误' : state.mode === 'auto' && state.native ? ' · 原生深色' : '';
    toggleButton.textContent = `${state.enabled ? '☾' : '◐'} ${modeLabel}${suffix}`;
    toggleButton.setAttribute('aria-label', `黑暗模式：${modeLabel}${suffix}。点击循环切换。`);
    toggleButton.setAttribute('aria-pressed', String(state.enabled));
    toggleButton.title = `本网站：${modeLabel}\n点击：自动 → 开启 → 关闭\n⌘⇧B：快速开关，⌥⇧D：循环模式`;
    toggleButton.dataset.mode = state.mode;
    if (menu) {
      menu.hidden = !state.menuOpen;
      for (const b of menu.querySelectorAll('[data-mode]')) {
        b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
      }
      if (stateLine) {
        stateLine.textContent = state.error ? `加载失败：${state.error}` :
          !state.saved ? '偏好保存失败，本页暂时有效' :
          state.native && state.mode === 'auto' ? '检测到网站原生暗色主题，已跳过' :
          state.enabled ? 'Dark Reader 已启用' : 'Dark Reader 未启用';
      }
    }
  }

  function applyTheme() {
    if (!state.ready) return;
    if (!library || typeof library.enable !== 'function' || typeof library.disable !== 'function') {
      state.error = 'Dark Reader 依赖不可用，请检查 @require 加载';
      state.enabled = false;
      updateUI();
      return;
    }
    const wanted = shouldEnable();
    const signature = wanted ? JSON.stringify(state.theme) : 'off';
    if (signature === previousSignature && !state.error) { updateUI(); return; }
    try {
      if (wanted) {
        library.enable({ ...state.theme });
      } else {
        library.disable();
      }
      state.enabled = wanted;
      state.error = '';
      previousSignature = signature;
    } catch (err) {
      state.enabled = false;
      state.error = err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100);
      previousSignature = '';
      try { library.disable(); } catch (_) { /* original failure retained */ }
    }
    updateUI();
  }

  function setMode(value) {
    const next = normalizeMode(value);
    if (next === state.mode) return;
    state.mode = next;
    if (next === 'auto' && !state.enabled) state.native = nativeDarkTheme();
    applyTheme();
    preferenceWrite = preferenceWrite.then(() => writeSetting(SITE_KEY, next));
  }

  function cycleMode() {
    setMode(MODES[(MODES.indexOf(state.mode) + 1) % MODES.length]);
  }

  function quickToggle() {
    setMode(state.enabled ? 'off' : 'on');
  }

  function updateTheme(key, value) {
    if (!Object.hasOwn(THEME_RANGES, key)) return;
    state.theme = normalizedTheme({ ...state.theme, [key]: value });
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => {
      applyTheme();
      void writeSetting(THEME_KEY, state.theme);
    }, 100);
  }

  function element(tag, props = {}, textValue = '') {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'className') el.className = v;
      else el.setAttribute(k, v);
    }
    if (textValue) el.textContent = textValue;
    return el;
  }

  function mountUI() {
    if (!document.body || toggleButton || document.getElementById(ID)) return;
    const host = element('div', { id: ID });
    host.style.cssText = 'all:initial!important;position:fixed!important;left:12px!important;bottom:12px!important;z-index:2147483647!important;pointer-events:auto!important;';
    const shadow = host.attachShadow({ mode: 'open' });
    const css = element('style');
    css.textContent = `
      :host { all: initial; font: 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif; }
      * { box-sizing:border-box; }
      button { font:inherit; cursor:pointer; }
      .bar { display:flex; gap:4px; align-items:center; }
      .pill { color:#e7ecf5; background:#242b37; border:1px solid #566377;
        padding:8px 11px; border-radius:999px; box-shadow:0 3px 16px #0007; opacity:.77; }
      .pill:hover,.pill:focus-visible { opacity:1; }
      button:focus-visible,input:focus-visible { outline:2px solid #a3c3ff; outline-offset:2px; }
      .panel { width:258px; margin-bottom:8px; padding:14px; background:#1e252f; color:#e9edf5;
        border:1px solid #536071; border-radius:13px; box-shadow:0 8px 28px #0009; }
      [hidden] { display:none!important; }
      h2 { font:bold 14px/1.2 -apple-system,sans-serif; margin:0 0 10px; }
      p { font:11px/1.4 -apple-system,sans-serif; color:#b8c2d1; margin:10px 0 0; overflow-wrap:anywhere; }
      .choices { display:flex; gap:5px; margin-bottom:10px; }
      .choices button { flex:1; background:#323e50; color:#e8edf4; border:1px solid #64748b;
        border-radius:7px; padding:7px 4px; }
      .choices button[aria-pressed=true] { background:#597ca8; border-color:#9ac2ff; }
      label { display:block; margin-top:8px; color:#dbe4ee; }
      input[type=range] { display:block; width:100%; accent-color:#9abdeb; margin:5px 0; }
      .hint { font-size:10px; color:#acb8c7; }
      @media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
    `;
    menu = element('section', { className: 'panel', id: 'sdr-settings', role: 'group', 'aria-label': '黑暗模式设置' });
    menu.hidden = true;
    menu.append(element('h2', {}, 'Safari Dark Reader'));
    const choices = element('div', { className: 'choices', role: 'group', 'aria-label': '网站模式' });
    for (const [mode, label] of [['auto', '自动'], ['on', '开启'], ['off', '关闭']]) {
      const btn = element('button', { type: 'button', 'data-mode': mode }, label);
      btn.addEventListener('click', () => setMode(mode));
      choices.append(btn);
    }
    menu.append(choices);
    for (const [key, textLabel] of [['brightness', '亮度'], ['contrast', '对比度'], ['sepia', '暖色调']]) {
      const [min, max] = THEME_RANGES[key];
      const label = element('label', {}, `${textLabel}：`);
      const number = element('span', { 'data-output': key }, `${state.theme[key]}%`);
      const input = element('input', { type: 'range', min: `${min}`, max: `${max}`,
        step: '1', value: String(state.theme[key]), 'aria-label': textLabel });
      input.addEventListener('input', () => {
        number.textContent = `${input.value}%`;
        updateTheme(key, Number(input.value));
      });
      label.append(number, input);
      menu.append(label);
    }
    stateLine = element('p', { role: 'status', 'aria-live': 'polite' });
    menu.append(stateLine, element('p', { className: 'hint' }, '⌘⇧B 快速开关 · ⌥⇧D 循环模式 · 偏好仅对本站生效'));
    const bar = element('div', { className: 'bar' });
    toggleButton = element('button', { type: 'button', className: 'pill', 'aria-pressed': 'false' });
    toggleButton.addEventListener('click', cycleMode);
    menuButton = element('button', { type: 'button', className: 'pill', 'aria-label': '打开设置',
      'aria-controls': 'sdr-settings', 'aria-expanded': 'false' }, '⚙');
    menuButton.addEventListener('click', () => {
      state.menuOpen = !state.menuOpen;
      menuButton.setAttribute('aria-expanded', String(state.menuOpen));
      updateUI();
    });
    bar.append(toggleButton, menuButton);
    shadow.append(css, menu, bar);
    document.body.append(host);
    updateUI();
  }

  function scheduleNativeCheck() {
    if (!state.ready || state.enabled || state.mode !== 'auto') return;
    clearTimeout(rootTimer);
    rootTimer = setTimeout(() => {
      if (state.enabled || state.mode !== 'auto') return;
      const next = nativeDarkTheme();
      if (next !== state.native) { state.native = next; applyTheme(); }
    }, 160);
  }

  function handleShortcut(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const key = (event.key || '').toLowerCase();
    if (event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey && key === 'b') {
      event.preventDefault();
      quickToggle();
    } else if (event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey && key === 'd') {
      event.preventDefault();
      cycleMode();
    } else if (key === 'escape' && state.menuOpen) {
      state.menuOpen = false;
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      updateUI();
    }
  }

  async function initialize() {
    const [storedMode, storedTheme] = await Promise.all([
      readSetting(SITE_KEY, 'auto'), readSetting(THEME_KEY, DEFAULT_THEME),
    ]);
    state.mode = normalizeMode(storedMode);
    state.theme = normalizedTheme(storedTheme);
    state.native = nativeDarkTheme();
    state.ready = true;
    if (library && typeof library.setFetchMethod === 'function' && typeof fetch === 'function') {
      try { library.setFetchMethod(fetch.bind(globalThis)); } catch (_) { /* CORS remains browser-enforced. */ }
    }
    applyTheme();
    if (document.body) mountUI();
    else document.addEventListener('DOMContentLoaded', mountUI, { once: true });
    document.addEventListener('keydown', handleShortcut, true);
    if (media) {
      if (typeof media.addEventListener === 'function') media.addEventListener('change', () => {
        if (state.mode === 'auto') {
          if (!state.enabled) state.native = nativeDarkTheme();
          applyTheme();
        }
      });
      else if (typeof media.addListener === 'function') media.addListener(() => {
        if (state.mode === 'auto') { if (!state.enabled) state.native = nativeDarkTheme(); applyTheme(); }
      });
    }
    document.addEventListener('DOMContentLoaded', scheduleNativeCheck, { once: true });
    window.addEventListener('pageshow', scheduleNativeCheck);
    if (document.documentElement && typeof MutationObserver === 'function') {
      rootObserver = new MutationObserver(scheduleNativeCheck);
      rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  // Wait for documentElement when injected at document-start without assuming body exists.
  if (document.documentElement) void initialize();
  else {
    const onReady = () => { if (document.documentElement) void initialize(); };
    document.addEventListener('readystatechange', onReady, { once: true });
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  }
})();
