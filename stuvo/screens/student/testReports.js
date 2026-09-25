const GRADE_COLOR = { 'A+': 'green', 'A': 'green', 'B+': 'blue', 'B': 'blue', 'C': 'yellow', 'D': 'red' };
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');

async function renderStudentTestReports(container) {
    const uid = appState.user?.uid;
    const classIds = appState.userData?.classIds || [];

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.testReports','Test Reports'), _i18n_t('timetable.subtitle','Read-only — managed by your teachers'))}
            ${createSkeleton(3)}
        </div>
    `;

    const reports = [];
    for (const classId of classIds) {
        try {
            const classSnap = await getDoc(doc(db, 'classes', classId));
            const className = classSnap.exists ? (classSnap.data().name || _i18n_t('testReports.class','Class')) : _i18n_t('testReports.class','Class');
            const repSnap = await getDocs(query(collection(db, 'classes', classId, 'testReports'), where('studentId', '==', uid)));
            repSnap.forEach(d => {
                const r = d.data();
                reports.push({ id: d.id, className, ...r });
            });
        } catch (err) {
            console.error('[studentTestReports load]', err);
        }
    }
    reports.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    function fmtDate(r) {
        const ts = r.createdAt;
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function pct(r) {
        const max = Number(r.maxMarks) || 0;
        const mark = Number(r.marks);
        if (!max || isNaN(mark)) return 0;
        return Math.round(mark / max * 100);
    }

    let filterSubject = 'All';
    const subjects = ['All', ...new Set(reports.map(r => r.subject).filter(Boolean))];

    function render() {
        const filtered = filterSubject === 'All' ? reports : reports.filter(r => r.subject === filterSubject);
        const withPct = filtered.map(pct);
        const avg = withPct.length ? Math.round(withPct.reduce((s, v) => s + v, 0) / withPct.length) : 0;
        const aGrades = filtered.filter(r => (r.grade || '').startsWith('A')).length;

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.testReports','Test Reports'), _i18n_t('timetable.subtitle','Read-only — managed by your teachers'))}

                <div class="grid-cols-3">
                    ${createGlassCard('', `<div class="stat-num" style="color:#C4B5FD;">${filtered.length}</div><div class="stat-label">${_i18n_t('testReports.testsTaken','Tests Taken')}</div>`, '', 0.05)}
                    ${createGlassCard('', `<div class="stat-num" style="color:#6EE7B7;">${avg}%</div><div class="stat-label">${_i18n_t('testReports.averageScore','Average Score')}</div>`, '', 0.1)}
                    ${createGlassCard('', `<div class="stat-num" style="color:#FDE68A;">${aGrades}</div><div class="stat-label">${_i18n_t('testReports.aGradeTests','A-Grade Tests')}</div>`, '', 0.15)}
                </div>

                ${createGlassCard('', `
                    <div class="card-header" style="margin-bottom:16px;">
                        <div class="card-title">${_i18n_t('testReports.allReports','All Reports')}</div>
                        ${subjects.length > 1 ? `<select class="form-control" id="subject-filter" style="width:auto;padding:8px 12px;">
                            ${subjects.map(s => `<option value="${_escapeHtml(s)}" ${s === filterSubject ? 'selected' : ''}>${_escapeHtml(s)}</option>`).join('')}
                        </select>` : ''}
                    </div>
                    ${filtered.length === 0
                        ? createEmptyState(_i18n_t('testReports.noReports','No reports added yet'), _i18n_t('testReports.noReportsSub','Reports published by your teachers will appear here.'), '📊')
                        : createTable(
                            [_i18n_t('studyHub.subject','Subject'), _i18n_t('testReports.testName','Test Name'), 'Score', 'Grade', _i18n_t('testReports.date','Date'), _i18n_t('testReports.class','Class')],
                            filtered.map(r => [
                                _escapeHtml(r.subject) || '—',
                                _escapeHtml(r.testName) || '—',
                                `<span style="font-weight:600;">${r.marks}/${r.maxMarks}</span>
                                 <span style="color:var(--text-dim);font-size:11px;"> (${pct(r)}%)</span>`,
                                createBadge(r.grade || '—', GRADE_COLOR[r.grade] || 'gray'),
                                fmtDate(r),
                                _escapeHtml(r.className) || ''
                            ])
                        )}
                `, '', 0.2)}
            </div>
        `;

        const filterEl = container.querySelector('#subject-filter');
        if (filterEl) {
            filterEl.addEventListener('change', e => {
                filterSubject = e.target.value;
                render();
            });
        }
    }

    render();
}