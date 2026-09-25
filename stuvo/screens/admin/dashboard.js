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