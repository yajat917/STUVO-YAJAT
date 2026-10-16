// Quota-free error-mapping tests (checklist item 8 / item 2).
// Stubs global.fetch so NO real OpenRouter request is ever sent (0 quota).
// Covers: 429 with/without Retry-After, daily-cap 429 message, 401, 402,
// 404 model, 500, empty content, invalid JSON, null content, timeout,
// not_configured, wellbeing escalation-on-failure, and the api/ai.js error
// contract { ok:false, code, message, retryAfterSec? } + HTTP status.
// Client-message cases load the REAL aiErrorTextFor/isConnectivityError
// source from stuvo/components.js (brace-matched extraction, stubbed t()).
process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-stub-key';
const assert = require('assert');
const fs = require('fs');
const or = require('../api/_lib/openrouter');
const aiHandler = require('../api/ai');

function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert(start !== -1, 'function ' + name + ' found in components.js');
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const compSrc = fs.readFileSync(__dirname + '/../stuvo/components.js', 'utf8');
global.__translations = {};
const stubT = (k, d, p) => {
  if (Object.prototype.hasOwnProperty.call(global.__translations, k)) {
    let s = global.__translations[k];
    if (p && typeof p === 'object') Object.keys(p).forEach(key => { s = String(s).replace('{' + key + '}', String(p[key])); });
    return s;
  }
  return typeof d === 'string' ? d : k;
};
const aiErrorTextFor = new Function('t', 'aiSetupHint', extractFn(compSrc, 'aiErrorTextFor') + '; return aiErrorTextFor;')(stubT, () => '[setup-hint]');
const isConnectivityError = new Function('navigator', extractFn(compSrc, 'isConnectivityError') + '; return isConnectivityError;')({ onLine: true });

let stubQueue = [];
const seenRequests = [];
global.fetch = async (url, opts) => {
  seenRequests.push({ url, body: JSON.parse(opts.body) });
  const next = stubQueue.shift();
  if (!next) throw new Error('stub queue empty — unexpected fetch');
  if (next instanceof Error) throw next;
  return next;
};
function resp({ status = 200, json = undefined, text = undefined, headers = {} }) {
  const raw = text !== undefined ? text : JSON.stringify(json);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (headers[k.toLowerCase()] !== undefined ? String(headers[k.toLowerCase()]) : null) },
    text: async () => raw,
  };
}
const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };

function mockRes() {
  return {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(data) { this.data = data; return this; },
  };
}

let passed = 0;
async function expectCall(name, stubs, fn, check) {
  stubQueue = stubs.slice();
  seenRequests.length = 0;
  try {
    const out = await fn();
    check(null, out);
  } catch (e) {
    check(e, null);
  }
  passed++;
  console.log('ok -', name);
}

(async () => {
  // 1. 429 with Retry-After, no fallback left → rate_limited + retryAfter
  // (lib caps honored Retry-After at 30s: header 45 → 30)
  await expectCall(
    '429 + Retry-After, exhausted models → rate_limited/429',
    [resp({ status: 429, json: { error: { code: 429, message: 'Rate limit exceeded', metadata: {} } }, headers: { 'retry-after': '45' } })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e, 'should throw'); assert.strictEqual(e.code, 'rate_limited'); assert.strictEqual(e.status, 429); assert.strictEqual(e.retryAfter, 30); }
  );

  // 2. Daily-cap 429 phrasing → daily_limit
  await expectCall(
    '429 daily-cap message → daily_limit/429',
    [resp({ status: 429, json: { error: { code: 429, message: 'Rate limit exceeded: free-models-per-day', metadata: { error_type: 'rate_limit_exceeded' } } } })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e, 'should throw'); assert.strictEqual(e.code, 'daily_limit'); assert.strictEqual(e.status, 429); assert(/daily/i.test(e.message)); }
  );

  // 3. 401 → account_issue
  await expectCall(
    '401 → account_issue',
    [resp({ status: 401, json: { error: { code: 401, message: 'Invalid API key' } } })],
    () => or.callOpenRouter('hi'),
    (e) => { assert(e); assert.strictEqual(e.code, 'account_issue'); }
  );

  // 4. 402 → account_issue
  await expectCall(
    '402 → account_issue',
    [resp({ status: 402, json: { error: { code: 402, message: 'Insufficient credits' } } })],
    () => or.callOpenRouter('hi'),
    (e) => { assert(e); assert.strictEqual(e.code, 'account_issue'); assert.strictEqual(e.status, 402); }
  );

  // 5. 404 model → model_unavailable (never surfaced as raw 404 to client contract; lib uses 502)
  await expectCall(
    '404 model → model_unavailable',
    [resp({ status: 404, json: { error: { code: 404, message: 'Model not found' } } })],
    () => or.callOpenRouter('hi', or.getModels()[0], 99, or.getModels()),
    (e) => { assert(e); assert.strictEqual(e.code, 'model_unavailable'); }
  );

  // 6. 500 terminal (no fallback left) → upstream_error/502
  await expectCall(
    '500 → upstream_error/502',
    [resp({ status: 500, json: { error: { code: 500, message: 'Provider boom' } } })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e); assert.strictEqual(e.code, 'upstream_error'); assert.strictEqual(e.status, 502); }
  );

  // 7. Empty content → bad_response
  await expectCall(
    '200 empty content, exhausted → bad_response',
    [resp({ status: 200, json: { choices: [{ message: { content: '   ' }, finish_reason: 'stop' }] } })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e); assert.strictEqual(e.code, 'bad_response'); assert.strictEqual(e.status, 502); }
  );

  // 8. Null content → bad_response
  await expectCall(
    '200 null content, exhausted → bad_response',
    [resp({ status: 200, json: { choices: [{ message: { content: null }, finish_reason: 'stop' }] } })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e); assert.strictEqual(e.code, 'bad_response'); }
  );

  // 9. Non-JSON → bad_response
  await expectCall(
    '200 non-JSON, exhausted → bad_response',
    [resp({ status: 200, text: '<html>nope</html>' })],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e); assert.strictEqual(e.code, 'bad_response'); }
  );

  // 10. Timeout → timeout/504
  await expectCall(
    'AbortError, exhausted → timeout/504',
    [abortErr()],
    () => or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']),
    (e) => { assert(e); assert.strictEqual(e.code, 'timeout'); assert.strictEqual(e.status, 504); }
  );

  // 11. No key → not_configured/500
  {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      await or.callOpenRouter('hi');
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'not_configured');
      assert.strictEqual(e.status, 500);
    }
    process.env.OPENROUTER_API_KEY = saved;
    passed++;
    console.log('ok - missing key → not_configured/500');
  }

  // 12. Data-policy 404 → account_issue with Privacy steps
  await expectCall(
    '404 data-policy → account_issue w/ Privacy fix',
    [resp({ status: 404, json: { error: { code: 404, message: 'No endpoints found matching your data policy' } } })],
    () => or.callOpenRouter('hi', or.getModels()[0], 99, or.getModels()),
    (e) => { assert(e); assert.strictEqual(e.code, 'account_issue'); assert(/Privacy/.test(e.message)); }
  );

  // 13. models array sent in ONE request (success path = 1 upstream call)
  stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: ' Paris. ' }, finish_reason: 'stop' }] } })];
  seenRequests.length = 0;
  {
    const out = await or.callOpenRouter('capital of France?');
    assert.strictEqual(out.trim(), 'Paris.');
    assert.strictEqual(seenRequests.length, 1, 'exactly one upstream request');
    assert(Array.isArray(seenRequests[0].body.models) && seenRequests[0].body.models.length >= 1, 'models array present');
    assert.strictEqual(seenRequests[0].body.model, seenRequests[0].body.models[0], 'model == models[0]');
    passed++;
    console.log('ok - single request carries models array; 1 upstream call on success');
  }

  // 14. api/ai.js contract: daily_limit → { ok:false, code, message, retryAfterSec } + 429
  // Throttle path sends EXACTLY ONE upstream request (no local fallback into
  // a throttle) and fails fast (no blocking sleep).
  {
    const res = mockRes();
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'free-models-per-day exhausted', metadata: {} } }, headers: { 'retry-after': '30' } }),
    ];
    seenRequests.length = 0;
    const t0 = Date.now();
    await aiHandler({ method: 'POST', body: { action: 'doubt', question: '2+2?' } }, res);
    const elapsed = Date.now() - t0;
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.code, 'daily_limit');
    assert(/daily/i.test(res.data.message));
    assert.strictEqual(res.data.retryAfterSec, 30);
    assert.strictEqual(seenRequests.length, 1, 'exactly one upstream request on throttle path');
    assert(elapsed < 3000, 'fails fast without blocking sleep, took ' + elapsed + 'ms');
    assert(!JSON.stringify(res.data).includes('sk-or-v1-test'), 'no key material in payload');
    passed++;
    console.log('ok - /api/ai contract for daily_limit (429, ok:false, retryAfterSec, 1 upstream call)');
  }

  // 14b. Non-daily HTTP 429 with fallback still available → immediate
  // rate_limited, exactly 1 upstream fetch, no sleep.
  {
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'Rate limit exceeded, try again in a bit', metadata: {} } }, headers: { 'retry-after': '20' } }),
    ];
    seenRequests.length = 0;
    const t0 = Date.now();
    try {
      await or.callOpenRouter('hi'); // fallback model available, must NOT be used
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'rate_limited');
      assert.strictEqual(e.retryAfter, 20);
    }
    assert.strictEqual(seenRequests.length, 1, 'no local retry into a throttle');
    assert(Date.now() - t0 < 3000, 'no blocking sleep on 429 path');
    passed++;
    console.log('ok - HTTP 429 → single upstream request, immediate rate_limited');
  }

  // 15. Wellbeing: AI fails on crisis message → error still carries escalationFlag
  stubQueue = [
    resp({ status: 500, json: { error: { code: 500, message: 'down' } } }),
    resp({ status: 500, json: { error: { code: 500, message: 'down' } } }),
  ];
  {
    const res = mockRes();
    await aiHandler({ method: 'POST', body: { action: 'wellbeingAssistant', message: 'I want to hurt myself' } }, res);
    assert.strictEqual(res.statusCode, 502);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.escalationFlag, true, 'escalation survives AI failure');
    passed++;
    console.log('ok - wellbeing failure carries escalationFlag=true');
  }

  // 16. Wellbeing: non-crisis failure → escalationFlag false present
  stubQueue = [
    resp({ status: 500, json: { error: { code: 500, message: 'down' } } }),
    resp({ status: 500, json: { error: { code: 500, message: 'down' } } }),
  ];
  {
    const res = mockRes();
    await aiHandler({ method: 'POST', body: { action: 'wellbeingAssistant', message: 'exam stress tips?' } }, res);
    assert.strictEqual(res.data.escalationFlag, false);
    passed++;
    console.log('ok - wellbeing failure carries escalationFlag=false');
  }

  // 17. Env override: bogus primary → still attempted upstream (not reset), 404 → model_unavailable
  {
    process.env.OPENROUTER_MODEL = 'no-such-model-xyz:free';
    assert.strictEqual(or.getModels()[0], 'no-such-model-xyz:free');
    stubQueue = [
      resp({ status: 404, json: { error: { code: 404, message: 'Model not found' } } }),
      resp({ status: 404, json: { error: { code: 404, message: 'Model not found' } } }),
    ];
    seenRequests.length = 0;
    try {
      await or.callOpenRouter('hi');
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'model_unavailable');
      assert.strictEqual(seenRequests[0].body.model, 'no-such-model-xyz:free', 'bogus env id reaches upstream (proves check item 9 path)');
    }
    delete process.env.OPENROUTER_MODEL;
    passed++;
    console.log('ok - OPENROUTER_MODEL override honored; bogus id → model_unavailable');
  }

  // 18. Client: 429 with Retry-After 30 → message names ~30 seconds, no "minute"
  {
    const msg = aiErrorTextFor('rate_limited', '', 30);
    assert(/about 30 seconds/.test(msg), 'mentions about 30 seconds, got: ' + msg);
    assert(!/minute/i.test(msg), 'no invented minute, got: ' + msg);
    passed++;
    console.log('ok - client rate_limited + Retry-After 30 → "about 30 seconds"');
  }

  // 19. Client: generic 429 (no wait) → rate_limited message, no invented wait
  {
    const msg = aiErrorTextFor('rate_limited', '', 0);
    assert(!/minute/i.test(msg) && !/\d+\s*s(ec)?/i.test(msg), 'no invented wait, got: ' + msg);
    assert(/try again later/i.test(msg), 'got: ' + msg);
    passed++;
    console.log('ok - client generic 429 → rate_limited, no invented wait');
  }

  // 20. Client: daily_limit → daily text (never a minute-wait)
  {
    const msg = aiErrorTextFor('daily_limit', '', 0);
    assert(/daily limit/i.test(msg) && /resets daily/i.test(msg), 'got: ' + msg);
    passed++;
    console.log('ok - client daily_limit → daily-cap message');
  }

  // 21. Client: structured server errors are NEVER connectivity errors
  {
    for (const code of ['daily_limit', 'rate_limited', 'model_unavailable', 'account_issue', 'bad_response', 'timeout', 'not_configured', 'upstream_error']) {
      const err = new Error(code + ' happened'); err.code = code;
      assert.strictEqual(isConnectivityError(err), false, code + ' must not be connectivity');
    }
    passed++;
    console.log('ok - no contract code is ever classified as connectivity');
  }

  // 22. Client: genuine fetch failure IS connectivity; offline navigator IS too
  {
    assert.strictEqual(isConnectivityError(new Error('Failed to fetch')), true);
    assert.strictEqual(isConnectivityError(new Error('Load failed')), true);
    assert.strictEqual(isConnectivityError(new Error('Network request failed: could not reach the AI service. Please check your connection and try again.')), true);
    const offlineCheck = new Function('navigator', extractFn(compSrc, 'isConnectivityError') + '; return isConnectivityError;')({ onLine: false });
    assert.strictEqual(offlineCheck(new Error('anything')), true);
    // Non-network plain error (e.g. missing-key fallback) is NOT connectivity
    assert.strictEqual(isConnectivityError(new Error('AI service unavailable: no API key found.')), false);
    passed++;
    console.log('ok - connectivity detected only for real fetch/offline failures');
  }

  // 23. Client: t() passthrough — translated strings win when present
  {
    global.__translations['ai.err_rate_limited_wait'] = 'KI busy. {n} sek me dobara.';
    const msg = aiErrorTextFor('rate_limited', '', 30);
    assert(/30/.test(msg) && /KI busy/.test(msg), 'got: ' + msg);
    delete global.__translations['ai.err_rate_limited_wait'];
    passed++;
    console.log('ok - client messages render through t() with interpolation');
  }

  // 24. Success path end-to-end: upstream plain text → doubt {answer}.
  // Proves the contract fields the website reads when upstream is healthy.
  {
    stubQueue = [
      resp({ status: 200, json: { choices: [{ message: { content: '1. Add 2 and 2.\nAnswer: 4' }, finish_reason: 'stop' }] } }),
    ];
    const res = mockRes();
    await aiHandler({ method: 'POST', body: { action: 'doubt', question: '2+2?' } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert(/Answer: 4/.test(res.data.answer), 'got: ' + JSON.stringify(res.data));
    passed++;
    console.log('ok - doubt success end-to-end returns {answer}');
  }

  // 25. Quiz with prose-wrapped + fenced JSON array (realistic free-model
  // output) → {questions} parsed. This is the "tokens logged but site
  // empty" parse path: if THIS passes, a quiz failure means the upstream
  // shape itself was unusable (null/empty), not our parser.
  {
    const fence = 'Here are your questions:\n```json\n[{"question":"Q1?","options":["A","B","C","D"],"correctIndex":1,"explanation":"E1"},{"question":"Q2?","options":["A","B","C","D"],"correctIndex":0,"explanation":"E2"}]\n```\nGood luck!';
    stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: fence }, finish_reason: 'stop' }] } })];
    const res = mockRes();
    await aiHandler({ method: 'POST', body: { action: 'generateQuiz', topic: 'T', questionCount: 2 } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data.questions) && res.data.questions.length === 2, 'got: ' + JSON.stringify(res.data).slice(0, 200));
    passed++;
    console.log('ok - quiz parses prose-wrapped fenced JSON array');
  }

  // 26. Quiz with UNPARSABLE text → bad_response contract (never blank).
  {
    stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: 'Sorry, I cannot do that right now.' }, finish_reason: 'stop' }] } })];
    const res = mockRes();
    await aiHandler({ method: 'POST', body: { action: 'generateQuiz', topic: 'T', questionCount: 2 } }, res);
    assert.strictEqual(res.statusCode, 502);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.code, 'bad_response');
    passed++;
    console.log('ok - quiz unparsable text → bad_response, never blank');
  }

  // 27. Exotic shape: choices[0].message as STRING → bad_response (documented).
  {
    stubQueue = [resp({ status: 200, json: { choices: [{ message: 'just a string', finish_reason: 'stop' }] } })];
    try {
      await or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']);
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'bad_response');
    }
    passed++;
    console.log('ok - string-typed message → bad_response');
  }

  // 28. Refusal (content_filter) → upstream_error, exactly 1 fetch (never
  // retried to get around a safety stop).
  {
    stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: '', refusal: 'filtered' }, finish_reason: 'content_filter' }] } })];
    seenRequests.length = 0;
    try {
      await or.callOpenRouter('hi');
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'upstream_error');
      assert(/declined|rephras/i.test(e.message));
    }
    assert.strictEqual(seenRequests.length, 1, 'refusals are never retried');
    passed++;
    console.log('ok - refusal → upstream_error, single fetch');
  }

  // 29. Unexpected provider shape: HTTP-200 error body (non-429) → classified.
  {
    stubQueue = [
      resp({ status: 200, json: { error: { code: 500, message: 'provider exploded' } } }),
      resp({ status: 200, json: { error: { code: 500, message: 'provider exploded' } } }),
    ];
    seenRequests.length = 0;
    try {
      await or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']);
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'upstream_error');
      assert.strictEqual(e.status, 502);
    }
    assert(seenRequests.length <= 1, 'exhausted models: single fetch, got ' + seenRequests.length);
    passed++;
    console.log('ok - 200-with-error-body → upstream_error');
  }

  // 30. Multipart array content ([{type:text,text}]) → normalized to text.
  {
    stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] }, finish_reason: 'stop' }] } })];
    const out = await or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']);
    assert.strictEqual(out, 'Hello world');
    passed++;
    console.log('ok - array content parts normalized to text');
  }

  // 31. TEMP-DIAG instrumentation emits joined action lines (no PII).
  {
    const lines = [];
    const origLog = console.log, origWarn = console.warn, origErr = console.error;
    console.log = (...a) => { lines.push(a.join(' ')); };
    console.warn = (...a) => { lines.push(a.join(' ')); };
    console.error = (...a) => { lines.push(a.join(' ')); };
    try {
      stubQueue = [resp({ status: 200, json: { choices: [{ message: { content: 'ok text' }, finish_reason: 'stop' }] } })];
      await aiHandler({ method: 'POST', body: { action: 'doubt', question: 'x?' } }, mockRes());
      stubQueue = [resp({ status: 429, json: { error: { code: 429, message: 'Rate limit exceeded' } } })];
      await aiHandler({ method: 'POST', body: { action: 'generateQuiz', topic: 'T' } }, mockRes());
    } finally {
      console.log = origLog; console.warn = origWarn; console.error = origErr;
    }
    const diag = lines.filter(l => l.includes('[TEMP-DIAG]'));
    assert(diag.some(l => /action=doubt/.test(l) && /upstreamStatus=200/.test(l) && /contentExists=true/.test(l) && /contentLen=\d+/.test(l) && /finishReason=stop/.test(l)), 'doubt success line: ' + diag.join(' || '));
    assert(diag.some(l => /action=generateQuiz/.test(l) && /upstreamStatus=429/.test(l)), 'quiz 429 line: ' + diag.join(' || '));
    assert(diag.some(l => /clientStatus=429/.test(l) && /code=rate_limited/.test(l)), 'client error line: ' + diag.join(' || '));
    const blob = diag.join('\n');
    assert(!/sk-or/i.test(blob) && !/Bearer/i.test(blob), 'no key material in diag lines');
    passed++;
    console.log('ok - TEMP-DIAG lines join action/status/model/content-shape, no PII');
  }

  // 33. Vendor-diversity rule: same-vendor fallback warns; distinct vendors quiet.
  {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...a) => { warns.push(a.join(' ')); };
    try {
      assert.strictEqual(or.modelVendor('google/gemma-4-31b-it:free'), 'google');
      assert.strictEqual(or.modelVendor('openai/gpt-oss-20b:free'), 'openai');
      process.env.OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
      process.env.OPENROUTER_FALLBACK_MODEL = 'google/gemma-4-26b-a4b-it:free';
      or.getModels();
      assert(warns.some(w => w.includes('[AI-CONFIG]')), 'same-vendor chain must warn, got: ' + warns.join(' || '));
      warns.length = 0;
      process.env.OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
      process.env.OPENROUTER_FALLBACK_MODEL = 'qwen/qwen3-30b-a3b:free';
      const pair = or.getModels();
      assert.strictEqual(warns.length, 0, 'distinct vendors must not warn, got: ' + warns.join(' || '));
      assert.notStrictEqual(or.modelVendor(pair[0]), or.modelVendor(pair[1]));
    } finally {
      console.warn = origWarn;
      delete process.env.OPENROUTER_MODEL;
      delete process.env.OPENROUTER_FALLBACK_MODEL;
    }
    passed++;
    console.log('ok - vendor-diversity rule warns on same-vendor chain');
  }

  // 34. 429 WITH X-RateLimit-* headers → scope platform + values carried.
  {
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'Rate limit exceeded', metadata: {} } }, headers: { 'retry-after': '20', 'x-ratelimit-limit': '20', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1710000060' } }),
    ];
    seenRequests.length = 0;
    try {
      await or.callOpenRouter('hi');
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'rate_limited');
      assert.strictEqual(e.scope, 'platform', 'headers present must mean platform, got: ' + e.scope);
      assert.deepStrictEqual(e.rateLimit, { limit: 20, remaining: 0, reset: 1710000060 });
    }
    assert.strictEqual(seenRequests.length, 1);
    passed++;
    console.log('ok - 429 + X-RateLimit headers → scope platform with values');
  }

  // 35. 429 with provider metadata, NO platform headers → scope provider.
  {
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'Provider returned rate limit error', metadata: { provider_name: 'Google', provider_code: 'RESOURCE_EXHAUSTED' } } } }),
    ];
    try {
      await or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']);
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.code, 'rate_limited');
      assert.strictEqual(e.scope, 'provider', 'provider metadata must mean provider, got: ' + e.scope);
      assert.strictEqual(e.providerName, 'Google');
      assert.strictEqual(e.providerCode, 'RESOURCE_EXHAUSTED');
      assert.strictEqual(e.rateLimit, undefined, 'no headers means no rateLimit object');
    }
    passed++;
    console.log('ok - 429 + provider metadata, no headers → scope provider');
  }

  // 36. Bare 429 (no headers, no metadata) → scope stays unknown (honest).
  {
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'Slow down' } } }),
    ];
    try {
      await or.callOpenRouter('hi', 'only-model-never-exists', 99, ['only-model-never-exists']);
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.scope, 'unknown', 'got: ' + e.scope);
    }
    passed++;
    console.log('ok - bare 429 → scope unknown');
  }

  // 37. parseRateLimitHeaders: plain-object headers + garbage tolerance.
  {
    assert.deepStrictEqual(or.parseRateLimitHeaders({ 'X-RateLimit-Limit': '20', 'x-ratelimit-remaining': '5', 'X-RATELIMIT-RESET': 'abc' }), { limit: 20, remaining: 5, reset: null });
    assert.deepStrictEqual(or.parseRateLimitHeaders({}), { limit: null, remaining: null, reset: null });
    assert.deepStrictEqual(or.parseRateLimitHeaders(null), { limit: null, remaining: null, reset: null });
    passed++;
    console.log('ok - parseRateLimitHeaders tolerates shapes');
  }

  console.log(`\nAll ${passed} stubbed error-mapping cases passed. Real completion requests used: 0.`);
})().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
