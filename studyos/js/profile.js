let form = {
  name: "",
  grade: "",
  subjects: ["Math", "Physics", "Chemistry"],
  strengths: [],
  weaknesses: [],
  examDate: "",
  dailyHours: 3,
};

document.addEventListener("DOMContentLoaded", () => {
  const data = getData();
  if (data.profile) form = { ...form, ...data.profile };

  document.getElementById("name").value = form.name;
  document.getElementById("grade").value = form.grade;
  document.getElementById("exam-date").value = form.examDate;
  document.getElementById("daily-hours").value = form.dailyHours;
  document.getElementById("hours-val").textContent = form.dailyHours;

  // Pre-fill saved OpenRouter key (browser-only). Canonical store is
  // localStorage studyos_openrouter_key (shared with Stuvo); the legacy
  // studyos-data.apiKey field is kept as a mirror for backwards compat.
  try {
    const savedKey = (localStorage.getItem('studyos_openrouter_key') || (data.apiKey || '')).trim();
    const keyInput = document.getElementById("openrouter-key");
    if (keyInput && savedKey) keyInput.value = savedKey;
    updateKeyStatus(savedKey);
  } catch (e) {}

  renderPills("subjects", form.subjects, "");
  renderPills("strengths", form.strengths, "green");
  renderPills("weaknesses", form.weaknesses, "red");

  document.getElementById("daily-hours").addEventListener("input", (e) => {
    form.dailyHours = Number(e.target.value);
    document.getElementById("hours-val").textContent = e.target.value;
  });

  const toggleBtn = document.getElementById("toggle-key");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const inp = document.getElementById("openrouter-key");
      inp.type = inp.type === "password" ? "text" : "password";
    });
  }
  const keyInput = document.getElementById("openrouter-key");
  if (keyInput) {
    keyInput.addEventListener("input", () => updateKeyStatus(keyInput.value.trim()));
  }

  document.getElementById("save-btn").addEventListener("click", saveProfile);
});

function updateKeyStatus(key) {
  const el = document.getElementById("key-status");
  if (!el) return;
  if (!key) {
    el.textContent = "No key saved — AI will use demo answers.";
    return;
  }
  if (key.length >= 10 && (key.startsWith("sk-or-") || key.length >= 20)) {
    el.textContent = "✓ Key format looks valid (stored only in this browser).";
  } else {
    el.textContent = "⚠ That does not look like an OpenRouter key (expected sk-or-v1-...).";
  }
}

function renderPills(id, selected, colorClass) {
  const container = document.getElementById(id);
  container.innerHTML = ALL_SUBJECTS.map((s) => {
    const active = selected.includes(s);
    return `<button type="button" class="pill ${colorClass} ${active ? "active" : ""}" data-subject="${s}">${s}</button>`;
  }).join("");

  const field = id === "subjects" ? "subjects" : id === "strengths" ? "strengths" : "weaknesses";

  container.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.dataset.subject;
      if (form[field].includes(sub)) {
        form[field] = form[field].filter((x) => x !== sub);
      } else {
        form[field].push(sub);
      }
      renderPills(id, form[field], colorClass);
    });
  });
}

function saveProfile() {
  form.name = document.getElementById("name").value.trim();
  form.grade = document.getElementById("grade").value.trim();
  form.examDate = document.getElementById("exam-date").value;
  form.dailyHours = Number(document.getElementById("daily-hours").value);

  const keyVal = (document.getElementById("openrouter-key").value || "").trim();
  if (keyVal && !(keyVal.length >= 10 && (keyVal.startsWith("sk-or-") || keyVal.length >= 20))) {
    const alertEl = document.getElementById("alert");
    showAlert(alertEl, "That API key format looks invalid (expected sk-or-v1-...). Fix it or clear the field.", "error");
    return;
  }
  try {
    if (keyVal) localStorage.setItem('studyos_openrouter_key', keyVal);
    else localStorage.removeItem('studyos_openrouter_key');
  } catch (e) {}

  updateData({ profile: { ...form }, apiKey: keyVal });

  updateKeyStatus(keyVal);
  const alertEl = document.getElementById("alert");
  showAlert(alertEl, keyVal ? "Profile + AI key saved in this browser!" : "Profile saved successfully!", "success");
  document.getElementById("save-btn").textContent = "✓ Saved!";
  setTimeout(() => {
    document.getElementById("save-btn").textContent = "Save Profile";
  }, 2000);
}
