const fs = require('fs');
const path = require('path');

function getApiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const envPaths = [
      path.resolve(__dirname, '../../.env.local'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '.env')
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(/OPENROUTER_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          const key = match[1].trim().replace(/^["']|["']$/g, '');
          process.env.OPENROUTER_API_KEY = key;
          return key;
        }
      }
    }
  } catch (e) {}
  return null;
}

// Auto-initialize key into environment
getApiKey();

// Model policy: IDs live in ONE place and are env-overridable so a
// withdrawn free model can be swapped without a code change:
//   OPENROUTER_MODEL (primary), OPENROUTER_FALLBACK_MODEL (single fallback).
// Defaults below were verified against the live OpenRouter catalog (text->text
// chat support for temperature / max_tokens / system messages as sent below).
// Primary: google/gemma-4-31b-it:free. Single fallback:
// google/gemma-4-26b-a4b-it:free (same instruct family, standard string
// `content` responses).
// NOTE: liquid/lfm-2.5-2.6b:free was REMOVED as fallback after production
// UPSTREAM_NULL_CONTENT incidents (HTTP 200 with `content: null`). It is a
// compact reasoning model served by a single provider, and OpenRouter's own
// availability stats count empty responses against it. Our request shape is
// within its supported parameters, so this is provider-side unreliability,
// not a request-shape bug — the parser already handles the documented
// string/array content schema correctly. Do not re-add it without live
// verification that it returns non-empty `content` consistently.
const DEFAULT_PRIMARY_MODEL = "NVIDIA: Nemotron 3.5 Super VL (free)";
const DEFAULT_FALLBACK_MODEL = "NVIDIA: Nemotron 3 Super (free)";
// Resolved per request (not once at module load) so a rotated env var takes
// effect without a redeploy-restart on long-lived hosts, and so the loop
// checklist item "bogus model id → model_unavailable" exercises the real path.
function modelVendor(id) {
  return String(id || '').split('/')[0].toLowerCase();
}
function getModels() {
  const primary = (process.env.OPENROUTER_MODEL || "").trim() || DEFAULT_PRIMARY_MODEL;
  const fallback = (process.env.OPENROUTER_FALLBACK_MODEL || "").trim() || DEFAULT_FALLBACK_MODEL;
  // Vendor-diversity rule: the fallback must never be from the same vendor as
  // the primary, or a family-wide throttle (like the Gemma 429s) fails over
  // to the same outage. Loud warning so a bad config is caught in server logs.
  if (fallback !== primary && modelVendor(fallback) === modelVendor(primary)) console.warn(`[AI-CONFIG] Fallback model ${fallback} shares vendor ${modelVendor(primary)} with primary ${primary} — same-vendor failover gives no redundancy. Set OPENROUTER_FALLBACK_MODEL to a different vendor.`);
  return primary === fallback ? [primary] : [primary, fallback];
}
const MODELS = getModels();

const REQUEST_TIMEOUT_MS = 20000;

const FORMAT_STANDARD = `
FORMATTING RULES — follow these exactly in every response:
- Never use LaTeX. Never use $ or $$ symbols. Never use \\frac, \\sqrt, \\times, or any backslash commands.
- For math, use plain readable text only:
  - Powers: x^2, x^3 (caret symbol, no superscript formatting)
  - Roots: √x or "square root of x" — never \\sqrt
  - Fractions: write as (numerator)/(denominator), e.g. (3)/(4), not \\frac{3}{4}
  - Multiplication: × or *
  - Division: ÷ or /
  - Do not use markdown bold/italic (** or *) inside explanations — plain text only
- For step-by-step explanations, number each step clearly: "1. ...", "2. ...", "3. ..."
- Keep sentences short and direct. No filler phrases like "Let's dive in" or "Great question!"
- Never wrap the entire response in markdown code blocks unless explicitly asked for code
- If the response must be JSON (per the specific prompt below), return ONLY valid JSON with no markdown fences, no backticks, no explanation text before or after
`;

// Unified AI voice for Study Hub tutoring features ONLY.
// Non-Study-Hub features (Wellbeing Assistant, Class Pulse, Homework Summary)
// keep their own existing distinct voices and must NOT use this preamble.
const STUVO_TUTOR_VOICE = `
You are the Stuvo Tutor, an AI study assistant for a school student.
- You already know the student's grade level and subject — never ask what you've already been told.
- Match explanation complexity to the student's grade: simpler analogies and shorter steps for grades 9-10, more technical depth for grades 11-12.
- Be encouraging and direct. Treat the student as capable. Never patronizing, never padded with filler phrases like "Great question!" or "Let's dive in!"
- Never invent facts, homework, or data not given to you in the prompt context.
`;

function isRetryableStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

// ─── Safe 429 diagnostics ─────────────────────────────────────
// Every upstream call gets a correlation id so a 429 can be traced through
// server logs without ever logging keys, auth headers, or user messages.
// Logs carry only: correlation id, model id, upstream HTTP status, and a
// short capped preview of the upstream error body.
let _openRouterReqSeq = 0;
function newCorrelationId() {
  _openRouterReqSeq = (_openRouterReqSeq + 1) % 1000000;
  return 'or-' + Date.now().toString(36) + '-' + _openRouterReqSeq.toString(36) + Math.random().toString(36).slice(2, 6);
}
function upstreamPreview(text) {
  return String(text || '').replace(/\s+/g, ' ').slice(0, 200);
}
function parseRetryAfterSecs(headers) {
  try {
    const raw = headers && typeof headers.get === 'function'
      ? headers.get('retry-after')
      : headers && (headers['retry-after'] || headers['Retry-After']);
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(String(raw).trim());
    if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 30);
    const t = Date.parse(String(raw));
    if (!isNaN(t)) return Math.min(Math.max(0, Math.round((t - Date.now()) / 1000)), 30);
  } catch (e) {}
  return 0;
}

// ─── Upstream error classification ────────────────────────────
// Per OpenRouter's errors documentation, provider failures arrive as
// {error: {code, message, metadata?: {error_type, provider_code, ...}}}.
// error_type is the stable field to branch on (rate_limit_exceeded,
// provider_overloaded, provider_unavailable, ...). provider_code carries
// the upstream provider's own code when available.
function parseUpstreamErrorBody(errText) {
  try {
    const parsed = JSON.parse(errText);
    const e = parsed && parsed.error;
    if (!e || typeof e !== 'object') return { code: 0, errorType: '', providerCode: '', providerName: '', message: '' };
    const md = e.metadata && typeof e.metadata === 'object' ? e.metadata : {};
    const pick = (...vals) => { for (const v of vals) if (typeof v === 'string' && v) return v; return ''; };
    return {
      code: Number(e.code) || 0,
      errorType: pick(md.error_type, md.errorType),
      providerCode: pick(md.provider_code, md.providerCode),
      providerName: pick(md.provider_name, md.providerName),
      message: typeof e.message === 'string' ? e.message : '',
    };
  } catch (x) {
    return { code: 0, errorType: '', providerCode: '', providerName: '', message: '' };
  }
}
// Rate-limit response headers, captured server-side on upstream 429s.
// OpenRouter documents X-RateLimit-Limit / -Remaining / -Reset on throttled
// responses. Values are reported raw (finite numbers) or null when the
// header is absent/unparseable — the daily-vs-per-minute call is made from
// the OBSERVED values in the incident report, never guessed in code.
function parseRateLimitHeaders(headers) {
  const out = { limit: null, remaining: null, reset: null };
  const rawOf = (key) => {
    try {
      if (headers && typeof headers.get === 'function') {
        const v = headers.get(key);
        return (v === null || v === undefined) ? '' : String(v);
      }
      if (headers && typeof headers === 'object') {
        const want = key.toLowerCase();
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === want && headers[k] !== undefined && headers[k] !== null && headers[k] !== '') return String(headers[k]);
        }
      }
    } catch (e) {}
    return '';
  };
  const numOf = (key) => {
    const raw = rawOf(key).trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  out.limit = numOf('x-ratelimit-limit');
  out.remaining = numOf('x-ratelimit-remaining');
  out.reset = numOf('x-ratelimit-reset');
  return out;
}
function hasRateLimitHeaders(rl) {
  return !!rl && (rl.limit !== null || rl.remaining !== null || rl.reset !== null);
}
function rateLimitScope(info, rl) {
  // 'platform': OpenRouter's own limiter spoke — via its documented
  //   X-RateLimit-* headers, or a typed platform error with no provider data.
  // 'provider': the serving provider throttled us (provider_code/name
  //   present, no platform headers) — a different vendor may succeed.
  // 'unknown': neither signal present — reported honestly as such.
  if (hasRateLimitHeaders(rl)) return 'platform';
  if (info && (info.providerCode || info.providerName)) return 'provider';
  if (info && info.errorType === 'rate_limit_exceeded') return 'platform';
  return 'unknown';
}
// Fills a 429 error with consistent safe diagnostics. Returns the parsed
// upstream info for logging. Never touches keys, headers, or prompts.
function attachRateLimitContext(e, errText, retryAfterSecs, triedModels, selectedModel, corrId, rl) {
  const info = parseUpstreamErrorBody(errText);
  e.status = 429;
  e.code = 'UPSTREAM_RATE_LIMIT';
  e.model = selectedModel;
  e.corrId = corrId;
  e.triedModels = triedModels;
  e.scope = rateLimitScope(info, rl);
  if (info.errorType) e.upstreamType = info.errorType;
  if (info.providerCode) e.providerCode = info.providerCode;
  if (info.providerName) e.providerName = info.providerName;
  if (hasRateLimitHeaders(rl)) e.rateLimit = { limit: rl.limit, remaining: rl.remaining, reset: rl.reset };
  if (retryAfterSecs > 0) e.retryAfter = retryAfterSecs;
  return info;
}

function isAuthErrorMessage(msg) {
  const m = String(msg || '');
  return /401|403|rejected the API key|invalid.*key|unauthorized|forbidden|402|payment|credits/i.test(m);
}

// ─── Structured failure codes (api/ai.js error contract) ────────
// Every throw from callOpenRouter carries a machine-readable `code` so the
// client can render the accurate user message instead of a generic one.
// Codes: daily_limit, rate_limited, model_unavailable, account_issue,
// bad_response, timeout, not_configured, upstream_error.
// Classification uses the REAL upstream status + error text (not invented
// matching): daily-cap detection keys off OpenRouter's documented free-tier
// phrasing ("daily", "per-day", "day quota") on HTTP 429 bodies.
function isDailyCapMessage(errText, info) {
  const hay = String((info && info.message) || '') + ' ' + String(errText || '');
  return /dail|per-day|per day|day.*quota|quota.*day|free-models-per-day|free.*tier.*limit/i.test(hay);
}
function isModelNotFoundMessage(errText, info, status) {
  if (status === 404) return true;
  const hay = String((info && info.message) || '') + ' ' + String(errText || '');
  return /no endpoints? found|model .*not (found|available)|unknown model|invalid model|data policy/i.test(hay);
}
function isDataPolicyMessage(errText, info) {
  const hay = String((info && info.message) || '') + ' ' + String(errText || '');
  return /data policy/i.test(hay);
}
// Classify a non-OK upstream response into the error contract. Returns
// { code, httpStatus, message } with user-safe text (capped, no key material
// — callers must pass only the body text, never headers).
function classifyUpstreamFailure(status, errText) {
  const info = parseUpstreamErrorBody(errText);
  const capped = upstreamPreview(errText).slice(0, 300);
  if (status === 401 || status === 403) {
    if (isDataPolicyMessage(errText, info)) {
      return { code: 'account_issue', httpStatus: status, message: 'The AI provider blocked this request because of the account data-policy setting. In the OpenRouter dashboard, go to Settings → Privacy and allow free-model endpoints, then try again.' };
    }
    return { code: 'account_issue', httpStatus: status, message: 'OpenRouter rejected the API key (HTTP ' + status + '). Ask the admin to check OPENROUTER_API_KEY.' };
  }
  if (status === 402) {
    return { code: 'account_issue', httpStatus: 402, message: 'OpenRouter credits are exhausted (HTTP 402). Free models need a non-negative balance — top up or wait, then try again.' };
  }
  if (status === 429) {
    if (isDailyCapMessage(errText, info)) {
      return { code: 'daily_limit', httpStatus: 429, message: "The AI's free daily limit has been reached. It resets daily — please try again later." };
    }
    return { code: 'rate_limited', httpStatus: 429, message: 'The AI is busy. Please try again later.' };
  }
  if (isModelNotFoundMessage(errText, info, status)) {
    if (isDataPolicyMessage(errText, info)) {
      return { code: 'account_issue', httpStatus: 502, message: 'The AI provider found no endpoint for this request because of the account data-policy setting. In the OpenRouter dashboard, go to Settings → Privacy and allow free-model endpoints, then try again.' };
    }
    return { code: 'model_unavailable', httpStatus: 502, message: 'The configured AI model is currently unavailable. Please try again in a bit.' };
  }
  return { code: 'upstream_error', httpStatus: 502, message: 'OpenRouter error (' + status + '): ' + capped };
}

// Some providers return message.content as an array of content parts
// ([{type:'text', text:'...'}]) instead of a plain string. Normalize to text
// so such responses aren't misclassified as empty.
function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') {
        if (typeof p.text === 'string') return p.text;
        if (typeof p.content === 'string') return p.content;
      }
      return '';
    }).join('');
  }
  return content;
}

async function callOpenRouter(prompt, model = null, attempt = 0, _triedModels = null, diagAction = '') {
  const corrId = newCorrelationId();
  // TEMP-DIAG (missing-response investigation): optional action label, used
  // ONLY in the structured log lines below so Vercel logs join each upstream
  // call to its /api/ai action. Never sent upstream, never logged with
  // prompts/keys/bodies. Remove when the investigation closes.
  const diagTag = diagAction ? ` action=${diagAction}` : ' action=legacy';
  const apiKey = getApiKey();
  if (!apiKey) {
    const e = new Error('OPENROUTER_API_KEY environment variable is not set. Add it in Vercel → Settings → Environment Variables (Production + Preview) and redeploy.');
    e.status = 500;
    e.code = 'not_configured';
    throw e;
  }

  // Single source of truth for model ids (env-overridable, resolved fresh
  // per request). An explicit per-call model still wins when it is in the
  // configured set; anything else falls back to the primary (this also keeps
  // stale hardcoded ids from old code paths from ever reaching upstream).
  const CONFIGURED = getModels();
  const DEFAULT_MODEL = CONFIGURED[0];
  let messages;
  let selectedModel = typeof model === 'object' && model !== null ? (model.model || DEFAULT_MODEL) : (model || DEFAULT_MODEL);
  if (!CONFIGURED.includes(selectedModel)) selectedModel = DEFAULT_MODEL;
  let max_tokens = 1000;
  let temperature = 0.7;

  if (Array.isArray(prompt)) {
    // Prepend FORMAT_STANDARD to existing messages
    const baseMessages = prompt.slice();
    if (baseMessages.length > 0 && baseMessages[0].role === 'system') {
      baseMessages[0] = { ...baseMessages[0], content: FORMAT_STANDARD.trim() + "\n\n" + baseMessages[0].content };
    } else {
      baseMessages.unshift({ role: 'system', content: FORMAT_STANDARD.trim() });
    }
    messages = baseMessages;
    if (typeof model === 'object' && model !== null) {
      if (model.maxTokens) max_tokens = model.maxTokens;
      if (model.temperature !== undefined) temperature = model.temperature;
    }
  } else {
    const fullPrompt = FORMAT_STANDARD.trim() + "\n\n" + String(prompt);
    messages = [{ role: "user", content: fullPrompt }];
  }

  // Controlled fallback: at most ONE fallback attempt per user request, and
  // ONLY for non-throttle failures (5xx, transport errors, malformed/empty
  // bodies). HTTP 429 / 429-in-body NEVER retries locally — the request
  // already carried `models: [primary, fallback]` for server-side
  // fall-through, and a second request into a throttle burns quota and
  // almost certainly 429s again on the same key. Throttle backoff belongs to
  // the client (Retry-After display + daily cap mode), not to this function.
  // This bounds provider load and keeps a single request inside the
  // serverless time budget (no blocking sleep on the 429 path anymore).
  const MAX_FALLBACKS_PER_REQUEST = 1;
  const triedModels = Array.isArray(_triedModels) ? _triedModels : [];
  const canRetry = attempt < MAX_FALLBACKS_PER_REQUEST;
  function pickFallbackModel() {
    // First configured model that is neither the just-failed model nor one
    // already tried for this request. Returns null when every configured
    // model is exhausted (caller then returns a retry-later JSON error
    // instead of looping).
    const seen = new Set([...triedModels, selectedModel]);
    return CONFIGURED.find(m => !seen.has(m)) || null;
  }
  const nextModelFor = () => pickFallbackModel() || CONFIGURED[attempt + 1];
  const withNextModel = () => {
    const nm = pickFallbackModel() || CONFIGURED[attempt + 1] || selectedModel;
    return typeof model === 'object' && model !== null ? { ...model, model: nm } : nm;
  };
  // Server-side fall-through list for this request: configured models minus
  // any already tried (never resend a model that already failed upstream).
  const serverFallbackModels = () => CONFIGURED.filter(m => ![...triedModels, selectedModel].includes(m));

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://stuvo-eosin.vercel.app",
          "X-Title": "Stuvo"
        },
        body: JSON.stringify({
          model: selectedModel,
          // Request-level fallbacks: OpenRouter falls through this list
          // server-side on rate limit / downtime in ONE request from us.
          models: [selectedModel, ...serverFallbackModels()].filter((m, i, a) => a.indexOf(m) === i),
          messages: messages,
          max_tokens: max_tokens,
          temperature: temperature
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Timeout / network error: transient — try next model once.
    if (err && err.name === 'AbortError') {
      const e = new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS / 1000}s (model ${selectedModel}). Please try again.`);
      e.status = 504;
      e.code = 'timeout';
      attachUpstreamContext(e, triedModels, selectedModel, corrId);
      if (canRetry) {
        console.warn(`[${corrId}] Timeout on ${selectedModel}, retrying with ${nextModelFor()}...`);
        return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
      }
      throw e;
    }
    if (canRetry && !isAuthErrorMessage(err && err.message)) {
      console.warn(`[${corrId}] Network error on attempt ${attempt} (${selectedModel}): ${err.message}. Retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const retryAfterSecs = parseRetryAfterSecs(response.headers);
    // Rate-limit response headers, captured server-side on upstream 429s
    // (absent object otherwise). Decides platform-vs-provider scope below.
    const rlHeaders = response.status === 429 ? parseRateLimitHeaders(response.headers) : { limit: null, remaining: null, reset: null };
    const upInfo = response.status === 429 ? parseUpstreamErrorBody(errText) : null;
    const scopeBit = upInfo ? ` scope=${rateLimitScope(upInfo, rlHeaders)}${upInfo.errorType ? ` type=${upInfo.errorType}` : ''}` : '';
    console.warn(`[${corrId}] Model ${selectedModel} returned HTTP ${response.status}${retryAfterSecs ? ` (Retry-After: ${retryAfterSecs}s)` : ''}${scopeBit}: ${upstreamPreview(errText)}`);
    // TEMP-DIAG: one structured line per non-OK upstream response. Fields:
    // action (from /api/ai), upstream HTTP status, model, corrId, sanitized
    // error type (parsed code only — never body text), Retry-After secs,
    // X-RateLimit-Limit/Remaining/Reset as observed (null when absent),
    // provider_name/provider_code as observed (empty when absent).
    try {
      const _di = parseUpstreamErrorBody(errText);
      console.warn(`[TEMP-DIAG]${diagTag} upstreamStatus=${response.status} model=${selectedModel} corrId=${corrId} errType=${_di.errorType || ('code' + (_di.code || response.status))} retryAfterSec=${retryAfterSecs} rlLimit=${rlHeaders.limit === null ? 'null' : rlHeaders.limit} rlRemaining=${rlHeaders.remaining === null ? 'null' : rlHeaders.remaining} rlReset=${rlHeaders.reset === null ? 'null' : rlHeaders.reset} providerName=${_di.providerName || 'none'} providerCode=${_di.providerCode || 'none'}`);
    } catch (e) {}
    // Structured classification FIRST so every failure below carries the
    // contract code even when it also gets a local single-fallback attempt.
    const classified = classifyUpstreamFailure(response.status, errText);
    const applyClass = (e) => {
      e.status = classified.httpStatus;
      e.code = classified.code;
      e.model = selectedModel;
      e.corrId = corrId;
      e.triedModels = [...triedModels, selectedModel].slice(0, 5);
      const upInfo2 = parseUpstreamErrorBody(errText);
      e.scope = rateLimitScope(upInfo2, rlHeaders);
      if (upInfo2.errorType) e.upstreamType = upInfo2.errorType;
      if (upInfo2.providerCode) e.providerCode = upInfo2.providerCode;
      if (upInfo2.providerName) e.providerName = upInfo2.providerName;
      if (hasRateLimitHeaders(rlHeaders)) e.rateLimit = { limit: rlHeaders.limit, remaining: rlHeaders.remaining, reset: rlHeaders.reset };
      if (retryAfterSecs > 0) e.retryAfter = retryAfterSecs;
      return e;
    };
    if (response.status === 401 || response.status === 403) {
      throw applyClass(new Error(classified.message)); // never retry auth failures across models
    }
    if (response.status === 402) {
      throw applyClass(new Error(classified.message));
    }
    if (response.status === 429) {
      // Throttled: NEVER send a second upstream request for this user action.
      // The request already carried `models: [primary, fallback]`, so the
      // gateway had its server-side fall-through chance inside that single
      // request; firing another one seconds later on the same key almost
      // certainly 429s again and burns scarce quota. Fail fast with the
      // classified error + Retry-After — the CLIENT owns the wait (cap mode /
      // "about N seconds"), which is where backoff actually helps.
      const e = applyClass(new Error(classified.message));
      e.upstreamType = e.upstreamType || 'rate_limit_exceeded';
      throw e;
    }
    if (isRetryableStatus(response.status) && canRetry) {
      console.log(`[${corrId}] Retrying with fallback model ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    const e = applyClass(new Error(classified.message));
    throw e;
  }

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    const err = new Error("OpenRouter returned non-JSON response. Please try again.");
    err.status = 502;
    err.code = 'bad_response';
    attachUpstreamContext(err, triedModels, selectedModel, corrId);
    if (canRetry) {
      console.warn(`[${corrId}] Non-JSON from ${selectedModel}, retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    throw err;
  }

  if (data.error) {
    const msg = String((data.error && data.error.message) || "OpenRouter error");
    // A provider failure can arrive as HTTP 200 with an error body (the
    // status line was already committed upstream). A 429 in the body must
    // be handled exactly like an HTTP 429 — never as a generic 502.
    const bodyInfo = parseUpstreamErrorBody(JSON.stringify(data));
    const isRateLimitBody = Number(data.error && data.error.code) === 429 || bodyInfo.errorType === 'rate_limit_exceeded';
    if (isRateLimitBody) {
      // Same no-second-request rule as HTTP 429 above: the gateway already
      // had its fall-through chance via the `models` array in this request.
      const retryAfterSecs = parseRetryAfterSecs(response.headers);
      const rlBody = parseRateLimitHeaders(response.headers);
      const bodyText = JSON.stringify(data.error);
      try {
        console.warn(`[TEMP-DIAG]${diagTag} upstreamStatus=200-body-429 model=${selectedModel} corrId=${corrId} errType=${bodyInfo.errorType || ('code' + (bodyInfo.code || 429))} retryAfterSec=${retryAfterSecs} rlLimit=${rlBody.limit === null ? 'null' : rlBody.limit} rlRemaining=${rlBody.remaining === null ? 'null' : rlBody.remaining} rlReset=${rlBody.reset === null ? 'null' : rlBody.reset} providerName=${bodyInfo.providerName || 'none'} providerCode=${bodyInfo.providerCode || 'none'}`);
      } catch (x) {}
      const cls = isDailyCapMessage(bodyText, bodyInfo)
        ? { code: 'daily_limit', httpStatus: 429, message: "The AI's free daily limit has been reached. It resets daily — please try again later." }
        : { code: 'rate_limited', httpStatus: 429, message: 'The AI is busy. Please try again later.' };
      const e = new Error(cls.message);
      e.status = cls.httpStatus;
      // attachRateLimitContext fills scope/model/corrId/retryAfter diagnostics
      // (it also stamps the legacy UPSTREAM_RATE_LIMIT marker, which is kept
      // for older clients) — then restore the contract code on top.
      attachRateLimitContext(e, bodyText, retryAfterSecs, [...triedModels, selectedModel], selectedModel, corrId, rlBody);
      e.code = cls.code;
      throw e;
    }
    if (!isAuthErrorMessage(msg) && canRetry) {
      console.warn(`[${corrId}] Provider error on ${selectedModel}: ${upstreamPreview(msg)}. Retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    // Classify the terminal provider error the same way as an HTTP failure
    // so a 200-with-error-body never surfaces as a generic 502.
    const termCls = classifyUpstreamFailure(Number((data.error && data.error.code) || 0) || 502, JSON.stringify(data.error));
    const e = new Error(termCls.code === 'upstream_error' ? msg.slice(0, 300) : termCls.message);
    e.status = termCls.httpStatus;
    e.code = termCls.code;
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    throw e;
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    const e = new Error("OpenRouter returned an incomplete response structure (missing choices). Please try again.");
    e.status = 502;
    e.code = 'bad_response';
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    if (canRetry) {
      console.warn(`[${corrId}] Missing choices/message from ${selectedModel}, retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    throw e;
  }

  // Classify the actual shape before extracting — models do not all return
  // identical structures (string vs multipart array vs null vs refusal).
  const meta = describeUpstreamResult(data);
  if (!meta.hasMessage) {
    // describeUpstreamResult disagrees with the guard above only for exotic
    // shapes (e.g. message is a string, not an object) — still malformed.
    const e = new Error("OpenRouter returned an incomplete response structure (missing choices). Please try again.");
    e.status = 502;
    e.code = 'bad_response';
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    if (canRetry) return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    throw e;
  }
  console.log(`[${corrId}] ${selectedModel} HTTP 200 ${metaLog(meta)}`);
  // TEMP-DIAG: one structured line per HTTP-200 upstream response, BEFORE
  // content extraction — this is the line that settles "tokens logged but
  // nothing displayed": contentExists/contentLen/finishReason show exactly
  // what shape arrived. No bodies, prompts, or keys.
  try {
    console.log(`[TEMP-DIAG]${diagTag} upstreamStatus=200 model=${selectedModel} corrId=${corrId} contentExists=${meta.contentType !== 'null' && meta.contentType !== 'missing'} contentType=${meta.contentType} contentLen=${meta.contentLen} finishReason=${meta.finishReason || 'none'} refusal=${meta.hasRefusal ? 'yes' : 'no'}`);
  } catch (e) {}

  if (meta.hasRefusal || REFUSAL_FINISH_REASONS.includes(meta.finishReason || '')) {
    // A refusal or safety-filter stop is decisive: trying another model to
    // get around it would be wrong, so there is NO fallback here. Never
    // invent substitute content either — fail visibly with a clear message.
    const e = new Error("The model declined to respond to that request. Please try rephrasing your prompt.");
    e.status = 502;
    e.code = 'upstream_error'; // refusal: decisive, no fallback; message stays specific
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    throw e;
  }

  const rawContent = data.choices[0].message.content;
  if (rawContent === null || typeof rawContent === 'undefined') {
    // Distinct from empty-string: the provider sent an explicit null, which
    // usually means the generation produced nothing at all (capacity hiccup
    // on free-tier models). One controlled fallback, then an honest error.
    const e = new Error("The AI model returned no content. Please try again.");
    e.status = 502;
    e.code = 'bad_response';
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    if (canRetry) {
      console.warn(`[${corrId}] Null content from ${selectedModel}, retrying once with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    throw e;
  }

  // Documented schema: content is a string or an array of content parts
  // ([{type:'text', text:'...'}]); normalizeContent extracts text parts only.
  const content = normalizeContent(rawContent);
  if (typeof content !== 'string' || String(content).trim().length === 0) {
    const e = new Error(
      typeof content !== 'string'
        ? "OpenRouter returned content in an unexpected format. Please try again."
        : "The AI model returned an empty response. Please try again."
    );
    e.status = 502;
    e.code = 'bad_response';
    attachUpstreamContext(e, triedModels, selectedModel, corrId);
    if (canRetry) {
      console.warn(`[${corrId}] ${metaLog(meta)} from ${selectedModel}, retrying once with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...triedModels, selectedModel], diagAction);
    }
    throw e;
  }

  if (meta.truncated) {
    // finish_reason=length with usable partial text: return what the model
    // produced (callers that need strict JSON still validate and fail
    // loudly via their own schema checks) and log it for diagnosis.
    console.warn(`[${corrId}] Truncated response (finish_reason=length) from ${selectedModel}; returning partial output.`);
  }

  return content;
}

// ─── Upstream result classification ─────────────────────────────
// Inspects the ACTUAL provider response shape before extracting text, so
// each failure mode (missing choices, refusal/filter, null content, empty
// text, malformed body) gets a distinct, accurately-coded error instead of
// one generic 502. Captures metadata only — never prompts, keys, or bodies.
const REFUSAL_FINISH_REASONS = ['content_filter'];
// Attaches safe failure context (last model, correlation id, every model
// attempted this request) to an error WITHOUT touching prompts, keys, or
// bodies. api/ai.js forwards these fields into the JSON error so future
// incidents (e.g. a null-content fallback) self-describe which models were
// tried, even when server logs are unavailable.
function attachUpstreamContext(e, triedModels, selectedModel, corrId) {
  e.model = selectedModel;
  e.corrId = corrId;
  const tried = [...(Array.isArray(triedModels) ? triedModels : [])];
  if (!tried.includes(selectedModel)) tried.push(selectedModel);
  if (tried.length) e.triedModels = tried.slice(0, 5);
  return e;
}
function describeUpstreamResult(data) {
  const meta = {
    hasChoices: !!(data && Array.isArray(data.choices)),
    choicesLen: data && Array.isArray(data.choices) ? data.choices.length : 0,
    hasMessage: !!(data && data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message === 'object'),
    contentType: 'missing', contentLen: 0,
    finishReason: null, hasRefusal: false, truncated: false,
  };
  try {
    const choice = data && data.choices && data.choices[0];
    if (choice && choice.finish_reason !== undefined && choice.finish_reason !== null) {
      meta.finishReason = String(choice.finish_reason);
    }
    const msg = choice && choice.message;
    if (msg && typeof msg === 'object') {
      if (typeof msg.refusal === 'string' && msg.refusal.trim()) meta.hasRefusal = true;
      const c = msg.content;
      if (typeof c === 'string') { meta.contentType = 'string'; meta.contentLen = c.length; }
      else if (Array.isArray(c)) { meta.contentType = 'array'; meta.contentLen = c.length; }
      else if (c === null) meta.contentType = 'null';
      else if (typeof c === 'undefined') meta.contentType = 'missing';
      else meta.contentType = typeof c;
    }
    meta.truncated = meta.finishReason === 'length';
  } catch (e) {}
  return meta;
}
function metaLog(meta) {
  const size = (meta.contentType === 'string' || meta.contentType === 'array') ? `(${meta.contentLen})` : '';
  return `choices=${meta.hasChoices ? meta.choicesLen : 'none'} message=${meta.hasMessage ? 'yes' : 'no'} content=${meta.contentType}${size} finish=${meta.finishReason || 'none'} refusal=${meta.hasRefusal ? 'yes' : 'no'}${meta.truncated ? ' TRUNCATED' : ''}`;
}

function parseJSON(text) {
  if (text === null || text === undefined || String(text).trim().length === 0) throw new Error('Empty response');
  const str = String(text);
  try {
    return JSON.parse(str);
  } catch (e) {}

  const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {}
  }

  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(str.slice(firstBrace, lastBrace + 1));
    } catch (e) {}
  }

  const firstBracket = str.indexOf('[');
  const lastBracket = str.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(str.slice(firstBracket, lastBracket + 1));
    } catch (e) {}
  }

  const clean = str.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function cleanMathFormatting(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\$\$(.*?)\$\$/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .trim();
}

module.exports = { callOpenRouter, parseJSON, cleanMathFormatting, normalizeContent, describeUpstreamResult, attachUpstreamContext, parseUpstreamErrorBody, rateLimitScope, parseRateLimitHeaders, hasRateLimitHeaders, classifyUpstreamFailure, getModels, modelVendor, FORMAT_STANDARD, STUVO_TUTOR_VOICE, getApiKey, MODELS, REQUEST_TIMEOUT_MS, parseRetryAfterSecs, upstreamPreview };
