const WORK = 25 * 60;
const BREAK = 5 * 60;
const CIRCUMFERENCE = 2 * Math.PI * 100;

let phase = "idle";
let secondsLeft = WORK;
let running = false;
let interval = null;
let sessions = 0;

document.addEventListener("DOMContentLoaded", () => {
  sessions = getData().gamification.focusSessions || 0;
  renderFocusStats();
  // Firestore first: overwrite the local cache so Device B never shows zero
  // when the cloud already has sessions.
  try {
    if (typeof window !== 'undefined' && window.StuvoCloud) {
      window.StuvoCloud.readCloud().then(function (cloud) {
        if (cloud && typeof cloud.totalXP === 'number') {
          try { window.StuvoCloud.syncCacheFromCloud(cloud); } catch (e) {}
          renderFocusStats(cloud);
        }
      }).catch(function () {});
    }
  } catch (e) {}
  updateDisplay();

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("pause-btn").addEventListener("click", pause);
  document.getElementById("reset-btn").addEventListener("click", reset);
});

function localDay(d) {
  const t = d instanceof Date ? d : new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
}

function istDay() {
  try {
    if (typeof window !== 'undefined' && window.XpFromActivity && window.XpFromActivity.istTodayKey) {
      return window.XpFromActivity.istTodayKey();
    }
  } catch (e) {}
  return localDay();
}

function renderFocusStats(cloud) {
  // Cloud values win when provided; local cache is fallback only.
  if (cloud && typeof cloud.focusTodaySessions === 'number') {
    document.getElementById("today-sessions").textContent = cloud.focusTodaySessions;
    document.getElementById("today-time").textContent = cloud.focusTodayMinutes + "m";
    return;
  }
  const data = getData();
  var ist = istDay();
  var loc = localDay();
  const todaySessions = (data.focusHistory || []).filter(h => h && (h.date === ist || h.date === loc));
  const count = todaySessions.length;
  const time = todaySessions.reduce((sum, h) => sum + (Number(h.duration) || 0), 0);

  document.getElementById("today-sessions").textContent = count;
  document.getElementById("today-time").textContent = time + "m";
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateDisplay() {
  document.getElementById("timer").textContent = formatTime(secondsLeft);
  const total = phase === "break" ? BREAK : WORK;
  const progress = phase === "idle" ? 0 : (total - secondsLeft) / total;
  const ring = document.getElementById("progress-ring");
  ring.setAttribute("stroke-dashoffset", CIRCUMFERENCE * (1 - progress));
  ring.setAttribute("stroke", phase === "break" ? "#4ade80" : "#6366f1");

  const labels = { idle: "Ready", work: "Focus Time", break: "Break Time" };
  document.getElementById("phase-label").textContent = labels[phase] || "Ready";
}

function tick() {
  if (secondsLeft <= 1) {
    onComplete();
    return;
  }
  secondsLeft--;
  updateDisplay();
}

function onComplete() {
  if (phase === "work") {
    // Firestore first (awaited). Local cache second. Partial logic preserved.
    var dayKey = istDay();
    try {
      if (typeof window !== 'undefined' && window.StuvoCloud && window.StuvoCloud.getUid()) {
        window.StuvoCloud.writeFocus(25, 25).then(function (ok) {
          if (ok) {
            window.StuvoCloud.readCloud().then(function (cloud) {
              if (cloud) { try { window.StuvoCloud.syncCacheFromCloud(cloud); } catch (e) {} renderFocusStats(cloud); }
              else renderFocusStats();
            }).catch(function () { renderFocusStats(); });
          } else {
            sessions++;
            const data = getData();
            const newHistory = [...(data.focusHistory || [])];
            newHistory.push({ date: dayKey, duration: 25 });
            updateData({ gamification: { ...data.gamification, focusSessions: sessions }, focusHistory: newHistory });
            addXP(25);
            renderFocusStats();
          }
        }).catch(function () {
          sessions++;
          const data2 = getData();
          const newHistory2 = [...(data2.focusHistory || [])];
          newHistory2.push({ date: dayKey, duration: 25 });
          updateData({ gamification: { ...data2.gamification, focusSessions: sessions }, focusHistory: newHistory2 });
          addXP(25);
          renderFocusStats();
        });
      } else {
        sessions++;
        const data = getData();
        const newHistory = [...(data.focusHistory || [])];
        newHistory.push({ date: dayKey, duration: 25 }); // 25 min session
        updateData({
          gamification: { ...data.gamification, focusSessions: sessions },
          focusHistory: newHistory
        });
        addXP(25); // Focus session completed: +25 XP
        renderFocusStats();
      }
    } catch (e) {
      sessions++;
      const data3 = getData();
      const newHistory3 = [...(data3.focusHistory || [])];
      newHistory3.push({ date: dayKey, duration: 25 });
      updateData({ gamification: { ...data3.gamification, focusSessions: sessions }, focusHistory: newHistory3 });
      addXP(25);
      renderFocusStats();
    }

    phase = "break";
    secondsLeft = BREAK;
  } else if (phase === "break") {
    phase = "work";
    secondsLeft = WORK;
  }
  updateDisplay();
}

function start() {
  if (phase === "idle") {
    phase = "work";
    secondsLeft = WORK;
    updateDisplay();
  }
  running = true;
  document.getElementById("start-btn").classList.add("hidden");
  document.getElementById("pause-btn").classList.remove("hidden");
  interval = setInterval(tick, 1000);
}

function pause() {
  running = false;
  clearInterval(interval);
  document.getElementById("start-btn").classList.remove("hidden");
  document.getElementById("start-btn").textContent = "Resume";
  document.getElementById("pause-btn").classList.add("hidden");
}

function reset() {
  // Partial-session save: real elapsed work time must never be discarded.
  // Firestore first (awaited), local second — same behavior, cloud truth.
  if (phase === "work") {
    const elapsedMinutes = Math.floor((WORK - secondsLeft) / 60);
    if (elapsedMinutes >= 1) {
      var xpAward = Math.max(1, elapsedMinutes); // 1 XP/min
      var dayKey = istDay();
      try {
        if (typeof window !== 'undefined' && window.StuvoCloud && window.StuvoCloud.getUid()) {
          window.StuvoCloud.writeFocus(elapsedMinutes, xpAward).then(function (ok) {
            if (ok) {
              window.StuvoCloud.readCloud().then(function (cloud) {
                if (cloud) { try { window.StuvoCloud.syncCacheFromCloud(cloud); } catch (e) {} renderFocusStats(cloud); }
                else renderFocusStats();
              }).catch(function () { renderFocusStats(); });
            } else {
              const data = getData();
              const newHistory = [...(data.focusHistory || [])];
              newHistory.push({ date: dayKey, duration: elapsedMinutes, partial: true });
              sessions++;
              updateData({ gamification: { ...data.gamification, focusSessions: sessions }, focusHistory: newHistory });
              addXP(xpAward);
              renderFocusStats();
            }
          }).catch(function () {
            const data2 = getData();
            const newHistory2 = [...(data2.focusHistory || [])];
            newHistory2.push({ date: dayKey, duration: elapsedMinutes, partial: true });
            sessions++;
            updateData({ gamification: { ...data2.gamification, focusSessions: sessions }, focusHistory: newHistory2 });
            addXP(xpAward);
            renderFocusStats();
          });
        } else {
          const data = getData();
          const newHistory = [...(data.focusHistory || [])];
          newHistory.push({ date: dayKey, duration: elapsedMinutes, partial: true });
          sessions++;
          updateData({
            gamification: { ...data.gamification, focusSessions: sessions },
            focusHistory: newHistory
          });
          addXP(xpAward);
          renderFocusStats();
        }
      } catch (e) {
        const data3 = getData();
        const newHistory3 = [...(data3.focusHistory || [])];
        newHistory3.push({ date: dayKey, duration: elapsedMinutes, partial: true });
        sessions++;
        updateData({ gamification: { ...data3.gamification, focusSessions: sessions }, focusHistory: newHistory3 });
        addXP(xpAward);
        renderFocusStats();
      }
    }
  }
  clearInterval(interval);
  running = false;
  phase = "idle";
  secondsLeft = WORK;
  document.getElementById("start-btn").classList.remove("hidden");
  document.getElementById("start-btn").textContent = "Start";
  document.getElementById("pause-btn").classList.add("hidden");
  updateDisplay();
}
