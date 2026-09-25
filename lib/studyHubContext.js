/**
 * Study Hub Brain — shared context, computed once per Study Hub visit.
 * Every Study Hub module must use this cached context instead of querying
 * Firestore independently for grade/subjects/weak-subjects/deadlines.
 *
 * Must load after: firebase.js (db + helpers), lib/subjectTaxonomy.js
 * (getSubjectsForStudent). index.html includes it before studyHub.js.
 */

var _studyHubContextCache = null; // { key, ts, data }
var STUDY_HUB_CONTEXT_TTL_MS = 5 * 60 * 1000;

var STUDY_HUB_LANG_NAMES = { en: 'English', hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu', ta: 'Tamil' };

function resolveStudyHubLanguageName() {
  try {
    var raw = (typeof window !== 'undefined' && window.currentUserLanguage) ? window.currentUserLanguage : 'English';
    if (STUDY_HUB_LANG_NAMES[raw]) return STUDY_HUB_LANG_NAMES[raw];
    return raw || 'English';
  } catch (e) { return 'English'; }
}

// Read a Firestore Timestamp-ish value into a JS Date (or null).
function studyHubToDate(v) {
  if (!v) return null;
  try {
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v.toDate === 'function') { var d = v.toDate(); return (d instanceof Date && !isNaN(d)) ? d : null; }
    if (typeof v.seconds === 'number') { var d2 = new Date(v.seconds * 1000); return isNaN(d2) ? null : d2; }
    if (typeof v === 'string') {
      var s = v.indexOf('T') !== -1 ? v : v + 'T23:59:59';
      var d3 = new Date(s);
      return isNaN(d3) ? null : d3;
    }
  } catch (e) {}
  return null;
}

/**
 * Compute the shared Study Hub context for a student.
 * @param {string} uid - student uid
 * @param {object} [injectedDb] - optional admin-style Firestore (db.collection(...)) for Node/tests.
 *   In the browser the global compat `db` (or modular helpers) is used.
 */
async function getStudyHubContext(uid, injectedDb) {
  if (!uid) throw new Error('getStudyHubContext: uid required');

  // Session cache — same visit reuses, no refetch.
  // Cache key includes resolved language so a mid-session language switch
  // never serves AI context (languageName) stale for up to 5 minutes.
  var _ctxLang = resolveStudyHubLanguageName();
  var cacheKey = String(uid) + '|' + _ctxLang;
  if (_studyHubContextCache && _studyHubContextCache.key === cacheKey &&
      (Date.now() - _studyHubContextCache.ts) < STUDY_HUB_CONTEXT_TTL_MS) {
    return _studyHubContextCache.data;
  }

  var useChain = null; // admin/compat style db with .collection()
  if (injectedDb && typeof injectedDb.collection === 'function') {
    useChain = injectedDb;
  } else if (typeof db !== 'undefined' && db && typeof db.collection === 'function') {
    useChain = db;
  }
  var useModular = !useChain && (typeof collection === 'function') && (typeof getDocs === 'function') &&
    (typeof db !== 'undefined' && db);
  if (!useChain && !useModular) throw new Error('getStudyHubContext: no Firestore db available');

  async function getUserDoc(id) {
    try {
      if (useChain) {
        var snap = await useChain.collection('users').doc(id).get();
        return snap.exists ? snap.data() : {};
      }
      var s = await getDoc(doc(db, 'users', id));
      return s.exists ? s.data() : {};
    } catch (e) { return {}; }
  }

  // orderBy(...).limit(...) subcollection read with graceful fallbacks
  async function readSubcollection(userId, sub, orderField, direction, lim) {
    var out = [];
    // 1) full ordered+limited query
    try {
      var snap;
      if (useChain) {
        snap = await useChain.collection('users').doc(userId).collection(sub)
          .orderBy(orderField, direction).limit(lim).get();
      } else {
        snap = await getDocs(query(collection(db, 'users', userId, sub), orderBy(orderField, direction), limit(lim)));
      }
      snap.forEach(function (d) { out.push(Object.assign({ _id: d.id }, d.data())); });
      return out;
    } catch (e) {}
    // 2) unordered fallback (missing index / ordering field)
    try {
      var snap2;
      if (useChain) {
        snap2 = await useChain.collection('users').doc(userId).collection(sub).get();
      } else {
        snap2 = await getDocs(collection(db, 'users', userId, sub));
      }
      snap2.forEach(function (d) { out.push(Object.assign({ _id: d.id }, d.data())); });
      return out.slice(0, lim);
    } catch (e2) { return out; }
  }

  var user = await getUserDoc(uid);
  var grade = (user.grade !== undefined && user.grade !== null && String(user.grade).trim() !== '')
    ? String(user.grade).trim() : null;
  var stream = user.stream || null;
  var classIds = Array.isArray(user.classIds) ? user.classIds : [];

  var taxonomySubjects = [];
  try {
    if (grade && typeof getSubjectsForStudent === 'function') {
      taxonomySubjects = getSubjectsForStudent(grade, stream) || [];
    }
  } catch (e) { taxonomySubjects = []; }

  // Enrolled class subjects (needed for allSubjects union + deadlines below)
  var classDocs = [];
  var enrolledSubjects = [];
  for (var ci = 0; ci < classIds.length; ci++) {
    try {
      var cdata = null;
      if (useChain) {
        var csnap = await useChain.collection('classes').doc(classIds[ci]).get();
        if (csnap.exists) cdata = csnap.data();
      } else {
        var cs = await getDoc(doc(db, 'classes', classIds[ci]));
        if (cs.exists) cdata = cs.data();
      }
      if (cdata) {
        classDocs.push({ id: classIds[ci], data: cdata });
        if (cdata.subject) enrolledSubjects.push(cdata.subject);
      }
    } catch (e) {}
  }
  enrolledSubjects = [...new Set(enrolledSubjects)];
  var allSubjects = [...new Set([...taxonomySubjects, ...enrolledSubjects])];

  var recentActivity = await readSubcollection(uid, 'studyActivity', 'completedAt', 'desc', 30);
  var quizHistory = await readSubcollection(uid, 'quizHistory', 'createdAt', 'desc', 20);

  // Compute weak subjects from real data — never invented.
  // A subject is weak when it has >= 2 scored quizzes averaging below 60%.
  var subjectScores = {};
  quizHistory.forEach(function (q) {
    if (!q.subject) return;
    var score = Number(q.score);
    var total = Number(q.totalQuestions);
    if (isNaN(score) || isNaN(total) || total <= 0) return;
    if (!subjectScores[q.subject]) subjectScores[q.subject] = [];
    subjectScores[q.subject].push(score / total);
  });
  var weakSubjects = Object.entries(subjectScores)
    .filter(function (entry) {
      var scores = entry[1];
      if (scores.length < 2) return false;
      var avg = scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
      return avg < 0.6;
    })
    .map(function (entry) { return entry[0]; });

  // Upcoming homework deadlines across enrolled classes (top 5, soonest first)
  var homeworkItems = [];
  for (var hi = 0; hi < classDocs.length; hi++) {
    var cd = classDocs[hi];
    try {
      var hwList = [];
      if (useChain) {
        var hwSnap = await useChain.collection('classes').doc(cd.id).collection('homework').get();
        hwSnap.forEach(function (d) { hwList.push(Object.assign({ id: d.id }, d.data())); });
      } else {
        var hwSnap2 = await getDocs(collection(db, 'classes', cd.id, 'homework'));
        hwSnap2.forEach(function (d) { hwList.push(Object.assign({ id: d.id }, d.data())); });
      }
      hwList.forEach(function (hw) {
        homeworkItems.push(Object.assign({ classId: cd.id }, hw));
      });
    } catch (e) {}
  }
  var now = new Date();
  var upcomingDeadlines = homeworkItems
    .map(function (hw) { return { hw: hw, date: studyHubToDate(hw.deadline) }; })
    .filter(function (x) { return x.date && x.date > now; })
    .sort(function (a, b) { return a.date - b.date; })
    .slice(0, 5)
    .map(function (x) {
      return {
        id: x.hw.id, classId: x.hw.classId,
        title: x.hw.title || 'Homework',
        subject: x.hw.subject || 'General',
        deadline: x.hw.deadline,
        deadlineDate: x.date
      };
    });

  var currentStreak = 0;
  try {
    if (useChain) {
      var streakSnap = await useChain.collection('users').doc(uid).collection('studyPlanner').doc('streak').get();
      currentStreak = streakSnap.exists ? (streakSnap.data().count || 0) : 0;
    } else {
      var streakS = await getDoc(doc(db, 'users', uid, 'studyPlanner', 'streak'));
      currentStreak = streakS.exists ? (streakS.data().count || 0) : 0;
    }
  } catch (e) { currentStreak = 0; }

  var ctx = {
    uid: uid,
    grade: grade,
    stream: stream,
    subjects: allSubjects,
    recentActivity: recentActivity,
    quizHistory: quizHistory,
    weakSubjects: weakSubjects,
    upcomingDeadlines: upcomingDeadlines,
    currentStreak: currentStreak,
    languageName: _ctxLang
  };

  _studyHubContextCache = { key: cacheKey, ts: Date.now(), data: ctx };
  try {
    if (typeof window !== 'undefined') window.studyHubContext = ctx;
  } catch (e) {}
  return ctx;
}

function resetStudyHubContext() {
  _studyHubContextCache = null;
  try {
    if (typeof window !== 'undefined') window.studyHubContext = null;
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.getStudyHubContext = getStudyHubContext;
  window.resetStudyHubContext = resetStudyHubContext;
  window.studyHubContext = window.studyHubContext || null;
  // Invalidate the 5-min cache the moment the language changes so the next
  // getStudyHubContext() recomputes languageName instead of serving stale AI lang.
  try {
    if (!window._studyHubLangInvalidationBound) {
      window._studyHubLangInvalidationBound = true;
      window.addEventListener('languageChanged', function () { resetStudyHubContext(); });
    }
  } catch (e) {}
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStudyHubContext: getStudyHubContext, resetStudyHubContext: resetStudyHubContext };
}
