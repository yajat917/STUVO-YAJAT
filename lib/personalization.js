/**
 * Personalization helpers — fetch enrolled class subjects and merge with taxonomy.
 * Must be loaded after firebase.js (provides db, getDoc, doc, getDocs, collection) and lib/subjectTaxonomy.js
 */
async function fetchEnrolledSubjects(uid, classIds) {
  var ids = Array.isArray(classIds) ? classIds : [];
  if (!ids.length) return [];
  var subjects = new Set();
  for (var i = 0; i < ids.length; i++) {
    try {
      var snap = await getDoc(doc(db, 'classes', ids[i]));
      if (snap.exists) {
        var data = snap.data();
        if (data.subject) subjects.add(data.subject);
      }
    } catch (e) {}
  }
  return Array.from(subjects);
}

async function fetchPersonalizedSubjects(uid, grade, stream, classIds) {
  var enrolled = await fetchEnrolledSubjects(uid, classIds);
  if (typeof getMergedSubjects === 'function') {
    return getMergedSubjects(grade, stream, enrolled);
  }
  if (typeof getSubjectsForStudent === 'function') {
    var taxonomy = getSubjectsForStudent(grade, stream);
    if (!taxonomy.length) return enrolled;
    var merged = new Set([].concat(taxonomy, enrolled));
    return Array.from(merged);
  }
  return enrolled;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchEnrolledSubjects, fetchPersonalizedSubjects };
}
if (typeof window !== 'undefined') {
  window.fetchEnrolledSubjects = fetchEnrolledSubjects;
  window.fetchPersonalizedSubjects = fetchPersonalizedSubjects;
}
