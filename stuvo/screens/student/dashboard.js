async function renderStudentDashboard(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;
    const name = appState.userData?.officialName || _i18n_t('auth.student','Student');
    const username = appState.userData?.username || '';

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader('')}
            ${createSkeleton(3)}
        </div>
    `;

    const classIds = appState.userData?.classIds || [];
    let announcements = [];
    let todayHomework = [];
    let todaySlots = [];
    let attendance = { present: 0, total: 0 };
    let homework = { done: 0, total: 0 };
    let gradePct = null;

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = now.getDay() === 0 ? null : dayNames[now.getDay() - 1];

    for (const classId of classIds) {
        try {
            const classSnap = await getDoc(doc(db, 'classes', classId));
            const className = classSnap.exists ? (classSnap.data().name || _i18n_t('testReports.class','Class')) : _i18n_t('testReports.class','Class');

            // Announcements
            try {
                const annSnap = await getDocs(query(collection(db, 'classes', classId, 'announcements'), orderBy('createdAt', 'desc'), limit(5)));
                annSnap.forEach(d => {
                    const a = d.data();
                    announcements.push({ id: d.id, className, text: a.text || a.title || '', createdAt: a.createdAt });
                });
            } catch (err) { console.error('[studentDashboard announcements]', err); }

            // Homework — today's due items
            try {
                const hwSnap = await getDocs(collection(db, 'classes', classId, 'homework'));
                for (const d of hwSnap.docs) {
                    const hw = { id: d.id, className, ...d.data() };
                    homework.total++;
                    let submitted = false;
                    try {
                        const subSnap = await getDoc(doc(db, 'classes', classId, 'homework', hw.id, 'submissions', uid));
                        if (subSnap.exists) submitted = true;
                    } catch (err) { console.error('[studentDashboard sub]', err); }
                    if (submitted) homework.done++;
                    if (!submitted && hw.deadline === todayStr()) {
                        todayHomework.push({ title: hw.title, subject: hw.subject || '', className });
                    }
                }
            } catch (err) { console.error('[studentDashboard homework]', err); }

            // Timetable — today's slots
            if (todayName) {
                try {
                    const ttSnap = await getDocs(collection(db, 'classes', classId, 'timetable'));
                    ttSnap.forEach(d => {
                        const s = d.data();
                        if (s.day === todayName) todaySlots.push({ subject: s.subject, startTime: s.startTime, endTime: s.endTime, className });
                    });
                } catch (err) { console.error('[studentDashboard timetable]', err); }
            }

            // Attendance — current month (up to today)
            try {
                for (let day = 1; day <= todayDate; day++) {
                    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const attSnap = await getDoc(doc(db, 'classes', classId, 'attendance', ds));
                    if (attSnap.exists) {
                        const recs = attSnap.data().records || {};
                        if (recs[uid]) {
                            attendance.total++;
                            if (recs[uid] === 'present') attendance.present++;
                        }
                    }
                }
            } catch (err) { console.error('[studentDashboard attendance]', err); }

            // Test reports — this student
            try {
                const repSnap = await getDocs(query(collection(db, 'classes', classId, 'testReports'), where('studentId', '==', uid)));
                repSnap.forEach(d => {
                    const r = d.data();
                    const max = Number(r.maxMarks) || 0;
                    const mark = Number(r.marks);
                    if (max > 0 && !isNaN(mark)) {
                        const pct = (gradePct === null) ? (mark / max * 100) : ((gradePct * 0) + (mark / max * 100));
                        gradePct = (gradePct === null) ? pct : ((gradePct + pct) / 2);
                    }
                });
            } catch (err) { console.error('[studentDashboard testReports]', err); }
        } catch (err) {
            console.error('[studentDashboard class loop]', err);
        }
    }

    announcements.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    const attendancePct = attendance.total ? Math.round(attendance.present / attendance.total * 100) : null;
    const hwDonePct = homework.total ? Math.round(homework.done / homework.total * 100) : null;
    const gradeLabel = gradePct === null ? ',' : (gradePct >= 90 ? 'A+' : gradePct >= 80 ? 'A' : gradePct >= 70 ? 'B+' : gradePct >= 60 ? 'B' : gradePct >= 50 ? 'C' : 'D');

    // Firestore single source of truth for XP/streak. Never show a local-only
    // zero without attempting a cloud read first: render a neutral placeholder,
    // then replace with cloud values. Local cache is fallback only.
    let streakNum = '…';
    let xpThisWeek = '…';
    try {
        if (typeof getStudyHubContext === 'function' && uid) {
            try {
                const _dctx = await getStudyHubContext(uid);
                if (_dctx && typeof _dctx.totalXP === 'number') {
                    streakNum = (_dctx.displayStreak != null ? _dctx.displayStreak : (_dctx.computedStreak || 0));
                    xpThisWeek = _dctx.totalXP;
                    try {
                        if (typeof shSyncLocalCacheFromCtx === 'function') { /* studyHub helper when present */ }
                        // Overwrite local cache so a later offline read matches cloud.
                        if (typeof getData === 'function' && typeof localStorage !== 'undefined') {
                            const _cur = getData();
                            const _badges = Array.isArray(_dctx.earnedBadges) ? _dctx.earnedBadges : ((_cur.gamification && _cur.gamification.badges) || []);
                            let _focusCount = 0;
                            try { _focusCount = (_dctx.recentActivity || []).filter(a => a && a.type === 'focus').length; } catch (e) {}
                            try {
                                localStorage.setItem('studyos-data', JSON.stringify({
                                    ..._cur,
                                    gamification: {
                                        ..._cur.gamification,
                                        xp: _dctx.totalXP,
                                        streak: streakNum,
                                        lastStudyDate: _dctx.focusTodayDayKey || _cur.gamification.lastStudyDate,
                                        badges: _badges,
                                        focusSessions: _focusCount
                                    }
                                }));
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            } catch (e) { /* fall through to local fallback below */ }
        }
        if (streakNum === '…' || xpThisWeek === '…') {
            const gamification = typeof getData === 'function' ? getData().gamification || {} : {};
            streakNum = gamification.streak || 0;
            xpThisWeek = gamification.xp || 0;
        }
    } catch (e) {
        const gamification = typeof getData === 'function' ? getData().gamification || {} : {};
        streakNum = gamification.streak || 0;
        xpThisWeek = gamification.xp || 0;
    }

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader('')}

            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div style="background:rgba(124,92,252,0.12);border:1px solid rgba(124,92,252,0.3);
                    border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px;">
                    <span style="font-size:12px;color:var(--text-dim);">${_i18n_t('dashboard.yourUsername','Your username')}</span>
                    <span style="font-size:14px;font-weight:700;color:#C4B5FD;font-family:'Sora',sans-serif;">
                        @${username}
                    </span>
                    <span style="font-size:11px;color:var(--text-dim);">(${_i18n_t('dashboard.shareWithTeachers','share with teachers to join classes')})</span>
                </div>
            </div>

            <div class="quick-actions" style="display:flex;gap:10px;overflow-x:auto;padding:12px 0;scrollbar-width:none;">
                <button class="quick-action-btn" data-route="#/student/doubt">💬 ${_i18n_t('dashboard.askAI','Ask AI')}</button>
                <button class="quick-action-btn" data-route="#/student/focus">🎯 ${_i18n_t('dashboard.startFocus','Start Focus')}</button>
                <button class="quick-action-btn" data-route="#/student/homework">📚 ${_i18n_t('dashboard.viewHomework','View Homework')}</button>
                <button class="quick-action-btn" data-route="#/student/study-hub">🔄 ${_i18n_t('dashboard.revise','Revise')}</button>
                <button class="quick-action-btn" data-route="#/student/study-hub">📖 ${_i18n_t('dashboard.studyPlanner','Study Planner')}</button>
            </div>

            <div class="grid">
                <div class="flex-col">
                    ${createGlassCard('📢 ' + _i18n_t('dashboard.announcements','Announcements'), `
                        ${announcements.length === 0
                            ? createEmptyState(_i18n_t('dashboard.noAnnouncements','No announcements yet'), _i18n_t('dashboard.announcementsEmptySub','Announcements from your teachers will appear here.'), '📢')
                            : announcements.slice(0, 5).map((a, i) => `
                                <div class="hw-item" style="align-items:flex-start;gap:10px;">
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:13px;line-height:1.6;color:var(--text);">${_escapeHtml(a.text)}</div>
                                        <div class="hw-sub" style="margin-top:6px;">${_escapeHtml(a.className)} · ${timeAgo(a.createdAt)}</div>
                                    </div>
                                </div>
                            `).join('')}
                    `, '', 0.05)}

                    ${createGlassCard(_i18n_t('dashboard.todaysHomework',"Today's Homework"), `
                        ${todayHomework.length === 0
                            ? createEmptyState(_i18n_t('dashboard.nothingDueToday','Nothing due today'), _i18n_t('dashboard.allCaughtUp','You are all caught up! 🎉'), '📚')
                            : todayHomework.slice(0, 3).map((h, i) => createHwItem(
                                h.title,
                                `${h.subject} · ${h.className}`,
                                _i18n_t('homework.dueToday','Due Today'),
                                'urgent',
                                0.15 + i * 0.05
                            )).join('')}
                        <a href="#/student/homework" class="btn btn-secondary btn-sm"
                            style="margin-top:14px;display:inline-flex;width:auto;">${_i18n_t('common.viewAll','View All')} ${_i18n_t('nav.homework','Homework')} →</a>
                    `, '', 0.1)}

                    ${createGlassCard(_i18n_t('dashboard.thisWeek','This Week'), `
                        ${createStatRow([
                            { num: attendancePct === null ? ',' : attendancePct + '%', label: _i18n_t('dashboard.attendance','Attendance'), color: '#C4B5FD' },
                            { num: hwDonePct === null ? ',' : hwDonePct + '%', label: _i18n_t('dashboard.homeworkDone','Homework Done'), color: '#93C5FD' },
                            { num: gradeLabel, label: _i18n_t('dashboard.avgGrade','Avg. Grade'), color: '#FDE68A' }
                        ])}
                    `, '', 0.15)}

                    ${createGlassCard('👪 ' + _i18n_t('parentShare.title','Share with Parent'), `
                        <div id="ps-body">
                            ${createEmptyState(_i18n_t('parentShare.empty','Generate a link to share your progress with a parent — no login needed for them.'), '', '🔗')}
                            <div style="text-align:center;margin-top:12px;">
                                <button class="btn btn-sm" id="ps-generate">${_i18n_t('parentShare.generate','Generate share link')}</button>
                            </div>
                        </div>
                    `, '', 0.18)}
                </div>

                <div class="flex-col">
                    ${createGlassCard('', createStreakOrb(streakNum, _i18n_t('dashboard.dayStreak','Day Study Streak'),
                        `${_i18n_t('dashboard.focusStreak','Focus Mode')} · ${_i18n_t('dashboard.xpEarned',{xp: xpThisWeek})}`, _i18n_t('dashboard.goToStudyHub','Go to Study Hub') + ' 🧠'), 'streak-card-wrapper', 0.2)}

                    ${createGlassCard('🎯 ' + _i18n_t('dashboard.yourPriority','Your Priority Right Now'), `
                        <div id="next-best-action" style="min-height:60px;">
                            <div class="skeleton-wrap"><div class="skeleton-line"></div><div class="skeleton-line"></div></div>
                        </div>
                    `, '', 0.22)}

                    ${createGlassCard('⚡ ' + _i18n_t('dashboard.practiceBitToday','Practice Bit: Today'), `
                        <p style="font-size:14px;line-height:1.7;color:var(--text-dim);">
                            ${_i18n_t('dashboard.generatePractice','Generate your daily AI practice question and keep your streak alive.')}
                        </p>
                        <a href="#/student/practice-bits" class="btn mt-4">${_i18n_t('dashboard.answerNow','Answer Now')} ⚡</a>
                    `, '', 0.25)}

                    ${createGlassCard(_i18n_t('dashboard.todayClasses','Today\'s Classes'), `
                        ${todaySlots.length === 0
                            ? createEmptyState(_i18n_t('dashboard.noClassesToday','No classes today'), _i18n_t('teacher.noClassesSub','Your timetable is free for today.'), '🎉')
                            : todaySlots.slice(0, 5).map((slot, i) => `
                                <div class="hw-item">
                                    <div>
                                        <div class="hw-title">${_escapeHtml(slot.subject)}</div>
                                        <div class="hw-sub">${formatStudentTime(slot.startTime)} · ${_escapeHtml(slot.className)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        <a href="#/student/timetable" class="btn btn-secondary btn-sm"
                            style="margin-top:14px;display:inline-flex;width:auto;">${_i18n_t('dashboard.fullTimetable','Full Timetable')} →</a>
                    `, '', 0.3)}
                </div>
            </div>
        </div>
    `;

    container.querySelector('.streak-card .btn')?.addEventListener('click', () => {
        window.location.hash = '#/student/study-hub';
    });

    // D.3 Quick Actions
    container.querySelectorAll('.quick-action-btn').forEach(btn => btn.addEventListener('click', () => window.location.hash = btn.dataset.route));

    // ─── Parent read-only share link (one stable link per student) ───
    // Reuses the attendance % already computed above + the same homework /
    // testReports read pattern used elsewhere (no new collections, no new logic).
    initParentShare(container, uid, classIds, attendancePct);

    function psToken() {
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        } catch {}
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function psLink(tokenId) {
        return location.origin + location.pathname + '#/parent-view/' + tokenId;
    }

    function psFmtDue(deadline) {
        try {
            if (typeof formatDueDate === 'function') return formatDueDate(deadline);
            if (typeof _i18n_t === 'function' && deadline) return deadline;
        } catch {}
        return deadline || '';
    }

    async function psCollectSnapshot() {
        const pending = [];
        const reports = [];
        for (const classId of classIds) {
            try {
                const hwSnap = await getDocs(collection(db, 'classes', classId, 'homework'));
                for (const d of hwSnap.docs) {
                    const hw = d.data();
                    let submitted = false;
                    try {
                        const subSnap = await getDoc(doc(db, 'classes', classId, 'homework', d.id, 'submissions', uid));
                        if (subSnap.exists) submitted = true;
                    } catch (err) { console.error('[parentShare sub]', err); }
                    if (!submitted && hw.deadline) {
                        pending.push({ title: hw.title || '', subject: hw.subject || '', deadline: hw.deadline });
                    }
                }
            } catch (err) { console.error('[parentShare homework]', err); }
            try {
                const repSnap = await getDocs(query(collection(db, 'classes', classId, 'testReports'), where('studentId', '==', uid)));
                repSnap.forEach(d => {
                    const r = d.data();
                    reports.push({ subject: r.subject || '', testName: r.testName || '', grade: r.grade || '', createdAt: r.createdAt });
                });
            } catch (err) { console.error('[parentShare testReports]', err); }
        }
        pending.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
        reports.sort((a, b) => ((b.createdAt && b.createdAt.toDate && b.createdAt.toDate()) || 0) - ((a.createdAt && a.createdAt.toDate && a.createdAt.toDate()) || 0));
        return {
            studentUid: uid,
            studentName: appState.userData?.officialName || name || '',
            attendancePercent: attendancePct,
            upcomingDeadlines: pending.slice(0, 5).map(h => ({ title: h.title, subject: h.subject, dueDate: psFmtDue(h.deadline) })),
            recentGrades: reports.slice(0, 5).map(r => ({ subject: r.subject, testName: r.testName, grade: r.grade })),
            generatedAt: new Date(),
            revoked: false
        };
    }

    async function initParentShare(root, studentUid, studentClassIds, attPct) {
        const body = root.querySelector('#ps-body');
        if (!body || !studentUid) return;
        const existingId = appState.userData?.shareSnapshotId || null;

        async function paintManage(tokenId) {
            const link = psLink(tokenId);
            body.innerHTML = `
                <div style="display:flex;gap:8px;align-items:center;">
                    <input id="ps-link" readonly value="${_escapeHtml(link)}" class="form-control" style="flex:1;min-width:0;" onclick="this.select()">
                    <button class="btn btn-secondary btn-sm" id="ps-copy" style="white-space:nowrap;">${_i18n_t('parentShare.copy','Copy link')}</button>
                </div>
                <p style="font-size:12px;color:var(--text-dim);margin-top:8px;line-height:1.5;">${_i18n_t('parentShare.linkHint','Anyone with this link can view this summary. Revoke it anytime to disable the link.')}</p>
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" id="ps-update">${_i18n_t('parentShare.update','Update snapshot')}</button>
                    <button class="btn btn-secondary btn-sm" id="ps-revoke">${_i18n_t('parentShare.revoke','Revoke link')}</button>
                </div>
            `;
            body.querySelector('#ps-copy').addEventListener('click', async () => {
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(link);
                    else { const i = body.querySelector('#ps-link'); i.select(); document.execCommand('copy'); }
                    showToast(_i18n_t('parentShare.copied','Link copied'));
                } catch { showToast(_i18n_t('parentShare.copyFailed','Copy failed — long-press the link to copy it manually.')); }
            });
            body.querySelector('#ps-update').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.textContent = _i18n_t('parentShare.generating','Generating…');
                try {
                    const snap = await psCollectSnapshot();
                    await setDoc(doc(db, 'shareSnapshots', tokenId), snap, { merge: true });
                    showToast(_i18n_t('parentShare.updated','Snapshot updated.'));
                } catch (err) {
                    const code = err && err.code;
                    if (code !== 'permission-denied' && code !== 'not-found') console.error('[parentShare update]', err);
                    showToast(_i18n_t('parentShare.failed','Could not generate the link. Try again.'));
                }
                paintManage(tokenId);
            });
            body.querySelector('#ps-revoke').addEventListener('click', async () => {
                try {
                    await updateDoc(doc(db, 'shareSnapshots', tokenId), { revoked: true });
                    try { await setDoc(doc(db, 'users', studentUid), { shareSnapshotId: null }, { merge: true }); } catch (err) {
                        if (err && err.code !== 'permission-denied') console.error('[parentShare pointer]', err);
                    }
                    if (appState.userData) appState.userData.shareSnapshotId = null;
                    showToast(_i18n_t('parentShare.revokedMsg','Link revoked.'));
                } catch (err) {
                    if (err && err.code !== 'permission-denied' && err.code !== 'not-found') console.error('[parentShare revoke]', err);
                    showToast(_i18n_t('parentShare.failed','Could not generate the link. Try again.')); return;
                }
                paintEmpty();
            });
        }

        function paintEmpty() {
            body.innerHTML = `
                ${createEmptyState(_i18n_t('parentShare.empty','Generate a link to share your progress with a parent — no login needed for them.'), '', '🔗')}
                <div style="text-align:center;margin-top:12px;">
                    <button class="btn btn-sm" id="ps-generate">${_i18n_t('parentShare.generate','Generate share link')}</button>
                </div>
            `;
            body.querySelector('#ps-generate').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.textContent = _i18n_t('parentShare.generating','Generating…');
                try {
                    const tokenId = psToken();
                    const snap = await psCollectSnapshot();
                    await setDoc(doc(db, 'shareSnapshots', tokenId), snap);
                    try { await setDoc(doc(db, 'users', studentUid), { shareSnapshotId: tokenId }, { merge: true }); } catch (err) {
                        if (err && err.code !== 'permission-denied') console.error('[parentShare pointer]', err);
                    }
                    if (appState.userData) appState.userData.shareSnapshotId = tokenId;
                    showToast(_i18n_t('parentShare.generated','Share link generated.'));
                    paintManage(tokenId);
                } catch (err) {
                    if (err && err.code !== 'permission-denied' && err.code !== 'not-found') console.error('[parentShare generate]', err);
                    showToast(_i18n_t('parentShare.failed','Could not generate the link. Try again.'));
                    paintEmpty();
                }
            });
        }

        if (!existingId) { paintEmpty(); return; }
        try {
            const snap = await getDoc(doc(db, 'shareSnapshots', existingId));
            if (snap.exists && snap.data().revoked !== true) paintManage(existingId);
            else paintEmpty();
        } catch (err) { console.error('[parentShare lookup]', err); paintEmpty(); }
    }

    // B.6 — Next Best Action
    (async () => {
        const el = container.querySelector('#next-best-action');
        if (!el) return;
        try {
            let data;
            if (typeof getNextBestAction === 'function') {
                data = await getNextBestAction(uid, classIds);
            } else {
                const homeworkItems = [];
                for (const cid of classIds) {
                    try { const snap = await getDocs(collection(db, 'classes', cid, 'homework')); snap.forEach(d => homeworkItems.push({ id: d.id, classId: cid, ...d.data() })); } catch(e) {}
                }
                const incomplete = [];
                for (const hw of homeworkItems) {
                    try { const sub = await getDoc(doc(db, 'classes', hw.classId, 'homework', hw.id, 'submissions', uid)); if (!sub.exists) incomplete.push(hw); } catch(e) {}
                }
                incomplete.sort((a,b) => new Date(a.deadline||'9999') - new Date(b.deadline||'9999'));
                data = { priorities: incomplete.slice(0,3).map(hw => ({ action: _i18n_t('dashboard.finishAction',{title: hw.title}), reason: _i18n_t('dashboard.dueReason',{date: hw.deadline||'soon'}), estimatedMinutes: 25 })) };
                if (!incomplete.length) data = { priorities: [{ action: _i18n_t('dashboard.noPendingHomework','No pending homework'), reason: _i18n_t('dashboard.caughtUpReason','You are all caught up'), estimatedMinutes: 0 }] };
                try {
                    const j = await safeApiCall('/api/ai', {
                        action: 'nextBestAction',
                        incompleteHomework: incomplete.slice(0,5).map(hw=>({title:hw.title, subject:hw.subject||'General', hoursUntilDue: Math.round((new Date(hw.deadline)-new Date())/3600000)})),
                        recentlyStudiedSubjects:[],
                        allEnrolledSubjects: [...new Set(homeworkItems.map(h=>h.subject).filter(Boolean))],
                        grade: (appState.userData && appState.userData.grade != null) ? String(appState.userData.grade) : '',
                        languageName: ({ en:'English', hi:'Hindi', bn:'Bengali', mr:'Marathi', te:'Telugu', ta:'Tamil' })[window.currentUserLanguage] || window.currentUserLanguage || 'English'
                    });
                    if (j && j.priorities) data = j;
                } catch(e) {}
            }
            if (!data.priorities || !data.priorities.length) {
                el.innerHTML = `<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:12px;">${_i18n_t('dashboard.noPriorities','No priorities right now: enjoy the break!')}</div>`;
            } else {
                el.innerHTML = data.priorities.map((p,i) => `
                    <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <div style="min-width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#4F8CFF);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${i+1}</div>
                        <div style="flex:1;">
                            <div style="font-size:14px;font-weight:600;">${p.action}</div>
                            <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${p.reason} · ${_i18n_t('common.minShort',{count: p.estimatedMinutes})}</div>
                        </div>
                    </div>
                `).join('') + `<div style="text-align:center;margin-top:12px;"><a href="#/student/study-hub" style="font-size:12px;color:#C4B5FD;text-decoration:none;">${_i18n_t('dashboard.viewFullPlan','View full plan')} →</a></div>`;
            }
        } catch(e) { const el2 = container.querySelector('#next-best-action'); if (el2) el2.innerHTML = `<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('dashboard.prioritiesFailed','Could not load priorities.')}</div>`; }
    })();

    // D.1 — deadline_approaching client-side scan (20-28h window)
    try {
        if (typeof checkDeadlineApproachingNotifications === 'function' && uid && classIds.length) {
            checkDeadlineApproachingNotifications(uid, classIds);
        } else if (typeof checkAndCreateDeadlineNotifications === 'function' && uid && classIds.length) {
            checkAndCreateDeadlineNotifications(uid, classIds);
        }
    } catch (e) { console.error('[deadline check]', e); }

}

function timeAgo(ts) {
    if (!ts) return _i18n_t('common.timeRecently','recently');
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return _i18n_t('common.timeJustNow','just now');
    if (sec < 3600) return _i18n_t('common.timeMinAgo',{count: Math.floor(sec / 60)});
    if (sec < 86400) return _i18n_t('common.timeHourAgo',{count: Math.floor(sec / 3600)});
    return _i18n_t('common.timeDayAgo',{count: Math.floor(sec / 86400)});
}

function formatStudentTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`;
}