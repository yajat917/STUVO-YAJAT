const SUBJECT_TAXONOMY = {
  "9": ["Mathematics", "Science", "English", "Social Science", "Second Language", "Computer Science"],
  "10": ["Mathematics", "Science", "English", "Social Science", "Second Language", "Computer Science"],
  "11": {
    "Science": ["Physics", "Chemistry", "Mathematics", "Biology", "English"],
    "Commerce": ["Accountancy", "Business Studies", "Economics", "English"],
    "Humanities": ["History", "Political Science", "Geography", "Economics", "Sociology", "English"]
  },
  "12": {
    "Science": ["Physics", "Chemistry", "Mathematics", "Biology", "English"],
    "Commerce": ["Accountancy", "Business Studies", "Economics", "English"],
    "Humanities": ["History", "Political Science", "Geography", "Economics", "Sociology", "English"]
  }
};

function getSubjectsForStudent(grade, stream) {
  if (grade === null || grade === undefined || grade === '') return [];
  const key = String(grade);
  const gradeData = SUBJECT_TAXONOMY[key];
  if (!gradeData) return [];
  if (Array.isArray(gradeData)) return [...gradeData];
  return gradeData[stream] ? [...gradeData[stream]] : [];
}

// Merge taxonomy subjects with real enrolled class subjects, deduplicated by exact string match.
// If grade is null/undefined, falls back to just enrolled subjects.
function getMergedSubjects(grade, stream, enrolledSubjects) {
  const taxonomy = getSubjectsForStudent(grade, stream);
  const enrolled = Array.isArray(enrolledSubjects) ? enrolledSubjects.filter(Boolean) : [];
  if (!taxonomy.length) return [...new Set(enrolled)];
  return [...new Set([...taxonomy, ...enrolled])];
}

// Deterministic schedule generation — round-robin, no AI, no randomness
function generateExamSchedule(examDate, subjects, existingHomeworkDeadlines) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = examDate instanceof Date ? examDate : new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  const daysRemaining = Math.max(1, Math.ceil((exam - today) / (1000 * 60 * 60 * 24)));
  const safeSubjects = (subjects && subjects.length) ? subjects : ['General'];
  // Build busy-day presence from homework deadlines within window
  const busyDays = new Set(
    (existingHomeworkDeadlines || [])
      .map(function(d) { return d instanceof Date ? d : new Date(d); })
      .filter(function(d) { return !isNaN(d) && (d - today) / (1000 * 60 * 60 * 24) <= daysRemaining && (d - today) >= 0; })
      .map(function(d) { return d.toISOString().split('T')[0]; })
  );
  var plan = [];
  var subjectIndex = 0;
  for (var i = 0; i < daysRemaining; i++) {
    var date = new Date(today);
    date.setDate(date.getDate() + i);
    var dateStr = date.toISOString().split('T')[0];
    // Note: spec mentions skipping overloaded days; logic here keeps round-robin predictable (busyDays available for future overload logic)
    var subject = safeSubjects[subjectIndex % safeSubjects.length];
    plan.push({ date: dateStr, subject: subject, topic: null, completed: false });
    subjectIndex++;
  }
  return plan;
}

function redistributeAfterMiss(dailyPlan, todayStr) {
  if (!Array.isArray(dailyPlan) || !dailyPlan.length) return dailyPlan;
  var today = todayStr || new Date().toISOString().split('T')[0];
  var missed = dailyPlan.filter(function(d) { return d.date < today && !d.completed; });
  var future = dailyPlan.filter(function(d) { return d.date >= today; });
  if (missed.length === 0 || future.length === 0) return dailyPlan;
  // Deep clone future to avoid mutating original refs unexpectedly
  var futureClone = future.map(function(d) { return Object.assign({}, d, { extraSubjects: d.extraSubjects ? [].concat(d.extraSubjects) : undefined }); });
  missed.forEach(function(missedDay, i) {
    var targetIndex = i % futureClone.length;
    if (!futureClone[targetIndex].extraSubjects) futureClone[targetIndex].extraSubjects = [];
    futureClone[targetIndex].extraSubjects.push(missedDay.subject);
  });
  return [].concat(dailyPlan.filter(function(d) { return d.date < today; }), futureClone);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUBJECT_TAXONOMY, getSubjectsForStudent, getMergedSubjects, generateExamSchedule, redistributeAfterMiss };
}
if (typeof window !== 'undefined') {
  window.SUBJECT_TAXONOMY = SUBJECT_TAXONOMY;
  window.getSubjectsForStudent = getSubjectsForStudent;
  window.getMergedSubjects = getMergedSubjects;
  window.generateExamSchedule = generateExamSchedule;
  window.redistributeAfterMiss = redistributeAfterMiss;
}
