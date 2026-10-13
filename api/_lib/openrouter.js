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

const MODELS = [
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
  "google/gemma-4-26b-a4b-it:free"
];

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

function isAuthErrorMessage(msg) {
  const m = String(msg || '');
  return /401|403|rejected the API key|invalid.*key|unauthorized|forbidden|402|payment|credits/i.test(m);
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

async function callOpenRouter(prompt, model = MODELS[0], attempt = 0, _tried429 = null) {
  const corrId = newCorrelationId();
  const apiKey = getApiKey();
  if (!apiKey) {
    const e = new Error("OPENROUTER_API_KEY environment variable is not set.");
    e.status = 500;
    throw e;
  }

  let messages;
  let selectedModel = typeof model === 'object' && model !== null ? (model.model || MODELS[0]) : model;
  // Guard against stale/invalid model ids persisted in old code paths.
  if (!MODELS.includes(selectedModel)) selectedModel = MODELS[0];
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

  // Controlled fallback: at most ONE fallback attempt per user request
  // (primary + one fallback = max 2 upstream calls). This bounds provider
  // load, keeps a single request inside the serverless time budget, and
  // guarantees a model that returned 429 is never tried twice below.
  const MAX_FALLBACKS_PER_REQUEST = 1;
  const tried429 = Array.isArray(_tried429) ? _tried429 : [];
  const canRetry = attempt < MAX_FALLBACKS_PER_REQUEST;
  function pickFallbackModel() {
    // First configured model that is neither the just-failed model nor one
    // already rate-limited for this request. Returns null when every
    // configured model is exhausted (caller then returns a retry-later
    // JSON error instead of looping).
    const seen = new Set([...tried429, selectedModel]);
    return MODELS.find(m => !seen.has(m)) || null;
  }
  const nextModelFor = () => pickFallbackModel() || MODELS[attempt + 1];
  const withNextModel = () => {
    const nm = pickFallbackModel() || MODELS[attempt + 1] || selectedModel;
    return typeof model === 'object' && model !== null ? { ...model, model: nm } : nm;
  };

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
      if (canRetry) {
        console.warn(`[${corrId}] Timeout on ${selectedModel}, retrying with ${nextModelFor()}...`);
        return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
      }
      throw e;
    }
    if (canRetry && !isAuthErrorMessage(err && err.message)) {
      console.warn(`[${corrId}] Network error on attempt ${attempt} (${selectedModel}): ${err.message}. Retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    }
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const retryAfterSecs = parseRetryAfterSecs(response.headers);
    console.warn(`[${corrId}] Model ${selectedModel} returned HTTP ${response.status}${retryAfterSecs ? ` (Retry-After: ${retryAfterSecs}s)` : ''}: ${upstreamPreview(errText)}`);
    if (response.status === 401 || response.status === 403) {
      const e = new Error("OpenRouter rejected the API key (HTTP " + response.status + "). Ask the admin to check OPENROUTER_API_KEY.");
      e.status = 500;
      throw e; // never retry auth failures across models
    }
    if (response.status === 402) {
      const e = new Error("OpenRouter quota/credits exhausted (HTTP 402). Try again later.");
      e.status = 502;
      throw e;
    }
    if (isRetryableStatus(response.status) && canRetry) {
      if (response.status === 429) {
        const tried = [...tried429, selectedModel];
        const fb = pickFallbackModel();
        if (!fb) {
          // Every configured model already returned 429 for this request —
          // stop here and tell the user to retry later (never loop).
          const e = new Error("OpenRouter rate limit reached (HTTP 429). Wait a minute and try again.");
          e.status = 429;
          e.code = 'UPSTREAM_RATE_LIMIT';
          e.model = selectedModel;
          e.corrId = corrId;
          e.triedModels = tried;
          if (retryAfterSecs > 0) e.retryAfter = retryAfterSecs;
          throw e;
        }
        console.log(`[${corrId}] 429 on ${selectedModel}; single fallback to ${fb}...`);
        // Respect legitimate Retry-After when provided, bounded so a single
        // user request can never stall a serverless function: at most 5s here.
        // The full value is still propagated to the client (e.retryAfter),
        // which is where the real wait happens — the user retries after that
        // delay. No tight-loop retries: one fallback attempt per request max.
        const waitSecs = retryAfterSecs > 0 ? Math.min(retryAfterSecs, 5) : (attempt + 1);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        return callOpenRouter(prompt, withNextModel(), attempt + 1, tried);
      }
      console.log(`[${corrId}] Retrying with fallback model ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    }
    const e = new Error(response.status === 429
      ? "OpenRouter rate limit reached (HTTP 429). Wait a minute and try again."
      : `OpenRouter error (${response.status}): ${upstreamPreview(errText).slice(0, 300)}`);
    e.status = response.status === 429 ? 429 : 502;
    if (response.status === 429) {
      // Coded so api/ai.js and the client can distinguish provider rate
      // limits from our own application limiter. `model` is the last model
      // attempted; `triedModels` lists every model rate-limited this request.
      e.code = 'UPSTREAM_RATE_LIMIT';
      e.model = selectedModel;
      e.corrId = corrId;
      e.triedModels = [...tried429, selectedModel];
      if (retryAfterSecs > 0) e.retryAfter = retryAfterSecs;
    }
    throw e;
  }

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    const err = new Error("OpenRouter returned non-JSON response. Please try again.");
    err.status = 502;
    if (canRetry) {
      console.warn(`[${corrId}] Non-JSON from ${selectedModel}, retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    }
    throw err;
  }

  if (data.error) {
    const msg = String((data.error && data.error.message) || "OpenRouter error");
    if (!isAuthErrorMessage(msg) && canRetry) {
      console.warn(`[${corrId}] Provider error on ${selectedModel}: ${upstreamPreview(msg)}. Retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    }
    const e = new Error(msg.slice(0, 300));
    e.status = 502;
    throw e;
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    const e = new Error("Unexpected OpenRouter response structure (missing choices). Please try again.");
    e.status = 502;
    if (canRetry) return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    throw e;
  }

  const content = normalizeContent(data.choices[0].message.content);
  if (content === null || content === undefined || String(content).trim().length === 0) {
    const e = new Error("The AI model returned an empty response. Please try again.");
    e.status = 502;
    if (canRetry) {
      console.warn(`[${corrId}] Empty content from ${selectedModel}, retrying with ${nextModelFor()}...`);
      return callOpenRouter(prompt, withNextModel(), attempt + 1, [...tried429]);
    }
    throw e;
  }

  return content;
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

module.exports = { callOpenRouter, parseJSON, cleanMathFormatting, normalizeContent, FORMAT_STANDARD, STUVO_TUTOR_VOICE, getApiKey, MODELS, REQUEST_TIMEOUT_MS, parseRetryAfterSecs, upstreamPreview };
