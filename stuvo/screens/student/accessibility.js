// ─── E.2 Inclusive Learning / Accessibility — EXPANDED ──────────────
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
// BCP-47 locale for speech APIs — defined here defensively (i18n.js also exposes it globally)
if (typeof stuvoBcp47 === 'undefined') {
  var stuvoBcp47 = function(code) {
    const map = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN' };
    const short = String(code || 'en').toLowerCase().split('-')[0];
    return map[short] || 'en-IN';
  };
}
// Full screen settings at screens/student/accessibility.js
// All prefs save to users/{uid}.accessibilityPrefs via Firestore + localStorage cache
// Features: text size, high contrast, dyslexia font, TTS, STT, simpler explanations, extended time, keyboard nav
// + Expanded: font weight, line spacing, color-blind, enhanced focus, reduce transparency, larger tap, no-hover, gesture alt, comfortable, auto-read, word highlighting, simplify-on-tap, reading ruler, reduce clutter, step-by-step, flexible focus, presets

// Centralized defaults — single source of truth
const ACCESSIBILITY_DEFAULTS = {
  textSize: 'normal', // normal | large | xlarge
  highContrast: false,
  dyslexiaFont: false,
  simplifiedExplanations: false,
  simplerMode: false, // legacy alias mirrors simplifiedExplanations
  // Vision
  fontWeight: 'normal', // normal | enhanced
  lineSpacing: 'normal', // normal | relaxed | loose
  colorBlindMode: false,
  enhancedFocus: false,
  reduceTransparency: false,
  // Motor & Input
  largerTapTargets: false,
  noHoverDependency: false,
  gestureAlternatives: false,
  comfortableControls: false,
  // Reading Support
  autoReadNewContent: false,
  wordHighlighting: true,
  simplifyOnTap: true,
  readingRuler: false,
  // Cognitive
  reduceVisualClutter: false,
  stepByStepForms: false,
  focusSessionStyle: 'standard', // standard | flexible | extended
};

// Ensure accessibility styles are present — expanded to cover all features
function ensureAccessibilityStyles() {
  if (document.getElementById('accessibility-styles')) return;
  const s = document.createElement('style');
  s.id = 'accessibility-styles';
  s.textContent = `
    :root { --text-scale: 1; --line-height-base: 1.6; }
    html { font-size: calc(16px * var(--text-scale)); }
    /* Data attribute driven text scaling — also via zoom for px-based layouts */
    html[data-text-size="normal"] { --text-scale: 1; zoom: 1; }
    html[data-text-size="large"] { --text-scale: 1.15; zoom: 1.08; }
    html[data-text-size="xlarge"] { --text-scale: 1.30; zoom: 1.18; }
    @media (max-width: 768px) {
      html[data-text-size="large"] { zoom: 1.06; }
      html[data-text-size="xlarge"] { zoom: 1.12; }
    }
    /* Firefox fallback via transform if zoom unsupported */
    @supports not (zoom: 1) {
      html[data-text-size="large"] body { transform: scale(1.08); transform-origin: top left; width: 92.5%; }
      html[data-text-size="xlarge"] body { transform: scale(1.18); transform-origin: top left; width: 84.7%; }
    }
    html.high-contrast {
      background: #000 !important;
    }
    html.high-contrast body {
      background: #000 !important;
      color: #fff !important;
    }
    html.high-contrast .glass-card,
    html.high-contrast .sidebar,
    html.high-contrast .modal,
    html.high-contrast .topbar-actions .notification-bell-btn,
    html.high-contrast .global-search-btn {
      background: #111 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border-color: #fff !important;
      box-shadow: none !important;
    }
    html.high-contrast .nav-item.active {
      background: #fff !important;
      color: #000 !important;
    }
    html.high-contrast .btn {
      background: #fff !important;
      color: #000 !important;
      border: 1px solid #fff !important;
    }
    html.dyslexia-font, html.dyslexia-font body, html.dyslexia-font * {
      font-family: 'OpenDyslexic', 'Comic Sans MS', sans-serif !important;
    }
    html.high-contrast .mesh { display: none !important; }
    html.high-contrast .particle { display: none !important; }
    /* Keyboard focus visible — base */
    *:focus-visible {
      outline: 3px solid #7C5CFC !important;
      outline-offset: 2px !important;
      border-radius: 6px;
    }
    /* Enhanced focus — thicker, more visible */
    html.enhanced-focus *:focus-visible {
      outline: 4px solid #7C5CFC !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 5px rgba(124,92,252,0.35) !important;
      border-radius: 8px !important;
    }
    html.enhanced-focus .btn:focus-visible,
    html.enhanced-focus .form-control:focus-visible,
    html.enhanced-focus .nav-item:focus-visible { outline-width: 4px !important; }

    /* Font weight boost */
    html[data-font-weight="enhanced"] body { font-weight: 500; }
    html[data-font-weight="enhanced"] .page-title,
    html[data-font-weight="enhanced"] .greeting h1,
    html[data-font-weight="enhanced"] .card-label { font-weight: 800 !important; }
    html[data-font-weight="enhanced"] .btn,
    html[data-font-weight="enhanced"] .nav-item,
    html[data-font-weight="enhanced"] .form-control,
    html[data-font-weight="enhanced"] .badge,
    html[data-font-weight="enhanced"] .hw-title { font-weight: 600 !important; }
    html[data-font-weight="enhanced"] .hw-sub,
    html[data-font-weight="enhanced"] .stat-label,
    html[data-font-weight="enhanced"] .page-sub { font-weight: 500 !important; }

    /* Line spacing */
    html[data-line-spacing="relaxed"] .ai-answer-line,
    html[data-line-spacing="relaxed"] .output-text,
    html[data-line-spacing="relaxed"] .hw-item,
    html[data-line-spacing="relaxed"] .post-text,
    html[data-line-spacing="relaxed"] .glass-card p,
    html[data-line-spacing="relaxed"] .glass-card li,
    html[data-line-spacing="relaxed"] .page-sub,
    html[data-line-spacing="relaxed"] .form-group label,
    html[data-line-spacing="relaxed"] .empty-sub { line-height: 1.6 !important; }
    html[data-line-spacing="loose"] .ai-answer-line,
    html[data-line-spacing="loose"] .output-text,
    html[data-line-spacing="loose"] .hw-item,
    html[data-line-spacing="loose"] .post-text,
    html[data-line-spacing="loose"] .glass-card p,
    html[data-line-spacing="loose"] .glass-card li,
    html[data-line-spacing="loose"] .page-sub,
    html[data-line-spacing="loose"] .form-group label,
    html[data-line-spacing="loose"] .empty-sub { line-height: 1.85 !important; }

    /* Color-blind friendly mode — secondary indicators */
    html.color-blind .hw-badge.success { border-style: solid !important; border-width: 2px !important; }
    html.color-blind .hw-badge.success::before { content: "✓ "; font-weight: 800; }
    html.color-blind .hw-badge.urgent::before { content: "! "; font-weight: 800; }
    html.color-blind .hw-badge.warning::before,
    html.color-blind .badge-yellow::before { content: "⚠ "; }
    html.color-blind .badge-green::before { content: "✓ "; }
    html.color-blind .badge-red::before,
    html.color-blind .badge-violet::before { content: "● "; }
    html.color-blind .hw-badge,
    html.color-blind .badge { padding-left: 10px !important; letter-spacing: 0.02em; }
    html.color-blind .stat-card { border-left: 3px solid currentColor !important; padding-left: 8px; }
    html.color-blind .notification-dot { border: 2px solid #fff !important; }
    html.color-blind .notification-dot.read { border-color: transparent !important; }

    /* Reduce transparency */
    html.reduce-transparency .glass-card,
    html.reduce-transparency .sidebar,
    html.reduce-transparency .modal,
    html.reduce-transparency .notification-dropdown,
    html.reduce-transparency .global-search-modal,
    html.reduce-transparency .mobile-top-header,
    html.reduce-transparency .mobile-bottom-nav {
      background: rgba(20,27,51,0.96) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border-color: rgba(255,255,255,0.14) !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
    }
    html.reduce-transparency .mesh,
    html.reduce-transparency .mesh::after { opacity: 0.35 !important; filter: blur(6px) !important; }
    html.reduce-transparency .btn { backdrop-filter: none !important; }
    html.reduce-transparency .glass-card::before,
    html.reduce-transparency .glass-card::after { opacity: 0.3 !important; }

    /* Larger tap targets */
    html.larger-tap .btn { padding: 14px 22px !important; min-height: 46px !important; font-size: 14px !important; }
    html.larger-tap .btn-sm { padding: 10px 18px !important; min-height: 40px !important; }
    html.larger-tap .nav-item { padding: 14px 18px !important; min-height: 46px !important; }
    html.larger-tap .tab-btn { padding: 14px 20px !important; min-height: 46px !important; }
    html.larger-tap .access-toggle { width: 56px !important; height: 32px !important; }
    html.larger-tap .access-toggle::after { width: 24px !important; height: 24px !important; }
    html.larger-tap .access-toggle.active::after { }
    html.larger-tap .form-control { padding: 14px 18px !important; min-height: 46px !important; }
    html.larger-tap .mobile-nav-item { padding: 10px 16px !important; min-height: 56px !important; }
    html.larger-tap .notification-bell-btn,
    html.larger-tap .global-search-btn { width: 48px !important; height: 48px !important; }

    /* No hover dependency — ensure critical controls always visible */
    html.no-hover .hw-item .hw-badge,
    html.no-hover .glass-card .badge,
    html.no-hover .btn-secondary,
    html.no-hover [data-hover-only] { opacity: 1 !important; visibility: visible !important; display: inline-flex !important; }
    html.no-hover .hw-item:hover { transform: none !important; padding-left: 0 !important; }

    /* Comfortable controls — increase spacing near destructive actions */
    html.comfortable .btn + .btn,
    html.comfortable .btn-danger { margin-left: 12px !important; }
    html.comfortable .form-group { margin-bottom: 18px !important; }
    html.comfortable .glass-card .hw-item { gap: 18px !important; padding: 18px 0 !important; }
    html.comfortable .roster-item,
    html.comfortable .approval-item { gap: 16px !important; padding: 14px 0 !important; }
    html.comfortable .modal .btn { margin-top: 16px !important; }
    html.comfortable .quick-actions { gap: 14px !important; }

    /* Reduce visual clutter */
    html.reduce-clutter .mesh,
    html.reduce-clutter .particle,
    html.reduce-clutter .particle { display: none !important; }
    html.reduce-clutter .badge:not(.keep) { opacity: 0.85; }

    /* Step-by-step forms */
    .step-form-progress { display: flex; gap: 8px; margin-bottom: 18px; align-items: center; }
    .step-form-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-dim); }
    .step-form-dot.active { background: linear-gradient(135deg,#7C5CFC,#4F8CFF); color: #fff; border-color: rgba(124,92,252,0.5); }
    .step-form-dot.done { background: rgba(16,185,129,0.15); color: #6EE7B7; border-color: rgba(16,185,129,0.35); }
    .step-form-panel { display: none; }
    .step-form-panel.active { display: block; }

    /* Reading ruler */
    #reading-ruler { position: fixed; left: 0; right: 0; height: 36px; background: rgba(124,92,252,0.12); border-top: 2px solid rgba(124,92,252,0.35); border-bottom: 2px solid rgba(124,92,252,0.35); pointer-events: none; z-index: 9995; display: none; backdrop-filter: blur(2px); }
    #reading-ruler.show { display: block !important; }
    #reading-ruler-handle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border-radius: 8px; background: rgba(124,92,252,0.9); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; pointer-events:auto; cursor:grab; user-select:none; box-shadow:0 2px 8px rgba(0,0,0,0.3); }

    /* Word highlighting during TTS */
    .tts-highlight-word { background: rgba(124,92,252,0.35) !important; color: #fff !important; border-radius: 4px; padding: 1px 3px; }
    .tts-highlight-sentence { background: rgba(124,92,252,0.12) !important; border-left: 3px solid rgba(124,92,252,0.5); padding-left: 8px !important; border-radius: 6px; }
    .tts-controls { display: inline-flex; gap: 6px; align-items: center; margin-left: 8px; }
    .tts-controls button { width: 28px; height: 28px; border-radius: 8px; background: var(--glass); border:1px solid var(--glass-border); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; }
    .tts-controls button:hover { background: rgba(124,92,252,0.12); }

    /* Simplify-on-tap tooltip */
    #simplify-tooltip { position: fixed; max-width: 300px; background: #111827; border:1px solid var(--glass-border); border-radius:12px; padding:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); z-index: 9996; display: none; font-size:13px; line-height:1.6; }
    #simplify-tooltip.show { display: block !important; }
    #simplify-tooltip .simplify-word { font-weight:700; color:#C4B5FD; font-size:14px; }
    #simplify-tooltip .simplify-meaning { color: var(--text); margin:6px 0; }
    #simplify-tooltip .simplify-example { color: var(--text-dim); font-size:12px; font-style: italic; background: rgba(255,255,255,0.04); padding:8px; border-radius:8px; margin-top:6px; }
    #simplify-tooltip .simplify-close { position:absolute; top:8px; right:8px; width:22px; height:22px; border-radius:6px; background: var(--glass); border:1px solid var(--glass-border); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; }

    /* TTS btn, STT btn */
    .tts-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 8px;
      background: var(--glass); border: 1px solid var(--glass-border);
      color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .tts-btn:hover { background: rgba(124,92,252,0.15); border-color: rgba(124,92,252,0.35); }
    .tts-btn.speaking { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.35); color: #6EE7B7; }
    .stt-btn {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--glass); border: 1px solid var(--glass-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 16px;
    }
    .stt-btn:hover { background: rgba(124,92,252,0.12); }
    .stt-btn.listening { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
    .access-toggle {
      position: relative; width: 48px; height: 26px; border-radius: 13px;
      background: rgba(255,255,255,0.12); border: 1px solid var(--glass-border);
      cursor: pointer; flex-shrink: 0;
    }
    .access-toggle.active { background: linear-gradient(135deg,#7C5CFC,#4F8CFF); border-color: rgba(124,92,252,0.5); }
    .access-toggle::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 20px; height: 20px; border-radius: 50%; background: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .access-toggle.active::after { }
    /* Preset cards */
    .preset-card { cursor:pointer; border:2px solid transparent; }
    .preset-card:hover { border-color: rgba(124,92,252,0.35); }
    .preset-card.active { border-color: #7C5CFC !important; background: rgba(124,92,252,0.10) !important; }
  `;
  document.head.appendChild(s);
}

// Apply prefs to document — centralized, immediate
function applyAccessibilityPrefs(prefs = {}) {
  ensureAccessibilityStyles();
  const html = document.documentElement;
  const merged = { ...ACCESSIBILITY_DEFAULTS, ...prefs };
  // Normalize legacy simplerMode
  if (merged.simplerMode && !merged.simplifiedExplanations) merged.simplifiedExplanations = true;
  if (merged.simplifiedExplanations) merged.simplerMode = true;

  // Text size
  const scaleMap = { normal: 1, large: 1.15, xlarge: 1.30 };
  const size = merged.textSize || 'normal';
  html.style.setProperty('--text-scale', String(scaleMap[size] || 1));
  html.dataset.textSize = size;
  html.setAttribute('data-text-size', size);

  // High contrast
  if (merged.highContrast) html.classList.add('high-contrast');
  else html.classList.remove('high-contrast');

  // Dyslexia-friendly font
  if (merged.dyslexiaFont) {
    html.classList.add('dyslexia-font');
    if (!document.getElementById('opendyslexic-link')) {
      const l = document.createElement('link');
      l.id = 'opendyslexic-link';
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css';
      document.head.appendChild(l);
      const fallback = document.createElement('style');
      fallback.id = 'opendyslexic-fallback';
      fallback.textContent = "@import url('https://fonts.cdnfonts.com/css/open-dyslexic');";
      document.head.appendChild(fallback);
    }
  } else {
    html.classList.remove('dyslexia-font');
  }

  // Vision
  html.setAttribute('data-font-weight', merged.fontWeight || 'normal');
  html.dataset.fontWeight = merged.fontWeight || 'normal';
  html.setAttribute('data-line-spacing', merged.lineSpacing || 'normal');
  html.dataset.lineSpacing = merged.lineSpacing || 'normal';
  if (merged.colorBlindMode) html.classList.add('color-blind');
  else html.classList.remove('color-blind');
  if (merged.enhancedFocus) html.classList.add('enhanced-focus');
  else html.classList.remove('enhanced-focus');
  if (merged.reduceTransparency) html.classList.add('reduce-transparency');
  else html.classList.remove('reduce-transparency');

  // Motor
  if (merged.largerTapTargets) html.classList.add('larger-tap');
  else html.classList.remove('larger-tap');
  if (merged.noHoverDependency) html.classList.add('no-hover');
  else html.classList.remove('no-hover');
  if (merged.gestureAlternatives) html.classList.add('gesture-alt');
  else html.classList.remove('gesture-alt');
  if (merged.comfortableControls) html.classList.add('comfortable');
  else html.classList.remove('comfortable');

  // Cognitive
  if (merged.reduceVisualClutter) html.classList.add('reduce-clutter');
  else html.classList.remove('reduce-clutter');
  if (merged.stepByStepForms) html.classList.add('step-by-step');
  else html.classList.remove('step-by-step');

  // Focus session style as data attribute
  html.setAttribute('data-focus-style', merged.focusSessionStyle || 'standard');
  html.dataset.focusStyle = merged.focusSessionStyle || 'standard';

  // Reading ruler
  toggleReadingRuler(!!merged.readingRuler);

  // Simplify-on-tap global init
  if (merged.simplifyOnTap) initSimplifyOnTapGlobal();
  else deinitSimplifyOnTapGlobal();

  // Auto-read flag stored globally for other modules
  window._autoReadEnabled = !!merged.autoReadNewContent;

  // Cache for other modules
  window._accessPrefsCache = merged;
  try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(merged)); } catch {}

  // Re-apply early script cache for text scale etc. for next load
}

// Load prefs from Firestore
async function loadAccessibilityPrefs(uid) {
  if (!uid) {
    // Try local cache for unauthenticated
    try {
      const cached = localStorage.getItem('stuvo_accessibility_cache');
      if (cached) {
        const p = JSON.parse(cached);
        applyAccessibilityPrefs(p);
        return p;
      }
    } catch {}
    return { ...ACCESSIBILITY_DEFAULTS };
  }
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists) {
      const data = snap.data();
      const prefs = { ...ACCESSIBILITY_DEFAULTS, ...(data.accessibilityPrefs || {}) };
      // Mirror legacy simplerMode
      if (prefs.simplerMode && !prefs.simplifiedExplanations) prefs.simplifiedExplanations = true;
      applyAccessibilityPrefs(prefs);
      if (data.notificationPrefs) window._notificationPrefs = data.notificationPrefs;
      window._accessPrefsCache = prefs;
      try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(prefs)); } catch {}
      return prefs;
    }
  } catch (e) { console.error('[loadAccessibilityPrefs]', e); }
  // fallback to cache
  try {
    const cached = localStorage.getItem('stuvo_accessibility_cache');
    if (cached) {
      const p = { ...ACCESSIBILITY_DEFAULTS, ...JSON.parse(cached) };
      applyAccessibilityPrefs(p);
      return p;
    }
  } catch {}
  return { ...ACCESSIBILITY_DEFAULTS };
}

async function saveAccessibilityPrefs(uid, prefs) {
  const merged = { ...ACCESSIBILITY_DEFAULTS, ...prefs };
  if (!uid) {
    // Local only
    try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(merged)); } catch {}
    applyAccessibilityPrefs(merged);
    window._accessPrefsCache = merged;
    showToast(_i18n_t('accessibility.preferencesSaved','Accessibility preferences saved'), 'success');
    return;
  }
  try {
    await setDoc(doc(db, 'users', uid), { accessibilityPrefs: merged }, { merge: true });
    applyAccessibilityPrefs(merged);
    window._accessPrefsCache = merged;
    try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(merged)); } catch {}
    showToast(_i18n_t('accessibility.preferencesSaved','Accessibility preferences saved'), 'success');
  } catch (e) {
    console.error('[saveAccessibilityPrefs]', e);
    // Save locally as fallback
    try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(merged)); } catch {}
    applyAccessibilityPrefs(merged);
    showToast(_i18n_t('accessibility.failedToSave','Failed to save to cloud, saved locally'), 'error');
  }
}

// ─── TTS — single shared native implementation ────────────────────
let currentUtterance = null;
let _ttsHighlightCleanup = null;
let _ttsContainer = null;
let _ttsBtn = null;

function _ttsLang() {
  try { return stuvoBcp47(window.currentUserLanguage || document.documentElement.lang || 'en'); } catch { return 'en'; }
}

function speak(text, { lang = _ttsLang(), onWordBoundary = null, onEnd = null } = {}) {
  if (!('speechSynthesis' in window)) return false;
  try { window.speechSynthesis.cancel(); } catch {}
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  if (onWordBoundary) utterance.onboundary = (event) => { if (event.name === 'word') onWordBoundary(event.charIndex, event.charIndex + (event.charLength || 0)); };
  if (onEnd) { utterance.onend = onEnd; utterance.onerror = onEnd; }
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

function pauseSpeech() { try { if (window.speechSynthesis.speaking) window.speechSynthesis.pause(); } catch {} }
function resumeSpeech() { try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch {} }
function stopSpeech() {
  try { window.speechSynthesis.cancel(); } catch {}
  currentUtterance = null;
  if (_ttsHighlightCleanup) { try { _ttsHighlightCleanup(); } catch {} _ttsHighlightCleanup = null; }
  if (_ttsBtn) { _ttsBtn.classList.remove('speaking'); _ttsBtn.innerHTML = '🔊 Listen'; _ttsBtn = null; }
  document.querySelectorAll('.tts-controls').forEach(el => el.remove());
  document.querySelectorAll('.tts-highlight-word').forEach(el => el.classList.remove('tts-highlight-word'));
}
// Critical correctness rule: cancel any in-progress speech on route change,
// so navigating away doesn't leave a voice talking over the new screen
if (typeof window !== 'undefined' && !window._stuvoSpeechCleanupBound) {
  window._stuvoSpeechCleanupBound = true;
  window.addEventListener('hashchange', stopSpeech);
}
// Legacy alias (callers + window export use stopSpeaking)
function stopSpeaking() { stopSpeech(); }

function speakText(text, btnEl) {
  if (!('speechSynthesis' in window)) { showToast(_i18n_t('accessibility.ttsNotSupported','Text-to-speech not supported'), 'error'); return; }
  if (!text || !text.trim()) { showToast(_i18n_t('accessibility.noTextToRead','No text to read'), 'info'); return; }
  stopSpeech();
  const prefs = window._accessPrefsCache || ACCESSIBILITY_DEFAULTS;
  if (prefs.wordHighlighting !== false) { speakWithHighlight(text, null, btnEl); return; }
  if (btnEl) btnEl.classList.add('speaking');
  speak(text, { onEnd: () => { if (btnEl) { btnEl.classList.remove('speaking'); btnEl.innerHTML = '🔊 Listen'; } } });
}

function speakWithHighlight(text, containerEl, btnEl) {
  if (!('speechSynthesis' in window)) { showToast(_i18n_t('accessibility.ttsNotSupported','Text-to-speech not supported'), 'error'); return; }
  if (!text || !text.trim()) { showToast(_i18n_t('accessibility.noTextToRead','No text to read'), 'info'); return; }
  stopSpeech();
  let wordSpans = [];
  if (containerEl && containerEl.nodeType === 1) {
    const originalHTML = containerEl.innerHTML;
    const words = text.split(/\s+/).filter(Boolean);
    const frag = document.createDocumentFragment();
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w + ' ';
      span.dataset.ttsWord = i;
      span.style.borderRadius = '4px';
      span.style.padding = '1px 2px';
      frag.appendChild(span);
      wordSpans[i] = span;
    });
    _ttsContainer = containerEl;
    _ttsContainer.dataset.ttsOriginal = originalHTML;
    containerEl.innerHTML = '';
    wordSpans.forEach(s => containerEl.appendChild(s));
    _ttsHighlightCleanup = () => {
      if (_ttsContainer && _ttsContainer.dataset.ttsOriginal !== undefined) {
        _ttsContainer.innerHTML = _ttsContainer.dataset.ttsOriginal;
        delete _ttsContainer.dataset.ttsOriginal;
      }
      _ttsContainer = null;
      wordSpans = [];
    };
  }
  _ttsBtn = btnEl || null;
  if (btnEl) { btnEl.classList.add('speaking'); btnEl.innerHTML = '⏹ Stop'; }
  let controls = null;
  if (containerEl && !containerEl.querySelector('.tts-controls')) {
    controls = document.createElement('div');
    controls.className = 'tts-controls';
    controls.innerHTML = `<button type="button" data-tts="pause" title="Pause">⏸</button><button type="button" data-tts="stop" title="Stop">⏹</button>`;
    containerEl.insertAdjacentElement('afterend', controls);
    controls.querySelector('[data-tts="pause"]').addEventListener('click', () => {
      if (window.speechSynthesis.paused) { resumeSpeech(); controls.querySelector('[data-tts="pause"]').textContent = '⏸'; }
      else { pauseSpeech(); controls.querySelector('[data-tts="pause"]').textContent = '▶'; }
    });
    controls.querySelector('[data-tts="stop"]').addEventListener('click', () => stopSpeech());
  }
  let lastWordIdx = -1;
  const cleanup = () => {
    if (lastWordIdx >= 0 && wordSpans[lastWordIdx]) wordSpans[lastWordIdx].classList.remove('tts-highlight-word');
    if (btnEl) { btnEl.classList.remove('speaking'); btnEl.innerHTML = '🔊 Listen'; }
    if (_ttsHighlightCleanup) { try { _ttsHighlightCleanup(); } catch {} _ttsHighlightCleanup = null; }
    if (controls) controls.remove();
    currentUtterance = null;
    _ttsBtn = null;
  };
  speak(text, {
    onWordBoundary: wordSpans.length ? (start) => {
      const wordIdx = text.slice(0, start).split(/\s+/).filter(Boolean).length;
      if (wordSpans[wordIdx]) {
        if (lastWordIdx >= 0 && wordSpans[lastWordIdx]) wordSpans[lastWordIdx].classList.remove('tts-highlight-word');
        wordSpans[wordIdx].classList.add('tts-highlight-word');
        lastWordIdx = wordIdx;
      }
    } : null,
    onEnd: cleanup
  });
}

// Attach TTS button after a description element — enhanced with highlight
function createTTSButtonForText(textGetter) {
  const btn = document.createElement('button');
  btn.className = 'tts-btn';
  btn.type = 'button';
  btn.innerHTML = '🔊 Listen';
  btn.title = 'Read aloud';
  btn.setAttribute('aria-label', 'Read aloud');
  btn.addEventListener('click', () => {
    if (btn.classList.contains('speaking')) { stopSpeech(); return; }
    const t = typeof textGetter === 'function' ? textGetter() : String(textGetter || '');
    if (!t.trim()) { showToast(_i18n_t('accessibility.noTextToRead','No text to read'), 'info'); return; }
    let container = null;
    try {
      const all = document.querySelectorAll('.glass-card p, .output-text, .hw-item, .post-text, [id*="tts"], .ai-answer-line');
      for (const el of all) {
        if (el.textContent && el.textContent.includes(t.slice(0,30))) { container = el; break; }
      }
    } catch {}
    if (container && (window._accessPrefsCache||{}).wordHighlighting !== false) {
      speakWithHighlight(t, container, btn);
    } else {
      speakText(t, btn);
    }
  });
  return btn;
}

// ─── Auto-read new content ──────────────────────────────────────
function maybeAutoRead(text, containerEl) {
  try {
    const prefs = window._accessPrefsCache || {};
    if (!prefs.autoReadNewContent) return;
    if (!text || !text.trim() || text.length < 20) return;
    // Avoid reading decorative or too short
    if (text.length > 2000) text = text.slice(0,2000);
    // Don't auto-read if user is typing or speech already in progress
    if (window.speechSynthesis.speaking) return;
    // Respect reduced motion? No, auto-read is separate
    // Provide easy way to stop — show controls via speakWithHighlight
    setTimeout(() => {
      if (window.speechSynthesis.speaking) return;
      speakWithHighlight(text, containerEl, null);
      showToast('Auto-reading — tap ⏹ to stop', 'info');
    }, 600);
  } catch (e) {}
}

// Speech-to-text — single shared native implementation
function startListening({ lang = _ttsLang(), onResult, onInterim = null, onError = null, onEnd = null } = {}) {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    if (onError) onError('unsupported');
    return null;
  }
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = !!onInterim;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    const isFinal = event.results[event.results.length - 1].isFinal;
    if (isFinal) onResult(transcript);
    else if (onInterim) onInterim(transcript);
  };
  recognition.onerror = (event) => {
    const genericMessages = {
      'no-speech': _i18n_t('accessibility.sttNoSpeech', "Didn't catch that — try again."),
      'not-allowed': _i18n_t('accessibility.micDenied', 'Microphone access is needed for this.'),
      'network': _i18n_t('accessibility.sttNetwork', 'Connection issue — try again.'),
    };
    if (onError) onError(genericMessages[event.error] || _i18n_t('accessibility.sttFailed', 'Something went wrong — try again.'));
  };
  if (onEnd) recognition.onend = onEnd;
  recognition.start();
  return recognition;
}

function attachSTT(inputEl) {
  if (!inputEl || inputEl.dataset.sttAttached) return;
  inputEl.dataset.sttAttached = '1';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:8px; align-items: center; flex:1;';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);
  inputEl.style.flex = '1';
  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'stt-btn';
  micBtn.title = 'Speech to text';
  micBtn.textContent = '🎤';
  micBtn.setAttribute('aria-label', 'Start voice input');
  wrapper.appendChild(micBtn);

  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    micBtn.addEventListener('click', () => showToast(_i18n_t('accessibility.sttUnsupported', "Speech input isn't supported"), 'info'));
    micBtn.style.opacity = '0.5';
    return;
  }
  let recognition = null;
  let listening = false;
  const resetBtn = () => { micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; listening = false; };
  micBtn.addEventListener('click', () => {
    if (listening) { try { recognition.stop(); } catch {} return; }
    micBtn.classList.add('listening');
    micBtn.textContent = '⏹';
    listening = true;
    try {
      recognition = startListening({
        onResult: (transcript) => {
          if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            const start = inputEl.selectionStart ?? inputEl.value.length;
            const end = inputEl.selectionEnd ?? inputEl.value.length;
            inputEl.value = inputEl.value.slice(0, start) + (inputEl.value.slice(0, start) ? ' ' : '') + transcript + inputEl.value.slice(end);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.focus();
          }
        },
        onError: (msg) => {
          resetBtn();
          showToast(msg === 'unsupported' ? _i18n_t('accessibility.sttUnsupported', "Speech input isn't supported") : msg, 'info');
        },
        onEnd: resetBtn
      });
      if (!recognition) resetBtn();
    } catch {
      resetBtn();
      showToast(_i18n_t('accessibility.sttFailed', 'Something went wrong — try again.'), 'info');
    }
  });
}

// Helper to auto-attach STT to all text inputs in container
function enhanceInputsWithSTT(container) {
  if (!container || !container.querySelectorAll) return;
  // Respect step-by-step forms — still enhance but ensure forms remain usable
  container.querySelectorAll('input[type="text"], textarea').forEach(el => {
    if (el.closest('.global-search-modal')) return;
    if (el.id === 'global-search-input') return;
    attachSTT(el);
  });
}

// Global helper for AI calls to include simpler mode
function shouldUseSimplerMode() {
  try {
    const prefs = window._accessPrefsCache || {};
    return !!prefs.simplifiedExplanations || !!prefs.simplerMode;
  } catch { return false; }
}
async function refreshAccessPrefsCache(uid) {
  const p = await loadAccessibilityPrefs(uid);
  window._accessPrefsCache = p;
  return p;
}
// Intercept safeApiCall to add mode:"simpler" if needed (transparent)
(function wrapSafeApiCall() {
  if (window._safeApiCallWrapped) return;
  window._safeApiCallWrapped = true;
  const check = () => {
    const orig = window.safeApiCall;
    if (typeof orig === 'function' && !orig._accessWrapped) {
      const base = orig;
      window.safeApiCall = async function(endpoint, payload) {
        try {
          const prefs = window._accessPrefsCache;
          if (prefs && (prefs.simplifiedExplanations || prefs.simplerMode) && payload && typeof payload === 'object' && !payload.mode) {
            payload = { ...payload, mode: 'simpler' };
          }
          // Inject language for AI
          try {
            const lang = window.currentUserLanguage || 'en';
            if (payload && typeof payload === 'object' && !payload.language && endpoint && endpoint.includes('/api/ai')) {
              payload = { ...payload, language: lang };
            }
          } catch {}
        } catch {}
        return base(endpoint, payload);
      };
      window.safeApiCall._accessWrapped = true;
    } else {
      setTimeout(check, 300);
    }
  };
  setTimeout(check, 400);
})();

// ─── Reading Ruler ──────────────────────────────────────────────
let _rulerEl = null;
let _rulerHandle = null;
let _rulerDragging = false;

function ensureReadingRuler() {
  if (_rulerEl) return _rulerEl;
  const el = document.createElement('div');
  el.id = 'reading-ruler';
  el.setAttribute('role', 'presentation');
  el.setAttribute('aria-hidden', 'true');
  const handle = document.createElement('div');
  handle.id = 'reading-ruler-handle';
  handle.textContent = '↕';
  handle.title = 'Drag to move · Tap X to hide (disable in Accessibility)';
  el.appendChild(handle);
  document.body.appendChild(el);
  _rulerEl = el;
  _rulerHandle = handle;
  let startY = 0, startTop = 0;
  const onMove = (e) => {
    if (!_rulerDragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = clientY - startY;
    let newTop = startTop + dy;
    newTop = Math.max(60, Math.min(window.innerHeight - 20, newTop));
    el.style.top = newTop + 'px';
  };
  const onUp = () => { _rulerDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp); };
  handle.addEventListener('mousedown', (e) => { _rulerDragging = true; startY = e.clientY; startTop = el.offsetTop; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); e.preventDefault(); });
  handle.addEventListener('touchstart', (e) => { _rulerDragging = true; startY = e.touches[0].clientY; startTop = el.offsetTop; document.addEventListener('touchmove', onMove, {passive:false}); document.addEventListener('touchend', onUp); }, {passive:false});
  // Move with mouse proximity when enabled
  document.addEventListener('mousemove', (e) => {
    if (!_rulerEl || !_rulerEl.classList.contains('show') || _rulerDragging) return;
    // Subtle follow: ruler follows cursor Y with slight ease, but only if not dragging
    // To avoid annoying, only update if user is reading (near text)
    const targetY = e.clientY - 18;
    el.style.top = targetY + 'px';
  }, { passive: true });
  // Keyboard toggle: Esc hides?
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _rulerEl && _rulerEl.classList.contains('show')) {
      // Don't hide automatically, but allow Esc to hide temporarily
    }
  });
  // Initial position middle
  el.style.top = (window.innerHeight/2) + 'px';
  return el;
}
function toggleReadingRuler(show) {
  const el = ensureReadingRuler();
  if (!el) return;
  if (show) el.classList.add('show');
  else el.classList.remove('show');
}

// ─── Simplify-on-tap ────────────────────────────────────────────
let _simplifyCache = {};
let _simplifyTooltip = null;
let _simplifyGlobalBound = false;

function ensureSimplifyTooltip() {
  if (_simplifyTooltip) return _simplifyTooltip;
  let tip = document.getElementById('simplify-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'simplify-tooltip';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', 'Word meaning');
    tip.innerHTML = `<button class="simplify-close" aria-label="Close">✕</button><div id="simplify-content"></div>`;
    document.body.appendChild(tip);
    tip.querySelector('.simplify-close').addEventListener('click', () => tip.classList.remove('show'));
    document.addEventListener('click', (e) => {
      if (!tip.contains(e.target) && !e.target.closest('[data-simplify-word]')) tip.classList.remove('show');
    });
  }
  _simplifyTooltip = tip;
  return tip;
}

const COMMON_WORDS = new Set(['the','and','for','that','with','this','have','from','they','will','what','when','where','which','about','there','their','would','could','should','because','through','between','under','over','after','before','while','being','also','into','more','most','other','some','such','only','than','then','them','these','those','very','even','just','like','well','your','each','which','their','been','were','had','has','are','was','one','all','can','not','but','out','use','how','our','who','oil','its','now','find','long','down','day','did','get','come','made','may','part']);

async function simplifyWord(word, lang) {
  const key = word.toLowerCase() + '|' + (lang || 'en');
  if (_simplifyCache[key]) return _simplifyCache[key];
  if (COMMON_WORDS.has(word.toLowerCase()) || word.length < 4) {
    // Don't waste AI for common short words, provide local fallback
    return null;
  }
  try {
    const effLang = lang || window.currentUserLanguage || 'en';
    // Use existing AI infrastructure
    const data = await safeApiCall('/api/ai', {
      action: 'wellbeingAssistant',
      prompt: `Explain the word "${word}" in simple language for a school student in language "${effLang}". Respond in JSON: {"meaning":"short simple meaning in ${effLang}", "example":"short example sentence using the word"}. Keep meaning under 18 words.`,
      message: word
    });
    let parsed = null;
    if (data && data.reply) {
      const m = data.reply.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
      if (!parsed) {
        // Fallback: treat reply as meaning
        parsed = { meaning: data.reply.slice(0,120), example: '' };
      }
    } else if (data && data.meaning) {
      parsed = data;
    } else {
      // Try direct fallback
      parsed = { meaning: `Simple meaning of "${word}" in ${effLang}`, example: '' };
    }
    _simplifyCache[key] = parsed;
    return parsed;
  } catch (e) {
    console.error('[simplifyWord]', e);
    return null;
  }
}

function initSimplifyOnTapGlobal() {
  if (_simplifyGlobalBound) return;
  _simplifyGlobalBound = true;
  document.addEventListener('click', async (e) => {
    const prefs = window._accessPrefsCache || {};
    if (!prefs.simplifyOnTap) return;
    // Only for AI-generated or educational content: look for ai-answer-line, output-text, post-text, glass-card p, etc.
    const target = e.target;
    if (!target || target.closest('#simplify-tooltip') || target.closest('.simplify-close')) return;
    // Check if click is inside readable content
    const readable = target.closest('.ai-answer-line, .output-text, .glass-card p, .post-text, .hw-item, .page-sub, [data-simplify-word], .simplify-ctx');
    if (!readable && !target.closest('.ai-answer-line')) {
      // Also allow direct word taps inside AI output area
      const aiContainer = target.closest('#chat-thread, #rev-output, #quiz-output, #revision-output, [id^="summary-out-"], .ai-output');
      if (!aiContainer) return;
    }
    // Try to get word at click point — if target is text node container, extract nearest word
    let word = '';
    if (target.dataset && target.dataset.simplifyWord) {
      word = target.dataset.simplifyWord;
    } else {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().split(/\s+/).length === 1 && sel.toString().trim().length > 2) {
        word = sel.toString().trim().replace(/[^a-zA-Z\u0900-\u097F\u0980-\u09FF\u0C00-\u0C7F\u0B80-\u0BFF\u0C80-\u0CFF\-']/g, '');
      } else {
        // Fallback: get clicked word via caretRangeFromPoint
        try {
          const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
          if (range && range.startContainer && range.startContainer.nodeType === 3) {
            const text = range.startContainer.textContent || '';
            let start = range.startOffset, end = range.startOffset;
            while (start > 0 && /[a-zA-Z\u0900-\u097F\u0980-\u09FF\u0C00-\u0C7F\u0B80-\u0BFF\-']/ .test(text[start-1])) start--;
            while (end < text.length && /[a-zA-Z\u0900-\u097F\u0980-\u09FF\u0C00-\u0C7F\u0B80-\u0BFF\-']/ .test(text[end])) end++;
            word = text.slice(start, end).trim();
          }
        } catch {}
      }
    }
    if (!word || word.length < 3 || word.length > 20) return;
    if (!/^[a-zA-Z\u0900-\u097F\u0980-\u09FF\u0C00-\u0C7F\u0B80-\u0BFF\-']+$/.test(word)) return;
    // Avoid common words quickly
    if (COMMON_WORDS.has(word.toLowerCase())) return;
    // Show loading tooltip immediately
    const tip = ensureSimplifyTooltip();
    const rect = target.getBoundingClientRect();
    tip.classList.add('show');
    tip.style.left = Math.min(window.innerWidth - 320, Math.max(12, e.clientX - 150)) + 'px';
    tip.style.top = (rect.bottom + 10) + 'px';
    tip.querySelector('#simplify-content').innerHTML = `<div style="color:var(--text-dim);font-size:12px;">Simplifying "<strong>${word}</strong>"…</div><div class="spinner" style="width:20px;height:20px;margin:10px auto;"></div>`;
    // Position correction if offscreen bottom
    setTimeout(() => {
      const r = tip.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 10) tip.style.top = (rect.top - r.height - 10) + 'px';
    }, 30);

    const lang = window.currentUserLanguage || 'en';
    const result = await simplifyWord(word, lang);
    if (!tip.classList.contains('show')) return;
    if (!result || !result.meaning) {
      tip.querySelector('#simplify-content').innerHTML = `<div style="color:var(--text-dim);font-size:12px;">No simple meaning found for "<strong>${word}</strong>". Try another word.</div>`;
      return;
    }
    tip.querySelector('#simplify-content').innerHTML = `
      <div class="simplify-word">${word}</div>
      <div class="simplify-meaning">${String(result.meaning).replace(/</g,'&lt;')}</div>
      ${result.example ? `<div class="simplify-example">Example: ${String(result.example).replace(/</g,'&lt;')}</div>` : ''}
    `;
  }, true);
}
function deinitSimplifyOnTapGlobal() {
  // Keep listener but check flag; actual removal not needed as flag gates
}

// Enhance AI output containers to enable simplify-on-tap word spans
function enhanceWithSimplify(container) {
  if (!container || !container.querySelectorAll) return;
  const prefs = window._accessPrefsCache || {};
  if (!prefs.simplifyOnTap) return;
  container.querySelectorAll('.ai-answer-line, .output-text p, .post-text, .glass-card p').forEach(el => {
    if (el.dataset.simplifyEnhanced) return;
    el.dataset.simplifyEnhanced = '1';
    el.classList.add('simplify-ctx');
    // Wrap long words in span with data-simplify-word for easier tap, but keep text intact
    // Instead of DOM rewrite, just mark container as simplify-enabled; global click handler will handle via selection
  });
}

// ─── Step-by-step form helper ───────────────────────────────────
function makeStepForm(container, formSelector, stepsConfig) {
  // Generic step form transformer — used for report, maybe homework
  const formEl = container.querySelector(formSelector);
  if (!formEl || formEl.dataset.stepEnhanced) return;
  const prefs = window._accessPrefsCache || {};
  if (!prefs.stepByStepForms) return;
  // stepsConfig: [{selector: '#report-category', label: 'Category'}, ...]
  // If not provided, auto-split by .form-group
  const groups = formEl.querySelectorAll('.form-group');
  if (groups.length < 3) return; // short forms remain normal
  formEl.dataset.stepEnhanced = '1';
  // Create step UI
  const stepDefs = stepsConfig || Array.from(groups).map((g, i) => ({ el: g, label: g.querySelector('label')?.textContent?.trim() || `Step ${i+1}` }));
  let current = 0;
  const total = stepDefs.length;
  // Wrap groups in panels
  const progress = document.createElement('div');
  progress.className = 'step-form-progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(total));
  formEl.parentNode.insertBefore(progress, formEl);
  const updateProgress = () => {
    progress.innerHTML = stepDefs.map((s, i) => `<div class="step-form-dot ${i === current ? 'active' : i < current ? 'done' : ''}" aria-label="Step ${i+1}: ${s.label}">${i < current ? '✓' : i+1}</div>`).join('<div style="flex:1;height:2px;background:var(--glass-border);"></div>') + ` <span style="font-size:11px;color:var(--text-dim);margin-left:8px;">Step ${current+1} of ${total}</span>`;
    progress.setAttribute('aria-valuenow', String(current+1));
  };
  const panels = stepDefs.map((s, i) => {
    const panel = document.createElement('div');
    panel.className = 'step-form-panel' + (i===0?' active':'');
    panel.dataset.step = i;
    // Move group into panel
    const el = s.el || s;
    if (el && el.parentNode === formEl) {
      panel.appendChild(el);
    } else if (s.el) {
      panel.appendChild(s.el);
    }
    return panel;
  });
  // Clear formEl and append panels
  // Instead of clearing, we will keep formEl as container for panels
  // Remove original groups already moved, then append panels
  panels.forEach(p => formEl.appendChild(p));
  // Controls
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex; gap:10px; justify-content:space-between; margin-top:18px;';
  controls.innerHTML = `<button type="button" class="btn btn-secondary btn-sm" id="step-prev" style="margin-top:0;width:auto;">← Previous</button><div style="flex:1"></div><button type="button" class="btn btn-sm" id="step-next" style="margin-top:0;width:auto;">Next →</button>`;
  formEl.appendChild(controls);
  const prevBtn = controls.querySelector('#step-prev');
  const nextBtn = controls.querySelector('#step-next');
  const submitBtn = formEl.querySelector('button[type="submit"], #btn-submit-report, #btn-submit-*, .btn');
  // Hide original submit until last step
  let originalSubmit = null;
  if (submitBtn && !submitBtn.closest('.step-form-controls')) {
    originalSubmit = submitBtn;
    // Move submit into last panel
    // Will show only on last step
  }
  const sync = () => {
    panels.forEach((p,i)=> p.classList.toggle('active', i===current));
    prevBtn.disabled = current===0;
    prevBtn.style.opacity = current===0 ? '0.5' : '1';
    if (current === total-1) {
      nextBtn.textContent = 'Review & Submit';
      nextBtn.classList.remove('btn-secondary');
    } else {
      nextBtn.textContent = 'Next →';
    }
    updateProgress();
    // Scroll to top of form
    try { formEl.scrollIntoView({ block:'start' }); } catch {}
  };
  prevBtn.addEventListener('click', () => { if (current>0) { current--; sync(); } });
  nextBtn.addEventListener('click', () => {
    if (current < total-1) {
      // Validate current panel inputs (basic required)
      const curPanel = panels[current];
      const required = curPanel.querySelectorAll('[required], textarea, select');
      let valid = true;
      required.forEach(el => {
        if (el.hasAttribute('required') && !el.value.trim()) { el.style.borderColor = '#EF4444'; valid = false; } else { el.style.borderColor = ''; }
      });
      // Allow progression even if valid false but warn?
      current++; sync();
    } else {
      // Last step: trigger original submit or show review
      if (originalSubmit) originalSubmit.click();
    }
  });
  updateProgress();
  sync();
}

// ─── Presets ────────────────────────────────────────────────────
const ACCESSIBILITY_PRESETS = {
  default: { ...ACCESSIBILITY_DEFAULTS },
  reading: {
    textSize: 'large',
    fontWeight: 'enhanced',
    lineSpacing: 'relaxed',
    dyslexiaFont: false,
    readingRuler: true,
    wordHighlighting: true,
    simplifyOnTap: true,
    reduceTransparency: false,
    largerTapTargets: false,
  },
  motor: {
    largerTapTargets: true,
    comfortableControls: true,
    enhancedFocus: true,
    noHoverDependency: true,
    gestureAlternatives: true,
    reduceTransparency: false,
    textSize: 'normal',
  },
  focus: {
    reduceVisualClutter: true,
    comfortableControls: true,
    focusSessionStyle: 'flexible',
    largerTapTargets: false,
  }
};

// Initialize on load if user present
(function initAccessibilityGlobal() {
  // Apply early from cache
  try {
    const cached = localStorage.getItem('stuvo_accessibility_cache');
    if (cached) applyAccessibilityPrefs(JSON.parse(cached));
  } catch {}
  // Also listen for user changes
  if (typeof window !== 'undefined') {
    window.applyAccessibilityPrefs = applyAccessibilityPrefs;
    window.loadAccessibilityPrefs = loadAccessibilityPrefs;
    window.saveAccessibilityPrefs = saveAccessibilityPrefs;
    window.speakText = speakText;
    window.speakWithHighlight = speakWithHighlight;
    window.stopSpeaking = stopSpeaking;
    window.speak = speak;
    window.pauseSpeech = pauseSpeech;
    window.resumeSpeech = resumeSpeech;
    window.stopSpeech = stopSpeech;
    window.startListening = startListening;
    window.createTTSButtonForText = createTTSButtonForText;
    window.attachSTT = attachSTT;
    window.enhanceInputsWithSTT = enhanceInputsWithSTT;
    window.maybeAutoRead = maybeAutoRead;
    window.enhanceWithSimplify = enhanceWithSimplify;
    window.makeStepForm = makeStepForm;
    window.ACCESSIBILITY_DEFAULTS = ACCESSIBILITY_DEFAULTS;
    window.ACCESSIBILITY_PRESETS = ACCESSIBILITY_PRESETS;
    window.toggleReadingRuler = toggleReadingRuler;
    window.simplifyWord = simplifyWord;
    window.ensureReadingRuler = ensureReadingRuler;
    window.initSimplifyOnTapGlobal = initSimplifyOnTapGlobal;
  }
  // Ensure ruler element exists early if pref says so
  try {
    const cached = localStorage.getItem('stuvo_accessibility_cache');
    if (cached) {
      const p = JSON.parse(cached);
      if (p.readingRuler) ensureReadingRuler();
    }
  } catch {}
})();

async function renderStudentAccessibility(container) {
  const uid = appState.user?.uid;
  ensureAccessibilityStyles();
  const _t = (typeof t === 'function') ? t : (k, d) => d || k;
  const _curLang = (window.currentUserLanguage || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'en') || 'en');
  // Load prefs
  let prefs = { ...ACCESSIBILITY_DEFAULTS };
  try { prefs = await loadAccessibilityPrefs(uid); } catch {}
  window._accessPrefsCache = prefs;
  try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(prefs)); } catch {}

  const _checked = (v) => v ? 'active' : '';
  const _selectActive = (cur, val) => cur===val ? 'background:linear-gradient(135deg,#7C5CFC,#4F8CFF);color:#fff;border-color:rgba(124,92,252,0.5);' : '';

  container.innerHTML = `
    <div class="flex-col">
      ${createPageHeader(_t('accessibility.title',_i18n_t('nav.accessibility','Accessibility')), _t('accessibility.subtitle',_i18n_t('accessibility.subtitle','Customize Stuvo to make learning more comfortable and accessible for you — changes apply instantly')))}
      <div class="glass-card" style="border-left:3px solid #7C5CFC; padding:18px;">
        <p style="font-size:13px;color:var(--text-dim);line-height:1.7;margin:0;">${_t('accessibility.intro','Adjust text, focus, motion, and reading support to suit your needs. Presets offer quick starts, but every setting can be fine-tuned.')}</p>
      </div>

      <!-- Language -->
      <div class="glass-card" style="border-left: 3px solid #7C5CFC;">
        <div class="card-label">${_t('accessibility.languageTitle',_i18n_t('accessibility.languageTitle','Language / भाषा'))}</div>
        <p style="font-size:13px; color: var(--text-dim); line-height:1.6; margin-bottom:6px;">${_t('accessibility.languageDesc',_i18n_t('accessibility.languageDesc','Choose your preferred language — UI and AI answers will respond in this language'))}</p>
        <p style="font-size:11px; color: var(--text-dim); line-height:1.5; margin-bottom:14px; background: rgba(124,92,252,0.06); padding:8px 10px; border-radius:8px; border:1px solid rgba(124,92,252,0.12);">${_t('accessibility.languageNote',_i18n_t('accessibility.languageNote','AI-generated content (Doubt Solver, Summaries, Quizzes) will also respond in your selected language. Math notation stays universal.'))}</p>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;" id="access-lang-grid">
          ${Object.entries((typeof SUPPORTED_LANGUAGES !== 'undefined' ? SUPPORTED_LANGUAGES : {en:'English', hi:'हिन्दी', bn:'বাংলা', mr:'मराठी', te:'తెలుగు', ta:'தமிழ்'})).map(([code, name]) => `
            <button class="btn ${code===_curLang ? '' : 'btn-secondary'}" data-lang="${code}" style="margin-top:0; padding:10px 8px; ${code===_curLang ? '' : 'opacity:0.9;'}">
              <div style="font-weight:700; font-size:13px;">${name}</div>
              <div style="font-size:11px; opacity:0.8; text-transform:uppercase; margin-top:2px;">${code}</div>
            </button>
          `).join('')}
        </div>
        <div style="font-size:11px; color: var(--text-dim); margin-top:10px; text-align:center;">${_t('language.current',_i18n_t('language.current','Current Language'))}: <span style="font-weight:700; color:#C4B5FD; text-transform:uppercase;">${_curLang}</span></div>
      </div>

      <!-- Grade & Stream — Personalization (editable) -->
      <div class="glass-card" id="grade-stream-card" style="border-left:3px solid #C4B5FD;">
        <div class="card-label">🎓 Grade & Stream</div>
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;line-height:1.6;">Your grade and stream personalize subject lists across Study Hub. Change anytime — taxonomy subjects merge with your real enrolled classes. <span style="font-size:11px;opacity:0.8;">(Deduped by exact string match)</span></p>
        <div id="gs-step-grade">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;">What grade are you in?</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;" id="gs-grade-buttons">
            <button class="btn btn-secondary gs-grade-btn" data-grade="9" style="margin-top:0;flex:1;min-width:60px;">9</button>
            <button class="btn btn-secondary gs-grade-btn" data-grade="10" style="margin-top:0;flex:1;min-width:60px;">10</button>
            <button class="btn btn-secondary gs-grade-btn" data-grade="11" style="margin-top:0;flex:1;min-width:60px;">11</button>
            <button class="btn btn-secondary gs-grade-btn" data-grade="12" style="margin-top:0;flex:1;min-width:60px;">12</button>
          </div>
          <div id="gs-grade-hint" style="font-size:11px;color:var(--text-dim);margin-top:8px;"></div>
        </div>
        <div id="gs-step-stream" style="display:none;margin-top:14px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;">What's your stream?</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;" id="gs-stream-buttons">
            <button class="btn btn-secondary gs-stream-btn" data-stream="Science" style="margin-top:0;flex:1;min-width:90px;">Science</button>
            <button class="btn btn-secondary gs-stream-btn" data-stream="Commerce" style="margin-top:0;flex:1;min-width:90px;">Commerce</button>
            <button class="btn btn-secondary gs-stream-btn" data-stream="Humanities" style="margin-top:0;flex:1;min-width:90px;">Humanities</button>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap;">
          <button class="btn" id="gs-save-btn" style="margin-top:0;width:auto;">Save Grade & Stream</button>
          <span id="gs-status" style="font-size:12px;color:var(--text-dim);"></span>
        </div>
        <div id="gs-subjects-preview" style="margin-top:12px;font-size:12px;color:var(--text-dim);background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;display:none;"></div>
      </div>

      <!-- Presets -->
      <div class="glass-card">
        <div class="card-label">⚡ Quick Presets</div>
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;line-height:1.6;">Presets apply a recommended combination — you can still customize each setting afterwards.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:12px;" id="preset-grid">
          <div class="glass-card preset-card ${JSON.stringify(prefs).includes('large')?'':''}" data-preset="default" style="padding:16px;text-align:center;margin:0;">
            <div style="font-size:22px;">🔄</div><div style="font-weight:700;font-size:13px;margin-top:6px;">Default</div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Normal settings</div>
          </div>
          <div class="glass-card preset-card" data-preset="reading" style="padding:16px;text-align:center;margin:0;">
            <div style="font-size:22px;">📖</div><div style="font-weight:700;font-size:13px;margin-top:6px;">Reading Support</div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Larger text + ruler + highlights</div>
          </div>
          <div class="glass-card preset-card" data-preset="motor" style="padding:16px;text-align:center;margin:0;">
            <div style="font-size:22px;">👆</div><div style="font-weight:700;font-size:13px;margin-top:6px;">Motor Support</div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Larger targets + focus</div>
          </div>
          <div class="glass-card preset-card" data-preset="focus" style="padding:16px;text-align:center;margin:0;">
            <div style="font-size:22px;">🧠</div><div style="font-weight:700;font-size:13px;margin-top:6px;">Focus / Cognitive</div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Reduce clutter + flexible</div>
          </div>
        </div>
      </div>

      <!-- Vision -->
      <div class="glass-card">
        <div class="card-label">👁 Vision</div>
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- Text Size -->
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:14px;">${_t('accessibility.textSize',_i18n_t('accessibility.textSize','Text Size'))}</div>
                <div style="font-size:12px; color: var(--text-dim); margin-top:4px;">${_t('accessibility.textSizeDesc',_i18n_t('accessibility.textSizeDesc','Global scaling — affects navigation, cards, forms, tables, dialogs, homework, AI responses'))}</div>
              </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;" role="radiogroup" aria-label="Text Size">
              <button class="btn btn-secondary" data-size="normal" role="radio" aria-checked="${prefs.textSize==='normal'}" style="margin-top:0; width:auto; flex:1; ${_selectActive(prefs.textSize,'normal')}">${_t('accessibility.normal',_i18n_t('accessibility.normal','Normal'))}</button>
              <button class="btn btn-secondary" data-size="large" role="radio" aria-checked="${prefs.textSize==='large'}" style="margin-top:0; width:auto; flex:1; ${_selectActive(prefs.textSize,'large')}">${_t('accessibility.large',_i18n_t('accessibility.large','Large'))}</button>
              <button class="btn btn-secondary" data-size="xlarge" role="radio" aria-checked="${prefs.textSize==='xlarge'}" style="margin-top:0; width:auto; flex:1; ${_selectActive(prefs.textSize,'xlarge')}">${_t('accessibility.xLarge',_i18n_t('accessibility.xLarge','Extra Large'))}</button>
            </div>
            <div style="font-size:12px; color: var(--text-dim); margin-top:10px; padding:10px; background: rgba(255,255,255,0.04); border-radius:10px;">${_t('accessibility.preview',_i18n_t('accessibility.preview','Preview: The quick brown fox jumps over the lazy dog. 123 ABC'))}</div>
          </div>

          <!-- Font Weight + Line Spacing -->
          <div class="grid-cols-2" style="gap:14px;">
            <div style="background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:12px; padding:14px;">
              <div style="font-weight:700;font-size:13px;">Font Weight</div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">Enhanced slightly increases weight, keeps hierarchy</div>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-secondary" data-font-weight="normal" style="margin-top:0;flex:1; ${_selectActive(prefs.fontWeight,'normal')}">Normal</button>
                <button class="btn btn-secondary" data-font-weight="enhanced" style="margin-top:0;flex:1; ${_selectActive(prefs.fontWeight,'enhanced')}">Enhanced</button>
              </div>
            </div>
            <div style="background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:12px; padding:14px;">
              <div style="font-weight:700;font-size:13px;">Line Spacing</div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">Applies to AI responses, homework, notes</div>
              <div style="display:flex;gap:6px;margin-top:10px;">
                <button class="btn btn-secondary" data-line-spacing="normal" style="margin-top:0;flex:1;padding:8px 6px;font-size:12px; ${_selectActive(prefs.lineSpacing,'normal')}">Normal</button>
                <button class="btn btn-secondary" data-line-spacing="relaxed" style="margin-top:0;flex:1;padding:8px 6px;font-size:12px; ${_selectActive(prefs.lineSpacing,'relaxed')}">Relaxed</button>
                <button class="btn btn-secondary" data-line-spacing="loose" style="margin-top:0;flex:1;padding:8px 6px;font-size:12px; ${_selectActive(prefs.lineSpacing,'loose')}">Loose</button>
              </div>
            </div>
          </div>

          <!-- Toggles Vision -->
          <div class="grid-cols-2" style="gap:14px;">
            <div class="glass-card" style="margin:0; padding:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                  <div style="font-weight:700; font-size:13px;">Color-Blind Friendly Mode</div>
                  <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Adds icons + patterns, never color alone</div>
                  <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><span class="badge badge-green">✓ Completed</span><span class="badge badge-yellow">⚠ Warning</span><span class="badge badge-red">! Urgent</span></div>
                </div>
                <button class="access-toggle ${_checked(prefs.colorBlindMode)}" id="toggle-color-blind" aria-label="Color-blind friendly mode" role="switch" aria-checked="${!!prefs.colorBlindMode}"></button>
              </div>
            </div>
            <div class="glass-card" style="margin:0; padding:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                  <div style="font-weight:700; font-size:13px;">Enhanced Focus</div>
                  <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Thicker keyboard focus outline, visible on all backgrounds</div>
                </div>
                <button class="access-toggle ${_checked(prefs.enhancedFocus)}" id="toggle-enhanced-focus" aria-label="Enhanced focus" role="switch" aria-checked="${!!prefs.enhancedFocus}"></button>
              </div>
            </div>
            <div class="glass-card" style="margin:0; padding:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                  <div style="font-weight:700; font-size:13px;">Reduce Transparency</div>
                  <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">More solid backgrounds, less blur</div>
                </div>
                <button class="access-toggle ${_checked(prefs.reduceTransparency)}" id="toggle-reduce-transparency" aria-label="Reduce transparency" role="switch" aria-checked="${!!prefs.reduceTransparency}"></button>
              </div>
            </div>
            <div class="glass-card" style="margin:0; padding:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                  <div style="font-weight:700; font-size:14px;">${_t('accessibility.highContrast',_i18n_t('accessibility.highContrast','High Contrast'))}</div>
                  <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">${_t('accessibility.highContrastDesc',_i18n_t('accessibility.highContrastDesc','Removes glass blur and increases contrast'))}</div>
                </div>
                <button class="access-toggle ${_checked(prefs.highContrast)}" id="toggle-high-contrast" aria-label="High contrast" role="switch" aria-checked="${!!prefs.highContrast}"></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Motor & Input -->
      <div class="glass-card">
        <div class="card-label">👆 Motor & Input</div>
        <div class="grid-cols-2" style="gap:14px;">
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Larger Tap Targets</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Bigger buttons, nav items, inputs</div>
              </div>
              <button class="access-toggle ${_checked(prefs.largerTapTargets)}" id="toggle-larger-tap" aria-label="Larger tap targets" role="switch" aria-checked="${!!prefs.largerTapTargets}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">No Hover Dependency</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Critical actions visible without hover</div>
              </div>
              <button class="access-toggle ${_checked(prefs.noHoverDependency)}" id="toggle-no-hover" aria-label="No hover dependency" role="switch" aria-checked="${!!prefs.noHoverDependency}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Gesture Alternatives</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Alternative to long-press / drag</div>
              </div>
              <button class="access-toggle ${_checked(prefs.gestureAlternatives)}" id="toggle-gesture-alt" aria-label="Gesture alternatives" role="switch" aria-checked="${!!prefs.gestureAlternatives}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Comfortable Controls</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">More spacing, avoid accidental taps</div>
              </div>
              <button class="access-toggle ${_checked(prefs.comfortableControls)}" id="toggle-comfortable" aria-label="Comfortable controls" role="switch" aria-checked="${!!prefs.comfortableControls}"></button>
            </div>
          </div>
        </div>
        <p style="font-size:11px;color:var(--text-dim);margin-top:12px;background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:8px;">Tip: Hover-only toolbars now keep delete / edit actions visible as buttons when No Hover is enabled — important on touch devices.</p>
      </div>

      <!-- Reading Support -->
      <div class="glass-card">
        <div class="card-label">📖 Reading Support</div>
        <div class="grid-cols-2" style="gap:14px;">
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:14px;">${_t('accessibility.dyslexiaFont',_i18n_t('accessibility.dyslexiaFont','Dyslexia-friendly Font'))}</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">${_t('accessibility.dyslexiaFontDesc',_i18n_t('accessibility.dyslexiaFontDesc','Uses OpenDyslexic via CDN'))}</div>
              </div>
              <button class="access-toggle ${_checked(prefs.dyslexiaFont)}" id="toggle-dyslexia" aria-label="Dyslexia font" role="switch" aria-checked="${!!prefs.dyslexiaFont}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Reading Ruler</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Horizontal guide that follows cursor</div>
              </div>
              <button class="access-toggle ${_checked(prefs.readingRuler)}" id="toggle-reading-ruler" aria-label="Reading ruler" role="switch" aria-checked="${!!prefs.readingRuler}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Auto-read New Content</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Homework, AI explanations auto-read (OFF by default)</div>
              </div>
              <button class="access-toggle ${_checked(prefs.autoReadNewContent)}" id="toggle-auto-read" aria-label="Auto-read new content" role="switch" aria-checked="${!!prefs.autoReadNewContent}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Simplify Difficult Words</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Tap any hard word in AI/homework for quick meaning</div>
              </div>
              <button class="access-toggle ${_checked(prefs.simplifyOnTap)}" id="toggle-simplify" aria-label="Simplify on tap" role="switch" aria-checked="${!!prefs.simplifyOnTap}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Word Highlighting with TTS</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Highlight spoken word / sentence</div>
              </div>
              <button class="access-toggle ${_checked(prefs.wordHighlighting)}" id="toggle-word-highlight" aria-label="Word highlighting" role="switch" aria-checked="${!!prefs.wordHighlighting}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px; opacity:0.95;">
            <div style="font-weight:700;font-size:13px;">Text-to-Speech & Speech-to-Text</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Try listening and speaking below</div>
            <div style="margin-top:10px;" id="reading-support-demo"></div>
          </div>
        </div>
        <div style="margin-top:14px; padding:10px; background:rgba(255,255,255,0.03); border-radius:10px; font-size:11px; color:var(--text-dim); line-height:1.6;">
          Simplify-on-tap: In AI answers or homework descriptions, tap a difficult word — a small card shows <strong>simple meaning</strong> + optional example. Results are cached and respect your language.
        </div>
      </div>

      <!-- Cognitive & Attention -->
      <div class="glass-card">
        <div class="card-label">🧠 Cognitive & Attention</div>
        <div class="grid-cols-2" style="gap:14px;">
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Reduce Visual Clutter</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Fewer decorations, keep essentials</div>
              </div>
              <button class="access-toggle ${_checked(prefs.reduceVisualClutter)}" id="toggle-reduce-clutter" aria-label="Reduce visual clutter" role="switch" aria-checked="${!!prefs.reduceVisualClutter}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Step-by-Step Forms</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">Long forms split into steps with progress</div>
              </div>
              <button class="access-toggle ${_checked(prefs.stepByStepForms)}" id="toggle-step-forms" aria-label="Step-by-step forms" role="switch" aria-checked="${!!prefs.stepByStepForms}"></button>
            </div>
          </div>
          <div class="glass-card" style="margin:0; padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight:700; font-size:13px;">Simplified Explanations</div>
                <div style="font-size:11px; color: var(--text-dim); margin-top:4px;">AI answers in simpler language by default</div>
              </div>
              <button class="access-toggle ${_checked(prefs.simplifiedExplanations)}" id="toggle-simpler" aria-label="Simplified explanations" role="switch" aria-checked="${!!prefs.simplifiedExplanations}"></button>
            </div>
          </div>
        </div>
        <div style="margin-top:14px; background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:12px; padding:14px;">
          <div style="font-weight:700;font-size:13px;">Focus Session Style</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Flexible allows longer work with gentle reminders, not rigid Pomodoro</div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button class="btn btn-secondary" data-focus-style="standard" style="margin-top:0;flex:1; ${_selectActive(prefs.focusSessionStyle,'standard')}">Standard<br><span style="font-size:10px;opacity:0.8;">25/5 Pomodoro</span></button>
            <button class="btn btn-secondary" data-focus-style="flexible" style="margin-top:0;flex:1; ${_selectActive(prefs.focusSessionStyle,'flexible')}">Flexible<br><span style="font-size:10px;opacity:0.8;">Longer, gentle nudges</span></button>
            <button class="btn btn-secondary" data-focus-style="extended" style="margin-top:0;flex:1; ${_selectActive(prefs.focusSessionStyle,'extended')}">Extended<br><span style="font-size:10px;opacity:0.8;">50-min deep work</span></button>
          </div>
        </div>
      </div>

      <!-- Try TTS/STT demo -->
      <div class="glass-card">
        <div class="card-label">Try Text-to-Speech & Speech-to-Text</div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start;">
          <div style="flex:1; min-width: 240px;">
            <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Text-to-Speech with Highlighting</div>
            <p id="tts-demo-text" class="ai-answer-line" style="font-size:14px; line-height:1.7; color: var(--text-dim); background: rgba(255,255,255,0.04); padding:12px; border-radius:10px;">This is a homework description example. Stuvo can read this aloud and highlight the spoken word so you can follow along.</p>
            <div id="tts-demo-btn" style="margin-top:8px; display:flex; gap:8px; align-items:center;"></div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">Word highlighting follows speech; use pause/stop controls. Auto-read setting (above) will auto-read new homework/AI content when enabled.</div>
          </div>
          <div style="flex:1; min-width: 240px;">
            <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Speech-to-Text</div>
            <div style="font-size:12px; color: var(--text-dim); margin-bottom:8px;">Tap 🎤 to dictate. Uses Web Speech API, respects language.</div>
            <input type="text" class="form-control" id="stt-demo-input" placeholder="${_i18n_t('accessibility.sttPlaceholder','Tap 🎤 and speak...')}">
            <div style="font-size:11px; color: var(--text-dim); margin-top:6px;">If unsupported, you will see “Speech input isn't supported”.</div>
          </div>
        </div>
      </div>

      <div id="extended-time-card"></div>

      <div class="glass-card">
        <div class="card-label">Keyboard Navigation</div>
        <p style="font-size:13px; line-height:1.7; color: var(--text-dim);">Use <kbd style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:6px; border:1px solid var(--glass-border);">Tab</kbd> to move. Enhanced Focus (Vision) makes outline thicker and visible on all backgrounds. Try it after enabling.</p>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="focusable-demo-btn" style="margin-top:0; width:auto;" type="button">Focusable Button</button>
          <button class="btn btn-secondary" id="focusable-demo-link" style="margin-top:0; width:auto;" type="button">Focusable Link</button>
          <input type="text" class="form-control" placeholder="${_i18n_t('accessibility.focusableInput','Focusable input')}" style="width:180px;">
        </div>
      </div>

      <div style="display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn btn-secondary" id="btn-reset-access" style="margin-top:0; width:auto; background:rgba(239,68,68,0.12); border-color:rgba(239,68,68,0.3); color:#FCA5A5;">↺ Reset Accessibility Settings</button>
        <button class="btn" id="btn-save-access" style="margin-top:0; width:auto;">Save Preferences</button>
      </div>
      <p style="font-size:11px;color:var(--text-dim);text-align:right;">Saving stores in cloud (when signed in) + local cache for instant load across refresh/navigation.</p>
    </div>
  `;

  // Helper to keep UI in sync after prefs change without full re-render
  function syncUI() {
    // Text size
    container.querySelectorAll('[data-size]').forEach(b => {
      const active = b.dataset.size === (prefs.textSize || 'normal');
      b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
      b.setAttribute('aria-checked', String(active));
    });
    // Font weight
    container.querySelectorAll('[data-font-weight]').forEach(b => {
      const active = b.dataset.fontWeight === (prefs.fontWeight || 'normal');
      b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
    });
    // Line spacing
    container.querySelectorAll('[data-line-spacing]').forEach(b => {
      const active = b.dataset.lineSpacing === (prefs.lineSpacing || 'normal');
      b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
    });
    // Focus style
    container.querySelectorAll('[data-focus-style]').forEach(b => {
      const active = b.dataset.focusStyle === (prefs.focusSessionStyle || 'standard');
      b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
    });
    // Toggles
    const toggleMap = {
      'toggle-high-contrast': 'highContrast',
      'toggle-dyslexia': 'dyslexiaFont',
      'toggle-simpler': 'simplifiedExplanations',
      'toggle-color-blind': 'colorBlindMode',
      'toggle-enhanced-focus': 'enhancedFocus',
      'toggle-reduce-transparency': 'reduceTransparency',
      'toggle-larger-tap': 'largerTapTargets',
      'toggle-no-hover': 'noHoverDependency',
      'toggle-gesture-alt': 'gestureAlternatives',
      'toggle-comfortable': 'comfortableControls',
      'toggle-auto-read': 'autoReadNewContent',
      'toggle-word-highlight': 'wordHighlighting',
      'toggle-simplify': 'simplifyOnTap',
      'toggle-reading-ruler': 'readingRuler',
      'toggle-reduce-clutter': 'reduceVisualClutter',
      'toggle-step-forms': 'stepByStepForms',
    };
    Object.entries(toggleMap).forEach(([id, key]) => {
      const el = container.querySelector('#' + id);
      if (el) {
        el.classList.toggle('active', !!prefs[key]);
        el.setAttribute('aria-checked', String(!!prefs[key]));
      }
    });
    // Presets visual not needed to sync
  }
  syncUI();
  applyAccessibilityPrefs(prefs);

  // Language switcher
  container.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.lang;
      const langName = (typeof SUPPORTED_LANGUAGES !== 'undefined' && SUPPORTED_LANGUAGES[code]) || code;
      const doneMsg = (typeof t === 'function' ? t('language.changedTo', { name: langName }) : null) || `Language changed to ${langName}`;
      if (typeof setLanguage === 'function') {
        await setLanguage(code);
        showToast(doneMsg, 'success');
        renderStudentAccessibility(container);
      } else if (typeof window.setLanguage === 'function') {
        await window.setLanguage(code);
        showToast(doneMsg, 'success');
        renderStudentAccessibility(container);
      }
    });
  });

  // Text size immediate apply
  container.querySelectorAll('[data-size]').forEach(b => {
    b.addEventListener('click', () => {
      prefs.textSize = b.dataset.size;
      applyAccessibilityPrefs(prefs);
      syncUI();
    });
  });
  // Font weight
  container.querySelectorAll('[data-font-weight]').forEach(b => {
    b.addEventListener('click', () => {
      prefs.fontWeight = b.dataset.fontWeight;
      applyAccessibilityPrefs(prefs);
      syncUI();
    });
  });
  // Line spacing
  container.querySelectorAll('[data-line-spacing]').forEach(b => {
    b.addEventListener('click', () => {
      prefs.lineSpacing = b.dataset.lineSpacing;
      applyAccessibilityPrefs(prefs);
      syncUI();
    });
  });
  // Focus style
  container.querySelectorAll('[data-focus-style]').forEach(b => {
    b.addEventListener('click', () => {
      prefs.focusSessionStyle = b.dataset.focusStyle;
      applyAccessibilityPrefs(prefs);
      syncUI();
      // Also inform focus mode
      window._focusSessionStyle = prefs.focusSessionStyle;
    });
  });
  // Toggles — all immediate with apply + sync
  const bindToggle = (id, key) => {
    const el = container.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('click', () => {
      prefs[key] = !prefs[key];
      // Mirror legacy
      if (key === 'simplifiedExplanations') prefs.simplerMode = prefs[key];
      applyAccessibilityPrefs(prefs);
      syncUI();
      window._accessPrefsCache = prefs;
      if (key === 'readingRuler' && prefs[key]) showToast('Reading ruler enabled — move your cursor to follow', 'info');
      if (key === 'autoReadNewContent' && prefs[key]) showToast('Auto-read enabled — new homework/AI content will be read aloud', 'info');
    });
  };
  bindToggle('toggle-high-contrast', 'highContrast');
  bindToggle('toggle-dyslexia', 'dyslexiaFont');
  bindToggle('toggle-simpler', 'simplifiedExplanations');
  bindToggle('toggle-color-blind', 'colorBlindMode');
  bindToggle('toggle-enhanced-focus', 'enhancedFocus');
  bindToggle('toggle-reduce-transparency', 'reduceTransparency');
  bindToggle('toggle-larger-tap', 'largerTapTargets');
  bindToggle('toggle-no-hover', 'noHoverDependency');
  bindToggle('toggle-gesture-alt', 'gestureAlternatives');
  bindToggle('toggle-comfortable', 'comfortableControls');
  bindToggle('toggle-auto-read', 'autoReadNewContent');
  bindToggle('toggle-word-highlight', 'wordHighlighting');
  bindToggle('toggle-simplify', 'simplifyOnTap');
  bindToggle('toggle-reading-ruler', 'readingRuler');
  bindToggle('toggle-reduce-clutter', 'reduceVisualClutter');
  bindToggle('toggle-step-forms', 'stepByStepForms');

  // Presets
  container.querySelectorAll('[data-preset]').forEach(card => {
    card.addEventListener('click', () => {
      const preset = card.dataset.preset;
      const base = ACCESSIBILITY_PRESETS[preset];
      if (!base) return;
      // Merge preset overrides onto current, preserving unrelated prefs? Spec says presets NOT permanently override individual settings after — so just merge
      prefs = { ...prefs, ...base };
      // Ensure defaults for any missing
      prefs = { ...ACCESSIBILITY_DEFAULTS, ...prefs };
      // Preserve textSize etc from preset fully
      applyAccessibilityPrefs(prefs);
      syncUI();
      window._accessPrefsCache = prefs;
      showToast(`Applied ${preset} preset — customize further as needed`, 'success');
      // Re-render to show updated UI properly for text size etc. but keep without losing?
      // Sync is enough, but also highlight active preset card
      container.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // TTS demo with highlighting
  const ttsHost = container.querySelector('#tts-demo-btn');
  if (ttsHost) {
    const textEl = container.querySelector('#tts-demo-text');
    const btn = createTTSButtonForText(() => textEl?.textContent || '');
    ttsHost.appendChild(btn);
    // Also add pause/stop demo via word highlighting? The create button already handles highlight if pref true
    // Enhance demo container for simplify
    try { enhanceWithSimplify(textEl.parentElement || container); } catch {}
  }
  // STT demo
  const sttInput = container.querySelector('#stt-demo-input');
  if (sttInput) attachSTT(sttInput);
  // Reading support demo area enhance simplify
  const readingDemo = container.querySelector('#reading-support-demo');
  if (readingDemo) {
    readingDemo.innerHTML = `<div style="font-size:12px;color:var(--text-dim);"><span class="ai-answer-line simplify-ctx">Tap a tricky word like <span style="text-decoration:underline dotted; cursor:pointer;">photosynthesis</span> in any AI explanation to see a simple meaning.</span></div>`;
  }

  // Extended-time read-only note
  const extCard = container.querySelector('#extended-time-card');
  async function loadExtendedTimeNote() {
    if (!uid) return;
    const classIds = appState.userData?.classIds || [];
    const notes = [];
    for (const cid of classIds) {
      try {
        const snap = await getDoc(doc(db, 'classes', cid, 'extendedTimeSettings', uid));
        if (snap.exists) {
          const d = snap.data();
          if (d.enabled || d.extraTimeMinutes || d.note) {
            notes.push({ classId: cid, ...d });
          }
        }
      } catch {}
    }
    if (notes.length) {
      extCard.innerHTML = `
        <div class="glass-card" style="border-left: 3px solid #93C5FD;">
          <div class="card-label">⏱ Extended Time</div>
          ${notes.map(n => `
            <div style="background: rgba(79,140,255,0.08); border:1px solid rgba(79,140,255,0.2); border-radius:12px; padding:14px; margin-bottom:10px;">
              <div style="font-weight:700; color:#93C5FD;">You have extra time on this assignment</div>
              <div style="font-size:12px; color: var(--text-dim); margin-top:6px;">Class: ${n.classId} ${n.extraTimeMinutes ? `· +${n.extraTimeMinutes} minutes` : ''}</div>
              ${n.note ? `<div style="font-size:13px; margin-top:8px; line-height:1.6;">${n.note}</div>` : ''}
              <div style="font-size:11px; color: var(--text-dim); margin-top:8px;">This is set by your teacher and cannot be changed here.</div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      extCard.innerHTML = `
        <div class="glass-card" style="opacity:0.8;">
          <div class="card-label">⏱ Extended Time</div>
          <p style="font-size:13px; color: var(--text-dim); line-height:1.6;">No extra time configured. If your teacher has granted extended time, you will see “You have extra time on this assignment” here.</p>
        </div>
      `;
    }
  }
  loadExtendedTimeNote();

  // ─── Grade & Stream — Personalization (editable, shared logic) ───────
  (function initGradeStreamSection(){
    var gsGrade = (appState.userData && appState.userData.grade != null) ? String(appState.userData.grade) : null;
    var gsStream = (appState.userData && appState.userData.stream) ? appState.userData.stream : null;
    // Refresh from Firestore to avoid stale cache
    if(uid){
      getDoc(doc(db,'users',uid)).then(function(snap){
        if(snap.exists){
          var d=snap.data();
          if(d.grade != null) gsGrade = String(d.grade);
          if(d.stream !== undefined) gsStream = d.stream || null;
          if(appState.userData){ appState.userData.grade = gsGrade; appState.userData.stream = gsStream; }
          syncGS();
        }
      }).catch(function(){});
    }
    var gsGradeEl = function(){ return container.querySelector('#gs-save-btn'); };
    function syncGS(){
      var gradeBtns = container.querySelectorAll('.gs-grade-btn');
      gradeBtns.forEach(function(b){
        var active = b.dataset.grade === gsGrade;
        b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
        b.style.color = active ? '#fff' : '';
        b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
        b.setAttribute('aria-pressed', String(active));
      });
      var streamSection = container.querySelector('#gs-step-stream');
      var showStream = gsGrade === '11' || gsGrade === '12';
      if(streamSection) streamSection.style.display = showStream ? 'block' : 'none';
      var streamBtns = container.querySelectorAll('.gs-stream-btn');
      streamBtns.forEach(function(b){
        var active = b.dataset.stream === gsStream && showStream;
        b.style.background = active ? 'linear-gradient(135deg,#7C5CFC,#4F8CFF)' : '';
        b.style.color = active ? '#fff' : '';
        b.style.borderColor = active ? 'rgba(124,92,252,0.5)' : '';
        b.setAttribute('aria-pressed', String(active));
      });
      var hint = container.querySelector('#gs-grade-hint');
      if(hint){
        if(!gsGrade) hint.textContent = 'Select your grade to see your personalized subjects.';
        else if(showStream && !gsStream) hint.textContent = 'Now select your stream for grades 11–12.';
        else hint.textContent = 'Grade ' + gsGrade + (gsStream ? ' · ' + gsStream : '') + ' — subjects will update everywhere.';
      }
      // Preview merged subjects (taxonomy ∪ enrolled)
      var preview = container.querySelector('#gs-subjects-preview');
      if(preview){
        try{
          var tax = (typeof getSubjectsForStudent==='function') ? getSubjectsForStudent(gsGrade, gsStream) : [];
          // Try enrolled from appState classIds synchronously if cached, else async fetch
          var classIds = (appState.userData && appState.userData.classIds) ? appState.userData.classIds : [];
          preview.style.display = 'block';
          if(!gsGrade){
            preview.innerHTML = '<span style="color:var(--text-dim);">Complete grade selection to see your subjects.</span>';
          } else {
            var enrolledPreview = [];
            // If we have cached subjects, show merged immediately; async will update
            preview.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">Your subjects: ' + (tax.length ? tax.join(', ') : '—') + '</div><div style="font-size:11px;color:var(--text-dim);">Including any extra subjects from your real enrolled classes (deduped).</div>';
            if(classIds.length && typeof fetchEnrolledSubjects==='function'){
              fetchEnrolledSubjects(uid, classIds).then(function(enrolled){
                var merged = (typeof getMergedSubjects==='function') ? getMergedSubjects(gsGrade, gsStream, enrolled) : [].concat(tax, enrolled);
                // dedupe already handled
                preview.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">Your subjects: ' + (merged.length ? merged.join(', ') : tax.join(', ')) + '</div>' + (enrolled.length ? '<div style="font-size:11px;">Extra from enrolled classes: ' + enrolled.join(', ') + '</div>' : '') + '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Merged taxonomy ∪ enrolled, deduped by exact string match.</div>';
              }).catch(function(){});
            }
          }
        }catch(e){}
      }
    }
    syncGS();
    container.querySelectorAll('.gs-grade-btn').forEach(function(b){
      b.addEventListener('click', function(){
        gsGrade = b.dataset.grade;
        if(gsGrade==='9' || gsGrade==='10') gsStream = null;
        syncGS();
      });
    });
    container.querySelectorAll('.gs-stream-btn').forEach(function(b){
      b.addEventListener('click', function(){
        gsStream = b.dataset.stream;
        syncGS();
      });
    });
    var saveBtn = container.querySelector('#gs-save-btn');
    var statusEl = container.querySelector('#gs-status');
    if(saveBtn){
      saveBtn.addEventListener('click', async function(){
        if(!gsGrade){ showToast('Please select your grade first.', 'error'); return; }
        if((gsGrade==='11' || gsGrade==='12') && !gsStream){ showToast('Please select your stream for grade ' + gsGrade + '.', 'error'); return; }
        var streamToSave = (gsGrade==='11' || gsGrade==='12') ? gsStream : null;
        saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
        if(statusEl) statusEl.textContent = '';
        try{
          await setDoc(doc(db,'users',uid), { grade: gsGrade, stream: streamToSave }, { merge: true });
          if(appState.userData){ appState.userData.grade = gsGrade; appState.userData.stream = streamToSave; }
          if(statusEl) statusEl.textContent = '✓ Saved';
          showToast('Grade & stream saved ✓', 'success');
          syncGS();
        }catch(e){
          console.error('[gradeStream save]', e);
          showToast('Failed to save: ' + (e.message||''), 'error');
          if(statusEl) statusEl.textContent = 'Failed to save';
        }finally{
          saveBtn.disabled = false; saveBtn.textContent = 'Save Grade & Stream';
        }
      });
    }
  })();

  container.querySelector('#focusable-demo-btn')?.addEventListener('click', () => {
    showToast('Button focused', 'info');
  });
  container.querySelector('#focusable-demo-link')?.addEventListener('click', () => {
    showToast('Link focused', 'info');
  });

  container.querySelector('#btn-save-access')?.addEventListener('click', async () => {
    window._accessPrefsCache = prefs;
    try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(prefs)); } catch {}
    await saveAccessibilityPrefs(uid, prefs);
  });
  container.querySelector('#btn-reset-access')?.addEventListener('click', () => {
    openModal(_i18n_t('accessibility.confirmReset','Reset Accessibility Settings?'), `
      <p style="font-size:13px;line-height:1.6;">This will restore all accessibility preferences to defaults. This only affects accessibility settings — not your profile, language, or school data.</p>
      <p style="font-size:12px;color:var(--text-dim);margin-top:10px;">You can still customize each setting again after reset.</p>
    `, async (overlay, close) => {
      prefs = { ...ACCESSIBILITY_DEFAULTS };
      applyAccessibilityPrefs(prefs);
      syncUI();
      window._accessPrefsCache = prefs;
      try { localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(prefs)); } catch {}
      if (uid) {
        try { await setDoc(doc(db, 'users', uid), { accessibilityPrefs: prefs }, { merge: true }); } catch (e) { console.error(e); }
      }
      showToast(_i18n_t('accessibility.resetDone','Accessibility settings reset to defaults'), 'success');
      close();
      // Re-sync UI after reset
      syncUI();
    });
  });

  // Enhance any inputs with STT for consistency
  try { enhanceInputsWithSTT(container); } catch {}
  // Enhance simplify context
  try { enhanceWithSimplify(container); } catch {}
  // Apply reading ruler preview immediately if enabled
  if (prefs.readingRuler) ensureReadingRuler();
}
