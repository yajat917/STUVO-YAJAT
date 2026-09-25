const { callOpenRouter, cleanMathFormatting, STUVO_TUTOR_VOICE } = require('./_lib/openrouter');

const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu', ta: 'Tamil' };

// ─── Input caps (token-abuse + crash protection) ─────────────
const MAX_SHORT = 200;   // names, subjects, chapters, grades
const MAX_PROMPT = 2000; // questions, answers, explanations
const MAX_LONG = 8000;   // homework text, notes/source material
const MAX_JSON_BYTES = 25 * 1024; // structured plans passed back in
const VALID_HEALTH_STATUSES = ['strong', 'steady', 'needs_attention', 'insufficient_data'];

function cappedStr(v, max, name) {
  const s = (v === undefined || v === null) ? '' : String(v);
  if (s.length > max) throw { status: 413, message: `${name} too long (max ${max} characters).` };
  return s;
}
function cappedNum(v, min, max, def) {
  const n = Number(v);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}
function cappedArr(v, max) {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

function getLanguageInstruction(languageName) {
  if (!languageName || languageName === 'English') return '';
  return `Respond entirely in ${languageName}. Do not mix in English except for proper nouns, technical terms without a common translation, or mathematical notation which stays universal (x^2, √, etc. remain as-is regardless of language).`;
}

// ─────────────────────────────────────────────
// Individual action handlers (logic copied from each old file)
// ─────────────────────────────────────────────

async function handleDoubt(body) {
  const question = cappedStr(body.question, MAX_PROMPT, 'question');
  if (!question.trim()) throw { status: 400, message: 'question required' };
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject') || 'General';
  const { mode } = body;
  const previousAnswer = cappedStr(body.previousAnswer, MAX_PROMPT, 'previousAnswer');
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  const gradeLine = grade ? ` The student is in grade ${grade} — match your explanation complexity to that level (simpler analogies and shorter steps for grades 9-10, more technical depth for grades 11-12).` : '';
  let prompt;
  if (mode === 'simpler') {
    prompt = `${STUVO_TUTOR_VOICE}\n${languageInstruction}\n\nA grade ${grade || 'school'} student found this explanation too complex: "${previousAnswer}". Re-explain the same answer to "${question}" (subject: ${subject}) using simpler words, shorter sentences, and a more basic analogy. Keep it step-by-step. Number each step. End with a clear final answer line starting with "Answer: ".`;
  } else if (mode === 'alternative') {
    prompt = `${STUVO_TUTOR_VOICE}\n${languageInstruction}\n\nA grade ${grade || 'school'} student wants a different way to understand this. Original question: "${question}" (subject: ${subject}). Original explanation: "${previousAnswer}". Provide a genuinely different method or approach, step-by-step. Number each step. End with a clear final answer line starting with "Answer: ".`;
  } else {
    prompt = `${STUVO_TUTOR_VOICE}\n${languageInstruction}\n\nYou already know the student (grade ${grade || 'unknown'}, subject: ${subject}) — never ask for this again.${gradeLine} A student asks: "${question}". Give a clear step-by-step explanation. Number each step. Structure your answer as numbered steps. End with a clear final answer line starting with "Answer: ".`;
  }
  const answer = cleanMathFormatting(await callOpenRouter(prompt));
  return { answer };
}

async function handleSummarizeHomework(body) {
  const homeworkText = cappedStr(body.homeworkText, MAX_LONG, 'homeworkText');
  const { mode, languageName = 'English' } = body;
  if (!homeworkText || homeworkText.trim().length === 0) {
    throw { status: 400, message: "No homework text provided to summarize." };
  }
  const languageInstruction = getLanguageInstruction(languageName);
  const simplerInstruction = mode === 'simpler' ? ' Use very simple language, as if explaining to a younger student.' : '';
  const jsonInstruction = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"summary": "...", "keyPoints": ["..."], "whatYouNeedToDo": "...", "importantConcepts": ["..."]}` : ` Return ONLY JSON:
{"summary": "concise 2-3 sentence summary", "keyPoints": ["point 1", "point 2"], "whatYouNeedToDo": "clear actionable instructions", "importantConcepts": ["concept 1"]}`;
  const prompt = `${languageInstruction}\n\nSummarize this homework assignment for a school student. Base your summary ONLY on the text provided.${jsonInstruction}${simplerInstruction}
Homework text: ${homeworkText}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  result.summary = cleanMathFormatting(result.summary);
  result.whatYouNeedToDo = cleanMathFormatting(result.whatYouNeedToDo);
  result.keyPoints = result.keyPoints.map(cleanMathFormatting);
  result.importantConcepts = result.importantConcepts.map(cleanMathFormatting);
  return result;
}

async function handleGenerateQuiz(body) {
  const topic = cappedStr(body.topic, 500, 'topic');
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject');
  const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium';
  const questionCount = cappedNum(body.questionCount, 1, 20, 8);
  const sourceText = cappedStr(body.sourceText, MAX_LONG, 'sourceText');
  const previousHashes = cappedArr(body.previousHashes, 100);
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  const source = sourceText ? `based on this material: "${sourceText}"` : `about "${topic}"`;
  const avoidNote = previousHashes.length > 0 ? ` Avoid repeating questions the student has already seen.` : '';
  const gradeNote = grade ? ` The student is in grade ${grade}: calibrate "${difficulty}" difficulty to that grade level (medium for grade 9 is much simpler than medium for grade 12).` : '';
  const subjectNote = subject ? ` Subject: ${subject}.` : '';
  const langJsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}]` : ` Return ONLY a JSON array: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}]`;
  const prompt = `${STUVO_TUTOR_VOICE}\n${languageInstruction}\n\nGenerate ${questionCount} multiple choice questions ${source} for a grade ${grade || 'school'} student, at ${difficulty} difficulty.${subjectNote}${gradeNote}${avoidNote} All text must use plain text math notation only (x^2, √, fractions as (a)/(b)) — never LaTeX.${langJsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  let questions;
  try { questions = JSON.parse(clean); }
  catch (e) { throw { status: 502, message: "The quiz generator returned an unexpected format. Please try again." }; }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw { status: 502, message: "No questions were generated. Try a different topic." };
  }
  questions.forEach(q => {
    q.question = cleanMathFormatting(q.question);
    q.options = q.options.map(cleanMathFormatting);
    q.explanation = cleanMathFormatting(q.explanation || '');
  });
  return { questions };
}

async function handlePracticeBit(body) {
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject');
  const topic = cappedStr(body.topic, 500, 'topic');
  const subjects = cappedArr(body.subjects, 10).map(s => cappedStr(s, MAX_SHORT, 'subjects[]'));
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  let finalSubject = subject;
  if (!finalSubject && Array.isArray(subjects) && subjects.length) {
    finalSubject = subjects[0];
  }
  if (!finalSubject) finalSubject = 'General';
  const finalTopic = topic || finalSubject;
  const gradeNote = grade ? ` The student is in grade ${grade}: keep the difficulty and vocabulary appropriate for that level.` : '';
  const jsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"question": "...", "correctAnswer": "..."}` : ` Return ONLY JSON: {"question": "...", "correctAnswer": "..."}`;
  const prompt = `${languageInstruction}\n\nGenerate one short practice question about ${finalSubject} (topic: ${finalTopic}) for a grade ${grade || 'school'} student. Keep it short.${gradeNote}${jsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  result.question = cleanMathFormatting(result.question);
  result.correctAnswer = cleanMathFormatting(result.correctAnswer);
  if (result.hint) result.hint = cleanMathFormatting(result.hint);
  return { subject: finalSubject, question: result.question, correctAnswer: result.correctAnswer, hint: result.hint || '' };
}

async function handleCheckAnswer(body) {
  const question = cappedStr(body.question, MAX_PROMPT, 'question');
  const studentAnswer = cappedStr(body.studentAnswer, MAX_PROMPT, 'studentAnswer');
  const correctAnswer = cappedStr(body.correctAnswer, MAX_PROMPT, 'correctAnswer');
  const languageName = body.languageName || 'English';
  if (!question || !studentAnswer) throw { status: 400, message: 'question and studentAnswer required' };
  const languageInstruction = getLanguageInstruction(languageName);
  const jsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"isCorrect": true/false, "feedback": "one sentence explanation"}` : ` Return ONLY JSON: {"isCorrect": true/false, "feedback": "one sentence explanation"}`;
  const prompt = `${languageInstruction}\n\nQuestion: "${question}". Correct answer: "${correctAnswer}". Student answered: "${studentAnswer}". Is the student correct?${jsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  result.feedback = cleanMathFormatting(result.feedback);
  if (result.correctAnswer) result.correctAnswer = cleanMathFormatting(result.correctAnswer);
  return { isCorrect: Boolean(result.isCorrect), feedback: result.feedback, correctAnswer: result.correctAnswer || correctAnswer || '' };
}

async function handleGenerateRevision(body) {
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject') || 'General';
  const chapter = cappedStr(body.chapter, 500, 'chapter');
  if (!chapter.trim()) throw { status: 400, message: 'chapter required' };
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  const gradeNote = grade ? ` The student is in grade ${grade} — match depth and vocabulary to that level (simpler analogies for grades 9-10, more technical depth for grades 11-12).` : '';
  const jsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"keyConcepts": ["..."], "formulas": ["..."], "quickNotes": "...", "practiceQuestions": [{"question": "...", "answer": "..."}], "checklist": ["..."]}` : ` Return ONLY JSON with these exact fields, in this exact order:
{"keyConcepts": ["..."], "formulas": ["..."], "quickNotes": "...", "practiceQuestions": [{"question": "...", "answer": "..."}], "checklist": ["..."]}`;
  const prompt = `${STUVO_TUTOR_VOICE}\n${languageInstruction}\n\nCreate revision material for a grade ${grade || 'school'} student on "${chapter}" in ${subject}.${gradeNote} Write all formulas in plain text notation (e.g. "Area = π × r^2", not LaTeX). Omit the formulas section (empty array) if the topic has no formulas. Structure, in this exact order: Key Concepts, then Formulas, then Quick Notes, then Practice Questions, then finally a short revision checklist the student can tick off (3-6 concrete items like "Recite the 3 key definitions from memory").${jsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  result.formulas = (result.formulas || []).map(cleanMathFormatting);
  result.quickNotes = cleanMathFormatting(result.quickNotes || '');
  result.practiceQuestions = (result.practiceQuestions || []).map(q => ({
    question: cleanMathFormatting(q.question), answer: cleanMathFormatting(q.answer)
  }));
  if (Array.isArray(result.keyConcepts)) result.keyConcepts = result.keyConcepts.map(v => cleanMathFormatting(String(v)));
  if (Array.isArray(result.checklist)) result.checklist = result.checklist.map(v => cleanMathFormatting(String(v)));
  else result.checklist = [];
  return result;
}

async function handleWeaknessAnalysis(body) {
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject');
  if (!subject.trim()) throw { status: 400, message: 'subject required' };
  const quizScores = cappedArr(body.quizScores, 20).map(Number).filter(n => !isNaN(n));
  const practiceBitAccuracy = cappedStr(body.practiceBitAccuracy, 50, 'practiceBitAccuracy');
  const daysSinceStudied = cappedStr(body.daysSinceStudied, 50, 'daysSinceStudied');
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const prompt = `${STUVO_TUTOR_VOICE}
A student (grade ${grade}) has this real performance data in ${subject}:
Recent quiz scores: ${JSON.stringify(quizScores)}
Practice bit accuracy: ${practiceBitAccuracy}%
Days since last studied: ${daysSinceStudied}
Based ONLY on this real data, write a short (3-4 sentence) supportive summary of where they stand and ONE specific, actionable suggestion. Do not invent scores or claims not in this data. Return ONLY JSON: {"summary": "...", "suggestion": "..."}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  const result = JSON.parse(clean);
  result.summary = cleanMathFormatting(result.summary);
  result.suggestion = cleanMathFormatting(result.suggestion);
  return result;
}

async function handleSubjectHealthNudge(body) {
  const subject = cappedStr(body.subject, MAX_SHORT, 'subject');
  const status = cappedStr(body.status, 30, 'status');
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  if (!subject.trim()) throw { status: 400, message: 'subject required' };
  if (!VALID_HEALTH_STATUSES.includes(status)) throw { status: 400, message: 'invalid status' };
  if (status === 'strong') return { nudge: '' }; // no nudge needed when things are going well
  const prompt = `${STUVO_TUTOR_VOICE}
A grade ${grade} student's ${subject} status is "${status}" (needs_attention or steady). Write ONE short, warm, actionable sentence (under 15 words) nudging them toward the Revision or Doubt Assistant tool for this subject. No guilt, no pressure.`;
  const nudge = cleanMathFormatting(await callOpenRouter(prompt));
  return { nudge };
}

async function handleScheduleNarrative(body) {
  const { weeklyPlan } = body; // weeklyPlan computed deterministically client-side, passed in
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  if (!Array.isArray(weeklyPlan) || !weeklyPlan.length || weeklyPlan.length > 7) {
    throw { status: 400, message: 'weeklyPlan must be a 1-7 day array' };
  }
  if (JSON.stringify(weeklyPlan).length > MAX_JSON_BYTES) {
    throw { status: 413, message: 'weeklyPlan too large' };
  }
  const prompt = `${STUVO_TUTOR_VOICE}
A grade ${grade} student has this weekly study plan: ${JSON.stringify(weeklyPlan)}
Write a brief (2-3 sentence) encouraging summary of the week ahead based on this real plan. Do not suggest anything not in the plan.`;
  const narrative = cleanMathFormatting(await callOpenRouter(prompt));
  return { narrative };
}

async function handleNextBestAction(body) {
  const incompleteHomework = cappedArr(body.incompleteHomework, 10);
  const recentlyStudiedSubjects = cappedArr(body.recentlyStudiedSubjects, 30).map(s => cappedStr(s, MAX_SHORT, 'recentlyStudiedSubjects[]'));
  const allEnrolledSubjects = cappedArr(body.allEnrolledSubjects, 30).map(s => cappedStr(s, MAX_SHORT, 'allEnrolledSubjects[]'));
  const grade = cappedStr(body.grade, 20, 'grade');
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  const neglectedSubjects = (allEnrolledSubjects || []).filter(s => !(recentlyStudiedSubjects || []).includes(s));
  const gradeLine = grade ? ` The student is in grade ${grade} — keep each action age-appropriate for that level.` : '';
  const jsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"priorities": [{"action": "...", "reason": "...", "estimatedMinutes": 25}]}` : ` Return ONLY JSON:
{"priorities": [{"action": "...", "reason": "...", "estimatedMinutes": 25}]}`;
  const prompt = `${languageInstruction}\n\nA student has this situation:
Incomplete homework: ${JSON.stringify(incompleteHomework)}
Recently studied subjects: ${(recentlyStudiedSubjects || []).join(', ') || 'none recently'}
Subjects with no recent activity: ${neglectedSubjects.join(', ') || 'none'}
Give a short prioritized study recommendation, maximum 3 items. Keep each "reason" under 8 words, each "action" under 12 words.${gradeLine}${jsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function handleClassPulse(body) {
  const completionPercent = cappedNum(body.completionPercent, 0, 100, 0);
  const notSubmittedCount = cappedNum(body.notSubmittedCount, 0, 10000, 0);
  const avgQuizScore = cappedNum(body.avgQuizScore, 0, 100, 0);
  const weakTopics = cappedArr(body.weakTopics, 30).map(s => cappedStr(s, MAX_SHORT, 'weakTopics[]'));
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  const jsonNote = languageName !== 'English' ? ` Return ONLY JSON with these exact English key names, but with the VALUES written in ${languageName}: {"recommendation": "..."}` : ` Return ONLY JSON: {"recommendation": "..."}`;
  const prompt = `${languageInstruction}\n\nA teacher's class has: ${completionPercent}% homework completion, ${notSubmittedCount} students haven't submitted, average quiz performance ${avgQuizScore}%, weak topics: ${(weakTopics||[]).join(', ') || 'none identified'}.
Give ONE short, actionable recommendation, under 20 words, plain direct language.${jsonNote}`;
  const content = await callOpenRouter(prompt);
  const clean = content.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function handleWellbeingAssistant(body) {
  const message = cappedStr(body.message || body.prompt || '', 4000, 'message');
  const conversationHistory = cappedArr(body.conversationHistory, 20).map(m => ({
    role: m && m.role === 'assistant' ? 'assistant' : 'user',
    content: cappedStr(m && m.content, 2000, 'conversationHistory[]')
  }));
  const languageName = body.languageName || 'English';
  const languageInstruction = getLanguageInstruction(languageName);
  if (!message || !String(message).trim()) throw { status: 400, message: 'prompt required' };
  const SYSTEM_CONTEXT = `You are the Stuvo Wellbeing Assistant, a supportive listening tool for school students. Listen, help organize thoughts, suggest healthy coping strategies, help with study stress, help prepare what to say to a teacher/counselor, gently point toward school support. NEVER diagnose, NEVER pretend to be a licensed counselor, NEVER encourage secrecy from trusted adults, NEVER give dangerous advice, NEVER promise confidentiality you cannot guarantee, NEVER try to be the sole support for a serious situation. If the student describes danger, harm, or self-harm thoughts, respond with care and clearly encourage them to talk to a trusted adult or support service right away. Keep responses plain, warm, conversational — no markdown, no bullet lists unless walking through a technique step-by-step.`;
  const historyText = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = `${languageInstruction}\n\n${SYSTEM_CONTEXT}\n\nConversation so far:\n${historyText}\n\nStudent: ${message}\n\nRespond warmly and briefly.`;
  const replyRaw = await callOpenRouter(prompt);
  const replyClean = cleanMathFormatting((replyRaw || '').trim() || "I'm here to listen. Would you like to try a short breathing exercise, jot a thought in your journal, or talk more about what's on your mind?");
  const finalReply = replyClean.replace(/AI Counselor/gi, 'Stuvo Wellbeing Assistant');
  // Extended concern keywords for all languages — CRITICAL: this list must be reviewed by native speakers for crisis-detection accuracy
  // Flagged for manual review: Hindi, Bengali, Marathi, Telugu, Tamil equivalents need verification by native speakers before shipping
  const concernKeywords = [
    // English
    'hurt myself', 'suicide', 'kill myself', 'want to die', 'end it', 'self harm', 'self-harm', 'end my life', 'suicidal', 'take my life',
    // Hindi - आत्महत्या, खुद को चोट, मरना चाहता हूँ, etc. (NEEDS REVIEW)
    'आत्महत्या', 'खुद को चोट', 'मरना चाहता', 'मरना चाहती', 'जीवन समाप्त', 'खुदकुशी',
    // Bengali - আত্মহত্যা etc. (NEEDS REVIEW)
    'আত্মহত্যা', 'নিজেকে আঘাত', 'মরে যেতে চাই',
    // Marathi - आत्महत्या etc. (NEEDS REVIEW)
    'आत्महत्या', 'स्वतःला इजा', 'मरायचे आहे',
    // Telugu - ఆత్మహత్య etc. (NEEDS REVIEW)
    'ఆత్మహత్య', 'నన్ను నేను గాయపరచు', 'చనిపోవాలని',
    // Tamil - தற்கொலை etc. (NEEDS REVIEW)
    'தற்கொலை', 'என்னை காயப்படுத்த', 'சாக விரும்புகிறேன்'
  ];
  const lowerMsg = String(message).toLowerCase();
  let escalationFlag = concernKeywords.some(kw => lowerMsg.includes(kw.toLowerCase()));
  if (!escalationFlag && Array.isArray(conversationHistory)) {
    for (const m of conversationHistory) {
      if (m && m.content && concernKeywords.some(kw => String(m.content).toLowerCase().includes(kw.toLowerCase()))) { escalationFlag = true; break; }
    }
  }
  return { reply: finalReply, escalationFlag };
}

// ─────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────

const ACTIONS = {
  doubt: handleDoubt,
  summarizeHomework: handleSummarizeHomework,
  generateQuiz: handleGenerateQuiz,
  practiceBit: handlePracticeBit,
  checkAnswer: handleCheckAnswer,
  generateRevision: handleGenerateRevision,
  weaknessAnalysis: handleWeaknessAnalysis,
  subjectHealthNudge: handleSubjectHealthNudge,
  scheduleNarrative: handleScheduleNarrative,
  nextBestAction: handleNextBestAction,
  classPulse: handleClassPulse,
  wellbeingAssistant: handleWellbeingAssistant,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let { action, language, languageName, ...body } = req.body || {};
  // Alias for backward compat: checkPracticeBit -> checkAnswer
  if (action === 'checkPracticeBit') action = 'checkAnswer';
  // Resolve languageName from language code if not directly provided
  if (!languageName && language) {
    languageName = LANGUAGE_NAMES[language] || 'English';
  }
  if (!languageName) languageName = 'English';
  // Pass languageName into body for handlers
  body.languageName = languageName;
  body.language = language || 'en';

  if (!action || !ACTIONS[action]) {
    return res.status(400).json({ error: `Unknown or missing action: "${action}". Valid actions: ${Object.keys(ACTIONS).join(', ')}` });
  }

  try {
    const result = await ACTIONS[action](body);
    res.status(200).json(result);
  } catch (e) {
    const status = e.status || 500;
    const message = e.message || 'AI service error. Please try again.';
    console.error(`Error in action "${action}":`, message);
    res.status(status).json({ error: message });
  }
};
