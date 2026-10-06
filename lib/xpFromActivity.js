/**
 * xpFromActivity — single source of truth for XP / Focus Time / streak.
 * Derives all values from Firestore studyActivity (+ quizHistory).
 * No localStorage. No animations. No colors.
 *
 * Must load BEFORE lib/studyHubContext.js in stuvo/index.html
 * and before studyos pages that use it.
 */

(function (root) {
  'use strict';

  var IST_TZ = 'Asia/Kolkata';

  // XP defaults per studyActivity type when explicit `xp` field is absent
  // (legacy docs written before xpAwarded existed).
  // focus: 1 XP per minute (25m=25, 50m=50; flexible 45m yields 45, which is
  //   the honest duration-based value going forward — new docs store exact xp).
  // doubt_asked: 10 (main submit path; simpler-variant 5s are preserved via xp field).
  // revision: 10. quiz completion: 10 per quizHistory doc. fallback: 5.
  var XP_DEFAULTS = {
    focus: null, // duration-based
    doubt_asked: 10,
    revision: 10,
    quiz: 10
  };

  var BADGES_DEF = [
    { id: 'first-session', xpRequired: 25 },
    { id: 'plan-master', xpRequired: 50 },
    { id: 'streak-3', xpRequired: 75 },
    { id: 'week-warrior', xpRequired: 100 },
    { id: 'scholar', xpRequired: 200 }
  ];

  function toDateSafe(v) {
    if (!v) return null;
    try {
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v.toDate === 'function') {
        var d = v.toDate();
        return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
      }
      if (typeof v.seconds === 'number') {
        var d2 = new Date(v.seconds * 1000);
        return isNaN(d2.getTime()) ? null : d2;
      }
      if (typeof v === 'string') {
        // Bare YYYY-MM-DD means that IST calendar day at noon (avoids TZ shift).
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          var parts = v.split('-');
          var dd = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 6, 30, 0));
          return isNaN(dd.getTime()) ? null : dd;
        }
        var d3 = new Date(v);
        return isNaN(d3.getTime()) ? null : d3;
      }
      if (typeof v === 'number') {
        var d4 = new Date(v);
        return isNaN(d4.getTime()) ? null : d4;
      }
    } catch (e) {}
    return null;
  }

  // IST calendar day key YYYY-MM-DD for any Timestamp-ish value.
  function istDayKey(v) {
    var d = (v instanceof Date) ? v : toDateSafe(v);
    if (!d) return null;
    try {
      // en-CA yields YYYY-MM-DD in the requested timeZone.
      var fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
      });
      return fmt.format(d);
    } catch (e) {
      // Fallback: UTC+5:30 arithmetic (no Intl available).
      var shifted = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
      var m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      var day = String(shifted.getUTCDate()).padStart(2, '0');
      return shifted.getUTCFullYear() + '-' + m + '-' + day;
    }
  }

  function istTodayKey(now) {
    return istDayKey(now instanceof Date ? now : new Date());
  }

  function activityDate(activity) {
    if (!activity) return null;
    return toDateSafe(activity.completedAt) || toDateSafe(activity.createdAt);
  }

  function xpForStudyActivity(a) {
    if (!a) return 0;
    if (typeof a.xp === 'number' && isFinite(a.xp) && a.xp > 0) {
      return Math.floor(a.xp);
    }
    // Back-compat: some writers used `xpAwarded`.
    if (typeof a.xpAwarded === 'number' && isFinite(a.xpAwarded) && a.xpAwarded > 0) {
      return Math.floor(a.xpAwarded);
    }
    var type = a.type || 'focus';
    if (type === 'focus') {
      var mins = Math.floor(Number(a.durationMinutes) || 0);
      return mins > 0 ? mins : 0;
    }
    if (type === 'doubt_asked') return XP_DEFAULTS.doubt_asked;
    if (type === 'revision') return XP_DEFAULTS.revision;
    // Unknown types: small participation credit only if they carry duration.
    if (Number(a.durationMinutes) > 0 && type !== 'quiz') return 5;
    return 0;
  }

  function totalXPFromCloud(recentActivity, quizHistory) {
    var total = 0;
    (recentActivity || []).forEach(function (a) { total += xpForStudyActivity(a); });
    // Quiz completions live in quizHistory (10 XP each). studyActivity never
    // duplicates them, so no double-count.
    (quizHistory || []).forEach(function () { total += XP_DEFAULTS.quiz; });
    return total;
  }

  function focusTodayFromActivities(recentActivity, todayKey) {
    var tk = todayKey || istTodayKey();
    var minutes = 0, sessions = 0;
    (recentActivity || []).forEach(function (a) {
      if (!a || a.type !== 'focus') return;
      var d = activityDate(a);
      if (!d) return;
      if (istDayKey(d) !== tk) return;
      var mins = Math.floor(Number(a.durationMinutes) || 0);
      if (!(mins > 0)) return;
      minutes += mins;
      sessions += 1;
    });
    return { minutes: minutes, sessions: sessions, dayKey: tk };
  }

  function focusWeekMinutes(recentActivity, endDate) {
    var end = endDate instanceof Date ? endDate : new Date();
    var endKey = istDayKey(end);
    // Build last-7 IST day set by walking back from endKey.
    var keys = {};
    try {
      // Walk using UTC noon anchors to avoid DST issues (IST has none, safe).
      var anchor = toDateSafe(endKey) || end;
      for (var i = 0; i < 7; i++) {
        var dt = new Date(anchor.getTime() - i * 86400000);
        keys[istDayKey(dt)] = true;
      }
    } catch (e) {
      return { minutes: 0, sessions: 0 };
    }
    var minutes = 0, sessions = 0;
    (recentActivity || []).forEach(function (a) {
      if (!a || a.type !== 'focus') return;
      var d = activityDate(a);
      if (!d) return;
      var k = istDayKey(d);
      if (!k || !keys[k]) return;
      var mins = Math.floor(Number(a.durationMinutes) || 0);
      if (!(mins > 0)) return;
      minutes += mins;
      sessions += 1;
    });
    return { minutes: minutes, sessions: sessions };
  }

  function activeDaySet(recentActivity, quizHistory) {
    var set = {};
    (recentActivity || []).forEach(function (a) {
      var d = activityDate(a);
      if (!d) return;
      var k = istDayKey(d);
      if (k) set[k] = true;
    });
    (quizHistory || []).forEach(function (q) {
      var qd = toDateSafe(q.createdAt) || toDateSafe(q.completedAt);
      if (!qd) return;
      var k2 = istDayKey(qd);
      if (k2) set[k2] = true;
    });
    return set;
  }

  // Consecutive IST days with any activity, counting back from today.
  // If today is empty but yesterday is active, streak starts at yesterday
  // (standard "still alive" behavior). Else 0.
  function streakFromActivities(recentActivity, quizHistory, todayKey) {
    var tk = todayKey || istTodayKey();
    var days = activeDaySet(recentActivity, quizHistory);
    if (!Object.keys(days).length) return 0;
    var cursor;
    if (days[tk]) {
      cursor = toDateSafe(tk);
    } else {
      // yesterday in IST
      var todayD = toDateSafe(tk) || new Date();
      var yest = new Date(todayD.getTime() - 86400000);
      var yKey = istDayKey(yest);
      if (!yKey || !days[yKey]) return 0;
      cursor = yest;
    }
    var streak = 0;
    // Guard: at most 365 iterations.
    for (var i = 0; i < 365; i++) {
      var k = istDayKey(cursor);
      if (!k || !days[k]) break;
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }

  function badgesForXP(xp) {
    var out = [];
    BADGES_DEF.forEach(function (b) {
      if ((Number(xp) || 0) >= b.xpRequired) out.push(b.id);
    });
    return out;
  }

  var api = {
    IST_TZ: IST_TZ,
    XP_DEFAULTS: XP_DEFAULTS,
    BADGES_DEF: BADGES_DEF,
    toDateSafe: toDateSafe,
    istDayKey: istDayKey,
    istTodayKey: istTodayKey,
    activityDate: activityDate,
    xpForStudyActivity: xpForStudyActivity,
    totalXPFromCloud: totalXPFromCloud,
    focusTodayFromActivities: focusTodayFromActivities,
    focusWeekMinutes: focusWeekMinutes,
    activeDaySet: activeDaySet,
    streakFromActivities: streakFromActivities,
    badgesForXP: badgesForXP
  };

  try {
    root.XpFromActivity = api;
    ['toDateSafe','istDayKey','istTodayKey','xpForStudyActivity','totalXPFromCloud',
     'focusTodayFromActivities','streakFromActivities','badgesForXP','focusWeekMinutes'
    ].forEach(function (k) { root[k] = api[k]; });
  } catch (e) {}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
