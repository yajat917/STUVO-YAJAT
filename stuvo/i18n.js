// Stuvo i18n engine — multi-language support for 6 languages
// Loads static JSON files from /lang/<code>.json, provides t() lookup with English fallback
let currentLanguage = 'en';
let translations = {};
let fallbackTranslations = {};

const SUPPORTED_LANGUAGES = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  mr: 'मराठी',
  te: 'తెలుగు',
  ta: 'தமிழ்'
};

// ─── Language persistence: Firestore (authoritative, per-user) + localStorage (fast cache) ───
// Scoped per-uid keys prevent cross-user leaks on shared school devices.
// The bare key holds the logged-out choice (login screen); it is NOT sensitive data.
const STUVO_LANG_KEY = 'stuvo_lang';
function stuvoLangScopedKey() {
  try { const uid = window.currentUserUid; return uid ? STUVO_LANG_KEY + '_' + uid : null; } catch { return null; }
}
function getCachedLang() {
  try {
    // 1. Explicit override: ?lang=xx or #/...?lang=xx (shareable links)
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const q = qs.get('lang');
      if (q && SUPPORTED_LANGUAGES[q]) return q;
    } catch {}
    try {
      const m = (window.location.hash || '').match(/[?&]lang=([a-z]{2})/);
      if (m && SUPPORTED_LANGUAGES[m[1]]) return m[1];
    } catch {}
    // 2. Per-user scoped cache (only when signed in as that user)
    try {
      const sk = stuvoLangScopedKey();
      if (sk) { const v = localStorage.getItem(sk); if (v && SUPPORTED_LANGUAGES[v]) return v; }
    } catch {}
    // 3. Logged-out / device cache
    try {
      const bare = localStorage.getItem(STUVO_LANG_KEY);
      if (bare && SUPPORTED_LANGUAGES[bare]) return bare;
    } catch {}
    // 4. Browser preference (hi-IN -> hi, etc.)
    try {
      const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
      const short = nav.split('-')[0];
      if (SUPPORTED_LANGUAGES[short]) return short;
    } catch {}
    // 5. In-memory (set from Firestore after sign-in)
    if (window.currentUserLanguage && SUPPORTED_LANGUAGES[window.currentUserLanguage]) return window.currentUserLanguage;
  } catch {}
  return 'en';
}
function cacheLangLocally(code) {
  if (!SUPPORTED_LANGUAGES[code]) return;
  try { localStorage.setItem(STUVO_LANG_KEY, code); } catch {}
  try { const sk = stuvoLangScopedKey(); if (sk) localStorage.setItem(sk, code); } catch {}
}
// Called on every explicit sign-out: drops per-user caches so the next
// student on a shared device never inherits language or accessibility prefs.
function clearScopedLangCache() {
  try { const sk = stuvoLangScopedKey(); if (sk) localStorage.removeItem(sk); } catch {}
  try { localStorage.removeItem('stuvo_accessibility_cache'); } catch {}
}

// BCP-47 locale tag for a Stuvo language code — used by SpeechRecognition / speechSynthesis.
// Indian English ('en-IN') is the default English voice for this audience.
function stuvoBcp47(code) {
  const map = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN' };
  const short = String(code || 'en').toLowerCase().split('-')[0];
  return map[short] || 'en-IN';
}

async function loadLanguage(langCode) {
  if (!SUPPORTED_LANGUAGES[langCode]) langCode = 'en';
  try {
    // Try relative path for stuvo subfolder, fallback to absolute
    let response = null;
    try {
      response = await fetch(`lang/${langCode}.json`);
      if (!response.ok) throw new Error('not ok relative');
    } catch {
      response = await fetch(`/stuvo/lang/${langCode}.json`);
    }
    if (!response || !response.ok) {
      // Try absolute /lang path as last resort (spec example)
      try { response = await fetch(`/lang/${langCode}.json`); } catch {}
    }
    if (!response || !response.ok) {
      console.error(`[i18n] Failed to load ${langCode}.json`, response && response.status);
      if (langCode !== 'en') return loadLanguage('en');
      return;
    }
    translations = await response.json();
    currentLanguage = langCode;
    window.currentUserLanguage = langCode;
    window.currentLanguage = langCode;
    try { document.documentElement.setAttribute('lang', langCode); } catch {}
    // Fast local cache so reloads + login screen paint instantly (Firestore stays authoritative)
    try { cacheLangLocally(langCode); } catch {}
    // Load fallback English if needed
    if (langCode !== 'en' && Object.keys(fallbackTranslations).length === 0) {
      try {
        let fb = null;
        try { fb = await fetch(`lang/en.json`); if (!fb.ok) throw new Error('fb relative fail'); } catch { try { fb = await fetch(`/stuvo/lang/en.json`);} catch {} }
        if (!fb || !fb.ok) { try { fb = await fetch(`/lang/en.json`);} catch {}}
        if (fb && fb.ok) fallbackTranslations = await fb.json();
      } catch (e) { console.warn('[i18n fallback]', e); }
    } else if (langCode === 'en') {
      fallbackTranslations = translations;
    }
    // Update lang code displays
    try {
      const el = document.getElementById('lang-current-code');
      if (el) el.textContent = langCode.toUpperCase();
      const mEl = document.getElementById('mth-lang-btn');
      if (mEl) mEl.textContent = '🌐 ' + langCode.toUpperCase();
    } catch {}
  } catch (e) {
    console.error('[loadLanguage]', e);
  }
}

// t('nav.dashboard') -> looks up translations.nav.dashboard, falls back to English, falls back to the key itself
function t(keyPath, params = {}) {
  if (!keyPath) return '';
  // If second arg is string, treat as default fallback value (for legacy calls like t('common.signOut','Sign Out'))
  let fallbackStr = null;
  if (typeof params === 'string') {
    fallbackStr = params;
    params = {};
  }
  const lookup = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
  let text = lookup(translations, keyPath);
  if (text === undefined) text = lookup(fallbackTranslations, keyPath);
  if (text === undefined) {
    // If caller provided default string, use it instead of warning
    if (fallbackStr !== null) return fallbackStr;
    console.warn(`Missing translation key: ${keyPath}`);
    return keyPath;
  }
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
  }
  return text;
}

async function setLanguage(langCode) {
  if (!SUPPORTED_LANGUAGES[langCode]) langCode = 'en';
  window._langSwitching = true;
  await loadLanguage(langCode);
  window.currentUserLanguage = langCode;
  window.currentLanguage = langCode;
  // Persist to Firestore users/{uid}.languagePreference (authoritative) + localStorage (fast cache).
  // setDoc-with-merge FIRST: update() throws if the user doc does not exist yet (first-login race).
  if (window.currentUserUid) {
    try {
      let saved = false;
      // Use compat helpers if available
      if (typeof setDoc === 'function' && typeof doc === 'function' && typeof db !== 'undefined') {
        try {
          await setDoc(doc(db, 'users', window.currentUserUid), { languagePreference: langCode }, { merge: true });
          saved = true;
        } catch (e) {
          // Fall through to legacy branches
        }
      }
      if (!saved) {
        if (typeof db !== 'undefined' && db.collection) {
          try { await db.collection('users').doc(window.currentUserUid).set({ languagePreference: langCode }, { merge: true }); }
          catch { await db.collection('users').doc(window.currentUserUid).update({ languagePreference: langCode }); }
        } else if (typeof firebase !== 'undefined' && firebase.firestore) {
          try { await firebase.firestore().collection('users').doc(window.currentUserUid).set({ languagePreference: langCode }, { merge: true }); }
          catch { await firebase.firestore().collection('users').doc(window.currentUserUid).update({ languagePreference: langCode }); }
        }
      }
      if (typeof appState !== 'undefined' && appState.userData) appState.userData.languagePreference = langCode;
    } catch (e) {
      console.error('[setLanguage firestore]', e);
    }
  }
  try { cacheLangLocally(langCode); } catch {}
  // Re-render current screen with new language
  try {
    if (window._navigate) window._navigate(window.location.hash);
    else if (typeof handleRoute === 'function') handleRoute();
  } catch {}
  // Update dropdown UI if present
  try {
    const codeEls = document.querySelectorAll('#lang-current-code');
    codeEls.forEach(el => el.textContent = langCode.toUpperCase());
  } catch {}
  // Dispatch custom event for listeners
  try { window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: langCode } })); } catch {}
  window._langSwitching = false;
}

// First-time language prompt — shows centered modal if no preference set
let _langPromptShown = false;
function showFirstTimeLanguagePrompt() {
  if (_langPromptShown) return;
  // Only show if no preference saved yet and user is logged in
  if (window.currentUserLanguage && window.currentUserLanguage !== 'en') return;
  // Check if already has preference in Firestore data
  try {
    if (typeof appState !== 'undefined' && appState.userData && appState.userData.languagePreference) return;
  } catch {}
  if (document.getElementById('lang-prompt-overlay')) return;
  _langPromptShown = true;
  const overlay = document.createElement('div');
  overlay.id = 'lang-prompt-overlay';
  overlay.className = 'lang-prompt-overlay';
  // Ensure styles exist
  if (!document.getElementById('lang-switcher-styles') && !document.querySelector('style#lang-prompt-styles')) {
    // styles already injected via styles.css; if not, inject minimal
  }
  overlay.innerHTML = `
    <div class="lang-prompt-modal">
      <div class="lang-prompt-title">${t('language.choose','Choose your language')}</div>
      <div class="lang-prompt-sub">${t('language.chooseSub','Select your preferred language')}</div>
      <div class="lang-prompt-grid">
        ${Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => `
          <button class="lang-prompt-btn" data-lang="${code}">
            <div style="font-size:16px;font-weight:700;">${name}</div>
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-top:2px;">${code}</div>
          </button>
        `).join('')}
      </div>
      <button class="lang-prompt-skip" id="lang-prompt-skip">${t('language.skip','Skip: Continue in English')}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.lang-prompt-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const c = btn.dataset.lang;
      await setLanguage(c);
      overlay.remove();
    });
  });
  const skipBtn = overlay.querySelector('#lang-prompt-skip');
  if (skipBtn) skipBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

window.t = t;
window.setLanguage = setLanguage;
window.loadLanguage = loadLanguage;
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
window.showFirstTimeLanguagePrompt = showFirstTimeLanguagePrompt;
window.getCachedLang = getCachedLang;
window.cacheLangLocally = cacheLangLocally;
window.clearScopedLangCache = clearScopedLangCache;
window.stuvoBcp47 = stuvoBcp47;
window.currentUserLanguage = window.currentUserLanguage || getCachedLang();
window.currentLanguage = currentLanguage;

// Auto-load default language on DOM ready — precedence:
// ?lang= > per-user cache > device cache > browser language > in-memory > en
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { loadLanguage(getCachedLang()).catch(()=>{}); });
} else {
  loadLanguage(getCachedLang()).catch(()=>{});
}

// Also wrap safeApiCall to include language automatically if needed
(function wrapSafeApiForLang(){
  if (window._safeApiLangWrapped) return;
  window._safeApiLangWrapped = true;
  // Wrap after components.js loads; delay slightly
  setTimeout(()=>{
    if (typeof window.safeApiCall === 'function' && !window.safeApiCall._langWrapped) {
      const orig = window.safeApiCall;
      window.safeApiCall = async function(endpoint, payload){
        try {
          const lang = window.currentUserLanguage || currentLanguage || 'en';
          if (payload && typeof payload === 'object' && !payload.language && endpoint && endpoint.includes('/api/ai')) {
            payload = { ...payload, language: lang };
          }
        } catch {}
        return orig(endpoint, payload);
      };
      window.safeApiCall._langWrapped = true;
    }
  }, 100);
})();

// ─── DOM Auto-Translation — ensures every hardcoded English string is translated even if screen didn't use t() ───
let _reverseMap = null; // English value -> keyPath, sorted by length desc
let _enCache = null;

function buildReverseMap() {
  if (_reverseMap) return _reverseMap;
  const src = fallbackTranslations && Object.keys(fallbackTranslations).length ? fallbackTranslations : translations;
  if (!src || !Object.keys(src).length) return null;
  const pairs = [];
  function walk(obj, prefix){
    for(const k in obj){
      const kp = prefix ? `${prefix}.${k}` : k;
      const v = obj[k];
      if(typeof v === 'string') pairs.push([kp, v]);
      else if(v && typeof v === 'object') walk(v, kp);
    }
  }
  walk(src, '');
  // Sort longest first so "Save Preferences" before "Save"
  pairs.sort((a,b)=> b[1].length - a[1].length);
  _reverseMap = pairs;
  return _reverseMap;
}

function translateTextWithMap(text, map){
  if(!text || !text.trim()) return text;
  let out = text;
  for(const [kp, enVal] of map){
    if(!enVal || enVal.length < 3) continue; // skip very short like "Yes" to avoid false positives inside other words? But we keep "Save" (4)
    if(out.includes(enVal)){
      const tr = t(kp);
      if(tr !== kp && tr !== enVal){
        // Use split-join to replace all occurrences
        out = out.split(enVal).join(tr);
      }
    }
  }
  return out;
}

function translateDOM(root){
  if(!root || !root.querySelectorAll) return;
  const map = buildReverseMap();
  if(!map) return;
  // Text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node)=>{
      if(!node.parentElement) return NodeFilter.FILTER_REJECT;
      const tag = node.parentElement.tagName;
      if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
      if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // Skip if parent is already inside a translation marker?
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes=[];
  let n;
  while(n = walker.nextNode()) textNodes.push(n);
  for(const node of textNodes){
    const original = node.dataset ? (node.parentElement && node.parentElement.dataset && node.parentElement.dataset.i18nOriginal) : null;
    // Store original on parent element for re-translation
    let origText = node.nodeValue;
    // If parent has stored original, use it as base to avoid double-translating already Hindi
    const parent = node.parentElement;
    if(parent && parent.dataset && parent.dataset.i18nOriginal){
      // This text node's parent was previously translated, but we stored original on parent, not node
      // For simplicity, we will use nodeValue as is and translate from English map; if already Hindi, it won't contain English val, so no change
    }
    // Use a per-node stored original if we have it
    if(node._i18nOriginal !== undefined){
      origText = node._i18nOriginal;
    } else {
      // Check if this text was previously translated: if it contains no English vals, keep as is
      // Store original for future switches
      node._i18nOriginal = origText;
    }
    const translated = translateTextWithMap(node._i18nOriginal, map);
    if(translated !== node.nodeValue){
      node.nodeValue = translated;
    }
  }
  // Attributes: placeholder, title, aria-label, alt
  const attrNames = ['placeholder','title','aria-label','alt'];
  const attrElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for(const el of attrElements){
    for(const attr of attrNames){
      const val = el.getAttribute(attr);
      if(val && val.trim()){
        const key = `_attr_${attr}_${val}`;
        // Store original in dataset
        const dsKey = 'i18nAttr' + attr.charAt(0).toUpperCase() + attr.slice(1);
        let origAttr = el.dataset[dsKey];
        if(origAttr === undefined){
          el.dataset[dsKey] = val;
          origAttr = val;
        } else {
          origAttr = el.dataset[dsKey];
        }
        const translatedAttr = translateTextWithMap(origAttr, map);
        if(translatedAttr !== val){
          el.setAttribute(attr, translatedAttr);
        }
      }
    }
  }
}

function translatePage(){
  try{
    const root = document.getElementById('router-outlet') || document.getElementById('app') || document.body;
    if(root) translateDOM(root);
    // Also translate topbar and sidebar which are outside router-outlet
    const topbar = document.getElementById('topbar');
    if(topbar) translateDOM(topbar);
    const sidebar = document.getElementById('sidebar');
    if(sidebar) translateDOM(sidebar);
    const mobileTop = document.getElementById('mobile-top-header');
    if(mobileTop) translateDOM(mobileTop);
    const mobileBottom = document.getElementById('mobile-bottom-nav');
    if(mobileBottom) translateDOM(mobileBottom);
    // Auth + floating layers live outside router-outlet — translate them too
    const authBox = document.getElementById('auth-container');
    if(authBox) translateDOM(authBox);
    const toastBox = document.getElementById('toast-container');
    if(toastBox) translateDOM(toastBox);
    try {
      document.querySelectorAll('.modal-overlay, #lang-prompt-overlay, .lang-prompt-modal').forEach(el => translateDOM(el));
    } catch {}
  }catch(e){ console.warn('[translatePage]', e); }
}
window.translatePage = translatePage;
window.translateDOM = translateDOM;

// Hook into language load to auto-translate
const _origLoadLanguage = loadLanguage;
loadLanguage = async function(langCode){
  const res = await _origLoadLanguage(langCode);
  // Rebuild reverse map on language change (needs fallbackTranslations)
  _reverseMap = null;
  setTimeout(()=>{ try{ translatePage(); }catch{} }, 80);
  setTimeout(()=>{ try{ translatePage(); }catch{} }, 400);
  return res;
};
window.loadLanguage = loadLanguage;
const _origSetLanguage = setLanguage;
setLanguage = async function(langCode){
  const res = await _origSetLanguage(langCode);
  _reverseMap = null;
  setTimeout(()=>{ try{ translatePage(); }catch{} }, 150);
  return res;
};
window.setLanguage = setLanguage;

// Observe DOM changes to auto-translate new content (e.g., after handleRoute)
if(typeof MutationObserver !== 'undefined'){
  let _translateDebounce=null;
  // Perf: translate ONLY newly added subtrees, not the whole page.
  // The old full-page translatePage() on every mutation re-scanned ~8 roots
  // per chat message / quiz render. characterData-only bursts (timers,
  // count-ups) now skip translation entirely.
  const observer = new MutationObserver((mutations)=>{
    clearTimeout(_translateDebounce);
    _translateDebounce=setTimeout(()=>{
      try{
        const roots=[];
        (mutations||[]).forEach(m=>{
          (m.addedNodes||[]).forEach(n=>{ if(n && n.nodeType===1) roots.push(n); });
        });
        if(!roots.length) return;
        roots.forEach(r=>{ try{ translateDOM(r); }catch{} });
      }catch{}
    }, 120);
  });
  // Observe after DOM ready
  const startObserve=()=>{
    const outlet=document.getElementById('router-outlet');
    if(outlet) observer.observe(outlet, {childList:true, subtree:true, characterData:true});
    const app=document.getElementById('app');
    if(app) observer.observe(app, {childList:true, subtree:true, characterData:true});
    // Login / pending screens render outside the outlet — observe them too
    const authBox=document.getElementById('auth-container');
    if(authBox) observer.observe(authBox, {childList:true, subtree:true, characterData:true});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(startObserve, 500));
  else setTimeout(startObserve, 500);
  // Also observe language change
  window.addEventListener('languageChanged', ()=>setTimeout(()=>{ _reverseMap=null; translatePage(); }, 100));
}

// Patch callDirectOpenRouter if present to inject language? No — backend handles it via payload
