async function renderTeacherDashboard(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;

    container.innerHTML = `
        <div class="grid">
            <div class="flex-col">
                ${createGlassCard(_i18n_t('teacher.quickStats','Quick Stats'), createSkeleton(2))}
                ${createGlassCard(_i18n_t('teacher.recentActivity','Recent Activity'), createSkeleton(3))}
            </div>
            <div class="flex-col">
                ${createGlassCard(_i18n_t('teacher.upcomingClasses','Upcoming Classes'), createSkeleton(3))}
            </div>
        </div>
    `;

    try {
        const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
        const classes = [];
        snap.forEach(d => classes.push({ id: d.id, ...d.data() }));

        const totalStudents = classes.reduce((s, c) => s + (c.studentIds || []).length, 0);

        let pendingHW = 0;
        let totalSubmissions = 0;
        let totalAssignments = 0;
        let submissionsList = [];

        for (const c of classes) {
            const hwSnap = await getDocs(collection(db, 'classes', c.id, 'homework'));
            for (const hwDoc of hwSnap.docs) {
                totalAssignments++;
                let submitted = 0;
                try {
                    const subSnap = await getDocs(collection(db, 'classes', c.id, 'homework', hwDoc.id, 'submissions'));
                    submitted = subSnap.size;
                    totalSubmissions += submitted;
                    if (submitted < (c.studentIds || []).length) pendingHW++;
                    subSnap.forEach(sd => {
                        const s = sd.data();
                        submissionsList.push({
                            id: sd.id,
                            classId: c.id,
                            className: c.name,
                            hwTitle: hwDoc.data().title || _i18n_t('teacher.untitledAssignment','Untitled assignment'),
                            submittedAt: s.submittedAt,
                        });
                    });
                } catch (err) {
                    console.error('[teacherDashboard submissions]', err);
                }
            }
        }

        const completionPct = totalAssignments && (classes.reduce((s, c) => s + (c.studentIds || []).length, 0))
            ? Math.round(totalSubmissions / (totalAssignments * totalStudents) * 100)
            : 0;

        submissionsList.sort((a, b) => (b.submittedAt?.toDate?.() || 0) - (a.submittedAt?.toDate?.() || 0));

        const announcements = [];
        for (const c of classes) {
            try {
                const annSnap = await getDocs(query(collection(db, 'classes', c.id, 'announcements'), orderBy('createdAt', 'desc'), limit(5)));
                annSnap.forEach(d => {
                    const a = d.data();
                    announcements.push({ id: d.id, className: c.name, ...a });
                });
            } catch (err) {
                console.error('[teacherDashboard announcements]', err);
            }
        }
        announcements.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

        const recentActivity = announcements.length
            ? announcements.slice(0, 4).map((a, i) => createHwItem(
                `${a.className}: ${a.title || a.text || _i18n_t('teacher.announcementItem','Announcement')}`,
                _i18n_t('teacher.postedAgo', {time: timeAgo(a.createdAt)}),
                null,
                '',
                0.15 + i * 0.05
            )).join('')
            : submissionsList.slice(0, 4).map((s, i) => createHwItem(
                `${s.className}: ${s.hwTitle}`,
                _i18n_t('teacher.submittedAgo', {time: timeAgo(s.submittedAt)}),
                _i18n_t('teacher.needsReview','Needs Review'),
                '',
                0.15 + i * 0.05
            )).join('')
            || createEmptyState(_i18n_t('teacher.noActivity','No activity yet'), _i18n_t('teacher.noActivitySub','Assign homework to see student submissions here.'), '📭');

        const todayIdx = new Date().getDay() === 0 ? -1 : new Date().getDay() - 1;
        const todayName = TEACHER_DAYS[todayIdx];

        const upcoming = [];
        if (todayName) {
            for (const c of classes) {
                try {
                    const ttSnap = await getDocs(collection(db, 'classes', c.id, 'timetable'));
                    ttSnap.forEach(d => {
                        const s = d.data();
                        if (s.day === todayName) upcoming.push({ className: c.name, subject: s.subject, start: s.startTime, end: s.endTime });
                    });
                } catch (err) {
                    console.error('[teacherDashboard timetable]', err);
                }
            }
            upcoming.sort((a, b) => a.start.localeCompare(b.start));
        }

        const upcomingHTML = upcoming.length
            ? upcoming.map((u, i) => createHwItem(
                `${u.className} ${u.subject}`,
                `${formatTeacherTime(u.start)} - ${formatTeacherTime(u.end)}`,
                null,
                '',
                0.25 + i * 0.05
            )).join('')
            : createEmptyState(_i18n_t('dashboard.noClassesToday','No classes today'), _i18n_t('teacher.noClassesSub','Your timetable is free for today.'), '🎉');

        container.innerHTML = `
            <div class="grid">
                <div class="flex-col">
                    ${createGlassCard(_i18n_t('teacher.quickStats','Quick Stats'), `
                        ${createStatRow([
                            { num: totalStudents, label: _i18n_t('teacher.totalStudents','Total Students'), color: '#C4B5FD' },
                            { num: pendingHW, label: _i18n_t('teacher.pendingHomework','Pending Homework'), color: '#FF9B9B' },
                            { num: classes.length, label: _i18n_t('teacher.activeClasses','Active Classes'), color: '#93C5FD' }
                        ])}
                    `, '', 0.05)}
                    ${createGlassCard(_i18n_t('teacher.recentActivity','Recent Activity'), recentActivity, '', 0.1)}
                </div>
                <div class="flex-col">
                    ${createGlassCard(_i18n_t('teacher.homeworkCompletion','Homework Completion'), `
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="flex:1;height:8px;border-radius:6px;background:rgba(255,255,255,0.06);overflow:hidden;">
                                <div style="height:100%;border-radius:6px;
                                    background:linear-gradient(90deg,#7C5CFC,#4F8CFF);
                                    width:${completionPct}%;"></div>
                            </div>
                            <span style="font-size:13px;color:var(--text-dim);flex-shrink:0;">${completionPct}%</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:8px;">
                            ${_i18n_t('teacher.submissionsOf', {done: totalSubmissions, total: totalAssignments * totalStudents})}
                        </div>
                        <div id="class-pulse-dashboard" style="margin-top:14px;padding:12px;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.2);border-radius:10px;min-height:36px;display:flex;align-items:center;">
                            <div style="font-size:13px;color:var(--text-dim);">🤖 ${_i18n_t('teacher.loadingAI','Loading AI recommendation...')}</div>
                        </div>
                    `, '', 0.15)}
                    ${createGlassCard(_i18n_t('teacher.upcomingClasses','Upcoming Classes'), upcomingHTML, '', 0.2)}
                </div>
            </div>
        `;
        // Fetch Class Pulse AI recommendation
        (async () => {
            const pulseEl = container.querySelector('#class-pulse-dashboard');
            if (!pulseEl) return;
            const notSubmittedCount = Math.max(0, (totalAssignments * totalStudents) - totalSubmissions);
            const avgQuizScore = 0;
            const weakTopics = [];
            try {
                const data = await safeApiCall('/api/ai', {
                    action: 'classPulse', completionPercent: completionPct, notSubmittedCount, avgQuizScore, weakTopics
                });
                if (data && data.recommendation) {
                    pulseEl.innerHTML = `<div style="font-size:13px;font-weight:600;color:#C4B5FD;">🤖 ${_i18n_t('teacher.aiRecommendation','AI Recommendation:')}</div><div style="font-size:13px;line-height:1.6;margin-top:4px;">${data.recommendation}</div>`;
                } else {
                    pulseEl.innerHTML = `<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('teacher.noRecommendation','No recommendation available.')}</div>`;
                }
            } catch (e) {
                console.error('[classPulse dashboard]', e);
                pulseEl.innerHTML = `<div style="font-size:13px;color:#FCA5A5;">${_i18n_t('teacher.aiUnavailable','AI recommendation unavailable')}</div>`;
            }
        })();
    } catch (err) {
        console.error('[teacherDashboard]', err);
        container.innerHTML = `
            <div class="grid">
                <div class="flex-col">
                    ${createGlassCard(_i18n_t('teacher.quickStats','Quick Stats'), createEmptyState(_i18n_t('admin.failedToLoad','Failed to load stats'), err.message, '⚠️'))}
                </div>
            </div>
        `;
    }
}

function timeAgo(ts) {
    const _t0 = (typeof _i18n_t === 'function') ? _i18n_t : ((k,d)=>d||k);
    if (!ts) return _t0('common.timeRecently','recently');
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return _t0('common.timeJustNow','just now');
    if (sec < 3600) return _t0('common.timeMinAgo',{count: Math.floor(sec / 60)});
    if (sec < 86400) return _t0('common.timeHourAgo',{count: Math.floor(sec / 3600)});
    return _t0('common.timeDayAgo',{count: Math.floor(sec / 86400)});
}