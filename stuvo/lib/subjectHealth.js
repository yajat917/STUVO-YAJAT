/**
 * Subject Health Check — computation logic (deterministic, reusable)
 * Used by Study Hub health bar and potentially elsewhere.
 * Depends on Firestore compat helpers: collection, query, where, orderBy, limit, getDocs, db
 * Exposed as window.computeSubjectHealth when loaded in browser.
 */

async function computeSubjectHealth(uid, subjects) {
  if (!uid || !Array.isArray(subjects) || !subjects.length) return {};
  var results = {};
  for (var si = 0; si < subjects.length; si++) {
    var subject = subjects[si];
    var quizHistorySnap = { size: 0, docs: [] };
    var practiceBitsSnap = { size: 0, docs: [] };
    var activitySnap = { empty: true, docs: [] };
    try {
      // quizHistory
      var qCol = collection(db, 'users', uid, 'quizHistory');
      var qQ = query(qCol, where('subject', '==', subject), orderBy('createdAt', 'desc'), limit(5));
      quizHistorySnap = await getDocs(qQ);
    } catch (e) { /* treat as empty */ }
    try {
      var pCol = collection(db, 'users', uid, 'practiceBits');
      var pQ = query(pCol, where('subject', '==', subject), orderBy('createdAt', 'desc'), limit(5));
      practiceBitsSnap = await getDocs(pQ);
    } catch (e) {}
    try {
      var aCol = collection(db, 'users', uid, 'studyActivity');
      var aQ = query(aCol, where('subject', '==', subject), orderBy('completedAt', 'desc'), limit(1));
      activitySnap = await getDocs(aQ);
    } catch (e) {}
    var totalDataPoints = (quizHistorySnap.size || 0) + (practiceBitsSnap.size || 0);
    if (totalDataPoints < 2) {
      results[subject] = { status: 'insufficient_data', label: 'Not enough data yet' };
      continue;
    }
    var quizAvg = null;
    if (quizHistorySnap.docs && quizHistorySnap.docs.length > 0) {
      var sum = 0; var cnt = 0;
      quizHistorySnap.docs.forEach(function(d) {
        var data = d.data();
        var score = Number(data.score);
        var total = Number(data.totalQuestions);
        if (!isNaN(score) && !isNaN(total) && total > 0) { sum += (score / total); cnt++; }
      });
      if (cnt > 0) quizAvg = sum / cnt;
    }
    var daysSinceStudied = 999;
    if (activitySnap.docs && activitySnap.docs.length > 0) {
      var docData = activitySnap.docs[0].data();
      var completedAt = docData.completedAt;
      var ts = null;
      if (completedAt && completedAt.toDate) ts = completedAt.toDate();
      else if (completedAt instanceof Date) ts = completedAt;
      else if (completedAt && completedAt.seconds) ts = new Date(completedAt.seconds * 1000);
      if (ts) daysSinceStudied = (new Date() - ts) / (1000 * 60 * 60 * 24);
    } else if (activitySnap.empty) {
      daysSinceStudied = 999;
    }
    var status;
    if ((quizAvg !== null && quizAvg < 0.5) || daysSinceStudied > 14) status = 'needs_attention';
    else if ((quizAvg !== null && quizAvg < 0.75) || daysSinceStudied > 7) status = 'steady';
    else status = 'strong';
    results[subject] = { status: status, quizAvg: quizAvg, daysSinceStudied: Math.round(daysSinceStudied) };
  }
  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSubjectHealth };
}
if (typeof window !== 'undefined') {
  window.computeSubjectHealth = computeSubjectHealth;
}
