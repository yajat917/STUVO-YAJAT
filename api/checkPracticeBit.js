// POST /api/checkPracticeBit
// Body: { question: string, studentAnswer: string, subject: string }
// Returns: { isCorrect: boolean, feedback: string, correctAnswer: string }

const { callOpenRouter, parseJSON, cleanMathFormatting } = require('./_lib/openrouter');

module.exports = async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable is not set.' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { question: rawQ, studentAnswer: rawA, subject: rawS } = req.body || {};
    const question = String(rawQ || '').slice(0, 2000);
    const studentAnswer = String(rawA || '').slice(0, 2000);
    const subject = String(rawS || 'General').slice(0, 200);
    if (!question || !studentAnswer) return res.status(400).json({ error: 'question and studentAnswer required' });

    try {
        const text = await callOpenRouter([
            {
                role: 'system',
                content: `You are a school teacher evaluating a student's answer. Keep the question short (one sentence where possible). Use plain text math notation only if the question involves math. Return ONLY valid JSON:
{
  "isCorrect": true or false,
  "correctAnswer": "...",
  "feedback": "2-3 sentences of encouraging, educational feedback"
}
Be lenient — if the core concept is right, mark it correct even if phrasing differs.`,
            },
            {
                role: 'user',
                content: `Subject: ${subject || 'General'}\nQuestion: ${question}\nStudent's answer: ${studentAnswer}\n\nEvaluate the answer and return JSON.`,
            },
        ], { temperature: 0.4, maxTokens: 350 });

        const data = parseJSON(text);
        res.status(200).json({
            isCorrect: Boolean(data.isCorrect),
            correctAnswer: cleanMathFormatting(String(data.correctAnswer || '')),
            feedback: cleanMathFormatting(String(data.feedback || '')),
        });
    } catch (err) {
        console.error('[checkPracticeBit]', err);
        res.status(500).json({ error: err.message || 'Failed to check answer' });
    }
};
