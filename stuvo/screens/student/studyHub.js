// ─── Study Hub — 5-section rebuild (Today / Learn / Practice / Track / Plan) ───
// Every module reads the shared brain (getStudyHubContext, computed once per
// visit, cached for the session). No module queries Firestore independently
// for grade/subjects/weak-subjects/deadlines. All AI calls pass grade +
// canonical subjects from that context. No free-text subject inputs.
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');

// ─── StudyOS v1 Storage (preserved namespace) ─────────────────
const STORAGE_KEY = 'studyos-data';
const BADGES_DEF = [
    { id: 'first-session', name: '🎯 First Focus', xpRequired: 25 },
    { id: 'plan-master',   name: '📋 Plan Master', xpRequired: 50 },
    { id: 'streak-3',      name: '🔥 3-Day Streak', xpRequired: 75 },
    { id: 'week-warrior',  name: '⚔️ Week Warrior', xpRequired: 100 },
    { id: 'scholar',       name: '🎓 Scholar',      xpRequired: 200 },
];

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            return {
                studyLogs: p.studyLogs?.length ? p.studyLogs : [],
                studyPlan: p.studyPlan || '',
                gamification: { xp: 0, streak: 0, lastStudyDate: '', badges: [], focusSessions: 0, ...p.gamification },
                goals: p.goals || [],
                focusHistory: p.focusHistory || [],
            };
        }
    } catch {}
    return { studyLogs: [], studyPlan: '', gamification: { xp: 0, streak: 0, lastStudyDate: '', badges: [], focusSessions: 0 }, goals: [], focusHistory: [] };
}

function saveData(partial) {
    const cur = getData();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...partial }));
        return true;
    } catch (e) {
        console.error('[saveData] localStorage write failed', e);
        try { if (typeof showToast === 'function') showToast('Could not save progress locally: storage unavailable', 'error'); } catch {}
        return false;
    }
}

function addXP(amount) {
    const d = getData();
    const today = new Date().toISOString().split('T')[0];
    let { streak, lastStudyDate, xp, badges } = d.gamification;
    if (lastStudyDate) {
        const diff = Math.floor((new Date(today) - new Date(lastStudyDate)) / 86400000);
        if (diff === 1) streak++;
        else if (diff > 1) streak = 1;
    } else { streak = 1; }
    xp += amount;
    BADGES_DEF.forEach(b => { if (xp >= b.xpRequired && !badges.includes(b.id)) badges.push(b.id); });
    saveData({ gamification: { ...d.gamification, xp, streak, lastStudyDate: today, badges } });
    return getData();
}

const SUBJECT_OPTIONS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History'];
const CIRCUMFERENCE = 2 * Math.PI * 90;

// ─── Small shared helpers ─────────────────────────────────────
function shEsc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function shFmt(t) {
    if (typeof renderFormattedAnswer === 'function') return renderFormattedAnswer(t);
    return shEsc(t).split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<p style="margin:0 0 8px 0;">' + l + '</p>'; }).join('');
}
function shSubjectOptions(subjects, selected) {
    var list = (subjects && subjects.length) ? subjects : SUBJECT_OPTIONS.slice();
    return list.map(function (s) {
        var esc = shEsc(s);
        return '<option value="' + esc + '"' + (s === selected ? ' selected' : '') + '>' + esc + '</option>';
    }).join('');
}
// Local calendar day (YYYY-MM-DD). Focus history is keyed by day, so local
// time is used instead of UTC to avoid off-by-one around midnight.
function shTodayStr(d) {
    var t = d instanceof Date ? d : new Date();
    var m = String(t.getMonth() + 1).padStart(2, '0');
    var day = String(t.getDate()).padStart(2, '0');
    return t.getFullYear() + '-' + m + '-' + day;
}
// Best-effort mirror of a focus session into Firestore studyActivity so the
// Track tab (Weekly Stats / recentActivity) sees focus time on any device.
// Local localStorage save is the source of truth; failures here never block it.
function shMirrorFocusToActivity(durationMinutes) {
    try {
        var uid = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
        if (!uid) return;
        if (typeof db === 'undefined' || !db) return;
        if (typeof collection !== 'function' || typeof addDoc !== 'function') return;
        var mins = Math.max(1, Math.floor(Number(durationMinutes) || 0));
        if (!(mins >= 1)) return;
        var payload = { type: 'focus', subject: 'General', durationMinutes: mins, relatedHomeworkId: null, relatedClassId: null };
        try {
            if (typeof serverTimestamp === 'function') payload.completedAt = serverTimestamp();
            else payload.completedAt = new Date().toISOString();
        } catch (e) { payload.completedAt = new Date().toISOString(); }
        try { window._shTrackDirty = true; } catch (e) {}
        addDoc(collection(db, 'users', uid, 'studyActivity'), payload).then(function () {
            try { _shCtx = null; if (typeof resetStudyHubContext === 'function') resetStudyHubContext(); } catch (e) {}
            try { window._shTrackDirty = true; } catch (e) {}
        }).catch(function () {});
    } catch (e) {}
}
// Re-render Track progress + charts when focus data changed since Track was
// last rendered. Merges localStorage so it works even before Firestore sync.
function shRefreshTrack(container) {
    try {
        var ctx = null;
        try { ctx = (typeof window !== 'undefined' && window.studyHubContext && window.studyHubContext.uid) ? window.studyHubContext : (container && container._shCtx ? container._shCtx : null); } catch (e) {}
        if (!ctx && container && container._shCtx) ctx = container._shCtx;
        if (!ctx) return;
        if (typeof loadTrackProgress === 'function') loadTrackProgress(container, ctx);
        if (typeof refreshTrackCharts === 'function') refreshTrackCharts(container);
        try { window._shTrackDirty = false; } catch (e) {}
    } catch (e) {}
}
function getHealthStatusConfig(status) {
    var map = {
        strong: { icon: '●', badge: 'badge-green', color: 'var(--success)', label: 'Strong', desc: 'doing great' },
        steady: { icon: '◐', badge: 'badge-yellow', color: 'var(--warning)', label: 'Steady', desc: 'steady' },
        needs_attention: { icon: '⚠', badge: 'badge-red', color: 'var(--danger)', label: 'Needs attention', desc: 'could use a little attention' },
        insufficient_data: { icon: '◌', badge: 'badge-gray', color: 'var(--text-dim)', label: 'Not enough data yet', desc: 'Not enough data yet' }
    };
    return map[status] || map.insufficient_data;
}
// Local fallback for schedule helpers if global not loaded
if (typeof generateExamSchedule !== 'function') {
    window.generateExamSchedule = function (examDate, subjects, existingHomeworkDeadlines) {
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var exam = examDate instanceof Date ? examDate : new Date(examDate); exam.setHours(0, 0, 0, 0);
        var daysRemaining = Math.max(1, Math.ceil((exam - today) / (1000 * 60 * 60 * 24)));
        var safeSubjects = (subjects && subjects.length) ? subjects : ['General'];
        var plan = []; var idx = 0;
        for (var i = 0; i < daysRemaining; i++) { var d = new Date(today); d.setDate(d.getDate() + i); var ds = d.toISOString().split('T')[0]; plan.push({ date: ds, subject: safeSubjects[idx % safeSubjects.length], topic: null, completed: false }); idx++; }
        return plan;
    };
}
if (typeof redistributeAfterMiss !== 'function') {
    window.redistributeAfterMiss = function (dailyPlan, todayStr) {
        if (!Array.isArray(dailyPlan) || !dailyPlan.length) return dailyPlan;
        var today = todayStr || new Date().toISOString().split('T')[0];
        var missed = dailyPlan.filter(function (d) { return d.date < today && !d.completed; });
        var future = dailyPlan.filter(function (d) { return d.date >= today; });
        if (missed.length === 0 || future.length === 0) return dailyPlan;
        var futureClone = future.map(function (d) { return Object.assign({}, d, { extraSubjects: d.extraSubjects ? [].concat(d.extraSubjects) : undefined }); });
        missed.forEach(function (m, i) { var ti = i % futureClone.length; if (!futureClone[ti].extraSubjects) futureClone[ti].extraSubjects = []; futureClone[ti].extraSubjects.push(m.subject); });
        return [].concat(dailyPlan.filter(function (d) { return d.date < today; }), futureClone);
    };
}

// ─── Deterministic weekly schedule (rule-based, never AI-generated) ──
// Weak subjects first, round-robin across a fixed Mon→Sun order.
// Pure function of its inputs: identical inputs → identical plan.
function generateWeeklyStudyPlan(subjects, weakSubjects, dailyMinutes) {
    var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var subs = (subjects && subjects.length) ? subjects.slice() : ['General'];
    var weak = {};
    (weakSubjects || []).forEach(function (s) { weak[s] = true; });
    subs.sort(function (a, b) {
        var wa = weak[a] ? 0 : 1, wb = weak[b] ? 0 : 1;
        if (wa !== wb) return wa - wb;
        return String(a).localeCompare(String(b));
    });
    var perDay = Math.max(1, Math.min(3, subs.length));
    var mins = Math.max(15, dailyMinutes || 60);
    var each = Math.floor(mins / perDay);
    var remainder = mins - each * perDay;
    var plan = [];
    for (var d = 0; d < 7; d++) {
        var blocks = [];
        for (var k = 0; k < perDay; k++) {
            var subj = subs[(d + k) % subs.length];
            blocks.push({ subject: subj, minutes: each + (k < remainder ? 1 : 0), focus: weak[subj] ? 'catch-up' : 'regular' });
        }
        plan.push({ day: DAYS[d], blocks: blocks });
    }
    return plan;
}
if (typeof window !== 'undefined') window.generateWeeklyStudyPlan = generateWeeklyStudyPlan;

// ─── Shared brain accessor (THE single context rule) ──────────
var _shCtx = null;
async function ensureStudyHubContext() {
    if (_shCtx && _shCtx.uid) return _shCtx;
    try {
        if (typeof window !== 'undefined' && window.studyHubContext && window.studyHubContext.uid) {
            _shCtx = window.studyHubContext;
            return _shCtx;
        }
    } catch (e) {}
    var uid = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
    if (!uid) throw new Error('Not signed in');
    if (typeof getStudyHubContext !== 'function') throw new Error('Study Hub context unavailable');
    _shCtx = await getStudyHubContext(uid);
    return _shCtx;
}

// ─── Section HTML shells (dynamic regions filled after context loads) ──
function todayHTML() {
    return `
        <div class="glass-card" id="nba-card">
            <div class="card-label">Next Best Action</div>
            <div id="nba-body"><div class="spinner" style="margin:12px auto;"></div></div>
        </div>
        <div class="glass-card" id="streak-card" style="margin-top:20px;text-align:center;">
            <div class="card-label">Day Streak</div>
            <div id="streak-body"><div class="spinner" style="margin:12px auto;"></div></div>
        </div>
        <div class="glass-card" id="focus-card" style="margin-top:20px;text-align:center;padding:36px;">
            <div class="card-label">Pomodoro Focus Timer <span id="focus-style-badge" style="font-size:11px;color:#C4B5FD;background:rgba(124,92,252,0.12);padding:4px 8px;border-radius:20px;margin-left:8px;vertical-align:middle;"></span></div>
            <div style="position:relative;display:inline-block;margin:20px 0;">
                <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="Focus timer progress">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
                    <circle id="focus-ring" cx="100" cy="100" r="90" fill="none" stroke="#7C5CFC" stroke-width="12"
                        stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}" stroke-linecap="round"
                        transform="rotate(-90 100 100)"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <div id="focus-timer" style="font-family:'Sora',sans-serif;font-size:40px;font-weight:800;">25:00</div>
                    <div id="focus-phase" style="font-size:13px;color:var(--text-dim);margin-top:4px;">Ready</div>
                </div>
            </div>
            <div id="focus-preset-row" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;" role="group" aria-label="${_i18n_t('studyHub.selfStudy.quickSelect', 'Quick select')}">
                <button type="button" class="badge badge-violet" id="focus-preset-default" style="cursor:pointer;padding:7px 12px;" aria-pressed="true">${_i18n_t('studyHub.selfStudy.pomodoro', 'Pomodoro')} 25</button>
                <span id="focus-preset-list" style="display:contents;"></span>
                <button type="button" class="badge badge-gray" id="focus-custom-toggle" style="cursor:pointer;padding:7px 12px;">+ ${_i18n_t('studyHub.selfStudy.customPreset', 'Custom')}</button>
            </div>
            <div id="focus-custom-form" class="hidden" style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:12px;margin-bottom:12px;text-align:left;">
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="focus-preset-name">${_i18n_t('studyHub.selfStudy.presetName', 'Preset name')}</label>
                        <input type="text" class="form-control" id="focus-preset-name" placeholder="${_i18n_t('studyHub.selfStudy.presetNamePlaceholder', 'e.g. Deep Work')}" maxlength="40">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="focus-preset-mins">${_i18n_t('studyHub.selfStudy.durationMinutes', 'Duration (minutes)')}</label>
                        <input type="number" class="form-control" id="focus-preset-mins" min="1" max="180" value="50" inputmode="numeric">
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm" id="focus-preset-save" style="margin-top:0;">${_i18n_t('studyHub.selfStudy.savePreset', 'Save preset')}</button>
                    <button type="button" class="btn btn-sm btn-secondary" id="focus-preset-cancel" style="margin-top:0;">${_i18n_t('studyHub.selfStudy.cancel', 'Cancel')}</button>
                </div>
                <div id="focus-preset-status" style="font-size:12px;color:var(--text-dim);margin-top:8px;" role="status"></div>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-bottom:24px;">
                <button class="btn btn-sm" id="focus-start" style="width:120px;">▶ Start</button>
                <button class="btn btn-sm btn-secondary hidden" id="focus-pause">⏸ Pause</button>
                <button class="btn btn-sm btn-secondary" id="focus-reset">↺ Reset</button>
            </div>
            <div class="grid-cols-3" style="gap:12px;">
                <div class="glass-card" style="padding:14px;text-align:center;">
                    <div class="stat-num" style="font-size:20px;color:#C4B5FD;" id="focus-today-count">0</div>
                    <div class="stat-label">Today's Sessions</div>
                </div>
                <div class="glass-card" style="padding:14px;text-align:center;">
                    <div class="stat-num" style="font-size:20px;color:#93C5FD;" id="focus-today-time">0m</div>
                    <div class="stat-label">Focus Time Today</div>
                </div>
                <div class="glass-card" style="padding:14px;text-align:center;">
                    <div class="stat-num" style="font-size:20px;color:#FDE68A;" id="focus-xp">0 XP</div>
                    <div class="stat-label">Total XP</div>
                </div>
            </div>
            <div class="glass-card" style="margin-top:20px;">
                <div class="card-label">Badges Earned</div>
                <div id="focus-badges" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;"></div>
            </div>
        </div>
    `;
}

function learnHTML(subjects) {
    return `
        <div class="glass-card" id="doubt-card">
            <div class="card-label">Doubt Assistant: Ask Anything</div>
            <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
                <select class="form-control" id="doubt-subject" style="width:auto;flex:0 0 180px;" aria-label="Subject">
                    ${shSubjectOptions(subjects)}
                </select>
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${['What is Newton\'s 3rd law?', 'Explain photosynthesis', 'Solve: x² - 5x + 6 = 0'].map(function (q) {
                        return '<button class="badge badge-violet suggestion-q" style="cursor:pointer;" data-q="' + shEsc(q) + '">' + shEsc(q) + '</button>';
                    }).join('')}
                </div>
            </div>
            <div id="chat-thread" style="min-height:200px;max-height:420px;overflow-y:auto;background:rgba(0,0,0,0.15);border-radius:14px;padding:16px;margin-bottom:14px;display:flex;flex-direction:column;gap:14px;">
                <div style="text-align:center;color:var(--text-dim);font-size:13px;">Ask any academic question: I'll explain it step by step 🤖</div>
            </div>
            <form id="chat-form" style="display:flex;gap:10px;">
                <textarea class="form-control" id="doubt-question" rows="2" placeholder="Type your question…" style="flex:1;resize:vertical;" aria-label="Your question"></textarea>
                <button type="submit" class="btn btn-sm" style="margin-top:0;flex-shrink:0;align-self:flex-end;">Send ↑</button>
            </form>
        </div>
        <div class="glass-card" id="revision-card" style="margin-top:20px;">
            <div class="card-label">Revision Generator</div>
            <div class="form-row">
                <div class="form-group">
                    <label>Subject</label>
                    <select class="form-control" id="rev-subject-select">${shSubjectOptions(subjects)}</select>
                </div>
                <div class="form-group">
                    <label>Chapter / Topic</label>
                    <input type="text" class="form-control" id="rev-chapter-input" placeholder="e.g. Photosynthesis, Algebra">
                </div>
            </div>
            <button class="btn" id="rev-generate-btn">📚 Generate Revision</button>
            <div id="rev-progress" style="display:none;margin-top:16px;">
                <div style="display:flex;gap:8px;align-items:center;">
                    <div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;">
                        <div id="rev-progress-bar" class="progress-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#7C5CFC,#4F8CFF);--progress:0;"></div>
                    </div>
                    <span id="rev-progress-text" style="font-size:12px;color:var(--text-dim);">0/5</span>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;justify-content:center;">
                    <span class="rev-dot" data-step="0" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);"></span>
                    <span class="rev-dot" data-step="1" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);"></span>
                    <span class="rev-dot" data-step="2" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);"></span>
                    <span class="rev-dot" data-step="3" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);"></span>
                    <span class="rev-dot" data-step="4" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);"></span>
                </div>
            </div>
            <div id="rev-output" style="margin-top:16px;"></div>
        </div>
    `;
}

function practiceHTML(subjects) {
    return `
        <div class="glass-card" id="quiz-card">
            <div class="card-label">Quiz Yourself: Chapter/Notes Based</div>
            <div class="form-group">
                <label>Subject (from your personalized list)</label>
                <select class="form-control" id="quiz-subject-select">${shSubjectOptions(subjects)}</select>
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Personalized: taxonomy ∪ enrolled classes. Selecting a subject pre-fills topic.</div>
            </div>
            <div class="form-group">
                <label>Source</label>
                <select class="form-control" id="quiz-source">
                    <option value="topic">Chapter/Topic (free text)</option>
                    <option value="homework">From my last homework</option>
                    <option value="notes">From notes (paste text)</option>
                </select>
            </div>
            <div class="form-group" id="quiz-topic-group">
                <label>Chapter / Topic</label>
                <input type="text" class="form-control" id="quiz-topic" placeholder="e.g. Photosynthesis">
            </div>
            <div class="form-group hidden" id="quiz-notes-group">
                <label>Paste your notes</label>
                <textarea class="form-control" id="quiz-notes" rows="4" placeholder="Paste notes text here..."></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Difficulty</label>
                    <div style="display:flex;gap:8px;">
                        <label style="display:flex;align-items:center;gap:4px;"><input type="radio" name="quiz-difficulty" value="easy"> Easy</label>
                        <label style="display:flex;align-items:center;gap:4px;"><input type="radio" name="quiz-difficulty" value="medium" checked> Medium</label>
                        <label style="display:flex;align-items:center;gap:4px;"><input type="radio" name="quiz-difficulty" value="hard"> Hard</label>
                    </div>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Difficulty is calibrated to your grade automatically.</div>
                </div>
                <div class="form-group">
                    <label>Question Count</label>
                    <select class="form-control" id="quiz-count">
                        <option value="5">5</option><option value="10" selected>10</option><option value="15">15</option>
                    </select>
                </div>
            </div>
            <button class="btn" id="quiz-generate-btn">Generate Quiz</button>
            <div id="quiz-output" style="margin-top:16px;"></div>
        </div>
        <div class="glass-card" id="bits-card" style="margin-top:20px;">
            <div class="card-label">Practice Bits History</div>
            <div id="bits-history"><div class="spinner" style="margin:12px auto;"></div></div>
            <button class="btn btn-secondary btn-sm" id="bits-open-full" style="margin-top:12px;">Open today's Practice Bit ⚡</button>
        </div>
    `;
}

function trackHTML() {
    return `
        <div class="glass-card status-tab is-brand" id="health-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                <div style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Subject Health Check</div>
                <span style="font-size:11px;color:var(--text-dim);background:rgba(255,255,255,0.06);padding:4px 8px;border-radius:20px;">Tap a subject that needs attention for a deep dive</span>
            </div>
            <div id="subject-health-row" style="display:flex;gap:12px;overflow-x:auto;padding:12px 0 4px;min-height:72px;scrollbar-width:thin;">
                <div class="spinner" style="width:22px;height:22px;border-width:2px;margin:10px auto;"></div>
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                <span><span style="color:var(--success);">●</span> Strong</span><span><span style="color:var(--warning);">◐</span> Steady</span><span><span style="color:var(--danger);">⚠</span> Needs attention</span><span style="color:var(--text-dim);">◌ Not enough data yet</span><span style="opacity:0.7;">· Color + icon together, never color alone</span>
            </div>
        </div>
        <div class="glass-card hidden" id="weakness-card" style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div class="card-label" id="weakness-title">Weakness Analyzer</div>
                <button class="btn btn-secondary btn-sm" id="weakness-back" style="margin-top:0;">← Back to Health Check</button>
            </div>
            <div id="weakness-body" style="margin-top:12px;"></div>
        </div>
        <div class="glass-card" id="progress-card" style="margin-top:20px;">
            <div class="card-label">Progress & Analytics</div>
            <div id="progress-glance"><div class="spinner" style="margin:12px auto;"></div></div>
            <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:18px 0 8px;">Study Hours by Day</div>
            <div style="height:200px;position:relative;"><canvas id="line-chart"></canvas></div>
            <div class="grid-cols-2" style="margin-top:16px;">
                <div>
                    <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:8px;">Subject Breakdown</div>
                    <div style="height:180px;position:relative;"><canvas id="pie-chart"></canvas></div>
                </div>
                <div>
                    <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:8px;">Weekly Stats</div>
                    <div id="weekly-stats"></div>
                </div>
            </div>
        </div>
    `;
}

function planHTML() {
    return `
        <div class="glass-card" id="exam-card">
            <div class="card-label">Exam Countdown: Deterministic plan, no AI for schedule</div>
            <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.6;">Create a stable daily plan: round-robin subjects across days until your exam. AI is only used when you tap a day to generate revision content.</p>
            <div id="exam-create-form" style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Exam name</label>
                        <input type="text" class="form-control" id="exam-name-input" placeholder="e.g. Midterm Mathematics">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Exam date</label>
                        <input type="date" class="form-control" id="exam-date-input" min="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Subjects for this exam</label>
                    <div id="exam-subject-pills" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;min-height:28px;"><span style="font-size:12px;color:var(--text-dim);">Loading your subjects…</span></div>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">From your personalized list (taxonomy ∪ enrolled classes)</div>
                </div>
                <button class="btn" id="exam-create-btn" style="margin-top:12px;">Add Exam Plan</button>
                <div id="exam-create-status" style="font-size:12px;color:var(--text-dim);margin-top:8px;"></div>
            </div>
            <div id="exam-list-container"><div class="spinner" style="margin:16px auto;"></div></div>
            <div id="exam-day-revision-output" style="margin-top:16px;"></div>
        </div>
        <div class="glass-card" id="schedule-card" style="margin-top:20px;">
            <div class="card-label">Schedule Generator: rule-based week, AI explains it</div>
            <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.6;">Your week is allocated by fixed rules (weak subjects first, round-robin): identical every time for the same inputs. AI only writes the summary.</p>
            <div class="form-group">
                <label>Subjects in my week</label>
                <div id="sched-subject-pills" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;min-height:28px;"></div>
            </div>
            <div class="form-group">
                <label>Daily study time: <span id="sched-mins-val">60</span> min</label>
                <input type="range" class="form-control" id="sched-mins" min="15" max="240" step="15" value="60" style="padding:8px 0;">
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn" id="sched-generate-btn" style="margin-top:0;">Generate My Week</button>
                <button class="btn btn-secondary" id="sched-narrate-btn" style="margin-top:0;" disabled title="Generate your week first to enable the explanation">✨ Explain My Week</button>
            </div>
            <div id="sched-output" style="margin-top:16px;"></div>
            <div id="sched-narrative" style="margin-top:12px;"></div>
        </div>
        <div class="glass-card" id="profile-card" style="margin-top:20px;">
            <div class="card-label">My Study Profile</div>
            <div id="profile-body"><div class="spinner" style="margin:12px auto;"></div></div>
        </div>
        <div class="glass-card status-tab is-brand" id="self-schedule-card" style="margin-top:20px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div class="card-label" style="margin-bottom:0;">🗓 ${_i18n_t('studyHub.selfStudy.mySchedule', 'My Schedule')}</div>
                <span class="badge badge-violet">${_i18n_t('studyHub.selfStudy.personalBadge', 'Personal')}</span>
            </div>
            <p style="font-size:12px;color:var(--text-dim);margin:8px 0 14px;line-height:1.6;">${_i18n_t('studyHub.selfStudy.privateScheduleNote', "Private to you: your teachers can't see this.")}</p>
            <div id="self-schedule-form" class="hidden" style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
                <div id="self-slot-form-title" style="font-size:13px;font-weight:700;margin-bottom:10px;">${_i18n_t('studyHub.selfStudy.addBlock', 'Add study block')}</div>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-slot-day">${_i18n_t('studyHub.selfStudy.day', 'Day')}</label>
                        <select class="form-control" id="self-slot-day"></select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-slot-start">${_i18n_t('studyHub.selfStudy.startTime', 'Start time')}</label>
                        <input type="time" class="form-control" id="self-slot-start" value="09:00">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-slot-end">${_i18n_t('studyHub.selfStudy.endTime', 'End time')}</label>
                        <input type="time" class="form-control" id="self-slot-end" value="09:45">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-slot-label">${_i18n_t('studyHub.selfStudy.label', 'Label')}</label>
                        <input type="text" class="form-control" id="self-slot-label" placeholder="${_i18n_t('studyHub.selfStudy.labelPlaceholder', 'e.g. Physics Revision')}" maxlength="80">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-slot-subject">${_i18n_t('studyHub.selfStudy.subject', 'Subject')} <span style="color:var(--text-dim);">(${_i18n_t('studyHub.selfStudy.optional', 'optional')})</span></label>
                        <select class="form-control" id="self-slot-subject"></select>
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm" id="self-slot-save" style="margin-top:0;">${_i18n_t('studyHub.selfStudy.save', 'Save')}</button>
                    <button type="button" class="btn btn-sm btn-secondary" id="self-slot-cancel" style="margin-top:0;">${_i18n_t('studyHub.selfStudy.cancel', 'Cancel')}</button>
                </div>
            </div>
            <button type="button" class="btn btn-sm" id="self-slot-add" style="margin-top:0;">+ ${_i18n_t('studyHub.selfStudy.addBlock', 'Add study block')}</button>
            <div id="self-schedule-list" style="margin-top:16px;"><div class="spinner" style="margin:16px auto;"></div></div>
        </div>
        <div class="glass-card status-tab is-success" id="self-tasks-card" style="margin-top:20px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div class="card-label" style="margin-bottom:0;">✅ ${_i18n_t('studyHub.selfStudy.myTasks', 'My Tasks')}</div>
                <span class="badge badge-green">${_i18n_t('studyHub.selfStudy.personalBadge', 'Personal')}</span>
            </div>
            <p style="font-size:12px;color:var(--text-dim);margin:8px 0 14px;line-height:1.6;">${_i18n_t('studyHub.selfStudy.personalTasksNote', 'Personal checklist: not graded work.')}</p>
            <div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;flex:2;">
                        <label for="self-task-title">${_i18n_t('studyHub.selfStudy.taskTitle', 'Title')}</label>
                        <input type="text" class="form-control" id="self-task-title" placeholder="${_i18n_t('studyHub.selfStudy.taskTitlePlaceholder', 'e.g. Revise photosynthesis')}" maxlength="120">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-task-due">${_i18n_t('studyHub.selfStudy.dueDate', 'Due date')} <span style="color:var(--text-dim);">(${_i18n_t('studyHub.selfStudy.optional', 'optional')})</span></label>
                        <input type="date" class="form-control" id="self-task-due">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="self-task-subject">${_i18n_t('studyHub.selfStudy.subject', 'Subject')} <span style="color:var(--text-dim);">(${_i18n_t('studyHub.selfStudy.optional', 'optional')})</span></label>
                        <select class="form-control" id="self-task-subject"></select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;display:flex;align-items:flex-end;">
                        <button type="button" class="btn btn-sm" id="self-task-add" style="margin-top:0;">+ ${_i18n_t('studyHub.selfStudy.addTask', 'Add task')}</button>
                    </div>
                </div>
            </div>
            <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:8px;">${_i18n_t('studyHub.selfStudy.incomplete', 'To do')}</div>
            <div id="self-tasks-open"><div class="spinner" style="margin:12px auto;"></div></div>
            <div id="self-tasks-done-wrap" style="margin-top:14px;">
                <div id="self-tasks-done-toggle" role="button" tabindex="0" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:12px;color:var(--text-dim);font-weight:600;">
                    <span>${_i18n_t('studyHub.selfStudy.completed', 'Completed')}</span>
                    <span id="self-tasks-done-count"></span>
                </div>
                <div id="self-tasks-done" style="display:none;margin-top:8px;opacity:0.85;"></div>
            </div>
        </div>
    `;
}

// ─── Grade Setup Modal (first-time, unchanged) ──────────────────
function showGradeSetupModal(container, onDone) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'grade-setup-overlay';
    overlay.style.zIndex = '1200';
    var gradeVal = null, streamVal = null;
    function isStreamNeeded(g) { return g === '11' || g === '12'; }
    function renderModal() {
        overlay.innerHTML = `
            <div class="modal" style="max-width:420px;text-align:center;">
                <div class="modal-title" style="margin-bottom:8px;">Welcome to Study Hub</div>
                <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:18px;">Personalize your subjects: this helps us show the right subjects everywhere. You can change this anytime in Accessibility.</p>
                <div id="gs-modal-step-grade">
                    <div style="font-weight:700;font-size:14px;margin-bottom:10px;">What grade are you in?</div>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        ${['9', '10', '11', '12'].map(g => `<button class="btn ${gradeVal === g ? '' : 'btn-secondary'}" data-grade="${g}" style="margin-top:0;min-width:64px;">${g}</button>`).join('')}
                    </div>
                </div>
                <div id="gs-modal-step-stream" style="display:${gradeVal && isStreamNeeded(gradeVal) ? 'block' : 'none'};margin-top:18px;">
                    <div style="font-weight:700;font-size:14px;margin-bottom:10px;">What's your stream?</div>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        ${['Science', 'Commerce', 'Humanities'].map(s => `<button class="btn ${streamVal === s ? '' : 'btn-secondary'}" data-stream="${s}" style="margin-top:0;min-width:90px;">${s}</button>`).join('')}
                    </div>
                </div>
                <button class="btn" id="gs-modal-save" style="margin-top:18px;width:100%;opacity:${!gradeVal || (isStreamNeeded(gradeVal) && !streamVal) ? '0.6' : ''}" ${!gradeVal || (isStreamNeeded(gradeVal) && !streamVal) ? 'disabled' : ''}>Save & Continue</button>
                <div style="font-size:11px;color:var(--text-dim);margin-top:8px;">Same two-step UI as in Accessibility: grade 9–10 skips stream.</div>
            </div>
        `;
        overlay.querySelectorAll('[data-grade]').forEach(function (b) {
            b.addEventListener('click', function () { gradeVal = b.dataset.grade; if (gradeVal === '9' || gradeVal === '10') streamVal = null; renderModal(); });
        });
        overlay.querySelectorAll('[data-stream]').forEach(function (b) {
            b.addEventListener('click', function () { streamVal = b.dataset.stream; renderModal(); });
        });
        var saveBtn = overlay.querySelector('#gs-modal-save');
        if (saveBtn) saveBtn.addEventListener('click', async function () {
            if (!gradeVal) return;
            if (isStreamNeeded(gradeVal) && !streamVal) { showToast('Select your stream for grade ' + gradeVal, 'error'); return; }
            var streamToSave = isStreamNeeded(gradeVal) ? streamVal : null;
            saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
            try {
                var uid = appState.user && appState.user.uid ? appState.user.uid : null;
                if (!uid) throw new Error('Not signed in');
                await setDoc(doc(db, 'users', uid), { grade: gradeVal, stream: streamToSave }, { merge: true });
                if (appState.userData) { appState.userData.grade = gradeVal; appState.userData.stream = streamToSave; }
                if (typeof resetStudyHubContext === 'function') resetStudyHubContext();
                _shCtx = null;
                overlay.remove();
                if (typeof onDone === 'function') onDone();
                showToast('Grade & stream saved ✓', 'success');
            } catch (e) { showToast('Failed to save: ' + (e.message || ''), 'error'); saveBtn.disabled = false; saveBtn.textContent = 'Save & Continue'; }
        });
    }
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { /* prevent closing without save */ } });
    renderModal();
}

// ─── Render ───────────────────────────────────────────────────
var SH_SECTIONS = [
    { id: 'today', label: '☀️ Today' },
    { id: 'learn', label: '📖 Learn' },
    { id: 'practice', label: '🎯 Practice' },
    { id: 'track', label: '📈 Track' },
    { id: 'plan', label: '🗓 Plan' },
];

function renderStudentStudyHub(container, params = {}) {
    // First-time setup: grade must exist before the shared context can personalize
    var isStudentRole = appState.role === 'student';
    var hasGrade = appState.userData && appState.userData.grade != null && String(appState.userData.grade).trim() !== '';
    if (isStudentRole && !hasGrade) {
        container.innerHTML = `<div class="flex-col"><div class="glass-card" style="text-align:center;padding:28px;"><div class="spinner"></div><div style="font-size:13px;color:var(--text-dim);margin-top:10px;">Loading your Study Hub…</div></div></div>`;
        setTimeout(function () {
            var stillMissing = !appState.userData || appState.userData.grade == null || String(appState.userData.grade).trim() === '';
            if (stillMissing) {
                showGradeSetupModal(container, function () { renderStudentStudyHub(container, params); });
            }
        }, 200);
        (async function () {
            try {
                var uid = appState.user && appState.user.uid ? appState.user.uid : null;
                if (uid) {
                    var snap = await getDoc(doc(db, 'users', uid));
                    if (snap.exists) {
                        var d = snap.data();
                        if (d.grade != null && String(d.grade).trim() !== '') {
                            if (appState.userData) { appState.userData.grade = String(d.grade); appState.userData.stream = d.stream || null; }
                            var overlay = document.getElementById('grade-setup-overlay');
                            if (overlay) { overlay.remove(); renderStudentStudyHub(container, params); }
                        }
                    }
                }
            } catch (e) {}
        })();
        return;
    }

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.studyHub', 'Study Hub'), _i18n_t('studyHub.subtitle', 'Your personal AI-powered study command center'))}
            <div id="study-hub-context-loading" class="glass-card" style="text-align:center;padding:28px;">
                <div class="spinner"></div>
                <div style="font-size:13px;color:var(--text-dim);margin-top:10px;">Loading your study context…</div>
            </div>
            <div id="study-hub-tabs" class="hidden">
                <div class="tabs" id="tabs-bar" role="tablist" aria-label="Study Hub sections">
                    ${SH_SECTIONS.map(function (s, i) {
                        return '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" data-section="' + s.id + '">' + s.label + '</button>';
                    }).join('')}
                </div>
                ${SH_SECTIONS.map(function (s, i) {
                        return '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" role="tabpanel" id="sh-section-' + s.id + '"></div>';
                    }).join('')}
            </div>
        </div>
    `;
    try { if (typeof enhanceInputsWithSTT === 'function') enhanceInputsWithSTT(container); } catch {}
    window._focusRunning = false;
    // Perf: kill any orphaned focus tick from a previous Study Hub visit
    // (route change doesn't unmount the closure's interval otherwise)
    try { if (window._shFocusInterval) { clearInterval(window._shFocusInterval); window._shFocusInterval = null; } } catch {}

    // Bedtime/wind-down: one-time-per-day banner after 9:30 PM
    try {
        const now = new Date();
        const after930 = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 30);
        if (after930) {
            const ds = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const key = "stuvo_bedtime_dismiss_" + ds;
            if (localStorage.getItem(key) !== "1") {
                const prefs = window._notificationPrefs || {};
                if (prefs.bedtimeNudge !== false) {
                    const banner = document.createElement("div");
                    banner.id = "bedtime-banner-studyhub";
                    banner.style.cssText = "background:linear-gradient(135deg,rgba(124,92,252,0.15),rgba(79,140,255,0.12));border:1px solid rgba(124,92,252,0.3);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:16px;";
                    banner.innerHTML = '<div style="font-size:22px;">🌙</div><div style="flex:1;"><div style="font-weight:700;font-size:14px;">It\'s getting late: consider wrapping up soon.</div><div style="font-size:12px;color:var(--text-dim);margin-top:2px;">A good wind-down helps you rest. You can dismiss this and it won\'t reappear today.</div></div><button id="bedtime-dismiss-sh" class="btn btn-secondary btn-sm" style="margin-top:0;width:auto;flex-shrink:0;">Dismiss</button>';
                    container.querySelector('.flex-col').prepend(banner);
                    banner.querySelector("#bedtime-dismiss-sh").addEventListener("click", () => { banner.remove(); localStorage.setItem(key, "1"); });
                }
            }
        }
    } catch (e) {}

    // Section switching (same .tabs styling as before)
    function switchSection(id, anchor) {
        var tabsRoot = container.querySelector('#study-hub-tabs');
        if (!tabsRoot) return;
        tabsRoot.querySelectorAll('.tab-btn').forEach(function (b) {
            var on = b.dataset.section === id;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        tabsRoot.querySelectorAll('.tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === 'sh-section-' + id);
        });
        // Track shows merged focus data; refresh it when returning after a
        // focus save so the new session is visible without a page reload.
        if (id === 'track') {
            try {
                if (window._shTrackDirty) shRefreshTrack(container);
            } catch (e) {}
        }
        if (anchor) {
            var el = container.querySelector('#' + anchor);
            if (el && el.scrollIntoView) setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 60);
        }
    }
    container.querySelectorAll('#tabs-bar .tab-btn').forEach(function (b) {
        b.addEventListener('click', function () { switchSection(b.dataset.section); });
    });

    // Deep links: old flat-tab ids + alias paths map to section + anchor
    function resolveDeepLink() {
        var target = null, anchor = null;
        try {
            const hashInfo = (typeof parseHash === 'function') ? parseHash() : { path: window.location.hash.split('?')[0], params: params || {} };
            const qp = (hashInfo && hashInfo.params) || params || {};
            target = qp.section || qp.tab || qp.rev || null;
            anchor = qp.anchor || null;
            if (!target) {
                const p = (hashInfo && hashInfo.path) || window.location.hash || '';
                if (p === '#/student/doubt') { target = 'doubt'; }
                else if (p === '#/student/focus') { target = 'today'; anchor = anchor || 'focus-card'; }
                else if (p === '#/student/revision') { target = 'learn'; anchor = anchor || 'revision-card'; }
                else if (p === '#/student/studyhub') { target = 'today'; }
            }
        } catch (e) {}
        if (!target) return { section: 'today', anchor: null };
        var t = String(target);
        var map = {
            today: ['today', null], learn: ['learn', null], practice: ['practice', null], track: ['track', null], plan: ['plan', null],
            planner: ['plan', 'schedule-card'], exam: ['plan', 'exam-card'], examCountdown: ['plan', 'exam-card'], 'exam-countdown': ['plan', 'exam-card'],
            revision: ['learn', 'revision-card'], rev: ['learn', 'revision-card'],
            quiz: ['practice', 'quiz-card'], focus: ['today', 'focus-card'],
            analytics: ['track', 'progress-card'], doubt: ['learn', 'doubt-card'],
            studyhub: ['today', null], 'study-hub': ['today', null]
        };
        var hit = map[t] || ['today', null];
        return { section: hit[0], anchor: anchor || hit[1] };
    }

    // ── Load shared brain ONCE, then render all 5 sections ────
    (async function boot() {
        var ctx;
        try {
            ctx = await ensureStudyHubContext();
        } catch (e) {
            var loadingEl = container.querySelector('#study-hub-context-loading');
            if (loadingEl) loadingEl.innerHTML = '<div style="font-size:13px;color:#FCA5A5;padding:12px;">Could not load your study context: ' + shEsc(e.message || '') + '</div>';
            return;
        }
        var subjects = (ctx.subjects && ctx.subjects.length) ? ctx.subjects : SUBJECT_OPTIONS.slice();
        container.querySelector('#sh-section-today').innerHTML = todayHTML();
        container.querySelector('#sh-section-learn').innerHTML = learnHTML(subjects);
        container.querySelector('#sh-section-practice').innerHTML = practiceHTML(subjects);
        container.querySelector('#sh-section-track').innerHTML = trackHTML();
        container.querySelector('#sh-section-plan').innerHTML = planHTML();
        var l = container.querySelector('#study-hub-context-loading');
        if (l) l.remove();
        container.querySelector('#study-hub-tabs').classList.remove('hidden');
        try { container._shCtx = ctx; } catch (e) {}

        bindToday(container, ctx);
        bindLearn(container, ctx);
        bindPractice(container, ctx);
        bindTrack(container, ctx);
        bindPlan(container, ctx);

        var dl = resolveDeepLink();
        var valid = SH_SECTIONS.some(function (s) { return s.id === dl.section; });
        switchSection(valid ? dl.section : 'today', dl.anchor);
    })();
}

// ══════════════════════════════════════════════════════════════
// TODAY — Next Best Action + Streak + Focus Mode
// ══════════════════════════════════════════════════════════════
function bindToday(container, ctx) {
    // Streak orb (from shared context — no independent query)
    var streakBody = container.querySelector('#streak-body');
    if (streakBody) {
        var n = ctx.currentStreak || 0;
        streakBody.innerHTML = `
            <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;">
                <div style="width:110px;height:110px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;
                    background:radial-gradient(circle at 35% 30%, rgba(124,92,252,0.35), rgba(79,140,255,0.12));
                    border:2px solid rgba(124,92,252,0.5);">
                    <div style="font-size:30px;">🔥</div>
                    <div style="font-family:'Sora',sans-serif;font-size:26px;font-weight:800;">${n}</div>
                </div>
                <div style="font-size:12px;color:var(--text-dim);">${n === 1 ? 'day streak: keep it going' : 'day streak'}</div>
            </div>`;
    }

    // Next Best Action — inputs derived from shared context only
    var nbaBody = container.querySelector('#nba-body');
    if (nbaBody) {
        (async function () {
            var incompleteHomework = (ctx.upcomingDeadlines || []).map(function (h) {
                var ms = 0;
                try {
                    var dl = h.deadlineDate instanceof Date ? h.deadlineDate : new Date(h.deadlineDate || h.deadline);
                    ms = dl - new Date();
                } catch (e) {}
                return { title: h.title || 'Homework', subject: h.subject || 'General', hoursUntilDue: Math.max(0, Math.round(ms / 3600000)) };
            });
            var recentlyStudiedSubjects = [...new Set((ctx.recentActivity || []).map(function (a) { return a.subject; }).filter(Boolean))];
            function fallback() {
                var items = [];
                if (incompleteHomework.length) items.push({ action: 'Finish ' + incompleteHomework[0].title + ' (' + incompleteHomework[0].subject + ')', reason: 'due soonest', estimatedMinutes: 25 });
                if (ctx.weakSubjects && ctx.weakSubjects.length) items.push({ action: 'Revise ' + ctx.weakSubjects[0], reason: 'weakest recent scores', estimatedMinutes: 30 });
                else if (ctx.subjects && ctx.subjects.length) items.push({ action: 'Revise ' + ctx.subjects[0], reason: 'stay consistent', estimatedMinutes: 25 });
                items.push({ action: 'Do a 25-minute focus session', reason: 'protect your streak', estimatedMinutes: 25 });
                return { priorities: items.slice(0, 3) };
            }
            var priorities;
            try {
                var data = await safeApiCall('/api/ai', {
                    action: 'nextBestAction',
                    incompleteHomework: incompleteHomework.slice(0, 5),
                    recentlyStudiedSubjects: recentlyStudiedSubjects,
                    allEnrolledSubjects: ctx.subjects,
                    grade: ctx.grade,
                    languageName: ctx.languageName
                });
                priorities = (data && data.priorities && data.priorities.length) ? data.priorities : fallback().priorities;
            } catch (e) { priorities = fallback().priorities; }
            nbaBody.innerHTML = priorities.slice(0, 3).map(function (p, i) {
                return '<div class="hw-item"><div style="font-size:22px;">' + ['1️⃣', '2️⃣', '3️⃣'][i] + '</div>' +
                    '<div style="flex:1;"><div class="hw-title">' + shEsc(p.action) + '</div>' +
                    '<div class="hw-sub">' + shEsc(p.reason || '') + (p.estimatedMinutes ? ' · ~' + p.estimatedMinutes + ' min' : '') + '</div></div></div>';
            }).join('');
        })();
    }

    // Focus Mode (preserved: flexible session styles from accessibility prefs)
    var d = getData();
    var today = shTodayStr();
    var todaySessions = (d.focusHistory || []).filter(function (h) { return h.date === today; });
    function paintFocusBase() {
        var tc = container.querySelector('#focus-today-count');
        var tt = container.querySelector('#focus-today-time');
        var xpEl = container.querySelector('#focus-xp');
        var bd = container.querySelector('#focus-badges');
        var dd = getData();
        var freshDay = shTodayStr();
        var daySessions = (dd.focusHistory || []).filter(function (h) { return h.date === freshDay; });
        if (tc) tc.textContent = daySessions.length;
        if (tt) tt.textContent = daySessions.reduce(function (s, h) { return s + (Number(h.duration) || 0); }, 0) + 'm';
        if (xpEl) xpEl.textContent = dd.gamification.xp + ' XP';
        if (bd) bd.innerHTML = BADGES_DEF.map(function (b) {
            var earned = dd.gamification.badges.includes(b.id);
            return '<span class="badge ' + (earned ? 'badge-violet' : 'badge-gray') + '" title="' + (earned ? 'Earned!' : b.xpRequired + ' XP needed') + '">' + b.name + '</span>';
        }).join('');
    }
    paintFocusBase();
    // ── Custom timer presets (Self-Study Zone — private to this student) ──
    // Duration-selection step ONLY. The start/tick/reset/completion logic below
    // is reused untouched, so the partial-session-on-reset fix applies to custom
    // durations automatically (reset/complete XP is pro-rated from WORK).
    var focusPresetOverrideMin = null;
    var focusPresets = [];
    function focusPresetCacheKey() {
        var u = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : 'anon';
        return 'stuvo_timer_presets_' + u;
    }
    function readFocusPresetCache() {
        try {
            var raw = localStorage.getItem(focusPresetCacheKey());
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function writeFocusPresetCache(list) {
        try { localStorage.setItem(focusPresetCacheKey(), JSON.stringify(list.slice(0, 20))); } catch (e) {}
    }
    function paintFocusPresets() {
        var host = container.querySelector('#focus-preset-list');
        var defBtn = container.querySelector('#focus-preset-default');
        if (!host) return;
        host.innerHTML = '';
        focusPresets.forEach(function (p) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'badge ' + (focusPresetOverrideMin === p.durationMinutes ? 'badge-violet' : 'badge-gray');
            b.style.cssText = 'cursor:pointer;padding:7px 12px;';
            b.textContent = p.name + ' · ' + p.durationMinutes + 'm';
            b.setAttribute('aria-pressed', focusPresetOverrideMin === p.durationMinutes ? 'true' : 'false');
            b.addEventListener('click', function () {
                if (focusPhase !== 'idle') { showToast(_i18n_t('studyHub.selfStudy.resetFirst', 'Reset the timer before switching duration.'), 'error'); return; }
                focusPresetOverrideMin = p.durationMinutes;
                refreshFocusDurations();
                paintFocusPresets();
            });
            host.appendChild(b);
        });
        if (defBtn) {
            var isDefault = !focusPresetOverrideMin;
            defBtn.className = 'badge ' + (isDefault ? 'badge-violet' : 'badge-gray');
            defBtn.setAttribute('aria-pressed', isDefault ? 'true' : 'false');
        }
    }
    async function loadFocusPresets() {
        var uid = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
        if (!uid) { focusPresets = readFocusPresetCache(); paintFocusPresets(); return; }
        try {
            var snap = await getDocs(collection(db, 'users', uid, 'timerPresets'));
            var list = [];
            snap.forEach(function (d) {
                var v = d.data() || {};
                var mins = Math.floor(Number(v.durationMinutes));
                if (v.name && mins >= 1 && mins <= 180) list.push({ id: d.id, name: String(v.name).slice(0, 40), durationMinutes: mins });
            });
            list.sort(function (a, b) { return a.durationMinutes - b.durationMinutes; });
            focusPresets = list.slice(0, 20);
            writeFocusPresetCache(focusPresets);
        } catch (e) {
            focusPresets = readFocusPresetCache();
        }
        paintFocusPresets();
    }
    function bindFocusPresetUI() {
        var toggle = container.querySelector('#focus-custom-toggle');
        var form = container.querySelector('#focus-custom-form');
        var defBtn = container.querySelector('#focus-preset-default');
        if (toggle && form) {
            toggle.addEventListener('click', function () { form.classList.toggle('hidden'); });
        }
        container.querySelector('#focus-preset-cancel')?.addEventListener('click', function () {
            if (form) form.classList.add('hidden');
        });
        if (defBtn) {
            defBtn.addEventListener('click', function () {
                if (focusPhase !== 'idle') { showToast(_i18n_t('studyHub.selfStudy.resetFirst', 'Reset the timer before switching duration.'), 'error'); return; }
                focusPresetOverrideMin = null;
                refreshFocusDurations();
                paintFocusPresets();
            });
        }
        container.querySelector('#focus-preset-save')?.addEventListener('click', async function () {
            var nameEl = container.querySelector('#focus-preset-name');
            var minsEl = container.querySelector('#focus-preset-mins');
            var statusEl = container.querySelector('#focus-preset-status');
            var btn = container.querySelector('#focus-preset-save');
            var name = nameEl ? nameEl.value.trim().slice(0, 40) : '';
            var mins = minsEl ? Math.floor(Number(minsEl.value)) : NaN;
            if (!name) { showToast(_i18n_t('studyHub.selfStudy.titleRequired', 'Please enter a title.'), 'error'); return; }
            if (!(mins >= 1 && mins <= 180)) { showToast(_i18n_t('studyHub.selfStudy.durationRequired', 'Enter a duration between 1 and 180 minutes.'), 'error'); return; }
            var uid = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
            if (!uid) { showToast(_i18n_t('common.error', 'Something went wrong'), 'error'); return; }
            btn.disabled = true;
            if (statusEl) statusEl.textContent = _i18n_t('common.loading', 'Loading...');
            try {
                var ref = await addDoc(collection(db, 'users', uid, 'timerPresets'), { name: name, durationMinutes: mins, createdAt: serverTimestamp() });
                focusPresets.push({ id: ref.id, name: name, durationMinutes: mins });
                focusPresets.sort(function (a, b) { return a.durationMinutes - b.durationMinutes; });
                writeFocusPresetCache(focusPresets);
                paintFocusPresets();
                if (nameEl) nameEl.value = '';
                if (form) form.classList.add('hidden');
                showToast(name + ' · ' + mins + 'm ✓', 'success');
            } catch (e) {
                showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
            } finally {
                btn.disabled = false;
                if (statusEl) statusEl.textContent = '';
            }
        });
        loadFocusPresets();
    }
    bindFocusPresetUI();
    function getFocusDurations() {
        const style = (window._accessPrefsCache && window._accessPrefsCache.focusSessionStyle) || 'standard';
        if (style === 'flexible') return { WORK: 45 * 60, BREAK: 10 * 60, labelWork: 'Flexible Focus', labelBreak: 'Gentle Break', xp: 35 };
        if (style === 'extended') return { WORK: 50 * 60, BREAK: 15 * 60, labelWork: 'Deep Focus', labelBreak: 'Extended Break', xp: 50 };
        return { WORK: 25 * 60, BREAK: 5 * 60, labelWork: 'Focus Time', labelBreak: 'Break Time', xp: 25 };
    }
    let _dur = getFocusDurations();
    let WORK = _dur.WORK, BREAK_TIME = _dur.BREAK;
    let focusPhase = 'idle', focusSecondsLeft = WORK, focusInterval = null;
    let gentleReminderDone = false;
    // Wall-clock anchor: tick counting throttles in background tabs, so real
    // elapsed time is measured from timestamps (pause gaps excluded).
    let focusSessionStartEpoch = null, focusPauseEpoch = null;
    var badge = container.querySelector('#focus-style-badge');
    if (badge) badge.textContent = WORK / 60 + '/' + BREAK_TIME / 60 + ' min';

    function updateFocusDisplay() {
        // Intentionally unanimated: the Pomodoro tick fires every second for up
        // to 50 minutes. Per the performance contract, high-frequency updates
        // get instant 0ms state changes, never transitions.
        const m = Math.floor(focusSecondsLeft / 60).toString().padStart(2, '0');
        const s = (focusSecondsLeft % 60).toString().padStart(2, '0');
        const timerEl = container.querySelector('#focus-timer');
        const phaseEl = container.querySelector('#focus-phase');
        const ring = container.querySelector('#focus-ring');
        if (!timerEl) return;
        timerEl.textContent = `${m}:${s}`;
        const labels = { idle: _i18n_t('studyHub.ready', 'Ready'), work: _dur.labelWork || _i18n_t('studyHub.focusTime', 'Focus Time'), break: _dur.labelBreak || 'Break Time' };
        phaseEl.textContent = labels[focusPhase] || labels.idle;
        const total = focusPhase === 'break' ? BREAK_TIME : WORK;
        const progress = focusPhase === 'idle' ? 0 : (total - focusSecondsLeft) / total;
        ring.setAttribute('stroke-dashoffset', CIRCUMFERENCE * (1 - progress));
        ring.setAttribute('stroke', focusPhase === 'break' ? '#10B981' : '#7C5CFC');
    }
    function focusTick() {
        if (_dur.labelWork === 'Flexible Focus' && focusPhase === 'work' && !gentleReminderDone && (WORK - focusSecondsLeft) === 25 * 60) {
            gentleReminderDone = true;
            showToast('You’ve been focused for 25 min: keep going or take a gentle pause if you need 🌿', 'info');
        }
        if (focusSecondsLeft <= 1) {
            if (focusPhase === 'work') {
                const dd = getData();
                const dur = WORK / 60;
                const focusDay = shTodayStr();
                const history = [...(dd.focusHistory || []), { date: focusDay, duration: dur }];
                saveData({ focusHistory: history, gamification: { ...dd.gamification, focusSessions: (dd.gamification.focusSessions || 0) + 1 } });
                addXP(_dur.xp || 25);
                shMirrorFocusToActivity(dur);
                try { window._shTrackDirty = true; } catch (e) {}
                focusSessionStartEpoch = null; focusPauseEpoch = null;
                focusPhase = 'break'; focusSecondsLeft = BREAK_TIME;
                gentleReminderDone = false;
                showToast(`Focus session complete! Take a ${BREAK_TIME / 60}-min break. +${_dur.xp || 25} XP 🎉`, 'success');
                paintFocusBase();
                shRefreshTrack(container);
            } else { focusPhase = 'work'; focusSecondsLeft = WORK; gentleReminderDone = false; focusSessionStartEpoch = Date.now(); focusPauseEpoch = null; }
            updateFocusDisplay(); return;
        }
        focusSecondsLeft--;
        updateFocusDisplay();
    }
    function refreshFocusDurations() {
        _dur = getFocusDurations();
        WORK = _dur.WORK; BREAK_TIME = _dur.BREAK;
        if (focusPresetOverrideMin && focusPhase === 'idle') WORK = focusPresetOverrideMin * 60;
        if (focusPhase === 'idle') focusSecondsLeft = WORK;
        var b2 = container.querySelector('#focus-style-badge');
        if (b2) b2.textContent = WORK / 60 + '/' + BREAK_TIME / 60 + ' min';
        updateFocusDisplay();
    }
    window.addEventListener('languageChanged', refreshFocusDurations);
    const _origApply = window.applyAccessibilityPrefs;
    if (_origApply && !_origApply._focusWrapped) {
        const baseApply = _origApply;
        window.applyAccessibilityPrefs = function (p) { baseApply(p); refreshFocusDurations(); };
        window.applyAccessibilityPrefs._focusWrapped = true;
    }
    container.querySelector('#focus-start')?.addEventListener('click', () => {
        if (window._focusRunning && focusInterval) return; // already ticking — ignore double-start
        if (focusPhase === 'idle') {
            _dur = getFocusDurations(); WORK = _dur.WORK; BREAK_TIME = _dur.BREAK; if (focusPresetOverrideMin) WORK = focusPresetOverrideMin * 60; focusSecondsLeft = WORK; gentleReminderDone = false;
            focusPhase = 'work';
            focusSessionStartEpoch = Date.now(); focusPauseEpoch = null;
        } else if (focusPauseEpoch && focusSessionStartEpoch) {
            // Resume: exclude the paused gap from wall-clock elapsed time.
            focusSessionStartEpoch += Date.now() - focusPauseEpoch; focusPauseEpoch = null;
        }
        window._focusRunning = true;
        container.querySelector('#focus-start').classList.add('hidden');
        container.querySelector('#focus-pause').classList.remove('hidden');
        focusInterval = setInterval(focusTick, 1000);
        try { window._shFocusInterval = focusInterval; } catch {}
        updateFocusDisplay();
    });
    container.querySelector('#focus-pause')?.addEventListener('click', () => {
        if (focusPhase === 'work' && focusSessionStartEpoch && !focusPauseEpoch) focusPauseEpoch = Date.now();
        window._focusRunning = false; clearInterval(focusInterval);
        try { window._shFocusInterval = null; } catch {}
        container.querySelector('#focus-start').classList.remove('hidden');
        container.querySelector('#focus-start').textContent = '▶ Resume';
        container.querySelector('#focus-pause').classList.add('hidden');
    });
    container.querySelector('#focus-reset')?.addEventListener('click', () => {
        // Partial-session save: real elapsed work time must never be discarded.
        // Only the work phase counts; idle/break resets save nothing.
        if (focusPhase === 'work') {
            const tickMinutes = Math.floor((WORK - focusSecondsLeft) / 60);
            // Prefer wall-clock (immune to background-tab throttle); fall back
            // to tick count only if no anchor exists. Paused gaps excluded.
            // If paused at reset press, count time up to the pause moment.
            const wallEnd = focusPauseEpoch || Date.now();
            const wallMinutes = focusSessionStartEpoch ? Math.floor((wallEnd - focusSessionStartEpoch) / 60000) : 0;
            const elapsedMinutes = focusSessionStartEpoch ? wallMinutes : tickMinutes;
            if (elapsedMinutes >= 1) {
                const dd = getData();
                const history = [...(dd.focusHistory || []), { date: shTodayStr(), duration: elapsedMinutes, partial: true }];
                const saved = saveData({ focusHistory: history, gamification: { ...dd.gamification, focusSessions: (dd.gamification.focusSessions || 0) + 1 } });
                if (saved) {
                    const rate = (_dur.xp || 25) / (WORK / 60);
                    addXP(Math.max(1, Math.floor(elapsedMinutes * rate)));
                    shMirrorFocusToActivity(elapsedMinutes);
                    try { window._shTrackDirty = true; } catch (e) {}
                    showToast(`Partial session saved: ${elapsedMinutes}m counted ✅`, 'success');
                    paintFocusBase();
                    shRefreshTrack(container);
                }
            }
        }
        clearInterval(focusInterval); try { window._shFocusInterval = null; } catch {} window._focusRunning = false; focusPhase = 'idle'; focusSecondsLeft = WORK; focusSessionStartEpoch = null; focusPauseEpoch = null;
        container.querySelector('#focus-start').classList.remove('hidden');
        container.querySelector('#focus-start').textContent = '▶ Start';
        container.querySelector('#focus-pause').classList.add('hidden');
        updateFocusDisplay();
    });
    updateFocusDisplay();
}

// ══════════════════════════════════════════════════════════════
// LEARN — Doubt Assistant + the ONE Revision Generator
// ══════════════════════════════════════════════════════════════
function bindLearn(container, ctx) {
    // Pre-fill quiz topic when subject changes (cross-module convenience)
    container.querySelector('#doubt-subject')?.addEventListener('change', function () {});

    // ── Doubt Assistant (grade + canonical subject passed to AI) ──
    let doubtHistory = [];
    function renderDoubtThread() {
        const thread = container.querySelector('#chat-thread');
        if (!thread) return;
        if (doubtHistory.length === 0) {
            thread.innerHTML = `<div style="text-align:center;color:var(--text-dim);font-size:13px;">Ask any academic question: I'll explain it step by step 🤖</div>`;
            return;
        }
        thread.innerHTML = doubtHistory.map((msg, idx) => {
            if (msg.role === 'user') {
                const esc = shEsc(msg.content);
                const subEsc = shEsc(msg.subject || 'General');
                return `<div style="background:rgba(124,92,252,0.2);border:1px solid rgba(124,92,252,0.3);border-radius:14px 14px 4px 14px;padding:12px 16px;max-width:80%;font-size:14px;align-self:flex-end;">[${subEsc}] ${esc}</div>`;
            } else {
                const isLastAssistant = idx === doubtHistory.length - 1;
                const formatted = shFmt(msg.content);
                return `<div style="align-self:flex-start;background:rgba(79,140,255,0.1);border:1px solid rgba(79,140,255,0.25);border-radius:14px 14px 14px 4px;padding:14px 16px;max-width:90%;font-size:14px;line-height:1.7;">
                    <strong style="color:#93C5FD;font-size:12px;display:block;margin-bottom:6px;">Stuvo AI</strong>${formatted}
                    ${isLastAssistant ? `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" data-doubt-action="simpler" style="margin-top:0;font-size:12px;">Explain Simpler</button>
                        <button class="btn btn-secondary btn-sm" data-doubt-action="alternative" style="margin-top:0;font-size:12px;">Show Another Method</button>
                    </div>` : ''}
                </div>`;
            }
        }).join('');
        thread.querySelectorAll('[data-doubt-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mode = btn.dataset.doubtAction;
                const lastUser = [...doubtHistory].reverse().find(m => m.role === 'user');
                const lastAssistant = [...doubtHistory].reverse().find(m => m.role === 'assistant');
                if (!lastUser || !lastAssistant) return;
                btn.disabled = true; btn.textContent = _i18n_t('common.loading', 'Loading...');
                try {
                    const data = await safeApiCall('/api/ai', { action: 'doubt', question: lastUser.content, subject: lastUser.subject, grade: ctx.grade, languageName: ctx.languageName, mode, previousAnswer: lastAssistant.content });
                    doubtHistory.push({ role: 'assistant', content: data.answer, subject: lastUser.subject });
                    renderDoubtThread();
                    thread.scrollTop = thread.scrollHeight;
                    addXP(5);
                } catch (err) { showToast(err.message, 'error'); }
                finally { btn.disabled = false; }
            });
        });
        try {
            thread.querySelectorAll('div').forEach(div => {
                if (div.textContent.includes('Stuvo AI') && !div.dataset.ttsDone && typeof createTTSButtonForText === 'function') {
                    const btn = createTTSButtonForText(() => div.textContent);
                    btn.style.marginTop = '8px'; btn.style.fontSize = '11px';
                    div.appendChild(btn);
                    div.dataset.ttsDone = '1';
                    try {
                        const prefs = window._accessPrefsCache || {};
                        if (prefs.autoReadNewContent && typeof maybeAutoRead === 'function') {
                            const ans = div.textContent.replace('Stuvo AI', '').trim().slice(0, 500);
                            if (ans) maybeAutoRead(ans, div);
                        }
                    } catch {}
                }
            });
            if (typeof enhanceWithSimplify === 'function') enhanceWithSimplify(thread);
        } catch {}
        thread.scrollTop = thread.scrollHeight;
    }
    try { const dq = container.querySelector('#doubt-question'); if (dq && typeof attachSTT === 'function') attachSTT(dq); } catch {}
    container.querySelector('#chat-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const input = container.querySelector('#doubt-question');
        const subject = container.querySelector('#doubt-subject').value;
        const q = input.value.trim();
        if (!q) return;
        doubtHistory.push({ role: 'user', content: q, subject });
        renderDoubtThread();
        const thread = container.querySelector('#chat-thread');
        const loading = document.createElement('div');
        loading.id = 'doubt-loading';
        loading.innerHTML = `<div class="spinner" style="margin:8px auto;width:24px;height:24px;border-width:2px;"></div>`;
        thread.appendChild(loading); thread.scrollTop = thread.scrollHeight; input.value = ''; input.disabled = true;
        try {
            const data = await safeApiCall('/api/ai', { action: 'doubt', question: q, subject, grade: ctx.grade, languageName: ctx.languageName });
            loading.remove();
            doubtHistory.push({ role: 'assistant', content: data.answer, subject });
            renderDoubtThread();
            addXP(10);
            try { await addDoc(collection(db, 'users', appState.user.uid, 'studyActivity'), { type: 'doubt_asked', subject, durationMinutes: 5, relatedHomeworkId: null, relatedClassId: null, completedAt: serverTimestamp() }); } catch (e) {}
        } catch (err) { loading.remove(); showToast(err.message, 'error'); }
        finally { input.disabled = false; input.focus(); if (thread) thread.scrollTop = thread.scrollHeight; }
    });
    container.querySelectorAll('.suggestion-q').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = container.querySelector('#doubt-question');
            if (input) { input.value = btn.dataset.q; input.focus(); }
        });
    });

    // ── Revision Generator (THE kept version — cache + 5 fields + checklist)
    let revViewedSteps = new Set();
    function updateRevProgress() {
        const total = 5;
        const viewed = revViewedSteps.size;
        const pct = (viewed / total) * 100;
        const bar = container.querySelector('#rev-progress-bar');
        const text = container.querySelector('#rev-progress-text');
        // Transform-only fill: scaleX replaces the old width write so the
        // compositor handles it. Origin-left keeps the left edge anchored.
        if (bar) { bar.style.setProperty('--progress', (pct / 100).toFixed(3)); bar.classList.add('progress-fill'); }
        if (text) text.textContent = viewed + '/' + total;
        container.querySelectorAll('.rev-dot').forEach(dot => {
            const step = parseInt(dot.dataset.step);
            dot.style.background = revViewedSteps.has(step) ? '#7C5CFC' : 'rgba(255,255,255,0.2)';
        });
    }
    var revCheckState = {};
    container.querySelector('#rev-generate-btn')?.addEventListener('click', async () => {
        const subject = container.querySelector('#rev-subject-select')?.value || (ctx.subjects[0] || 'General');
        const chapter = container.querySelector('#rev-chapter-input')?.value?.trim();
        if (!chapter) { showToast('Enter a chapter name.', 'error'); return; }
        const output = container.querySelector('#rev-output');
        const progress = container.querySelector('#rev-progress');
        output.innerHTML = `<div class="spinner"></div>`;
        if (progress) progress.style.display = 'block';
        revViewedSteps.clear(); updateRevProgress();
        revCheckState = {};
        try {
            const data = await safeApiCall('/api/ai', { action: 'generateRevision', subject, chapter, grade: ctx.grade, languageName: ctx.languageName });
            var checklist = Array.isArray(data.checklist) ? data.checklist : [];
            output.innerHTML = `
                <div class="glass-card" style="margin-top:12px;">
                    <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:15px;margin-bottom:12px;">📖 ${shEsc(data.chapter || chapter)} <span style="font-size:12px;color:var(--text-dim);font-weight:400;">(${shEsc(subject)})</span></div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin-bottom:8px;cursor:pointer;" data-rev-step="0">Key Concepts</div>
                    <ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px;">
                        ${(data.keyConcepts || []).map(c => `<li style="font-size:14px;line-height:1.6;">${shEsc(c)}</li>`).join('')}
                    </ul>
                    ${(data.formulas && data.formulas.length) ? `
                        <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin:14px 0 8px;cursor:pointer;" data-rev-step="1">Formulas</div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;">
                            ${data.formulas.map(f => `<span style="font-family:monospace;background:rgba(124,92,252,0.15);border:1px solid rgba(124,92,252,0.3);border-radius:8px;padding:6px 12px;font-size:13px;color:#C4B5FD;">${shEsc(f)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin:14px 0 8px;cursor:pointer;" data-rev-step="2">Quick Notes</div>
                    <div style="font-size:14px;line-height:1.7;color:var(--text-dim);">${shFmt(data.quickNotes || '')}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin:14px 0 8px;cursor:pointer;" data-rev-step="3">Practice Questions</div>
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        ${(data.practiceQuestions || []).map((pq, i) => `
                            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;">
                                <div style="font-size:14px;font-weight:500;margin-bottom:6px;">${i + 1}. ${shEsc(pq.question)}</div>
                                <div style="font-size:13px;color:#6EE7B7;">Answer: ${shEsc(pq.answer)}</div>
                            </div>
                        `).join('')}
                    </div>
                    ${checklist.length ? `
                    <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin:14px 0 8px;cursor:pointer;" data-rev-step="4">Revision Checklist</div>
                    <div style="display:flex;flex-direction:column;gap:8px;" id="rev-checklist">
                        ${checklist.map(function (item, i) {
                            return '<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;cursor:pointer;background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px;">' +
                                '<input type="checkbox" data-check-idx="' + i + '" style="width:17px;height:17px;accent-color:#7C5CFC;margin-top:1px;flex-shrink:0;">' +
                                '<span>' + shEsc(item) + '</span></label>';
                        }).join('')}
                    </div>` : ''}
                </div>
            `;
            output.querySelectorAll('[data-rev-step]').forEach(el => {
                el.addEventListener('click', () => {
                    revViewedSteps.add(parseInt(el.dataset.revStep));
                    updateRevProgress();
                });
            });
            output.querySelectorAll('#rev-checklist input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    revCheckState[cb.dataset.checkIdx] = cb.checked;
                    if (cb.checked) revViewedSteps.add(4);
                    updateRevProgress();
                });
            });
            setTimeout(() => { [0, 1, 2, 3].forEach(s => revViewedSteps.add(s)); updateRevProgress(); }, 500);
            try {
                const revText = output.textContent || '';
                if (revText.trim() && typeof createTTSButtonForText === 'function') {
                    const btn = createTTSButtonForText(() => revText.slice(0, 800));
                    btn.style.marginTop = '10px';
                    output.appendChild(btn);
                }
            } catch {}
            try { await addDoc(collection(db, 'users', appState.user.uid, 'studyActivity'), { type: 'revision', subject, durationMinutes: 15, relatedHomeworkId: null, relatedClassId: null, completedAt: serverTimestamp() }); } catch (e) {}
            addXP(10);
        } catch (err) {
            output.innerHTML = '';
            showToast(err.message, 'error');
            if (progress) progress.style.display = 'none';
        }
    });
}

// ══════════════════════════════════════════════════════════════
// PRACTICE — Self-Quiz + Practice Bits history
// ══════════════════════════════════════════════════════════════
function bindPractice(container, ctx) {
    let quizQuestions = [], quizCurrentIdx = 0, quizScore = 0, quizUserAnswers = [], quizHashes = [];
    function hashQ(text) { let h = 0; for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i); h |= 0; return h.toString(36); }
    container.querySelector('#quiz-subject-select')?.addEventListener('change', function () {
        var tp = container.querySelector('#quiz-topic');
        if (tp && !tp.value.trim()) tp.value = container.querySelector('#quiz-subject-select').value;
    });
    container.querySelector('#quiz-source')?.addEventListener('change', (e) => {
        const v = e.target.value;
        container.querySelector('#quiz-topic-group').style.display = v === 'notes' ? 'none' : 'block';
        container.querySelector('#quiz-notes-group').style.display = v === 'notes' ? 'block' : 'none';
        if (v === 'homework') {
            const classIds = appState.userData?.classIds || [];
            if (classIds.length) {
                getDocs(collection(db, 'classes', classIds[0], 'homework')).then(snap => {
                    let last = null;
                    snap.forEach(d => last = d.data());
                    if (last && last.description) container.querySelector('#quiz-topic').value = last.description.slice(0, 80);
                });
            }
        }
    });
    container.querySelector('#quiz-generate-btn')?.addEventListener('click', async () => {
        const quizSubject = container.querySelector('#quiz-subject-select')?.value || (ctx.subjects[0] || 'General');
        const source = container.querySelector('#quiz-source').value;
        const difficulty = container.querySelector('input[name="quiz-difficulty"]:checked')?.value || 'medium';
        const count = parseInt(container.querySelector('#quiz-count').value) || 10;
        let topic = container.querySelector('#quiz-topic').value.trim();
        if (!topic) topic = quizSubject;
        let sourceText = null;
        if (source === 'notes') sourceText = container.querySelector('#quiz-notes').value.trim();
        if (source === 'homework' && !topic) topic = 'general homework';
        if (source === 'topic' && !topic) { showToast('Enter a chapter/topic.', 'error'); return; }
        const btn = container.querySelector('#quiz-generate-btn');
        btn.disabled = true; btn.textContent = _i18n_t('studyHub.generating', 'Generating...');
        const out = container.querySelector('#quiz-output');
        out.innerHTML = `<div class="spinner"></div>`;
        let previousHashes = [];
        try {
            const histSnap = await getDocs(collection(db, 'users', appState.user.uid, 'quizHistory'));
            histSnap.forEach(d => { const h = d.data().questionHashes || []; previousHashes.push(...h); });
        } catch (e) {}
        try {
            const data = await safeApiCall('/api/ai', { action: 'generateQuiz', topic, subject: quizSubject, grade: ctx.grade, languageName: ctx.languageName, difficulty, questionCount: count, sourceText, previousHashes: previousHashes.slice(0, 50) });
            quizQuestions = data.questions || data.quiz || [];
            if (!quizQuestions.length) throw new Error('No questions returned');
            quizCurrentIdx = 0; quizScore = 0; quizUserAnswers = [];
            quizHashes = quizQuestions.map(q => hashQ(q.question));
            renderQuizQuestion();
        } catch (err) { out.innerHTML = ''; showToast(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = _i18n_t('studyHub.generateQuiz', 'Generate Quiz'); }
    });
    function renderQuizQuestion() {
        const out = container.querySelector('#quiz-output');
        if (!out) return;
        if (quizCurrentIdx >= quizQuestions.length) {
            out.innerHTML = `
                <div class="glass-card" style="text-align:center;padding:24px;">
                    <div style="font-size:28px;margin-bottom:8px;">${quizScore >= quizQuestions.length * 0.8 ? '🎉' : quizScore >= quizQuestions.length * 0.5 ? '👍' : '💪'}</div>
                    <div style="font-size:22px;font-weight:700;">Score: ${quizScore} / ${quizQuestions.length}</div>
                    <div style="font-size:13px;color:var(--text-dim);margin:8px 0 16px;">${quizScore === quizQuestions.length ? 'Perfect!' : quizScore >= quizQuestions.length * 0.6 ? 'Good job!' : 'Keep practicing!'}</div>
                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-secondary" id="quiz-retry">Retry This Quiz</button>
                        <button class="btn" id="quiz-another">Generate Another Quiz</button>
                    </div>
                </div>
            `;
            try {
                const subject = container.querySelector('#quiz-subject-select')?.value || 'General';
                addDoc(collection(db, 'users', appState.user.uid, 'quizHistory'), {
                    subject, topic: subject, difficulty: container.querySelector('input[name="quiz-difficulty"]:checked')?.value || 'medium',
                    questionHashes: quizHashes, score: quizScore, totalQuestions: quizQuestions.length, createdAt: serverTimestamp()
                });
                addXP(10);
                _shCtx = null; if (typeof resetStudyHubContext === 'function') resetStudyHubContext();
            } catch (e) {}
            out.querySelector('#quiz-retry')?.addEventListener('click', () => {
                quizQuestions = [...quizQuestions].sort(() => Math.random() - 0.5);
                quizCurrentIdx = 0; quizScore = 0; quizUserAnswers = [];
                renderQuizQuestion();
            });
            out.querySelector('#quiz-another')?.addEventListener('click', () => {
                out.innerHTML = '';
                container.querySelector('#quiz-topic').value = '';
                container.querySelector('#quiz-notes').value = '';
            });
            return;
        }
        const q = quizQuestions[quizCurrentIdx];
        out.innerHTML = `
            <div class="glass-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-size:12px;color:var(--text-dim);">Question ${quizCurrentIdx + 1} of ${quizQuestions.length}</span>
                    <span style="font-size:12px;color:var(--text-dim);">Score: ${quizScore}</span>
                </div>
                <div style="font-size:15px;font-weight:600;margin-bottom:14px;">${shEsc(q.question)}</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${(q.options || []).map((opt, oi) => `<button class="quiz-option" data-oi="${oi}" style="text-align:left;"><div class="quiz-letter">${'ABCD'[oi]}</div>${shEsc(opt)}</button>`).join('')}
                </div>
                <div id="quiz-feedback" style="margin-top:12px;"></div>
            </div>
        `;
        out.querySelectorAll('.quiz-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const oi = parseInt(btn.dataset.oi);
                const isCorrect = oi === q.correctIndex;
                if (isCorrect) quizScore++;
                quizUserAnswers.push(oi);
                const fb = out.querySelector('#quiz-feedback');
                fb.innerHTML = `
                    <div style="padding:12px;border-radius:10px;background:${isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
                        <div style="font-weight:600;color:${isCorrect ? '#6EE7B7' : '#FCA5A5'};margin-bottom:6px;">${isCorrect ? '✅ Correct!' : '❌ Incorrect'} ${!isCorrect && q.correctIndex !== undefined ? `(Correct: ${'ABCD'[q.correctIndex]})` : ''}</div>
                        <div style="font-size:13px;line-height:1.6;color:var(--text-dim);">${shEsc(q.explanation || '')}</div>
                        <button class="btn btn-sm" id="quiz-next" style="margin-top:12px;">${quizCurrentIdx + 1 === quizQuestions.length ? 'See Results' : 'Next Question →'}</button>
                    </div>
                `;
                out.querySelectorAll('.quiz-option').forEach(b => b.style.pointerEvents = 'none');
                if (isCorrect) btn.classList.add('correct'); else { btn.classList.add('incorrect'); const correctBtn = out.querySelector(`[data-oi="${q.correctIndex}"]`); if (correctBtn) correctBtn.classList.add('correct'); }
                out.querySelector('#quiz-next')?.addEventListener('click', () => { quizCurrentIdx++; renderQuizQuestion(); });
            });
        });
    }

    // Practice Bits history (module-owned data; full flow lives on its own screen)
    var bitsHost = container.querySelector('#bits-history');
    if (bitsHost) {
        (async function () {
            var items = [];
            try {
                var uid = appState.user && appState.user.uid ? appState.user.uid : null;
                var start = new Date(); start.setDate(start.getDate() - 7);
                var startStr = start.toISOString().split('T')[0];
                var todayStr = new Date().toISOString().split('T')[0];
                var snap = await getDocs(collection(db, 'users', uid, 'practiceBits'));
                snap.forEach(function (d) {
                    if (d.id >= startStr && d.id <= todayStr) items.push(Object.assign({ date: d.id }, d.data()));
                });
            } catch (e) {}
            items.sort(function (a, b) { return b.date.localeCompare(a.date); });
            if (!items.length) {
                bitsHost.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:8px 0;">No practice bits in the last 7 days: generate today\'s bit to start a streak.</div>';
                return;
            }
            bitsHost.innerHTML = items.slice(0, 7).map(function (h, i) {
                var badge = (h.studentAnswer === undefined) ? '<div class="hw-badge">unanswered</div>'
                    : '<div class="hw-badge ' + (h.isCorrect ? 'success' : 'urgent') + '">' + (h.isCorrect ? '✓ Correct' : '✗ Incorrect') + '</div>';
                return '<div class="hw-item"><div><div class="hw-title">' + shEsc((h.question || '').slice(0, 70)) + '…</div>' +
                    '<div class="hw-sub">' + shEsc(h.subject || 'General') + ' · ' + shEsc(h.date) + '</div></div>' + badge + '</div>';
            }).join('');
        })();
    }
    container.querySelector('#bits-open-full')?.addEventListener('click', function () {
        window.location.hash = '#/student/practice-bits';
    });
}

// ══════════════════════════════════════════════════════════════
// TRACK — Health glance → Weakness deep dive + merged Progress
// ══════════════════════════════════════════════════════════════
function bindTrack(container, ctx) {
    var row = container.querySelector('#subject-health-row');
    var healthResults = {};

    function openAnalyzerFor(subject) {
        var entry = healthResults[subject];
        // Only deep-dive statuses route here; strong/insufficient chips are not clickable
        if (!entry || (entry.status !== 'needs_attention' && entry.status !== 'steady')) return;
        openWeaknessAnalyzer(container, ctx, subject, entry, healthResults);
    }

    function renderHealthRow(results) {
        healthResults = results || {};
        if (!results || !Object.keys(results).length) {
            row.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:12px;">No health data.</div>';
            return;
        }
        row.innerHTML = Object.entries(results).map(function (entry) {
            var subject = entry[0]; var data = entry[1];
            var cfg = getHealthStatusConfig(data.status);
            var escSub = shEsc(subject);
            var statusLabel = data.status === 'insufficient_data' ? 'Not enough data yet' : cfg.label;
            var desc = data.status === 'insufficient_data' ? 'Not enough data yet: complete a quiz or practice' :
                data.status === 'needs_attention' ? escSub + ' could use a little attention' :
                data.status === 'steady' ? escSub + ': steady' : escSub + ': strong';
            var clickable = (data.status === 'needs_attention' || data.status === 'steady');
            return '<div class="health-chip" data-health-subject="' + escSub + '"' + (clickable ? ' role="button" tabindex="0" aria-label="' + escSub + ', ' + statusLabel + '. Open detailed analysis."' : '') +
                ' style="min-width:150px;flex:0 0 auto;background:var(--glass);border:1px solid var(--glass-border);border-radius:14px;padding:12px;text-align:center;' +
                (clickable ? 'cursor:pointer;' : '') + '" title="' + shEsc(desc) + '">' +
                '<div style="font-size:20px;color:' + cfg.color + ';line-height:1;">' + cfg.icon + '</div>' +
                '<div style="font-weight:700;font-size:13px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escSub + '</div>' +
                '<div class="badge ' + cfg.badge + '" style="margin-top:6px;font-size:11px;display:inline-flex;align-items:center;gap:4px;">' + cfg.icon + ' ' + shEsc(statusLabel) + '</div>' +
                (data.status !== 'insufficient_data'
                    ? '<div style="font-size:11px;color:var(--text-dim);margin-top:6px;">' + shEsc(desc) + '</div>' +
                      '<div style="font-size:10px;color:var(--text-dim);margin-top:4px;">' + (data.quizAvg !== null && data.quizAvg !== undefined ? 'Avg ' + Math.round(data.quizAvg * 100) + '%' : '') + (data.daysSinceStudied !== undefined && data.daysSinceStudied !== 999 ? ' · ' + data.daysSinceStudied + 'd ago' : '') + '</div>' +
                      '<div class="health-nudge" data-nudge-for="' + escSub + '" style="font-size:11px;color:#C4B5FD;margin-top:6px;font-style:italic;"></div>'
                    : '<div style="font-size:11px;color:var(--text-dim);margin-top:6px;">Not enough data yet</div>') +
                '</div>';
        }).join('');
        row.querySelectorAll('[data-health-subject]').forEach(function (chip) {
            var subj = chip.dataset.healthSubject;
            var entry = healthResults[subj];
            if (!entry || (entry.status !== 'needs_attention' && entry.status !== 'steady')) return;
            chip.addEventListener('click', function () { openAnalyzerFor(subj); });
            chip.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAnalyzerFor(subj); } });
        });
        // AI nudges — ONLY for subjects that are not strong/insufficient_data
        Object.entries(healthResults).forEach(function (entry) {
            var subject = entry[0]; var data = entry[1];
            if (data.status !== 'needs_attention' && data.status !== 'steady') return;
            (async function () {
                try {
                    var res = await safeApiCall('/api/ai', { action: 'subjectHealthNudge', subject: subject, status: data.status, grade: ctx.grade, languageName: ctx.languageName });
                    var slot = row.querySelector('[data-nudge-for="' + subject.replace(/"/g, '&quot;') + '"]');
                    if (slot && res && res.nudge) slot.textContent = res.nudge;
                } catch (e) { /* nudge is best-effort; chip still shows computed status */ }
            })();
        });
    }

    (async function loadSubjectHealth() {
        if (!row) return;
        var subjectsForHealth = (ctx.subjects && ctx.subjects.length) ? ctx.subjects : [];
        if (!subjectsForHealth.length) {
            row.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:12px;text-align:center;width:100%;">No subjects yet: set grade/stream or join a class.</div>';
            return;
        }
        try {
            var uid = appState.user && appState.user.uid ? appState.user.uid : null;
            if (!uid) { row.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:12px;">Sign in to see health.</div>'; return; }
            var computeFn = (typeof computeSubjectHealth === 'function') ? computeSubjectHealth : null;
            if (!computeFn && typeof window.computeSubjectHealth === 'function') computeFn = window.computeSubjectHealth;
            if (!computeFn) {
                row.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:12px;">Health check unavailable.</div>';
                return;
            }
            var results = await computeFn(uid, subjectsForHealth);
            renderHealthRow(results);
        } catch (e) {
            row.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:12px;">Could not load health data.</div>';
        }
    })();

    container.querySelector('#weakness-back')?.addEventListener('click', function () {
        container.querySelector('#weakness-card').classList.add('hidden');
        container.querySelector('#health-card').scrollIntoView({ block: 'start' });
    });

    loadTrackProgress(container, ctx);
    initTrackCharts(container);
}

// Weakness Analyzer: deep dive for ONE subject, driven by the SAME data as
// the Health Check (context weakSubjects + real quiz/practice numbers).
// The AI only phrases what the numbers already show.
async function openWeaknessAnalyzer(container, ctx, subject, healthEntry, allHealth) {
    var card = container.querySelector('#weakness-card');
    var body = container.querySelector('#weakness-body');
    var title = container.querySelector('#weakness-title');
    if (!card || !body) return;
    card.classList.remove('hidden');
    title.textContent = 'Weakness Analyzer: ' + subject;
    body.innerHTML = '<div class="spinner" style="margin:12px auto;"></div><div style="font-size:12px;color:var(--text-dim);text-align:center;">Reading your real performance data…</div>';
    card.scrollIntoView({ block: 'start' });

    // Real numbers only: from shared context + module-owned practiceBits
    var quizzes = (ctx.quizHistory || []).filter(function (q) { return q.subject === subject; }).slice(0, 5);
    var quizScores = quizzes.map(function (q) {
        var s = Number(q.score), t = Number(q.totalQuestions);
        return (isNaN(s) || isNaN(t) || t <= 0) ? null : Math.round((s / t) * 100);
    }).filter(function (v) { return v !== null; });
    var daysSinceStudied = (healthEntry && healthEntry.daysSinceStudied !== undefined) ? healthEntry.daysSinceStudied : 999;
    var practiceBitAccuracy = null;
    try {
        var uid = appState.user && appState.user.uid ? appState.user.uid : null;
        var snap = await getDocs(query(collection(db, 'users', uid, 'practiceBits'), where('subject', '==', subject), orderBy('createdAt', 'desc'), limit(10)));
        var answered = [];
        snap.forEach(function (d) {
            var pb = d.data();
            if (pb.studentAnswer !== undefined) answered.push(pb.isCorrect === true ? 1 : 0);
        });
        if (answered.length) practiceBitAccuracy = Math.round((answered.reduce(function (a, b) { return a + b; }, 0) / answered.length) * 100);
    } catch (e) { /* empty or unordered fallback below */ }
    if (practiceBitAccuracy === null) {
        try {
            var snap2 = await getDocs(collection(db, 'users', uid, 'practiceBits'));
            var ans2 = [];
            snap2.forEach(function (d) {
                var pb = d.data();
                if (pb.subject === subject && pb.studentAnswer !== undefined) ans2.push(pb.isCorrect === true ? 1 : 0);
            });
            if (ans2.length) practiceBitAccuracy = Math.round((ans2.reduce(function (a, b) { return a + b; }, 0) / ans2.length) * 100);
        } catch (e2) {}
    }

    var isWeak = (ctx.weakSubjects || []).indexOf(subject) !== -1;
    var cfg = getHealthStatusConfig(healthEntry.status);
    var numbersHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">' +
        '<span class="badge ' + cfg.badge + '">' + cfg.icon + ' ' + shEsc(healthEntry.status === 'needs_attention' ? 'Needs attention' : 'Steady') + '</span>' +
        (isWeak ? '<span class="badge badge-red">⚠ in weak-subjects list</span>' : '') +
        '<span class="badge badge-gray">Quiz: ' + (quizScores.length ? quizScores.join('%, ') + '%' : 'no quizzes yet') + '</span>' +
        '<span class="badge badge-gray">Practice bits: ' + (practiceBitAccuracy !== null ? practiceBitAccuracy + '%' : 'no data yet') + '</span>' +
        '<span class="badge badge-gray">Last studied: ' + (daysSinceStudied === 999 ? 'over 2 weeks ago' : daysSinceStudied + 'd ago') + '</span>' +
        '</div>';

    if (!quizScores.length && practiceBitAccuracy === null) {
        body.innerHTML = numbersHTML + '<div style="font-size:13px;color:var(--text-dim);line-height:1.7;">Not enough real data for ' + shEsc(subject) + ' yet: attempt a quiz or practice bit first, then come back for your deep dive.</div>';
        return;
    }
    try {
        var res = await safeApiCall('/api/ai', {
            action: 'weaknessAnalysis',
            subject: subject,
            quizScores: quizScores,
            practiceBitAccuracy: practiceBitAccuracy === null ? 'no data yet' : practiceBitAccuracy,
            daysSinceStudied: daysSinceStudied === 999 ? '14+' : daysSinceStudied,
            grade: ctx.grade,
            languageName: ctx.languageName
        });
        body.innerHTML = numbersHTML +
            '<div style="font-size:14px;line-height:1.7;margin-bottom:12px;">' + shEsc(res.summary) + '</div>' +
            '<div style="background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.25);border-radius:12px;padding:12px 14px;">' +
            '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:4px;">ONE NEXT STEP</div>' +
            '<div style="font-size:14px;font-weight:600;">' + shEsc(res.suggestion) + '</div></div>';
    } catch (e) {
        body.innerHTML = numbersHTML + '<div style="font-size:13px;color:#FCA5A5;">Could not generate the summary: ' + shEsc(e.message || '') + '. Your numbers above are still accurate.</div>';
    }
}

// Merged Progress/Analytics: glance stats on top, historical charts below
async function loadTrackProgress(container, ctx) {
    var host = container.querySelector('#progress-glance');
    var statsHost = container.querySelector('#weekly-stats');
    var uid = appState.user && appState.user.uid ? appState.user.uid : null;
    var classIds = (appState.userData && Array.isArray(appState.userData.classIds)) ? appState.userData.classIds : [];
    var homeworkTotal = 0, homeworkDone = 0;
    var subjectStats = {};
    try {
        for (const cid of classIds) {
            const snap = await getDocs(collection(db, 'classes', cid, 'homework'));
            for (const d of snap.docs) {
                const hw = d.data();
                homeworkTotal++;
                const sub = await getDoc(doc(db, 'classes', cid, 'homework', d.id, 'submissions', uid));
                if (sub.exists) homeworkDone++;
                const subj = hw.subject || 'General';
                if (!subjectStats[subj]) subjectStats[subj] = { total: 0, done: 0 };
                subjectStats[subj].total++;
                if (sub.exists) subjectStats[subj].done++;
            }
        }
    } catch (e) {}
    var totalPct = homeworkTotal ? Math.round(homeworkDone / homeworkTotal * 100) : 0;
    // Focus time (localStorage source of truth) summarized over the last 7 days
    // so the glance stays functional even when there is no homework yet.
    var focusWeekMinutes = 0, focusWeekSessions = 0;
    try {
        var weekKeys = {};
        for (var wi = 6; wi >= 0; wi--) { var wdt = new Date(); wdt.setDate(wdt.getDate() - wi); weekKeys[shTodayStr(wdt)] = true; }
        var fh = (typeof getData === 'function' ? getData().focusHistory : []) || [];
        fh.forEach(function (h) {
            if (h && h.date && weekKeys[h.date]) { focusWeekMinutes += (Number(h.duration) || 0); focusWeekSessions++; }
        });
    } catch (e) {}
    if (host) {
        host.innerHTML = `
            <div class="grid-cols-2">
                <div style="text-align:center;">
                    <div style="position:relative;width:120px;height:120px;margin:8px auto;">
                        <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Homework completion ${totalPct} percent">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"/>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#7C5CFC" stroke-width="12" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 54}" stroke-dashoffset="${2 * Math.PI * 54 * (1 - totalPct / 100)}" transform="rotate(-90 60 60)"/>
                        </svg>
                        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                            <div style="font-size:24px;font-weight:800;">${totalPct}%</div>
                            <div style="font-size:11px;color:var(--text-dim);">${homeworkDone} of ${homeworkTotal} done</div>
                        </div>
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);">Homework Completion</div>
                </div>
                <div>
                    <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:8px;">Subject-wise Progress</div>
                    ${Object.keys(subjectStats).length ? Object.entries(subjectStats).map(function (entry) {
                        var subj = entry[0], s = entry[1];
                        var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
                        return `<div style="margin-bottom:10px;">
                            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>${shEsc(subj)}</span><span style="color:var(--text-dim);">${pct}% (${s.done}/${s.total})</span></div>
                            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7C5CFC,#4F8CFF);border-radius:6px;"></div></div>
                        </div>`;
                    }).join('') : `<div style="font-size:13px;color:var(--text-dim);">No homework yet.</div>`}
                </div>
            </div>
            <div style="margin-top:12px;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.2);border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div style="font-size:13px;font-weight:600;">🎯 Focus this week: ${focusWeekMinutes}m across ${focusWeekSessions} session${focusWeekSessions === 1 ? '' : 's'}</div>
                <div style="font-size:11px;color:var(--text-dim);">Includes Pomodoro time from Today: stays in sync automatically.</div>
            </div>`;
    }
    // Weekly stats: shared context's recent activity + local focus history.
    // Focus sessions previously never reached here (localStorage only), which
    // is why focus-only users always saw 0m.
    if (statsHost) {
        var byDay = {};
        for (var i = 6; i >= 0; i--) {
            var dt = new Date(); dt.setDate(dt.getDate() - i);
            byDay[shTodayStr(dt)] = 0;
        }
        (ctx.recentActivity || []).forEach(function (a) {
            var v = a.completedAt;
            var day = null;
            try {
                if (v && typeof v.toDate === 'function') day = shTodayStr(v.toDate());
                else if (v instanceof Date) day = shTodayStr(v);
                else if (v && typeof v.seconds === 'number') day = shTodayStr(new Date(v.seconds * 1000));
                else if (typeof v === 'string' && v.length >= 10) day = v.slice(0, 10);
            } catch (e) {}
            if (day && byDay[day] !== undefined) byDay[day] += (Number(a.durationMinutes) || 0);
        });
        // Merge local focus sessions with count-based dedupe: if N local
        // sessions of X minutes exist on a day and M mirrored focus docs of
        // the same duration are already in recentActivity, only the
        // (N - M) unsynced remainder is added. Existence-check (.some) would
        // undercount repeated identical sessions (e.g. two 25m Pomodoros).
        try {
            var localFocus = (typeof getData === 'function' ? getData().focusHistory : []) || [];
            var localCounts = {}, mirroredCounts = {};
            localFocus.forEach(function (h) {
                if (!h || !h.date || byDay[h.date] === undefined) return;
                var mins = Number(h.duration) || 0;
                if (!(mins > 0)) return;
                var k = h.date + '|' + mins;
                localCounts[k] = (localCounts[k] || 0) + 1;
            });
            (ctx.recentActivity || []).forEach(function (a) {
                if (!a || a.type !== 'focus') return;
                var mins = Number(a.durationMinutes) || 0;
                if (!(mins > 0)) return;
                var av = a.completedAt, aday = null;
                try {
                    if (av && typeof av.toDate === 'function') aday = shTodayStr(av.toDate());
                    else if (av instanceof Date) aday = shTodayStr(av);
                    else if (av && typeof av.seconds === 'number') aday = shTodayStr(new Date(av.seconds * 1000));
                    else if (typeof av === 'string' && av.length >= 10) aday = av.slice(0, 10);
                } catch (e) {}
                if (!aday || byDay[aday] === undefined) return;
                var k2 = aday + '|' + mins;
                mirroredCounts[k2] = (mirroredCounts[k2] || 0) + 1;
            });
            Object.keys(localCounts).forEach(function (k) {
                var parts = k.split('|');
                var day = parts[0], mins = Number(parts[1]) || 0;
                var unsynced = (localCounts[k] || 0) - (mirroredCounts[k] || 0);
                if (unsynced > 0 && byDay[day] !== undefined) byDay[day] += unsynced * mins;
            });
        } catch (e) {}
        var totalMin = Object.values(byDay).reduce(function (a, b) { return a + b; }, 0);
        var focusTotalMin = focusWeekMinutes, focusTotalSessions = focusWeekSessions;
        statsHost.innerHTML = '<div style="font-size:28px;font-weight:700;font-family:\'Sora\',sans-serif;color:#C4B5FD;">' + totalMin + 'm</div>' +
            '<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">Active minutes, last 7 days (includes ' + focusTotalMin + 'm focus across ' + focusTotalSessions + ' sessions)</div>' +
            '<div style="font-size:12px;color:var(--text-dim);">' + (ctx.quizHistory || []).length + ' recent quizzes · ' + (ctx.weakSubjects || []).length + ' weak subject(s)</div>';
    }
}

function initTrackCharts(container) {
    function initCharts() {
        if (typeof Chart === 'undefined') { setTimeout(initCharts, 500); return; }
        // Charts merge manual study logs with Pomodoro focus history.
        // studyLogs is never written in Stuvo (always []), so without this
        // merge focus-only users always saw empty charts.
        const d = getData();
        const logs = d.studyLogs || [];
        const focusHistory = d.focusHistory || [];
        var focusByDate = {};
        focusHistory.forEach(function (h) {
            if (!h || !h.date) return;
            var mins = Number(h.duration) || 0;
            if (!(mins > 0)) return;
            focusByDate[h.date] = (focusByDate[h.date] || 0) + mins;
        });
        var logHoursByDate = {};
        var logTotals = {};
        logs.forEach(function (l) {
            if (!l || !l.date) return;
            var hrs = Number(l.hours) || 0;
            if (!(hrs > 0)) return;
            logHoursByDate[l.date] = (logHoursByDate[l.date] || 0) + hrs;
            var subj = l.subject || 'General';
            logTotals[subj] = (logTotals[subj] || 0) + hrs;
        });
        var allDates = {};
        Object.keys(logHoursByDate).forEach(function (k) { allDates[k] = true; });
        Object.keys(focusByDate).forEach(function (k) { allDates[k] = true; });
        var sortedDates = Object.keys(allDates).sort();
        // Fall back to raw log order when neither source aggregates (legacy).
        var useUnion = sortedDates.length > 0;
        var labels, studyData, focusData;
        if (useUnion) {
            labels = sortedDates.map(function (ds) { var dt = new Date(ds + 'T12:00:00'); return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); });
            studyData = sortedDates.map(function (ds) { return Math.round((logHoursByDate[ds] || 0) * 100) / 100; });
            focusData = sortedDates.map(function (ds) { return Math.round(((focusByDate[ds] || 0) / 60) * 100) / 100; });
        } else {
            labels = logs.map(l => { const dt = new Date(l.date); return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); });
            studyData = logs.map(l => l.hours);
            focusData = logs.map(() => 0);
        }
        var hasFocus = focusData.some(function (v) { return v > 0; });
        const lineEl = container.querySelector('#line-chart');
        const pieEl = container.querySelector('#pie-chart');
        if (lineEl) {
            try { var prevLine = (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') ? Chart.getChart(lineEl) : null; if (prevLine) prevLine.destroy(); } catch (e) {}
            try { delete lineEl.dataset.done; } catch (e) {}
            var datasets = [{ label: 'Hours', data: studyData, borderColor: '#7C5CFC', backgroundColor: 'rgba(124,92,252,0.15)', fill: true, tension: 0.4 }];
            if (hasFocus) datasets.push({ label: 'Focus (h)', data: focusData, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.12)', fill: true, tension: 0.4 });
            new Chart(lineEl, { type: 'line', data: { labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: hasFocus } }, scales: { x: { ticks: { color: '#9AA3C4' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#9AA3C4' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
        }
        if (pieEl) {
            try { var prevPie = (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') ? Chart.getChart(pieEl) : null; if (prevPie) prevPie.destroy(); } catch (e) {}
            try { delete pieEl.dataset.done; } catch (e) {}
            const totals = Object.assign({}, logTotals);
            var focusTotalHours = Object.values(focusByDate).reduce(function (a, b) { return a + b; }, 0) / 60;
            focusTotalHours = Math.round(focusTotalHours * 100) / 100;
            if (focusTotalHours > 0) totals['Focus'] = Math.round(((totals['Focus'] || 0) + focusTotalHours) * 100) / 100;
            new Chart(pieEl, { type: 'pie', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: ['#7C5CFC', '#4F8CFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: '#9AA3C4', font: { size: 11 } } } } } });
        }
    }
    if (!document.getElementById('chartjs-script')) {
        const s = document.createElement('script');
        s.id = 'chartjs-script';
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        s.onload = initCharts;
        document.head.appendChild(s);
    } else { initCharts(); }
}

// Rebuild Track charts from current localStorage (called after focus saves
// and when returning to the Track tab). Safe to call repeatedly: existing
// Chart instances are destroyed first, so no leak or double-draw.
function refreshTrackCharts(container) {
    try {
        if (typeof Chart === 'undefined') return;
        var lineEl = container ? container.querySelector('#line-chart') : null;
        var pieEl = container ? container.querySelector('#pie-chart') : null;
        if (!lineEl && !pieEl) return;
        // Reuse the same merge logic by delegating to initTrackCharts, which
        // now destroys previous instances before recreating.
        initTrackCharts(container);
    } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
// PLAN — Exam Countdown + Schedule Generator + Profile
// ══════════════════════════════════════════════════════════════
function bindPlan(container, ctx) {
    let examSelectedSubjects = [];
    async function renderExamSubjectPills() {
        var host = container.querySelector('#exam-subject-pills');
        if (!host) return;
        var subs = (ctx.subjects && ctx.subjects.length) ? ctx.subjects : SUBJECT_OPTIONS.slice();
        host.innerHTML = subs.map(function (s) {
            var esc = shEsc(s);
            var active = examSelectedSubjects.indexOf(s) !== -1;
            return '<button type="button" class="badge ' + (active ? 'badge-violet' : 'badge-gray') + '" data-exam-subj="' + esc + '" style="cursor:pointer;padding:7px 12px;">' + esc + '</button>';
        }).join('');
        host.querySelectorAll('[data-exam-subj]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var s = btn.dataset.examSubj;
                if (examSelectedSubjects.indexOf(s) !== -1) examSelectedSubjects = examSelectedSubjects.filter(function (x) { return x !== s; });
                else examSelectedSubjects.push(s);
                renderExamSubjectPills();
            });
        });
    }
    renderExamSubjectPills();

    async function fetchHomeworkDeadlines(classIds, examDate) {
        var deadlines = [];
        var exam = examDate instanceof Date ? examDate : new Date(examDate);
        for (var i = 0; i < classIds.length; i++) {
            try {
                var snap = await getDocs(collection(db, 'classes', classIds[i], 'homework'));
                snap.forEach(function (d) {
                    var hw = d.data();
                    if (!hw.deadline) return;
                    var dl = hw.deadline.indexOf('T') !== -1 ? new Date(hw.deadline) : new Date(hw.deadline + 'T23:59:59');
                    if (isNaN(dl)) return;
                    if (dl <= exam && dl >= new Date()) deadlines.push(dl);
                });
            } catch (e) {}
        }
        return deadlines;
    }
    function daysUntil(examDate) {
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var e = examDate instanceof Date ? examDate : new Date(examDate);
        e.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((e - today) / (1000 * 60 * 60 * 24)));
    }
    async function loadExamCountdowns() {
        var listEl = container.querySelector('#exam-list-container');
        if (!listEl) return;
        var uid = appState.user && appState.user.uid ? appState.user.uid : null;
        if (!uid) { listEl.innerHTML = '<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:16px;">Sign in to track exams.</div>'; return; }
        listEl.innerHTML = '<div class="spinner" style="margin:16px auto;"></div>';
        try {
            var colRef = collection(db, 'users', uid, 'examCountdowns');
            var q = query(colRef, orderBy('examDate', 'asc'));
            var snap;
            try { snap = await getDocs(q); }
            catch (err) { snap = await getDocs(collection(db, 'users', uid, 'examCountdowns')); }
            var exams = [];
            snap.forEach(function (d) { var data = d.data(); exams.push({ id: d.id, ref: d.ref, data: data }); });
            exams.sort(function (a, b) {
                var da = a.data.examDate && a.data.examDate.toDate ? a.data.examDate.toDate() : new Date(a.data.examDate);
                var dbv = b.data.examDate && b.data.examDate.toDate ? b.data.examDate.toDate() : new Date(b.data.examDate);
                return da - dbv;
            });
            if (!exams.length) {
                listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px;">No exams yet: add one above. ✨<br><span style="font-size:11px;">You' + '\'ll see days to prepare and Today\'s focus, not pressure.</span></div>';
                return;
            }
            var todayStr = new Date().toISOString().split('T')[0];
            for (var ei = 0; ei < exams.length; ei++) {
                var ex = exams[ei];
                var plan = ex.data.dailyPlan || [];
                if (plan.length && typeof redistributeAfterMiss === 'function') {
                    var redistributed = redistributeAfterMiss(plan, todayStr);
                    var changed = JSON.stringify(redistributed) !== JSON.stringify(plan);
                    if (changed) {
                        try { await updateDoc(doc(db, 'users', uid, 'examCountdowns', ex.id), { dailyPlan: redistributed }); ex.data.dailyPlan = redistributed; }
                        catch (e) { try { await setDoc(doc(db, 'users', uid, 'examCountdowns', ex.id), { dailyPlan: redistributed }, { merge: true }); ex.data.dailyPlan = redistributed; } catch (_) {} }
                    }
                }
            }
            listEl.innerHTML = exams.map(function (ex) {
                var d = ex.data;
                var examDateObj = d.examDate && d.examDate.toDate ? d.examDate.toDate() : new Date(d.examDate);
                var remaining = daysUntil(examDateObj);
                var examNameEsc = shEsc(d.examName || 'Exam');
                var plan = d.dailyPlan || [];
                var todayPlan = plan.filter(function (p) { return p.date === todayStr; });
                var todaySubjects = todayPlan.map(function (p) { var base = [p.subject]; if (p.extraSubjects) base = base.concat(p.extraSubjects); return base; }).flat();
                var todayLabel = todaySubjects.length ? todaySubjects.join(', ') : (plan.length ? 'All caught for today: check upcoming days' : 'No plan yet');
                return '<div class="glass-card" style="margin-bottom:12px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
                    '<div><div style="font-family:\'Sora\',sans-serif;font-weight:800;font-size:16px;">' + examNameEsc + '</div><div style="font-size:12px;color:var(--text-dim);margin-top:2px;">' + examDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + (d.subjects || []).map(shEsc).join(', ') + '</div></div>' +
                    '<div style="text-align:right;"><div style="font-family:\'Sora\',sans-serif;font-weight:800;font-size:28px;color:#C4B5FD;line-height:1;">' + remaining + '</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px;">days to prepare</div></div>' +
                    '</div>' +
                    '<div style="margin-top:14px;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.2);border-radius:12px;padding:12px;">' +
                    '<div style="font-size:12px;color:var(--text-dim);font-weight:600;">Today\'s focus</div>' +
                    '<div style="font-size:15px;font-weight:700;margin-top:4px;color:' + (todaySubjects.length ? '#C4B5FD' : 'var(--text-dim)') + ';">' + shEsc(todayLabel) + '</div>' +
                    (todaySubjects.length ? '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Tap a subject below to generate revision for that day.</div>' : '') +
                    '</div>' +
                    '<div style="margin-top:14px;">' +
                    '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Daily plan</div>' +
                    '<div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;padding-right:4px;">' +
                    plan.map(function (day, idx) {
                        var isPast = day.date < todayStr;
                        var isToday = day.date === todayStr;
                        var subjectsLine = day.subject + (day.extraSubjects && day.extraSubjects.length ? ' + ' + day.extraSubjects.join(', ') : '');
                        var dateObj = new Date(day.date + 'T12:00:00');
                        var dateLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                        return '<div style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:' + (isToday ? 'rgba(124,92,252,0.12)' : isPast && !day.completed ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)') + ';border:1px solid ' + (isToday ? 'rgba(124,92,252,0.3)' : isPast && !day.completed ? 'rgba(239,68,68,0.2)' : 'var(--glass-border)') + ';">'
                            + '<input type="checkbox" data-exam-id="' + ex.id + '" data-day-index="' + idx + '" ' + (day.completed ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#7C5CFC;cursor:pointer;" aria-label="Mark ' + shEsc(day.date) + ' complete">'
                            + '<div style="flex:1;min-width:0;">'
                            + '<div style="font-size:13px;font-weight:600;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
                            + '<span style="background:var(--glass);border:1px solid var(--glass-border);padding:2px 8px;border-radius:20px;font-size:11px;">' + dateLabel + '</span>'
                            + '<span style="font-size:13px;color:' + (isPast && !day.completed ? '#FCA5A5' : 'var(--text)') + ';cursor:pointer;text-decoration:underline dotted;" data-exam-day-subject="' + shEsc(day.subject).replace(/"/g, '&quot;') + '" data-exam-id-tap="' + ex.id + '" data-day-date="' + day.date + '">' + shEsc(subjectsLine) + '</span>'
                            + '</div>'
                            + (isPast && !day.completed ? '<div style="font-size:11px;color:#FCA5A5;margin-top:2px;">Missed: will be redistributed forward</div>' : '') +
                            (day.topic ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">Topic: ' + shEsc(day.topic) + '</div>' : '') +
                            '</div>'
                            + '<span style="font-size:11px;color:var(--text-dim);">' + day.date + '</span>'
                            + '</div>';
                    }).join('') +
                    '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
                    '<button class="btn btn-secondary btn-sm" data-exam-delete="' + ex.id + '" style="margin-top:0;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#FCA5A5;">Delete exam</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            listEl.querySelectorAll('input[type="checkbox"][data-exam-id]').forEach(function (cb) {
                cb.addEventListener('change', async function () {
                    var examId = cb.dataset.examId;
                    var idx = parseInt(cb.dataset.dayIndex);
                    var ex = exams.find(function (e) { return e.id === examId; });
                    if (!ex) return;
                    var plan = ex.data.dailyPlan || [];
                    if (plan[idx]) {
                        plan[idx].completed = cb.checked;
                        cb.disabled = true;
                        try { await updateDoc(doc(db, 'users', uid, 'examCountdowns', examId), { dailyPlan: plan }); }
                        catch (e) { try { await setDoc(doc(db, 'users', uid, 'examCountdowns', examId), { dailyPlan: plan }, { merge: true }); } catch (_) {} }
                        cb.disabled = false;
                        if (cb.checked) showToast('Marked completed ✓', 'success');
                    }
                });
            });
            listEl.querySelectorAll('[data-exam-delete]').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    var eid = btn.dataset.examDelete;
                    if (!confirm('Delete this exam plan?')) return;
                    btn.disabled = true; btn.textContent = 'Deleting…';
                    try { await deleteDoc(doc(db, 'users', uid, 'examCountdowns', eid)); showToast('Exam deleted', 'success'); loadExamCountdowns(); }
                    catch (e) { showToast('Failed to delete', 'error'); btn.disabled = false; btn.textContent = 'Delete exam'; }
                });
            });
            listEl.querySelectorAll('[data-exam-day-subject]').forEach(function (el) {
                el.addEventListener('click', async function () {
                    var subj = el.dataset.examDaySubject;
                    var examId = el.dataset.examIdTap;
                    var dayDate = el.dataset.dayDate;
                    var out = container.querySelector('#exam-day-revision-output');
                    if (!out) return;
                    out.innerHTML = '<div class="glass-card" style="padding:14px;"><div class="spinner" style="width:22px;height:22px;border-width:2px;margin:8px auto;"></div><div style="font-size:12px;color:var(--text-dim);text-align:center;">Generating revision for ' + shEsc(subj) + '…</div></div>';
                    out.scrollIntoView({ block: 'center' });
                    try {
                        var topic = null;
                        var ex = exams.find(function (e) { return e.id === examId; });
                        if (ex && ex.data.dailyPlan) {
                            var dp = ex.data.dailyPlan.find(function (p) { return p.date === dayDate; });
                            if (dp && dp.topic) topic = dp.topic;
                        }
                        var chapter = topic || subj;
                        var data = await safeApiCall('/api/ai', { action: 'generateRevision', subject: subj, chapter: chapter, grade: ctx.grade, languageName: ctx.languageName });
                        var checklist = Array.isArray(data.checklist) ? data.checklist : [];
                        out.innerHTML = '<div class="glass-card" style="margin-top:4px;">'
                            + '<div style="font-weight:700;font-size:14px;margin-bottom:8px;">Revision: ' + shEsc(chapter) + ' (' + shEsc(subj) + ')</div>'
                            + '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:6px;">KEY CONCEPTS</div><ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px;">' + (data.keyConcepts || []).map(function (c) { return '<li style="font-size:14px;line-height:1.6;">' + shEsc(c) + '</li>'; }).join('') + '</ul>'
                            + (data.formulas && data.formulas.length ? '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:12px 0 6px;">FORMULAS</div><div style="display:flex;flex-wrap:wrap;gap:8px;">' + data.formulas.map(function (f) { return '<span style="font-family:monospace;background:rgba(124,92,252,0.15);border:1px solid rgba(124,92,252,0.3);border-radius:8px;padding:6px 10px;font-size:12px;color:#C4B5FD;">' + shEsc(f) + '</span>'; }).join('') + '</div>' : '')
                            + '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:12px 0 6px;">QUICK NOTES</div><div style="font-size:13px;line-height:1.6;color:var(--text-dim);">' + shFmt(data.quickNotes || '') + '</div>'
                            + '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:12px 0 6px;">PRACTICE QUESTIONS</div><div style="display:flex;flex-direction:column;gap:8px;">' + (data.practiceQuestions || []).map(function (pq, i) { return '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;"><div style="font-size:13px;font-weight:500;">' + (i + 1) + '. ' + shEsc(pq.question) + '</div><div style="font-size:12px;color:#6EE7B7;margin-top:4px;">Answer: ' + shEsc(pq.answer) + '</div></div>'; }).join('') + '</div>'
                            + (checklist.length ? '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:12px 0 6px;">REVISION CHECKLIST</div><div style="display:flex;flex-direction:column;gap:8px;">' + checklist.map(function (item) { return '<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;cursor:pointer;"><input type="checkbox" style="width:17px;height:17px;accent-color:#7C5CFC;margin-top:1px;flex-shrink:0;"><span>' + shEsc(item) + '</span></label>'; }).join('') + '</div>' : '')
                            + '<button class="btn btn-secondary btn-sm" id="exam-rev-close" style="margin-top:12px;">Close revision</button>'
                            + '</div>';
                        out.querySelector('#exam-rev-close')?.addEventListener('click', function () { out.innerHTML = ''; });
                        try { if (typeof createTTSButtonForText === 'function') { var btn = createTTSButtonForText(function () { return out.textContent || ''; }); btn.style.marginTop = '10px'; out.querySelector('.glass-card').appendChild(btn); } } catch (e) {}
                        try { await addDoc(collection(db, 'users', uid, 'studyActivity'), { type: 'revision', subject: subj, durationMinutes: 15, relatedHomeworkId: null, relatedClassId: null, completedAt: serverTimestamp() }); } catch (e) {}
                    } catch (e) { out.innerHTML = '<div class="glass-card" style="padding:14px;"><div style="font-size:13px;color:#FCA5A5;">Could not generate revision: ' + shEsc(e.message || '') + '</div><button class="btn btn-secondary btn-sm" id="exam-rev-close2" style="margin-top:10px;">Close</button></div>'; out.querySelector('#exam-rev-close2')?.addEventListener('click', function () { out.innerHTML = ''; }); }
                });
            });
        } catch (e) {
            listEl.innerHTML = '<div style="font-size:13px;color:#FCA5A5;padding:12px;">Failed to load exams: ' + shEsc(e.message || '') + '</div>';
        }
    }
    setTimeout(function () { loadExamCountdowns(); }, 300);

    (function bindExamCreate() {
        var btn = container.querySelector('#exam-create-btn');
        if (!btn) return;
        btn.addEventListener('click', async function () {
            var nameInput = container.querySelector('#exam-name-input');
            var dateInput = container.querySelector('#exam-date-input');
            var statusEl = container.querySelector('#exam-create-status');
            var examName = nameInput ? nameInput.value.trim() : '';
            var examDateStr = dateInput ? dateInput.value : '';
            if (!examName) { showToast('Enter exam name.', 'error'); return; }
            if (!examDateStr) { showToast('Select exam date.', 'error'); return; }
            if (!examSelectedSubjects.length) { showToast('Select at least one subject for the exam.', 'error'); return; }
            var examDate = new Date(examDateStr + 'T12:00:00');
            if (isNaN(examDate) || examDate < new Date(new Date().setHours(0, 0, 0, 0))) { showToast('Exam date must be today or later.', 'error'); return; }
            btn.disabled = true; btn.textContent = 'Creating…';
            if (statusEl) statusEl.textContent = 'Building your plan… deterministic, no AI needed for schedule.';
            try {
                var uid = appState.user && appState.user.uid ? appState.user.uid : null;
                if (!uid) throw new Error('Not signed in');
                var classIds = appState.userData && Array.isArray(appState.userData.classIds) ? appState.userData.classIds : [];
                var deadlines = await fetchHomeworkDeadlines(classIds, examDate);
                var schedule = generateExamSchedule(examDate, examSelectedSubjects, deadlines);
                await addDoc(collection(db, 'users', uid, 'examCountdowns'), {
                    examName: examName,
                    examDate: Timestamp.fromDate ? Timestamp.fromDate(examDate) : examDate,
                    subjects: examSelectedSubjects.slice(),
                    createdAt: serverTimestamp(),
                    dailyPlan: schedule
                });
                showToast('Exam plan created: ' + schedule.length + ' days to prepare ✓', 'success');
                if (nameInput) nameInput.value = '';
                if (dateInput) dateInput.value = '';
                examSelectedSubjects = [];
                await renderExamSubjectPills();
                if (statusEl) statusEl.textContent = '✓ Created: ' + schedule.length + ' study days planned.';
                loadExamCountdowns();
            } catch (e) {
                showToast('Failed to create exam: ' + (e.message || ''), 'error');
                if (statusEl) statusEl.textContent = 'Failed: ' + (e.message || '');
            } finally {
                btn.disabled = false; btn.textContent = 'Add Exam Plan';
            }
        });
    })();

    // ── Schedule Generator (deterministic plan + AI narrative only) ──
    var schedSelected = (ctx.weakSubjects && ctx.weakSubjects.length) ? ctx.weakSubjects.slice(0, 3) : (ctx.subjects || []).slice(0, 3);
    var schedPlan = null;
    function renderSchedPills() {
        var host = container.querySelector('#sched-subject-pills');
        if (!host) return;
        var subs = (ctx.subjects && ctx.subjects.length) ? ctx.subjects : SUBJECT_OPTIONS.slice();
        host.innerHTML = subs.map(function (s) {
            var esc = shEsc(s);
            var active = schedSelected.indexOf(s) !== -1;
            var isWeak = (ctx.weakSubjects || []).indexOf(s) !== -1;
            return '<button type="button" class="badge ' + (active ? 'badge-violet' : 'badge-gray') + '" data-sched-subj="' + esc + '" style="cursor:pointer;padding:7px 12px;">' + esc + (isWeak ? ' ⚠' : '') + '</button>';
        }).join('');
        host.querySelectorAll('[data-sched-subj]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var s = btn.dataset.schedSubj;
                if (schedSelected.indexOf(s) !== -1) schedSelected = schedSelected.filter(function (x) { return x !== s; });
                else schedSelected.push(s);
                renderSchedPills();
            });
        });
    }
    renderSchedPills();
    container.querySelector('#sched-mins')?.addEventListener('input', function (e) {
        container.querySelector('#sched-mins-val').textContent = e.target.value;
    });
    container.querySelector('#sched-generate-btn')?.addEventListener('click', function () {
        if (!schedSelected.length) { showToast('Select at least one subject.', 'error'); return; }
        var mins = parseInt(container.querySelector('#sched-mins').value) || 60;
        schedPlan = generateWeeklyStudyPlan(schedSelected, ctx.weakSubjects, mins);
        var out = container.querySelector('#sched-output');
        out.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + schedPlan.map(function (day) {
            return '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:10px 12px;">' +
                '<div style="font-size:12px;font-weight:700;color:#C4B5FD;margin-bottom:6px;">' + day.day + '</div>' +
                day.blocks.map(function (b) {
                    return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span>' + shEsc(b.subject) + (b.focus === 'catch-up' ? ' <span style="font-size:10px;color:#FCA5A5;">catch-up</span>' : '') + '</span><span style="color:var(--text-dim);">' + b.minutes + ' min</span></div>';
                }).join('') + '</div>';
        }).join('') + '</div>';
        container.querySelector('#sched-narrate-btn').disabled = false;
        container.querySelector('#sched-narrative').innerHTML = '';
        try {
            if (typeof createTTSButtonForText === 'undefined') return;
        } catch (e) {}
    });
    container.querySelector('#sched-narrate-btn')?.addEventListener('click', async function () {
        if (!schedPlan) return;
        var btn = container.querySelector('#sched-narrate-btn');
        var host = container.querySelector('#sched-narrative');
        btn.disabled = true; btn.textContent = 'Writing…';
        host.innerHTML = '<div class="spinner" style="width:22px;height:22px;border-width:2px;margin:8px auto;"></div>';
        try {
            var res = await safeApiCall('/api/ai', { action: 'scheduleNarrative', weeklyPlan: schedPlan, grade: ctx.grade, languageName: ctx.languageName });
            host.innerHTML = '<div style="background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.25);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.7;">' + shEsc(res.narrative) + '</div>';
        } catch (e) {
            host.innerHTML = '';
            showToast(e.message || 'Could not write summary', 'error');
        } finally { btn.disabled = false; btn.textContent = '✨ Explain My Week'; }
    });

    // ── Profile (from shared context: no independent query) ──
    var profileBody = container.querySelector('#profile-body');
    if (profileBody) {
        profileBody.innerHTML = `
            <div class="grid-cols-2">
                <div>
                    <div style="font-size:12px;color:var(--text-dim);font-weight:600;">Grade</div>
                    <div style="font-size:16px;font-weight:700;">${shEsc(ctx.grade || 'Not set')}${ctx.stream ? ' · ' + shEsc(ctx.stream) : ''}</div>
                </div>
                <div>
                    <div style="font-size:12px;color:var(--text-dim);font-weight:600;">Day streak</div>
                    <div style="font-size:16px;font-weight:700;">🔥 ${ctx.currentStreak || 0}</div>
                </div>
            </div>
            <div style="font-size:12px;color:var(--text-dim);font-weight:600;margin:12px 0 6px;">My subjects (${(ctx.subjects || []).length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">${(ctx.subjects || []).map(function (s) {
                var weak = (ctx.weakSubjects || []).indexOf(s) !== -1;
                return '<span class="badge ' + (weak ? 'badge-red' : 'badge-gray') + '">' + shEsc(s) + (weak ? ' ⚠' : '') + '</span>';
            }).join('') || '<span style="font-size:13px;color:var(--text-dim);">No subjects yet.</span>'}</div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:12px;">${(ctx.recentActivity || []).length} recent activities · ${(ctx.quizHistory || []).length} recent quizzes · ${(ctx.upcomingDeadlines || []).length} upcoming deadlines</div>
            <button class="btn btn-secondary btn-sm" id="profile-edit-grade" style="margin-top:12px;">Edit grade & stream</button>`;
        profileBody.querySelector('#profile-edit-grade')?.addEventListener('click', function () {
            window.location.hash = '#/student/accessibility';
        });
    }

    // ── Self-Study Zone (private personal layer: never teacher-visible) ──
    bindSelfStudy(container, ctx);
}

// ══════════════════════════════════════════════════════════════
// SELF-STUDY ZONE: My Schedule + My Tasks (student-private)
// All reads/writes scoped to users/{uid}/personalTimetable|personalTasks.
// No teacher/admin screen queries these collections (privacy by absence,
// enforced by Firestore rules: owner-uid match only, no exceptions).
// ══════════════════════════════════════════════════════════════
function bindSelfStudy(container, ctx) {
    if (!container.querySelector('#self-schedule-card') || !container.querySelector('#self-tasks-card')) return;
    var SELF_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var subjects = (ctx && ctx.subjects && ctx.subjects.length) ? ctx.subjects : SUBJECT_OPTIONS.slice();

    function selfUid() {
        return (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
    }
    function toDateSafe(v) {
        try {
            if (!v) return null;
            if (v.toDate) return v.toDate();
            var d = new Date(v);
            return isNaN(d) ? null : d;
        } catch (e) { return null; }
    }
    function fmtDue(v) {
        var d = toDateSafe(v);
        if (!d) return '';
        try {
            var loc = (typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN');
            return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return d.toISOString().split('T')[0]; }
    }

    // ── Shared subject selects ──
    var slotSubjectSel = container.querySelector('#self-slot-subject');
    if (slotSubjectSel) slotSubjectSel.innerHTML = '<option value="">Select</option>' + subjects.map(function (s) {
        return '<option value="' + shEsc(s) + '">' + shEsc(s) + '</option>';
    }).join('');
    var taskSubjectSel = container.querySelector('#self-task-subject');
    if (taskSubjectSel) taskSubjectSel.innerHTML = '<option value="">Select</option>' + subjects.map(function (s) {
        return '<option value="' + shEsc(s) + '">' + shEsc(s) + '</option>';
    }).join('');
    var daySel = container.querySelector('#self-slot-day');
    if (daySel) daySel.innerHTML = SELF_DAYS.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');

    // ═══ My Schedule ═══
    var editingSlotId = null;
    var lastSlots = [];

    function slotForm(show) {
        var f = container.querySelector('#self-schedule-form');
        var addBtn = container.querySelector('#self-slot-add');
        if (!f) return;
        if (show) {
            f.classList.remove('hidden');
            if (addBtn) addBtn.classList.add('hidden');
        } else {
            f.classList.add('hidden');
            if (addBtn) addBtn.classList.remove('hidden');
        }
    }
    function resetSlotForm() {
        editingSlotId = null;
        var formTitle = container.querySelector('#self-slot-form-title');
        if (formTitle) formTitle.textContent = _i18n_t('studyHub.selfStudy.addBlock', 'Add study block');
        if (daySel) daySel.value = SELF_DAYS[0];
        var st = container.querySelector('#self-slot-start'); if (st) st.value = '09:00';
        var en = container.querySelector('#self-slot-end'); if (en) en.value = '09:45';
        var lb = container.querySelector('#self-slot-label'); if (lb) lb.value = '';
        if (slotSubjectSel) slotSubjectSel.value = '';
    }

    async function loadSchedule() {
        var host = container.querySelector('#self-schedule-list');
        if (!host) return;
        var id = selfUid();
        if (!id) { host.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:12px;">Sign in to see your schedule.</div>'; return; }
        host.innerHTML = '<div class="spinner" style="margin:16px auto;"></div>';
        try {
            var snap = await getDocs(collection(db, 'users', id, 'personalTimetable'));
            var slots = [];
            snap.forEach(function (d) { slots.push(Object.assign({ id: d.id }, d.data())); });
            lastSlots = slots;
            renderSchedule(slots);
        } catch (e) {
            host.innerHTML = '<div style="font-size:13px;color:#FCA5A5;padding:12px;">' + shEsc((e && e.message) || '') + '</div>';
        }
    }

    function renderSchedule(slots) {
        var host = container.querySelector('#self-schedule-list');
        if (!host) return;
        if (!slots.length) {
            host.innerHTML = '<div class="empty-state"><div class="empty-icon">🗓</div>' +
                '<div class="empty-title">' + shEsc(_i18n_t('studyHub.selfStudy.emptySchedule', 'Your personal schedule is empty. Add a study block to get started.')) + '</div></div>';
            return;
        }
        var todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        var byDay = {};
        SELF_DAYS.forEach(function (d) { byDay[d] = []; });
        slots.forEach(function (s) {
            if (byDay[s.day]) byDay[s.day].push(s);
            else byDay[s.day] = [s];
        });
        Object.keys(byDay).forEach(function (k) {
            byDay[k].sort(function (a, b) { return String(a.startTime || '').localeCompare(String(b.startTime || '')); });
        });
        host.innerHTML = SELF_DAYS.filter(function (d) { return (byDay[d] || []).length; }).map(function (day) {
            var isToday = day === todayName;
            return '<div style="margin-bottom:12px;">' +
                '<div style="font-size:12px;font-weight:700;color:' + (isToday ? '#C4B5FD' : 'var(--text-dim)') + ';margin-bottom:6px;">' +
                shEsc(day) + (isToday ? ' · ' + shEsc(_i18n_t('timetable.today', 'Today')) : '') + '</div>' +
                byDay[day].map(function (s) {
                    return '<div class="hw-item"><div style="flex:1;min-width:0;">' +
                        '<div class="hw-title">' + shEsc(s.label || s.subject || '') + '</div>' +
                        '<div class="hw-sub">' + shEsc(s.startTime || '') + '–' + shEsc(s.endTime || '') + (s.subject ? ' · ' + shEsc(s.subject) : '') + '</div>' +
                        '</div><div style="display:flex;gap:6px;flex-shrink:0;">' +
                        '<button type="button" class="btn btn-secondary btn-sm" data-slot-edit="' + s.id + '" style="margin-top:0;">' + shEsc(_i18n_t('studyHub.selfStudy.edit', 'Edit')) + '</button>' +
                        '<button type="button" class="btn btn-secondary btn-sm" data-slot-del="' + s.id + '" style="margin-top:0;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#FCA5A5;" aria-label="' + shEsc(_i18n_t('studyHub.selfStudy.delete', 'Delete')) + ' ' + shEsc(s.label || '') + '">' + shEsc(_i18n_t('studyHub.selfStudy.delete', 'Delete')) + '</button>' +
                        '</div></div>';
                }).join('') + '</div>';
        }).join('');
        host.querySelectorAll('[data-slot-edit]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sid = btn.dataset.slotEdit;
                var s = lastSlots.find(function (x) { return x.id === sid; });
                if (!s) return;
                editingSlotId = sid;
                var formTitle = container.querySelector('#self-slot-form-title');
                if (formTitle) formTitle.textContent = _i18n_t('studyHub.selfStudy.editBlock', 'Edit study block');
                if (daySel) daySel.value = s.day || SELF_DAYS[0];
                var st = container.querySelector('#self-slot-start'); if (st) st.value = s.startTime || '09:00';
                var en = container.querySelector('#self-slot-end'); if (en) en.value = s.endTime || '09:45';
                var lb = container.querySelector('#self-slot-label'); if (lb) lb.value = s.label || '';
                if (slotSubjectSel) slotSubjectSel.value = s.subject || '';
                slotForm(true);
                var form = container.querySelector('#self-schedule-form');
                if (form && form.scrollIntoView) form.scrollIntoView({ block: 'nearest' });
            });
        });
        host.querySelectorAll('[data-slot-del]').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var sid = btn.dataset.slotDel;
                if (!confirm(_i18n_t('studyHub.selfStudy.confirmDelete', 'Delete this item?'))) return;
                btn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'users', selfUid(), 'personalTimetable', sid));
                    showToast(_i18n_t('studyHub.selfStudy.delete', 'Delete') + ' ✓', 'success');
                    loadSchedule();
                } catch (e) {
                    showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
                    btn.disabled = false;
                }
            });
        });
    }

    container.querySelector('#self-slot-add')?.addEventListener('click', function () {
        resetSlotForm();
        slotForm(true);
    });
    container.querySelector('#self-slot-cancel')?.addEventListener('click', function () {
        resetSlotForm();
        slotForm(false);
    });
    container.querySelector('#self-slot-save')?.addEventListener('click', async function () {
        var id = selfUid();
        if (!id) return;
        var day = daySel ? daySel.value : SELF_DAYS[0];
        var startEl = container.querySelector('#self-slot-start');
        var endEl = container.querySelector('#self-slot-end');
        var labelEl = container.querySelector('#self-slot-label');
        var start = startEl ? startEl.value : '';
        var end = endEl ? endEl.value : '';
        var label = labelEl ? labelEl.value.trim().slice(0, 80) : '';
        var subject = slotSubjectSel && slotSubjectSel.value ? slotSubjectSel.value : null;
        if (!label) { showToast(_i18n_t('studyHub.selfStudy.titleRequired', 'Please enter a title.'), 'error'); return; }
        if (!start || !end || start >= end) { showToast(_i18n_t('studyHub.selfStudy.invalidTime', 'End time must be after start time.'), 'error'); return; }
        var btn = container.querySelector('#self-slot-save');
        btn.disabled = true;
        try {
            if (editingSlotId) {
                await updateDoc(doc(db, 'users', id, 'personalTimetable', editingSlotId), { day: day, startTime: start, endTime: end, label: label, subject: subject });
            } else {
                await addDoc(collection(db, 'users', id, 'personalTimetable'), { day: day, startTime: start, endTime: end, label: label, subject: subject, createdAt: serverTimestamp() });
            }
            resetSlotForm();
            slotForm(false);
            showToast(_i18n_t('studyHub.selfStudy.save', 'Save') + ' ✓', 'success');
            loadSchedule();
        } catch (e) {
            showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
        } finally {
            btn.disabled = false;
        }
    });

    // ═══ My Tasks ═══
    function taskRow(t) {
        var due = fmtDue(t.dueDate);
        return '<div class="hw-item"><input type="checkbox" data-task-toggle="' + t.id + '"' + (t.completed ? ' checked' : '') +
            ' style="width:18px;height:18px;accent-color:#10B981;cursor:pointer;flex-shrink:0;"' +
            ' aria-label="' + shEsc(_i18n_t(t.completed ? 'studyHub.selfStudy.markIncomplete' : 'studyHub.selfStudy.markComplete', t.completed ? 'Mark not complete' : 'Mark complete')) + ' ' + shEsc(t.title || '') + '">' +
            '<div style="flex:1;min-width:0;"><div class="hw-title"' + (t.completed ? ' style="text-decoration:line-through;opacity:0.7;"' : '') + '>' + shEsc(t.title || '') + '</div>' +
            '<div class="hw-sub">' + (t.subject ? shEsc(t.subject) + ' · ' : '') + shEsc(due) + '</div></div>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-task-del="' + t.id + '" style="margin-top:0;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#FCA5A5;flex-shrink:0;" aria-label="' + shEsc(_i18n_t('studyHub.selfStudy.delete', 'Delete')) + ' ' + shEsc(t.title || '') + '">' + shEsc(_i18n_t('studyHub.selfStudy.delete', 'Delete')) + '</button></div>';
    }

    async function loadTasks() {
        var openHost = container.querySelector('#self-tasks-open');
        if (!openHost) return;
        var id = selfUid();
        if (!id) { openHost.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:12px;">Sign in to see your tasks.</div>'; return; }
        openHost.innerHTML = '<div class="spinner" style="margin:12px auto;"></div>';
        try {
            var snap = await getDocs(collection(db, 'users', id, 'personalTasks'));
            var tasks = [];
            snap.forEach(function (d) { tasks.push(Object.assign({ id: d.id }, d.data())); });
            renderTasks(tasks);
        } catch (e) {
            openHost.innerHTML = '<div style="font-size:13px;color:#FCA5A5;padding:12px;">' + shEsc((e && e.message) || '') + '</div>';
        }
    }

    function renderTasks(tasks) {
        var openHost = container.querySelector('#self-tasks-open');
        var doneHost = container.querySelector('#self-tasks-done');
        var doneCount = container.querySelector('#self-tasks-done-count');
        if (!openHost || !doneHost) return;
        var open = tasks.filter(function (t) { return !t.completed; });
        var done = tasks.filter(function (t) { return t.completed; });
        open.sort(function (a, b) {
            var da = toDateSafe(a.dueDate), db = toDateSafe(b.dueDate);
            var ma = da ? da.getTime() : Infinity, mb = db ? db.getTime() : Infinity;
            if (ma !== mb) return ma - mb;
            return String(a.title || '').localeCompare(String(b.title || ''));
        });
        done.sort(function (a, b) {
            var ca = toDateSafe(a.completedAt), cb = toDateSafe(b.completedAt);
            return (cb ? cb.getTime() : 0) - (ca ? ca.getTime() : 0);
        });
        openHost.innerHTML = open.length ? open.map(taskRow).join('') :
            '<div class="empty-state"><div class="empty-icon">✅</div>' +
            '<div class="empty-title">' + shEsc(_i18n_t('studyHub.selfStudy.emptyTasks', 'No personal tasks yet. Add something you want to work on.')) + '</div></div>';
        doneHost.innerHTML = done.length ? done.map(taskRow).join('') :
            '<div style="font-size:12px;color:var(--text-dim);padding:6px 0;">None yet</div>';
        if (doneCount) doneCount.textContent = done.length ? String(done.length) : '';
        container.querySelectorAll('[data-task-toggle]').forEach(function (cb) {
            cb.addEventListener('change', async function () {
                var tid = cb.dataset.taskToggle;
                cb.disabled = true;
                try {
                    await updateDoc(doc(db, 'users', selfUid(), 'personalTasks', tid), { completed: cb.checked, completedAt: cb.checked ? serverTimestamp() : null });
                    loadTasks();
                } catch (e) {
                    showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
                    cb.disabled = false;
                }
            });
        });
        container.querySelectorAll('[data-task-del]').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var tid = btn.dataset.taskDel;
                if (!confirm(_i18n_t('studyHub.selfStudy.confirmDelete', 'Delete this item?'))) return;
                btn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'users', selfUid(), 'personalTasks', tid));
                    showToast(_i18n_t('studyHub.selfStudy.delete', 'Delete') + ' ✓', 'success');
                    loadTasks();
                } catch (e) {
                    showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
                    btn.disabled = false;
                }
            });
        });
    }

    container.querySelector('#self-task-add')?.addEventListener('click', async function () {
        var id = selfUid();
        if (!id) return;
        var titleEl = container.querySelector('#self-task-title');
        var title = titleEl ? titleEl.value.trim().slice(0, 120) : '';
        if (!title) { showToast(_i18n_t('studyHub.selfStudy.titleRequired', 'Please enter a title.'), 'error'); return; }
        var subject = taskSubjectSel && taskSubjectSel.value ? taskSubjectSel.value : null;
        var dueEl = container.querySelector('#self-task-due');
        var dueStr = dueEl ? dueEl.value : '';
        var dueDate = null;
        if (dueStr) {
            var dd = new Date(dueStr + 'T12:00:00');
            if (!isNaN(dd)) dueDate = (typeof Timestamp !== 'undefined' && Timestamp.fromDate) ? Timestamp.fromDate(dd) : dd;
        }
        var btn = container.querySelector('#self-task-add');
        btn.disabled = true;
        try {
            await addDoc(collection(db, 'users', id, 'personalTasks'), { title: title, subject: subject, dueDate: dueDate, completed: false, createdAt: serverTimestamp(), completedAt: null });
            if (titleEl) titleEl.value = '';
            if (dueEl) dueEl.value = '';
            if (taskSubjectSel) taskSubjectSel.value = '';
            showToast(_i18n_t('studyHub.selfStudy.save', 'Save') + ' ✓', 'success');
            loadTasks();
        } catch (e) {
            showToast((e && e.message) || _i18n_t('common.error', 'Something went wrong'), 'error');
        } finally {
            btn.disabled = false;
        }
    });

    var doneToggle = container.querySelector('#self-tasks-done-toggle');
    if (doneToggle) {
        var flipDone = function () {
            var dh = container.querySelector('#self-tasks-done');
            if (!dh) return;
            dh.style.display = dh.style.display === 'none' ? 'block' : 'none';
        };
        doneToggle.addEventListener('click', flipDone);
        doneToggle.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipDone(); }
        });
    }

    loadSchedule();
    loadTasks();
}
