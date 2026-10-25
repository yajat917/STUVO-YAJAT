const {
  callOpenRouter,
  cleanMathFormatting,
  parseJSON,
  FORMAT_STANDARD
} = require('./_lib/openrouter');
const {
  TEMPERATURES,
  wrap,
  stripDelimiterTags,
  hashString,
  sanitizeContext,
  buildDoubtPrompt,
  buildSummarizeHomeworkPrompt,
  buildGenerateQuizPrompt,
  buildPracticeBitPrompt,
  buildCheckAnswerPrompt,
  buildGenerateRevisionPrompt,
  buildWeaknessAnalysisPrompt,
  buildSubjectHealthNudgePrompt,
  buildScheduleNarrativePrompt,
  buildNextBestActionPrompt,
  buildClassPulsePrompt,
  buildWellbeingAssistantPrompt
} = require('./_lib/prompts');

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

// Parse model output as JSON robustly (fences / prose-wrapped).
function parseModelJSON(content, featureMessage) {
  const text = (content === null || content === undefined) ? '' : String(content);
  if (!text.trim()) throw { status: 502, code: 'bad_response', message: featureMessage || 'The AI returned an empty response. Please try again.' };
  try {
    return parseJSON(text);
  } catch (e) {
    throw { status: 502, code: 'bad_response', message: featureMessage || 'The AI returned an unexpected format. Please try again.' };
  }
}

function requireNonEmptyText(v, featureMessage) {
  const s = (v === null || v === undefined) ? '' : String(v).trim();
  if (!s) throw { status: 502, code: 'bad_response', message: featureMessage || 'The AI returned an empty response. Please try again.' };
  return s;
}

// Truncate feedback to 400 chars at a sentence boundary.
function truncateFeedback(text) {
  const s = String(text === null || text === undefined ? '' : text).trim();
  if (!s) return '';
  let cut = s.slice(0, 400);
  const lastPeriod = cut.lastIndexOf('.');
  if (lastPeriod !== -1 && lastPeriod < cut.length - 1) cut = cut.slice(0, lastPeriod + 1);
  return cut;
}

// Strict boolean parsing: true/false or exact strings "true"/"false".
function parseStrictBoolean(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

// Fisher-Yates shuffle, returns [shuffledOptions, newCorrectIndex].
function shuffleOptions(options, correctIndex) {
  const shuffled = options.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const correctText = options[correctIndex];
  const newIdx = shuffled.indexOf(correctText);
  return { shuffled, newIdx: newIdx !== -1 ? newIdx : 0 };
}

// ─────────────────────────────────────────────
// Individual action handlers
// ─────────────────────────────────────────────

async function handleDoubt(body) {
  const question = cappedStr(body.question, 1000, 'question');
  if (!question.trim()) throw { status: 400, message: 'question required' };
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] doubt defaulted grade to 10');
  const mode = body.mode;
  const previousAnswer = cappedStr(body.previousAnswer, 2000, 'previousAnswer');
  const languageName = body.languageName || 'English';
  const messages = buildDoubtPrompt({
    question, subject: ctx.subject, grade: ctx.grade, stream: ctx.stream,
    languageName, mode, previousAnswer
  });
  const answer = cleanMathFormatting(stripDelimiterTags(await callOpenRouter(messages, { temperature: TEMPERATURES.doubt }, 0, null, 'doubt')));
  requireNonEmptyText(answer, 'The tutor returned an empty explanation. Please try again.');
  return { answer };
}

async function handleSummarizeHomework(body) {
  const homeworkText = cappedStr(body.homeworkText, 6000, 'homeworkText');
  if (!homeworkText || homeworkText.trim().length === 0) {
    throw { status: 400, message: "No homework text provided to summarize." };
  }
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] summarizeHomework defaulted grade to 10');
  const { mode, languageName = 'English' } = body;
  const messages = buildSummarizeHomeworkPrompt({
    homeworkText, subject: ctx.subject, grade: ctx.grade, stream: ctx.stream,
    languageName, mode
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.summarizeHomework }, 0, null, 'summarizeHomework');
  const result = parseModelJSON(content, 'The homework summarizer returned an unexpected format. Please try again.');
  if (!result.summary || !Array.isArray(result.keyPoints) || !result.whatYouNeedToDo || !Array.isArray(result.importantConcepts)) {
    throw { status: 502, code: 'bad_response', message: 'The homework summarizer returned an incomplete summary. Please try again.' };
  }
  result.summary = cleanMathFormatting(stripDelimiterTags(String(result.summary)));
  result.whatYouNeedToDo = cleanMathFormatting(stripDelimiterTags(String(result.whatYouNeedToDo)));
  result.keyPoints = result.keyPoints.map(v => cleanMathFormatting(stripDelimiterTags(String(v))));
  result.importantConcepts = result.importantConcepts.map(v => cleanMathFormatting(stripDelimiterTags(String(v))));
  return result;
}

async function handleGenerateQuiz(body) {
  const topic = cappedStr(body.topic, 500, 'topic');
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] generateQuiz defaulted grade to 10');
  const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium';
  const questionCount = cappedNum(body.questionCount, 5, 15, 8);
  const sourceText = cappedStr(body.sourceText, 6000, 'sourceText');
  const previousHashes = cappedArr(body.previousHashes, 100);
  const languageName = body.languageName || 'English';
  const messages = buildGenerateQuizPrompt({
    topic, sourceMaterial: sourceText, subject: ctx.subject, grade: ctx.grade, stream: ctx.stream,
    difficulty, count: questionCount, previousHashes, languageName
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.generateQuiz }, 0, null, 'generateQuiz');
  const text = (content === null || content === undefined) ? '' : String(content);
  if (!text.trim()) throw { status: 502, code: 'bad_response', message: 'The quiz generator returned an unexpected format. Please try again.' };
  let questions;
  const ab = text.indexOf('['), ae = text.lastIndexOf(']');
  if (ab !== -1 && ae > ab) {
    try { questions = JSON.parse(text.slice(ab, ae + 1)); } catch (e) { questions = undefined; }
  }
  if (!Array.isArray(questions)) {
    try {
      const parsed = parseModelJSON(text, 'The quiz generator returned an unexpected format. Please try again.');
      questions = Array.isArray(parsed) ? parsed : parsed.questions;
    } catch (e) {
      throw { status: 502, code: 'bad_response', message: "The quiz generator returned an unexpected format. Please try again." };
    }
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw { status: 502, code: 'bad_response', message: "No questions were generated. Try a different topic." };
  }
  // Validate + normalize + shuffle + dedup.
  const seenHashes = new Set(previousHashes);
  const valid = [];
  for (const q of questions) {
    if (!q || typeof q.question !== 'string') continue;
    const qtext = String(q.question).trim();
    if (qtext.length < 1 || qtext.length > 300) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    const opts = q.options.map(o => String(o === null || o === undefined ? '' : o).trim());
    if (opts.some(o => o.length === 0)) continue;
    if (new Set(opts).size !== 4) continue;
    let idx = Number(q.correctIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
    const { shuffled, newIdx } = shuffleOptions(opts, idx);
    const qHash = hashString(qtext + '|' + shuffled.join('|'));
    if (seenHashes.has(qHash)) continue;
    seenHashes.add(qHash);
    valid.push({
      question: cleanMathFormatting(qtext),
      options: shuffled.map(o => cleanMathFormatting(o)),
      correctIndex: newIdx,
      explanation: cleanMathFormatting(q.explanation ? String(q.explanation) : '')
    });
  }
  if (valid.length < 3) {
    throw { status: 502, code: 'bad_response', message: "The quiz generator returned too few valid questions. Try a different topic." };
  }
  return { questions: valid };
}

async function handlePracticeBit(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] practiceBit defaulted grade to 10');
  const topic = cappedStr(body.topic, 500, 'topic');
  const subjects = cappedArr(body.subjects, 10).map(s => cappedStr(s, MAX_SHORT, 'subjects[]'));
  let finalSubject = ctx.subject || subject;
  if (!finalSubject && Array.isArray(subjects) && subjects.length) {
    finalSubject = subjects[0];
  }
  if (!finalSubject) finalSubject = 'General';
  const finalTopic = topic || finalSubject;
  const languageName = body.languageName || 'English';
  const messages = buildPracticeBitPrompt({
    subject: finalSubject, grade: ctx.grade, stream: ctx.stream, topicHint: finalTopic, languageName
  });
  const text = (await callOpenRouter(messages, { temperature: TEMPERATURES.practiceBit }, 0, null, 'practiceBit')) || '';
  const result = parseModelJSON(text, 'The question generator returned an unexpected format. Please try again.');
  if (!result.question || typeof result.question !== 'string') {
    throw { status: 502, code: 'bad_response', message: 'The question generator returned an incomplete question. Please try again.' };
  }
  const question = cleanMathFormatting(stripDelimiterTags(String(result.question))).trim();
  if (question.length < 1 || question.length > 400) {
    throw { status: 502, code: 'bad_response', message: 'The question generator returned an invalid question length.' };
  }
  if (!result.correctAnswer || typeof result.correctAnswer !== 'string') {
    throw { status: 502, code: 'bad_response', message: 'The question generator returned an incomplete question. Please try again.' };
  }
  const correctAnswer = cleanMathFormatting(stripDelimiterTags(String(result.correctAnswer))).trim();
  if (correctAnswer.length < 1 || correctAnswer.length > 300) {
    throw { status: 502, code: 'bad_response', message: 'The question generator returned an invalid answer length.' };
  }
  let solution = '';
  if (result.solution) {
    solution = cleanMathFormatting(stripDelimiterTags(String(result.solution))).trim();
    if (solution.length > 400) solution = solution.slice(0, 400);
  }
  return { subject: finalSubject, question, correctAnswer, solution: solution || '', hint: '' };
}

async function handleCheckAnswer(body) {
  const question = cappedStr(body.question, 1000, 'question');
  const studentAnswer = cappedStr(body.studentAnswer, 1000, 'studentAnswer');
  if (!question || !studentAnswer) throw { status: 400, message: 'question and studentAnswer required' };
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] checkAnswer defaulted grade to 10');
  const referenceAnswer = cappedStr(body.correctAnswer || body.referenceAnswer, 1000, 'correctAnswer');
  const solution = cappedStr(body.solution, 1000, 'solution');
  const languageName = body.languageName || 'English';
  const messages = buildCheckAnswerPrompt({
    subject: ctx.subject, grade: ctx.grade, stream: ctx.stream, question,
    referenceAnswer, solution, studentAnswer, languageName
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.checkAnswer }, 0, null, 'checkAnswer');
  const result = parseModelJSON(content, 'The answer checker returned an unexpected format. Please try again.');
  const isCorrect = parseStrictBoolean(result.isCorrect);
  if (isCorrect === undefined) {
    throw { status: 502, code: 'bad_response', message: 'The answer checker returned an invalid isCorrect value.' };
  }
  let feedback = truncateFeedback(result.feedback);
  if (!feedback) {
    throw { status: 502, code: 'bad_response', message: 'The answer checker returned empty feedback.' };
  }
  let correctAnswer = referenceAnswer || '';
  if (result.correctAnswer) {
    correctAnswer = cleanMathFormatting(stripDelimiterTags(String(result.correctAnswer))).trim();
  }
  return {
    isCorrect,
    feedback: cleanMathFormatting(stripDelimiterTags(feedback)),
    correctAnswer: correctAnswer || ''
  };
}

async function handleGenerateRevision(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] generateRevision defaulted grade to 10');
  const chapter = cappedStr(body.chapter, 500, 'chapter');
  if (!chapter.trim()) throw { status: 400, message: 'chapter required' };
  const languageName = body.languageName || 'English';
  const messages = buildGenerateRevisionPrompt({
    subject: ctx.subject, chapter, grade: ctx.grade, stream: ctx.stream, languageName
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.generateRevision }, 0, null, 'generateRevision');
  const result = parseModelJSON(content, 'The revision generator returned an unexpected format. Please try again.');
  if (!Array.isArray(result.keyConcepts) || result.keyConcepts.length === 0 || !result.quickNotes) {
    throw { status: 502, code: 'bad_response', message: 'The revision generator returned an incomplete response. Please try again.' };
  }
  result.formulas = (result.formulas || []).map(f => cleanMathFormatting(stripDelimiterTags(String(f))));
  result.quickNotes = cleanMathFormatting(stripDelimiterTags(String(result.quickNotes || '')));
  result.practiceQuestions = (result.practiceQuestions || []).map(q => ({
    question: cleanMathFormatting(stripDelimiterTags(String(q.question))),
    answer: cleanMathFormatting(stripDelimiterTags(String(q.answer)))
  }));
  if (Array.isArray(result.keyConcepts)) result.keyConcepts = result.keyConcepts.map(v => cleanMathFormatting(stripDelimiterTags(String(v))));
  if (Array.isArray(result.checklist)) result.checklist = result.checklist.map(v => cleanMathFormatting(stripDelimiterTags(String(v))));
  else result.checklist = [];
  return result;
}

async function handleWeaknessAnalysis(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] weaknessAnalysis defaulted grade to 10');
  const subject = ctx.subject || cappedStr(body.subject, MAX_SHORT, 'subject');
  if (!subject) throw { status: 400, message: 'subject required' };
  const quizScores = cappedArr(body.quizScores, 20).map(Number).filter(n => !isNaN(n));
  const practiceBitAccuracy = cappedStr(body.practiceBitAccuracy, 50, 'practiceBitAccuracy');
  const daysSinceStudied = cappedStr(body.daysSinceStudied, 50, 'daysSinceStudied');
  const languageName = body.languageName || 'English';
  const messages = buildWeaknessAnalysisPrompt({
    subject, grade: ctx.grade, stream: ctx.stream, quizScores,
    practiceBitAccuracy, daysSinceStudied, languageName
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.weaknessAnalysis }, 0, null, 'weaknessAnalysis');
  const result = parseModelJSON(content, 'The weakness analyzer returned an unexpected format. Please try again.');
  if (!result.summary || !result.suggestion) {
    throw { status: 502, code: 'bad_response', message: 'The weakness analyzer returned an incomplete response. Please try again.' };
  }
  result.summary = cleanMathFormatting(stripDelimiterTags(String(result.summary)));
  result.suggestion = cleanMathFormatting(stripDelimiterTags(String(result.suggestion)));
  return result;
}

async function handleSubjectHealthNudge(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] subjectHealthNudge defaulted grade to 10');
  const subject = ctx.subject || cappedStr(body.subject, MAX_SHORT, 'subject');
  const status = cappedStr(body.status, 30, 'status');
  if (!subject) throw { status: 400, message: 'subject required' };
  if (!VALID_HEALTH_STATUSES.includes(status)) throw { status: 400, message: 'invalid status' };
  if (status === 'strong') return { nudge: '' };
  const languageName = body.languageName || 'English';
  const messages = buildSubjectHealthNudgePrompt({ subject, status, grade: ctx.grade, stream: ctx.stream, languageName });
  const nudgeRaw = await callOpenRouter(messages, { temperature: TEMPERATURES.subjectHealthNudge }, 0, null, 'subjectHealthNudge');
  const nudge = cleanMathFormatting(stripDelimiterTags(requireNonEmptyText(nudgeRaw, 'The nudge generator returned an empty response. Please try again.')));
  return { nudge };
}

async function handleScheduleNarrative(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] scheduleNarrative defaulted grade to 10');
  const { weeklyPlan } = body;
  if (!Array.isArray(weeklyPlan) || !weeklyPlan.length || weeklyPlan.length > 7) {
    throw { status: 400, message: 'weeklyPlan must be a 1-7 day array' };
  }
  if (JSON.stringify(weeklyPlan).length > MAX_JSON_BYTES) {
    throw { status: 413, message: 'weeklyPlan too large' };
  }
  const languageName = body.languageName || 'English';
  const messages = buildScheduleNarrativePrompt({ weeklyPlan, grade: ctx.grade, stream: ctx.stream, languageName });
  const narrativeRaw = await callOpenRouter(messages, { temperature: TEMPERATURES.scheduleNarrative }, 0, null, 'scheduleNarrative');
  const narrative = cleanMathFormatting(stripDelimiterTags(requireNonEmptyText(narrativeRaw, 'The schedule writer returned an empty response. Please try again.')));
  return { narrative };
}

async function handleNextBestAction(body) {
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (ctx.defaultedGrade) console.debug('[ai] nextBestAction defaulted grade to 10');
  const incompleteHomework = cappedArr(body.incompleteHomework, 10);
  const recentlyStudiedSubjects = cappedArr(body.recentlyStudiedSubjects, 30).map(s => cappedStr(s, MAX_SHORT, 'recentlyStudiedSubjects[]'));
  const allEnrolledSubjects = cappedArr(body.allEnrolledSubjects, 30).map(s => cappedStr(s, MAX_SHORT, 'allEnrolledSubjects[]'));
  const languageName = body.languageName || 'English';
  const messages = buildNextBestActionPrompt({
    incompleteHomework, recentlyStudiedSubjects, allEnrolledSubjects,
    grade: ctx.grade, stream: ctx.stream, languageName
  });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.nextBestAction }, 0, null, 'nextBestAction');
  const parsed = parseModelJSON(content, 'The study recommender returned an unexpected format. Please try again.');
  if (!parsed || !Array.isArray(parsed.priorities) || parsed.priorities.length === 0) {
    throw { status: 502, code: 'bad_response', message: 'The study recommender returned an incomplete response. Please try again.' };
  }
  parsed.priorities = parsed.priorities.slice(0, 3).map(p => ({
    action: String((p && p.action) || '').slice(0, 200),
    reason: String((p && p.reason) || '').slice(0, 200),
    estimatedMinutes: Math.min(90, Math.max(5, Number((p && p.estimatedMinutes)) || 25))
  })).filter(p => p.action);
  if (!parsed.priorities.length) throw { status: 502, code: 'bad_response', message: 'The study recommender returned an incomplete response. Please try again.' };
  return parsed;
}

async function handleClassPulse(body) {
  const completionPercent = cappedNum(body.completionPercent, 0, 100, 0);
  const notSubmittedCount = cappedNum(body.notSubmittedCount, 0, 10000, 0);
  const avgQuizScore = cappedNum(body.avgQuizScore, 0, 100, 0);
  const weakTopics = cappedArr(body.weakTopics, 30).map(s => cappedStr(s, MAX_SHORT, 'weakTopics[]'));
  const languageName = body.languageName || 'English';
  const messages = buildClassPulsePrompt({ completionPercent, notSubmittedCount, avgQuizScore, weakTopics, languageName });
  const content = await callOpenRouter(messages, { temperature: TEMPERATURES.classPulse }, 0, null, 'classPulse');
  const parsed = parseModelJSON(content, 'The class assistant returned an unexpected format. Please try again.');
  if (!parsed || !parsed.recommendation) {
    throw { status: 502, code: 'bad_response', message: 'The class assistant returned an incomplete response. Please try again.' };
  }
  parsed.recommendation = cleanMathFormatting(stripDelimiterTags(String(parsed.recommendation)));
  requireNonEmptyText(parsed.recommendation, 'The class assistant returned an empty response. Please try again.');
  return parsed;
}

async function handleWellbeingAssistant(body) {
  const message = cappedStr(body.message || body.prompt || '', 1500, 'message');
  const conversationHistory = cappedArr(body.conversationHistory, 20).map(m => ({
    role: m && m.role === 'assistant' ? 'assistant' : 'user',
    content: cappedStr(m && m.content, 2000, 'conversationHistory[]')
  }));
  const languageName = body.languageName || 'English';
  const studentName = cappedStr(body.studentName, 60, 'studentName');
  const ctx = sanitizeContext({ grade: body.grade, stream: body.stream, subject: body.subject });
  if (!message || !String(message).trim()) throw { status: 400, message: 'prompt required' };
  // SAFETY-CRITICAL: the crisis-keyword check runs BEFORE the model call and
  // its result travels with BOTH success and failure responses, so the
  // crisis-support banner never depends on AI success. Keyword lists are
  // intentionally narrow (high-precision phrases) — see client pre-check.
  const concernKeywords = [
    'hurt myself', 'suicide', 'kill myself', 'want to die', 'end it', 'self harm', 'self-harm', 'end my life', 'suicidal', 'take my life',
    'आत्महत्या', 'खुद को चोट', 'मरना चाहता', 'मरना चाहती', 'जीवन समाप्त', 'खुदकुशी',
    'আত্মহত্যা', 'নিজেকে আঘাত', 'মরে যেতে চাই',
    'आत्महत्या', 'स्वतःला इजा', 'मरायचे आहे',
    'ಆತ್ಮಹತ್ಯ', 'ನನ್ನನ್ನು ನಾನು ಗಾಯಪಡಿಸ 처치', 'ಚನಿಪೋವಾಲನಿ',
    'தற்கொலை', 'என்னை காயப்படுத்த', 'சாக விரும்புகிறேன்'
  ];
  const lowerMsg = String(message).toLowerCase();
  let escalationFlag = concernKeywords.some(kw => lowerMsg.includes(kw.toLowerCase()));
  if (!escalationFlag && Array.isArray(conversationHistory)) {
    for (const m of conversationHistory) {
      if (m && m.content && concernKeywords.some(kw => String(m.content).toLowerCase().includes(kw.toLowerCase()))) { escalationFlag = true; break; }
    }
  }
  const messages = buildWellbeingAssistantPrompt({ message, conversationHistory, languageName, studentName, grade: ctx.grade, stream: ctx.stream, subject: ctx.subject });
  let replyRaw;
  try {
    replyRaw = await callOpenRouter(messages, { temperature: TEMPERATURES.wellbeingAssistant }, 0, null, 'wellbeingAssistant');
  } catch (e) {
    if (typeof e === 'object' && e !== null) e.escalationFlag = escalationFlag;
    throw e;
  }
  const replyText = requireNonEmptyText(replyRaw, 'The wellbeing assistant returned an empty response. Please try again.');
  const replyClean = cleanMathFormatting(stripDelimiterTags(replyText));
  const finalReply = replyClean.replace(/AI Counselor/gi, 'Stuvo Wellbeing Assistant');
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

module.exports = async (req, res) => {  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let { action, language, languageName, ...body } = req.body || {};
  // Strip any client-supplied key material — AI always uses the server-side
  // OpenRouter key only. Never accept, log, or echo a user-provided key.
  delete body.apiKey;
  delete body.api_key;
  delete body.openrouter_key;
  delete body.openrouterApiKey;
  delete body.userKey;
  delete body.customKey;
  delete body.byok;
  delete body.authorization;
  delete body['x-api-key'];
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
    // Structured error contract: { ok:false, code, message, retryAfterSec? }
    // with the correct HTTP status. `code` is one of: daily_limit,
    // rate_limited, model_unavailable, account_issue, bad_response, timeout,
    // not_configured, upstream_error. Legacy fields (error, retryAfter, code
    // UPSTREAM_*) are kept alongside so older clients keep working; never
    // include prompts, keys, headers, or raw upstream bodies.
    const LEGACY_CODE_MAP = {
      UPSTREAM_RATE_LIMIT: 'rate_limited',
      UPSTREAM_MALFORMED: 'bad_response',
      UPSTREAM_NULL_CONTENT: 'bad_response',
      UPSTREAM_EMPTY: 'bad_response',
      UPSTREAM_REFUSAL: 'upstream_error',
    };
    let code = (e && e.code) || '';
    if (LEGACY_CODE_MAP[code]) code = LEGACY_CODE_MAP[code];
    const message = (e && e.message) || 'AI service error. Please try again.';
    const STATUS_BY_CODE = {
      daily_limit: 429,
      rate_limited: 429,
      model_unavailable: 502,
      account_issue: 502,
      bad_response: 502,
      timeout: 504,
      not_configured: 500,
      upstream_error: 502,
    };
    let status = (e && e.status) || 0;
    if (code && STATUS_BY_CODE[code]) {
      if (!(status === 429 || status === 402 || status === 504 || status === 500)) {
        status = STATUS_BY_CODE[code];
      }
    }
    if (!status) status = 500;
    const retryAfterSec = (e && Number(e.retryAfter) > 0)
      ? Math.min(Math.floor(Number(e.retryAfter)), 600) : 0;
    const payload = { ok: false, error: message, message };
    if (code) payload.code = code;
    if (retryAfterSec > 0) { payload.retryAfterSec = retryAfterSec; payload.retryAfter = retryAfterSec; }
    if (e && e.model) payload.model = e.model;
    if (e && e.corrId) payload.corrId = e.corrId;
    if (e && Array.isArray(e.triedModels) && e.triedModels.length) payload.triedModels = e.triedModels.slice(0, 5);
    if (e && e.scope) payload.scope = e.scope;
    if (e && e.upstreamType) payload.upstreamType = e.upstreamType;
    // Wellbeing safety: the pre-call escalation flag travels on failures too.
    if (e && typeof e.escalationFlag === 'boolean') payload.escalationFlag = e.escalationFlag;
    console.error(`Error in action "${action}":`, message,
      code ? `(code=${code}${e && e.scope ? `, scope=${e.scope}` : ''}${e && e.model ? `, model=${e.model}` : ''}${e && e.corrId ? `, corrId=${e.corrId}` : ''})` : '');
    // TEMP-DIAG (missing-response investigation): one structured line per
    // failed /api/ai call — action, final client HTTP status, contract code,
    // model, corrId. Join with the lib's [TEMP-DIAG] lines via corrId.
    // No prompts, keys, headers, or bodies. Remove when closed.
    try {
      console.error(`[TEMP-DIAG] action=${action} clientStatus=${status} code=${code || 'none'} model=${(e && e.model) || 'none'} corrId=${(e && e.corrId) || 'none'}`);
    } catch (x) {}
    res.status(status).json(payload);
  }
};

// Named exports for testing validators.
module.exports.parseStrictBoolean = parseStrictBoolean;
module.exports.shuffleOptions = shuffleOptions;
module.exports.truncateFeedback = truncateFeedback;
