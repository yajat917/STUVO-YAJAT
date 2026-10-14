// Quota-free error-mapping tests (checklist item 8).
// Stubs global.fetch so NO real OpenRouter request is ever sent (0 quota).
// Covers: 429 with/without Retry-After, daily-cap 429 message, 401, 402,
// 404 model, 500, empty content, invalid JSON, null content, timeout,
// not_configured, wellbeing escalation-on-failure, and the api/ai.js error
// contract { ok:false, code, message, retryAfterSec? } + HTTP status.
process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-stub-key';
const assert = require('assert');
const or = require('../api/_lib/openrouter');
const aiHandler = require('../api/ai');

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
  {
    const res = mockRes();
    // Normal path: primary 429 → one local fallback 429 → contract error.
    stubQueue = [
      resp({ status: 429, json: { error: { code: 429, message: 'free-models-per-day exhausted', metadata: {} } }, headers: { 'retry-after': '30' } }),
      resp({ status: 429, json: { error: { code: 429, message: 'free-models-per-day exhausted', metadata: {} } }, headers: { 'retry-after': '30' } }),
    ];
    await aiHandler({ method: 'POST', body: { action: 'doubt', question: '2+2?' } }, res);
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.data.ok, false);
    assert.strictEqual(res.data.code, 'daily_limit');
    assert(/daily/i.test(res.data.message));
    assert.strictEqual(res.data.retryAfterSec, 30);
    assert(!JSON.stringify(res.data).includes('sk-or-v1-test'), 'no key material in payload');
    passed++;
    console.log('ok - /api/ai contract for daily_limit (429, ok:false, retryAfterSec)');
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

  console.log(`\nAll ${passed} stubbed error-mapping cases passed. Real completion requests used: 0.`);
})().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
