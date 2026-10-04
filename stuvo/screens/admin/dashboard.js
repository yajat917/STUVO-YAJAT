async function computePlatformHealth(usersSnap) {
    const nowMs = Date.now();
    const DAY = 86400000;
    const result = { inactiveClasses: [], inactiveTeachers: [], attendanceConcerns: [], ok: true };

    // Inactive classes: no homework posted in 14+ days (one limit(1) read per class)
    let classesSnap = null;
    try {
        classesSnap = await getDocs(collection(db, 'classes'));
    } catch (err) {
        console.error('[platformHealth classes]', err);
        result.ok = false;
    }
    if (classesSnap) {
        for (const classDoc of classesSnap.docs) {
            const c = classDoc.data() || {};
            try {
                const hwSnap = await getDocs(query(collection(db, 'classes', classDoc.id, 'homework'), orderBy('createdAt', 'desc'), limit(1)));
                let daysSince = 999;
                if (!hwSnap.empty) {
                    const ts = hwSnap.docs[0].data().createdAt;
                    const ms = ts && ts.toDate ? ts.toDate().getTime() : NaN;
                    if (!isNaN(ms)) daysSince = (nowMs - ms) / DAY;
                }
                if (daysSince > 14) result.inactiveClasses.push({ id: classDoc.id, name: c.name || classDoc.id, daysSince: Math.min(Math.round(daysSince), 999) });
            } catch (err) {
                console.error('[platformHealth homework]', classDoc.id, err);
            }
        }
        result.inactiveClasses.sort((a, b) => b.daysSince - a.daysSince);
    }

    // Inactive teachers: no sign-in in 14+ days (reuses the already-fetched users snapshot)
    usersSnap.forEach(d => {
        const u = d.data() || {};
        if (u.role !== 'teacher' || u.status !== 'active') return;
        const ts = u.lastActiveAt;
        const ms = ts && ts.toDate ? ts.toDate().getTime() : NaN;
        if (isNaN(ms)) {
            result.inactiveTeachers.push({ id: d.id, name: u.officialName || d.id, daysSince: null });
        } else {
            const daysSince = (nowMs - ms) / DAY;
            if (daysSince > 14) result.inactiveTeachers.push({ id: d.id, name: u.officialName || d.id, daysSince: Math.round(daysSince) });
        }
    });
    result.inactiveTeachers.sort((a, b) => (b.daysSince === null ? 9999 : b.daysSince) - (a.daysSince === null ? 9999 : a.daysSince));

    // Attendance concern: same tallyAttendancePct formula as the Student screen,
    // aggregated over the current month. One attendance-list read per class,
    // student names resolved from the already-fetched users snapshot.
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const names = {};
    const studentIds = new Set();
    usersSnap.forEach(d => {
        const u = d.data() || {};
        if (u.role === 'student') {
            names[d.id] = u.officialName || (u.username ? '@' + u.username : d.id);
            studentIds.add(d.id);
        }
    });
    const entriesByStudent = {};
    if (classesSnap) {
        for (const classDoc of classesSnap.docs) {
            try {
                const attSnap = await getDocs(collection(db, 'classes', classDoc.id, 'attendance'));
                attSnap.forEach(a => {
                    if (!a.id.startsWith(monthPrefix)) return;
                    const recs = a.data().records || {};
                    for (const sid of Object.keys(recs)) {
                        if (!studentIds.has(sid)) continue;
                        (entriesByStudent[sid] = entriesByStudent[sid] || []).push({ day: a.id, value: recs[sid] });
                    }
                });
            } catch (err) {
                console.error('[platformHealth attendance]', classDoc.id, err);
            }
        }
    }
    for (const sid of Object.keys(entriesByStudent)) {
        const r = tallyAttendancePct(sid, entriesByStudent[sid]);
        if (r.total > 0 && r.pct < 75) result.attendanceConcerns.push({ id: sid, name: names[sid] || sid, pct: r.pct });
    }
    result.attendanceConcerns.sort((a, b) => a.pct - b.pct);

    return result;
}

async function renderAdminDashboard(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    container.innerHTML = `
        <div class="grid">
            <div class="flex-col" style="grid-column: span 2;">
                ${createGlassCard(_i18n_t('admin.platformOverview','Platform Overview'), createSkeleton(2), '', 0.05)}
            </div>
        </div>
    `;

    try {
        let totalStudents = 0;
        let activeTeachers = 0;
        let pendingApprovals = 0;

        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(d => {
            const u = d.data();
            if (u.role === 'student') totalStudents++;
            else if (u.role === 'teacher') {
                if (u.status === 'active') activeTeachers++;
                if (u.status === 'pending') pendingApprovals++;
            }
        });

        let openReports = 0;
        try {
            const repSnap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')));
            openReports = repSnap.size;
        } catch (err) {
            console.error('[adminDashboard reports]', err);
        }

        const health = await computePlatformHealth(usersSnap);

        const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const healthSection = (count, label, items, itemSub, viewAllHash) => {
            if (count === 0) return '';
            const shown = items.slice(0, 5);
            return `
                <details style="margin-top:12px;">
                    <summary style="cursor:pointer;font-size:14px;font-weight:600;">${label}</summary>
                    <div style="margin-top:8px;">
                        ${shown.map(it => createHwItem(it.name, itemSub(it))).join('')}
                        ${viewAllHash ? `<a href="${viewAllHash}" style="font-size:13px;color:#93C5FD;">${esc(_i18n_t('common.viewAll','View All'))} →</a>` : ''}
                    </div>
                </details>
            `;
        };

        let healthBody;
        if (!health.ok) {
            healthBody = createEmptyState(_i18n_t('admin.failedToLoad','Failed to load stats'), '', '⚠️');
        } else if (health.inactiveClasses.length === 0 && health.inactiveTeachers.length === 0 && health.attendanceConcerns.length === 0) {
            healthBody = createEmptyState(_i18n_t('admin.allHealthy','Everything looks healthy'), _i18n_t('admin.allHealthySub','No quiet classes, inactive teachers, or attendance concerns right now.'), '✅');
        } else {
            healthBody = `
                ${healthSection(health.inactiveClasses.length,
                    `⚠️ ${_i18n_t('admin.quietClasses', { count: health.inactiveClasses.length })}`,
                    health.inactiveClasses,
                    (it) => it.daysSince >= 999
                        ? _i18n_t('admin.noHomeworkYet','No homework posted yet')
                        : _i18n_t('admin.quietForDays', { days: it.daysSince }),
                    null)}
                ${healthSection(health.inactiveTeachers.length,
                    `⚠️ ${_i18n_t('admin.inactiveTeachersRow', { count: health.inactiveTeachers.length })}`,
                    health.inactiveTeachers,
                    (it) => it.daysSince === null
                        ? _i18n_t('admin.neverActive','Never signed in')
                        : _i18n_t('admin.inactiveForDays', { days: it.daysSince }),
                    '#/admin/users')}
                ${healthSection(health.attendanceConcerns.length,
                    `⚠️ ${_i18n_t('admin.lowAttendanceRow', { count: health.attendanceConcerns.length })}`,
                    health.attendanceConcerns,
                    (it) => _i18n_t('admin.attendancePct', { pct: it.pct }),
                    '#/admin/users')}
            `;
        }

        container.innerHTML = `
            <div class="grid">
                <div class="flex-col" style="grid-column: span 2;">
                    ${createGlassCard(_i18n_t('admin.platformOverview','Platform Overview'), `
                        ${createStatRow([
                            { num: totalStudents, label: _i18n_t('teacher.totalStudents','Total Students'), color: '#93C5FD' },
                            { num: activeTeachers, label: _i18n_t('admin.activeTeachers','Active Teachers'), color: '#C4B5FD' },
                            { num: pendingApprovals, label: _i18n_t('admin.pendingApprovals','Pending Approvals'), color: '#FF9B9B' },
                            { num: openReports, label: _i18n_t('admin.openReports','Open Reports'), color: '#FDE68A' }
                        ])}
                    `, '', 0.05)}
                </div>
                <div class="flex-col" style="grid-column: span 2;">
                    ${createGlassCard(_i18n_t('admin.platformHealth','Platform Health'), healthBody, '', 0.05)}
                </div>
            </div>
        `;
    } catch (err) {
        console.error('[adminDashboard]', err);
        container.innerHTML = `
            <div class="grid">
                <div class="flex-col" style="grid-column: span 2;">
                    ${createGlassCard(_i18n_t('admin.platformOverview','Platform Overview'), createEmptyState(_i18n_t('admin.failedToLoad','Failed to load stats'), err.message, '⚠️'), '', 0.05)}
                </div>
            </div>
        `;
    }
}
