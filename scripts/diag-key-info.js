// TEMP-DIAG one-shot: GET /api/v1/key — NOT a completion request, zero quota.
// Requires OPENROUTER_API_KEY in env or local .env (gitignored).
// Prints redacted fields only. NEVER prints the key or Authorization header.
const { getApiKey } = require('../api/_lib/openrouter');

(async () => {
  const key = getApiKey();
  if (!key) {
    console.error('NO_KEY: set OPENROUTER_API_KEY in the environment or local .env first.');
    process.exit(2);
  }
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: 'Bearer ' + key },
  });
  console.log('http:', res.status);
  const body = await res.json().catch(() => ({}));
  // Safe-list only: usage/tier/limit fields. Anything else is dropped.
  const pick = (o, ks) => {
    const out = {};
    for (const k of ks) {
      if (o && o[k] !== undefined && o[k] !== null) out[k] = o[k];
    }
    return out;
  };
  const FIELDS = ['is_free_tier', 'usage_daily', 'usage', 'limit', 'limit_remaining', 'label'];
  console.log(JSON.stringify({
    top: pick(body, FIELDS),
    data: pick(body && body.data, FIELDS),
  }, null, 1));
})().catch((e) => {
  console.error('FAIL:', String((e && e.message) || e).slice(0, 200));
  process.exit(1);
});
