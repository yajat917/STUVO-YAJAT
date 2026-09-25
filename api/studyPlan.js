// POST /api/studyPlan
// Body: { examDate, subjects, weakTopics, hours }
// Returns: { plan: string }

const { callOpenRouter } = require('./_lib/openrouter');

module.exports = async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY environment variable is not set.' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { examDate, subjects: rawSubjects = [], weakTopics: rawWeak = {}, hours: rawHours = 4 } = req.body || {};
    const subjects = (Array.isArray(rawSubjects) ? rawSubjects : []).slice(0, 30).map(s => String(s).slice(0, 200));
    const weakTopics = {};
    Object.entries(rawWeak || {}).slice(0, 30).forEach(([k, v]) => { weakTopics[String(k).slice(0, 200)] = v; });
    const hours = Math.min(12, Math.max(1, Number(rawHours) || 4));
    if (!examDate || !subjects.length) return res.status(400).json({ error: 'examDate and subjects required' });

    const weakStr = Object.entries(weakTopics)
        .filter(([, t]) => t?.length)
        .map(([s, t]) => `${s}: ${Array.isArray(t) ? t.join(', ') : t}`)
        .join('; ') || 'None specified';

    const daysUntil = Math.max(1, Math.ceil((new Date(examDate) - Date.now()) / 86400000));
    const planDays = Math.min(daysUntil, 14);

    try {
        const plan = await callOpenRouter([
            {
                role: 'system',
                content: 'You are an AI study planner. Format daily study plans using day ranges, topics, hours, and priority (HIGH/MEDIUM/LOW). Stick strictly to the format requested.',
            },
            {
                role: 'user',
                content: `Create a ${planDays}-day study plan for subjects: ${subjects.join(', ')}.
Exam date: ${examDate}. Daily study hours: ${hours}.
Weak topics to prioritize: ${weakStr}.

Format EXACTLY like this for each block:

Day 1-3

[Subject]:
[Topic/Chapter]
[X] hours

Priority:
HIGH

---`,
            },
        ], { temperature: 0.7, maxTokens: 1000 });

        res.status(200).json({ plan });
    } catch (err) {
        console.error('[studyPlan]', err);
        res.status(500).json({ error: err.message });
    }
};
