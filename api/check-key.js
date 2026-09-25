module.exports = async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
        return res.status(200).json({ key: apiKey, hasKey: true });
    }
    return res.status(500).json({ hasKey: false, error: 'No OpenRouter key configured on server' });
};
