// POST /api/analyzeWeakness
// Body: { marks, studyTime, focusCount, weakSubjects }
// Returns: { analysis: string }

const { callOpenRouter } = require('./_lib/openrouter');

module.exports = async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable is not set.' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { marks: rawMarks = {}, studyTime: rawTime = {}, focusCount: rawFocus = 0, weakSubjects: rawWeak = [] } = req.body || {};
    const marks = {};
    Object.entries(rawMarks || {}).slice(0, 50).forEach(([k, v]) => { marks[String(k).slice(0, 200)] = Number(v) || 0; });
    const studyTime = {};
    Object.entries(rawTime || {}).slice(0, 50).forEach(([k, v]) => { studyTime[String(k).slice(0, 200)] = Number(v) || 0; });
    const focusCount = Math.min(10000, Math.max(0, Number(rawFocus) || 0));
    const weakSubjects = (Array.isArray(rawWeak) ? rawWeak : []).slice(0, 30).map(s => String(s).slice(0, 200));

    const marksStr = Object.entries(marks).map(([s, v]) => `${s}: ${v}%`).join(', ') || 'Not provided';
    const timeStr = Object.entries(studyTime).map(([s, v]) => `${s}: ${v}h`).join(', ') || 'Not provided';

    try {
        const analysis = await callOpenRouter([
            {
                role: 'system',
                content: 'You are an AI academic advisor. Analyze student performance and provide a structured report with Strong/Weak subjects and 3 actionable recommendations. Match the format exactly.',
            },
            {
                role: 'user',
                content: `Student profile:
- Marks by subject: ${marksStr}
- Study hours: ${timeStr}
- Focus sessions: ${focusCount}
- Self-identified weak subjects: ${weakSubjects.join(', ') || 'None'}

Format EXACTLY:

Performance Analysis:

Strong:
[Subject(s)]

Weak:
[Subject(s)]

Recommendation:
1. [Tip]
2. [Tip]
3. [Tip]`,
            },
        ], { temperature: 0.6, maxTokens: 500 });

        res.status(200).json({ analysis });
    } catch (err) {
        console.error('[analyzeWeakness]', err);
        res.status(500).json({ error: err.message });
    }
};
