/* StudyOS shared-engine i18n light coverage.
 * Reuses the Stuvo hand-rolled engine (/stuvo/i18n.js): t() lookup with EN
 * fallback, loadLanguage/setLanguage, Firestore+localStorage persistence,
 * translatePage() reverse-map for any remaining hardcoded English.
 * This file adds: engine loading, a navbar language <select>, explicit
 * [data-i18n] application, and re-translation on languageChanged.
 */
(function () {
  var ENGINE_SRC = '../stuvo/i18n.js';
  var LANG_CODES = ['en', 'hi', 'bn', 'mr', 'te', 'ta'];

  function langName(code) {
    try {
      if (window.SUPPORTED_LANGUAGES && window.SUPPORTED_LANGUAGES[code]) return window.SUPPORTED_LANGUAGES[code];
    } catch (e) {}
    var fallback = { en: 'English', hi: 'हिन्दी', bn: 'বাংলা', mr: 'मराठी', te: 'తెలుగు', ta: 'தமிழ்' };
    return fallback[code] || code;
  }

  function currentLang() {
    try {
      if (typeof window.getCachedLang === 'function') return window.getCachedLang();
    } catch (e) {}
    return window.currentUserLanguage || 'en';
  }

  // Explicit data-i18n application: <a data-i18n="studyos.navHome">Home</a>
  // Leaf-only: never textContent-clobber an element wrapping child markup.
  function applyDataI18n() {
    if (typeof window.t !== 'function') return;
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      if (!key || el.children.length > 0) continue;
      if (el.dataset.i18nOriginal === undefined) el.dataset.i18nOriginal = el.textContent;
      var tr = window.t(key, el.dataset.i18nOriginal);
      if (tr && tr !== key) el.textContent = tr;
    }
  }

  function applyAll() {
    applyDataI18n();
    try { if (typeof window.translatePage === 'function') window.translatePage(); } catch (e) {}
  }

  function injectSelector() {
    if (document.getElementById('studyos-lang')) return;
    var nav = document.querySelector('.navbar');
    if (!nav) return;
    var sel = document.createElement('select');
    sel.id = 'studyos-lang';
    sel.setAttribute('aria-label', 'Language');
    sel.style.cssText = 'background:var(--glass,#1e2433);color:inherit;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:4px 6px;font-size:12px;margin-left:8px;';
    LANG_CODES.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = langName(code);
      sel.appendChild(opt);
    });
    try { sel.value = currentLang(); } catch (e) {}
    sel.addEventListener('change', function () {
      var code = sel.value;
      if (typeof window.setLanguage === 'function') {
        window.setLanguage(code).then(applyAll).catch(function () { applyAll(); });
      }
    });
    // Place at the end of the navbar so desktop + mobile layouts both keep it visible.
    nav.appendChild(sel);
  }

  function init() {
    injectSelector();
    applyAll();
    try {
      if (!window._studyosLangBound) {
        window._studyosLangBound = true;
        window.addEventListener('languageChanged', function () {
          try {
            var sel = document.getElementById('studyos-lang');
            if (sel) sel.value = currentLang();
          } catch (e) {}
          setTimeout(applyAll, 100);
        });
      }
    } catch (e) {}
  }

  function ensureEngine(cb) {
    if (typeof window.t === 'function' && typeof window.setLanguage === 'function') { cb(); return; }
    var s = document.createElement('script');
    s.src = ENGINE_SRC;
    s.onload = cb;
    s.onerror = function () { console.warn('[studyos i18n] engine failed to load'); };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ensureEngine(init); });
  } else {
    ensureEngine(init);
  }
})();
