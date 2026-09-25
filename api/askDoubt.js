// POST /api/askDoubt
// Body: { question: string, subject?: string }
// Returns: { answer: string }

const { callOpenRouter } = require('./_lib/openrouter');

module.exports = async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable is not set.' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { question: rawQuestion, subject: rawSubject } = req.body || {};
    const question = String(rawQuestion || '').slice(0, 2000);
    const subject = String(rawSubject || 'General').slice(0, 200);
    if (!question.trim()) return res.status(400).json({ error: 'question required' });

    try {
        const answer = await callOpenRouter([
            {
                role: 'system',
                content: `You are a school teacher answering student doubts. Be clear, step-by-step, and encouraging. Use examples where helpful. Subject context: ${subject || 'General academic query'}.`,
            },
            { role: 'user', content: question },
        ], { temperature: 0.7, maxTokens: 700 });

        res.status(200).json({ answer });
    } catch (err) {
        console.error('[askDoubt]', err);
        res.status(500).json({ error: err.message });
    }
};
