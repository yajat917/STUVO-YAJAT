async function getNextBestAction(uid, enrolledClassIds) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
  const homeworkItems = [];
  for (const classId of enrolledClassIds) {
    const hwSnap = await getDocs(collection(db, 'classes', classId, 'homework'));
    hwSnap.forEach(doc => homeworkItems.push({ id: doc.id, classId, ...doc.data() }));
  }
  const submissionsSnap = await Promise.all(
    homeworkItems.map(hw =>
      getDoc(doc(db, 'classes', hw.classId, 'homework', hw.id, 'submissions', uid))
    )
  );
  const incomplete = homeworkItems.filter((hw, i) => !submissionsSnap[i].exists);
  incomplete.sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline) : new Date(8640000000000000);
    const dbd = b.deadline ? new Date(b.deadline) : new Date(8640000000000000);
    return da - dbd;
  });
  let recentSubjects = new Set();
  try {
    const recentActivitySnap = await getDocs(query(collection(db, 'users', uid, 'studyActivity'), orderBy('completedAt', 'desc'), limit(20)));
    recentActivitySnap.forEach(d => { const s = d.data().subject; if (s) recentSubjects.add(s); });
  } catch(e) {}
  const allEnrolledSubjects = [...new Set(homeworkItems.map(h => h.subject).filter(Boolean))];
  const context = {
    incompleteHomework: incomplete.slice(0, 5).map(hw => ({
      title: hw.title, subject: hw.subject || 'General',
      hoursUntilDue: Math.round(((hw.deadline ? new Date(hw.deadline) : new Date(Date.now()+86400000*7)) - new Date()) / 3600000)
    })),
    recentlyStudiedSubjects: [...recentSubjects],
    allEnrolledSubjects
  };
  try {
    let grade = '';
    let languageName = 'English';
    try {
      if (typeof appState !== 'undefined' && appState.userData && appState.userData.grade != null) grade = String(appState.userData.grade);
      const code = (typeof window !== 'undefined' && window.currentUserLanguage) ? window.currentUserLanguage : 'en';
      const names = { en: 'English', hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu', ta: 'Tamil' };
      languageName = names[code] || code || 'English';
    } catch (e) {}
    const data = await safeApiCall('/api/ai', { action: 'nextBestAction', grade, languageName, ...context });
    return data;
  } catch (e) {
    return {
      priorities: incomplete.slice(0,3).map(hw => ({
        action: `Finish ${hw.title}`,
        reason: `due ${hw.deadline || 'soon'}`,
        estimatedMinutes: 25
      }))
    };
  }
}