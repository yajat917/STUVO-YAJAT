/**
 * StudyOS cloud sync — Firestore single source of truth.
 * Mirrors the Stuvo derivation (lib/xpFromActivity.js) for the legacy app.
 * Local localStorage remains strictly a cache, overwritten by cloud.
 * No animations. No colors. Never throws. Never blocks local saves.
 */
(function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyCvhZBrlpM1xYgTumGq7uesMTsvAhlRWK8",
    authDomain: "stuvo-2adff.firebaseapp.com",
    projectId: "stuvo-2adff",
    storageBucket: "stuvo-2adff.firebasestorage.app",
    messagingSenderId: "29760452841",
    appId: "1:29760452841:web:b5cc80456e749825001878"
  };

  var _db = null;
  var _auth = null;
  var _ready = false;

  function init() {
    try {
      if (typeof firebase === 'undefined') return;
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      try { _auth = firebase.auth(); } catch (e) {}
      try { _db = firebase.firestore(); } catch (e) {}
      _ready = !!(_db && _auth);
    } catch (e) { _ready = false; }
  }

  try {
    if (typeof firebase !== 'undefined') init();
    else if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', init);
      // Retry once in case compat scripts load after this file (defer order).
      setTimeout(init, 1500);
    }
  } catch (e) {}

  function getUid() {
    try {
      if (_auth && _auth.currentUser && _auth.currentUser.uid) return _auth.currentUser.uid;
      // Compat persistence shares localStorage with Stuvo on the same origin,
      // so a Stuvo sign-in is visible here after reload.
    } catch (e) {}
    return null;
  }

  function toDateSafe(v) {
    try {
      if (typeof window !== 'undefined' && window.XpFromActivity && window.XpFromActivity.toDateSafe) {
        return window.XpFromActivity.toDateSafe(v);
      }
    } catch (e) {}
    if (!v) return null;
    try {
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v.toDate === 'function') { var d = v.toDate(); return (d instanceof Date && !isNaN(d.getTime())) ? d : null; }
      if (typeof v.seconds === 'number') { var d2 = new Date(v.seconds * 1000); return isNaN(d2.getTime()) ? null : d2; }
      if (typeof v === 'string') { var d3 = new Date(v.indexOf('T') !== -1 ? v : v + 'T12:00:00'); return isNaN(d3.getTime()) ? null : d3; }
    } catch (e) {}
    return null;
  }

  function istKey(d) {
    try {
      if (typeof window !== 'undefined' && window.XpFromActivity && window.XpFromActivity.istDayKey) {
        var k = window.XpFromActivity.istDayKey(d);
        if (k) return k;
      }
    } catch (e) {}
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d instanceof Date ? d : new Date());
    } catch (e2) {}
    var t = (d instanceof Date) ? d : new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  async function readCloud() {
    var uid = getUid();
    if (!uid || !_db) return null;
    try {
      var actSnap = await _db.collection('users').doc(uid).collection('studyActivity').get();
      var quizSnap = await _db.collection('users').doc(uid).collection('quizHistory').get();
      var acts = [];
      actSnap.forEach(function (doc) { acts.push(Object.assign({ _id: doc.id }, doc.data())); });
      var quizzes = [];
      quizSnap.forEach(function (doc) { quizzes.push(Object.assign({ _id: doc.id }, doc.data())); });
      var totalXP = 0, focusMinutes = 0, focusSessions = 0, totalFocusMinutes = 0;
      var todayK = istKey(new Date());
      var daySet = {};
      try {
        if (window.XpFromActivity) {
          totalXP = window.XpFromActivity.totalXPFromCloud(acts, quizzes);
          var ft = window.XpFromActivity.focusTodayFromActivities(acts, todayK);
          focusMinutes = ft.minutes; focusSessions = ft.sessions;
          acts.forEach(function (a) {
            if (a && a.type === 'focus') totalFocusMinutes += Math.max(0, Math.floor(Number(a.durationMinutes) || 0));
          });
          var st = window.XpFromActivity.streakFromActivities(acts, quizzes, todayK);
          var badges = window.XpFromActivity.badgesForXP(totalXP);
          return { uid: uid, totalXP: totalXP, focusTodayMinutes: focusMinutes, focusTodaySessions: focusSessions, totalFocusMinutes: totalFocusMinutes, streak: st, badges: badges, todayKey: todayK, activityCount: acts.length };
        }
      } catch (e) {}
      // Inline fallback.
      acts.forEach(function (a) {
        var xp = 0;
        if (typeof a.xp === 'number' && a.xp > 0) xp = Math.floor(a.xp);
        else if (typeof a.xpAwarded === 'number' && a.xpAwarded > 0) xp = Math.floor(a.xpAwarded);
        else if ((a.type || 'focus') === 'focus') xp = Math.max(0, Math.floor(Number(a.durationMinutes) || 0));
        else if (a.type === 'doubt_asked' || a.type === 'revision') xp = 10;
        totalXP += xp;
        if (a && a.type === 'focus') totalFocusMinutes += Math.max(0, Math.floor(Number(a.durationMinutes) || 0));
        var d = toDateSafe(a.completedAt) || toDateSafe(a.createdAt);
        if (d) {
          var k = istKey(d);
          if (k) daySet[k] = true;
          if (a.type === 'focus' && k === todayK) {
            var m = Math.floor(Number(a.durationMinutes) || 0);
            if (m > 0) { focusMinutes += m; focusSessions += 1; }
          }
        }
      });
      totalXP += quizzes.length * 10;
      quizzes.forEach(function (q) { var d = toDateSafe(q.createdAt); if (d) { var k = istKey(d); if (k) daySet[k] = true; } });
      var streak = 0;
      var cur = toDateSafe(todayK) || new Date();
      if (!daySet[todayK]) {
        var y = new Date(cur.getTime() - 86400000);
        if (!daySet[istKey(y)]) streak = 0;
        else { cur = y; for (var i = 0; i < 365; i++) { var ky = istKey(cur); if (!ky || !daySet[ky]) break; streak++; cur = new Date(cur.getTime() - 86400000); } }
      } else {
        for (var j = 0; j < 365; j++) { var kj = istKey(cur); if (!kj || !daySet[kj]) break; streak++; cur = new Date(cur.getTime() - 86400000); }
      }
      return { uid: uid, totalXP: totalXP, focusTodayMinutes: focusMinutes, focusTodaySessions: focusSessions, totalFocusMinutes: totalFocusMinutes, streak: streak, badges: [], todayKey: todayK, activityCount: acts.length };
    } catch (e) { return null; }
  }

  async function writeFocus(durationMinutes, xpAwarded) {
    var uid = getUid();
    if (!uid || !_db) return false;
    try {
      var mins = Math.max(1, Math.floor(Number(durationMinutes) || 0));
      if (!(mins >= 1)) return false;
      var payload = {
        type: 'focus', subject: 'General', durationMinutes: mins,
        relatedHomeworkId: null, relatedClassId: null,
        xp: (typeof xpAwarded === 'number' && xpAwarded > 0) ? Math.floor(xpAwarded) : mins,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await _db.collection('users').doc(uid).collection('studyActivity').add(payload);
      return true;
    } catch (e) { return false; }
  }

  function syncCacheFromCloud(cloud) {
    try {
      if (!cloud || typeof cloud.totalXP !== 'number') return;
      if (typeof getData !== 'function' || typeof saveData !== 'function') return;
      var cur = getData();
      var badges = (cloud.badges && cloud.badges.length) ? cloud.badges.slice() : ((cur.gamification && cur.gamification.badges) || []);
      // Preserve local-only badge ids not in cloud list (union, never shrink).
      try {
        ((cur.gamification && cur.gamification.badges) || []).forEach(function (b) { if (badges.indexOf(b) === -1) badges.push(b); });
      } catch (e) {}
      var focusSessions = (cur.gamification && cur.gamification.focusSessions) || 0;
      if (typeof cloud.activityCount === 'number' && cloud.activityCount > focusSessions) {
        focusSessions = cloud.activityCount;
      }
      var next = {
        gamification: Object.assign({}, cur.gamification, {
          xp: cloud.totalXP,
          streak: cloud.streak || 0,
          lastStudyDate: cloud.todayKey || (cur.gamification && cur.gamification.lastStudyDate),
          badges: badges,
          focusSessions: focusSessions
        })
      };
      saveData({ gamification: next.gamification });
    } catch (e) {}
  }

  try {
    window.StuvoCloud = {
      getUid: getUid,
      readCloud: readCloud,
      writeFocus: writeFocus,
      syncCacheFromCloud: syncCacheFromCloud,
      isReady: function () { init(); return _ready; }
    };
  } catch (e) {}
})();
