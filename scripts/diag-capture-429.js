// TEMP-DIAG one-shot: makes ONE tiny completion request to capture a live
// failing 429's headers + metadata (counts 1 against the quota budget).
// Requires OPENROUTER_API_KEY in env or local .env (gitignored).
// Prints sanitized diagnostics only. NEVER prints the key, prompts, or bodies.
const or = require('../api/_lib/openrouter');

(async () => {
  const key = or.getApiKey();
  if (!key) {
    console.error('NO_KEY: set OPENROUTER_API_KEY in the environment or local .env first.');
    process.exit(2);
  }
  try {
    const out = await or.callOpenRouter(
      'Reply with exactly this word: ok',
      undefined, undefined, undefined, 'diag-capture'
    );
    console.log('SUCCESS(200):', JSON.stringify(out).slice(0, 120));
  } catch (e) {
    console.log(JSON.stringify({
      code: e.code || null,
      status: e.status || null,
      scope: e.scope || null,
      model: e.model || null,
      triedModels: e.triedModels || null,
      retryAfter: e.retryAfter || 0,
      rateLimit: e.rateLimit || null,
      providerName: e.providerName || null,
      providerCode: e.providerCode || null,
      upstreamType: e.upstreamType || null,
      message: String(e.message || '').slice(0, 200),
    }, null, 1));
  }
})().catch((e) => {
  console.error('FAIL:', String((e && e.message) || e).slice(0, 200));
  process.exit(1);
});
