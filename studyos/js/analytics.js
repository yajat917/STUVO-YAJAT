const marks = { Math: 65, Physics: 75, Chemistry: 90 };

document.addEventListener("DOMContentLoaded", () => {
  const data = getData();
  const logs = data.studyLogs;
  const focusHistory = data.focusHistory || [];

  // Focus history was previously ignored here, so focus-only users always
  // saw 0h / empty charts even with consistent focus time on the Focus page.
  // Merge it additively: existing studyLogs logic is untouched.
  const focusByDate = {};
  let focusTotalMinutes = 0;
  focusHistory.forEach((h) => {
    if (!h || !h.date) return;
    const mins = Number(h.duration) || 0;
    if (!(mins > 0)) return;
    focusByDate[h.date] = (focusByDate[h.date] || 0) + mins;
    focusTotalMinutes += mins;
  });
  const focusHoursTotal = Math.round((focusTotalMinutes / 60) * 100) / 100;

  const logsHours = logs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const totalHours = logsHours + focusHoursTotal;
  document.getElementById("total-hours").textContent = totalHours.toFixed(1) + "h";
  document.getElementById("xp").textContent = data.gamification.xp + " XP";

  const subjectTotals = {};
  logs.forEach((l) => {
    subjectTotals[l.subject] = (subjectTotals[l.subject] || 0) + (Number(l.hours) || 0);
  });
  if (focusHoursTotal > 0) subjectTotals["Focus"] = Math.round(((subjectTotals["Focus"] || 0) + focusHoursTotal) * 100) / 100;
  // Subject count stays focused on study subjects (excludes the synthetic Focus slice).
  const subjects = Object.keys(subjectTotals);
  document.getElementById("subject-count").textContent = subjects.filter((s) => s !== "Focus").length || subjects.length;

  // Daily union of study logs + focus days so the line chart renders even
  // when studyLogs is empty but focusHistory is not.
  const logHoursByDate = {};
  logs.forEach((l) => {
    if (!l || !l.date) return;
    logHoursByDate[l.date] = (logHoursByDate[l.date] || 0) + (Number(l.hours) || 0);
  });
  const allDates = [...new Set([...Object.keys(logHoursByDate), ...Object.keys(focusByDate)])].sort();
  const useUnion = allDates.length > 0;
  const labels = useUnion
    ? allDates.map((ds) => new Date(ds + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }))
    : logs.map((l) => {
      const d = new Date(l.date);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
  const hours = useUnion
    ? allDates.map((ds) => Math.round((logHoursByDate[ds] || 0) * 100) / 100)
    : logs.map((l) => l.hours);
  const focusHours = useUnion
    ? allDates.map((ds) => Math.round(((focusByDate[ds] || 0) / 60) * 100) / 100)
    : [];
  const hasFocus = focusHours.some((v) => v > 0);

  const lineDatasets = [{
    label: "Hours Studied",
    data: hours,
    borderColor: "#6366f1",
    backgroundColor: "rgba(99,102,241,0.15)",
    fill: true,
    tension: 0.4,
  }];
  if (hasFocus) lineDatasets.push({
    label: "Focus (h)",
    data: focusHours,
    borderColor: "#4ade80",
    backgroundColor: "rgba(74,222,128,0.12)",
    fill: true,
    tension: 0.4,
  });

  new Chart(document.getElementById("line-chart"), {
    type: "line",
    data: {
      labels,
      datasets: lineDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: hasFocus } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
      },
    },
  });

  new Chart(document.getElementById("pie-chart"), {
    type: "pie",
    data: {
      labels: subjects,
      datasets: [{
        data: Object.values(subjectTotals),
        backgroundColor: ["#6366f1", "#4ade80", "#fbbf24", "#f472b6", "#38bdf8", "#10b981", "#8b5cf6", "#f59e0b"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#94a3b8" } } },
    },
  });

  renderMarksInputs();
  document.getElementById("analyze-btn").addEventListener("click", runAnalysis);
});

function renderMarksInputs() {
  const data = getData();
  const activeSubjects = data.profile?.subjects || ["Math", "Physics", "Chemistry"];
  
  const marksMap = {};
  activeSubjects.forEach(s => {
    marksMap[s] = marks[s] !== undefined ? marks[s] : 75;
  });

  document.getElementById("marks-inputs").innerHTML = Object.entries(marksMap).map(([subject, score]) => `
    <div class="form-group">
      <label>${subject} (%)</label>
      <input type="number" class="input mark-input" data-subject="${subject}" min="0" max="100" value="${score}">
    </div>`).join("");
}

async function runAnalysis() {
  const alertEl = document.getElementById("alert");
  const output = document.getElementById("analysis-output");
  const btn = document.getElementById("analyze-btn");
  hideAlert(alertEl);

  const currentMarks = {};
  document.querySelectorAll(".mark-input").forEach((input) => {
    currentMarks[input.dataset.subject] = Number(input.value);
  });

  const data = getData();
  const studyTime = {};
  data.studyLogs.forEach((l) => {
    studyTime[l.subject] = (studyTime[l.subject] || 0) + l.hours;
  });
  // Include focus time so the weakness analysis sees real effort even when
  // studyLogs is empty. Additive only; per-subject log totals unchanged.
  try {
    const focusMins = (data.focusHistory || []).reduce((s, h) => s + (Number(h.duration) || 0), 0);
    if (focusMins > 0) studyTime["Focus"] = Math.round(((studyTime["Focus"] || 0) + focusMins / 60) * 100) / 100;
  } catch (e) {}

  const focusCount = data.gamification.focusSessions || 0;
  const weakList = data.profile?.weaknesses || [];

  btn.disabled = true;
  showSpinner(output, "AI is analyzing your performance...");

  try {
    const analysis = await tryAI(
      () => analyzeWeakness(currentMarks, studyTime, focusCount, weakList),
      () => getDemoAnalysis(currentMarks, weakList)
    );
    output.innerHTML = `<div class="glass" style="background:rgba(99,102,241,0.08); text-align:left"><pre class="output-text">${analysis}</pre></div>`;
  } catch (err) {
    showAlert(alertEl, err.message);
    output.innerHTML = "";
  } finally {
    btn.disabled = false;
  }
}
