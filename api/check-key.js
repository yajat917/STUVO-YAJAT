// GET/POST /api/check-key
// SECURITY: never return the key itself. Clients only need to know
// whether the server is configured, so they can show the right setup hint.
const { getApiKey } = require('./_lib/openrouter');

module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    }
    const apiKey = getApiKey();
    if (apiKey) {
        return res.status(200).json({ hasKey: true });
    }
    return res.status(200).json({
        hasKey: false,
        error: 'No OpenRouter key configured on server. Set OPENROUTER_API_KEY env var and redeploy.',
    });
};
