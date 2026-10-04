function reportGrade(pct) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
}

async function renderTeacherTestReports(container) {
    const uid = appState.user?.uid;
    let classes = [];
    let selectedClassId = null;
    let roster = [];
    let marks = {};
    let reports = [];

    function fmtDate(ts) {
        if (!ts) return ',';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return isNaN(d) ? ',' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.testReports','Test Reports'), _i18n_t('teacher.testReportsSub','Publish marks and results for your classes'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            classes = rows;
        } catch (err) {
            console.error('[teacherReports classes]', err);
            showToast(_i18n_t('teacher.failedToLoadClasses','Failed to load classes from Firestore.'), 'error');
            classes = [];
        }

        if (classes.length > 0 && !selectedClassId) selectedClassId = classes[0].id;
        await loadRoster();
        await loadReports();
    }

    async function loadRoster() {
        roster = [];
        marks = {};
        if (selectedClassId) {
            const cls = classes.find(c => c.id === selectedClassId);
            const ids = cls?.studentIds || [];
            for (const sid of ids) {
                try {
                    const us = await getDoc(doc(db, 'users', sid));
                    if (us.exists) {
                        const u = us.data();
                        roster.push({ id: sid, name: u.officialName || `@${u.username || sid}` });
                    }
                } catch (err) {
                    console.error('[teacherReports roster]', err);
                }
            }
        }
    }

    async function loadReports() {
        reports = [];
        if (selectedClassId) {
            try {
                const snap = await getDocs(collection(db, 'classes', selectedClassId, 'testReports'));
                const rows = [];
                snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
                reports = rows.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
            } catch (err) {
                console.error('[teacherReports list]', err);
                showToast(_i18n_t('teacher.failedReports','Failed to load test reports from Firestore.'), 'error');
            }
        }
        render();
    }

    function reportPct(r) {
        const max = Number(r.maxMarks) || 0;
        const mark = Number(r.marks);
        if (!max || isNaN(mark) || mark < 0) return null;
        return { mark, pct: Math.round(mark / max * 100) };
    }

    function render() {
        if (classes.length === 0) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.testReports','Test Reports'), _i18n_t('teacher.testReportsSub','Publish marks and results for your classes'))}
                    <div class="glass-card">${createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassReportsSub','Create a class first to publish test reports.'), '🏫')}</div>
                </div>
            `;
            return;
        }

        const selectedClass = classes.find(c => c.id === selectedClassId);
        const pcts = reports.map(reportPct).filter(Boolean);
        const avgPct = pcts.length ? Math.round(pcts.reduce((s, r) => s + r.pct, 0) / pcts.length) : 0;
        const avgMark = pcts.length ? Math.round(pcts.reduce((s, r) => s + r.mark, 0) / pcts.length * 10) / 10 : 0;

        const testNames = [...new Set(reports.map(r => r.testName).filter(Boolean))];
        const testRows = testNames.map(name => {
            const items = reports.filter(r => r.testName === name);
            const first = items[0];
            const avg = items.map(reportPct).filter(Boolean);
            const testAvg = avg.length ? Math.round(avg.reduce((s, r) => s + r.pct, 0) / avg.length) : 0;
            return { name, subject: first?.subject || ',', count: items.length, avg: testAvg, date: first?.createdAt };
        });

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.testReports','Test Reports'), _i18n_t('teacher.testReportsSub','Publish marks and results for your classes'))}

                <div class="grid-cols-3">
                    ${createGlassCard('', `<div class="stat-num" style="color:#C4B5FD;">${testNames.length}</div><div class="stat-label">${_i18n_t('teacher.testsPublished','Tests Published')}</div>`, '', 0.05)}
                    ${createGlassCard('', `<div class="stat-num" style="color:#6EE7B7;">${avgPct}%</div><div class="stat-label">${_i18n_t('teacher.classAverage','Class Average')}</div>`, '', 0.1)}
                    ${createGlassCard('', `<div class="stat-num" style="color:#FDE68A;">${avgMark}</div><div class="stat-label">${_i18n_t('teacher.avgMarksLabel','Avg. Marks')}</div>`, '', 0.15)}
                </div>

                <div class="glass-card">
                    <div class="card-label">📊 New Test Report</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>${_i18n_t('teacher.classLabel','Class')}</label>
                            <select class="form-control" id="rep-class">
                                ${classes.map(c => `
                                    <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.subjectLabel','Subject')}</label>
                            <select class="form-control" id="rep-subject">
                                <option>Mathematics</option><option>Physics</option><option>Chemistry</option>
                                <option>Biology</option><option>English</option><option>History</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>${_i18n_t('teacher.testNameLabel','Test Name')}</label>
                            <input type="text" class="form-control" id="rep-name" placeholder="e.g. Chapter 5 Unit Test">
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.maxMarksLabel','Max Marks')}</label>
                            <input type="number" class="form-control" id="rep-max" min="1" max="200" value="50">
                        </div>
                    </div>

                    <div style="margin-top:8px;">
                        <div class="hw-sub" style="margin-bottom:8px;">Enter marks for each student in ${selectedClass.name}</div>
                        ${roster.length === 0
                            ? createEmptyState(_i18n_t('teacher.noStudents','No students in this class'), _i18n_t('teacher.noStudentsSub','Add students by username from the class page.'), '👥')
                            : `<div style="display:flex;flex-direction:column;gap:6px;">
                                ${roster.map(s => `
                                    <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;
                                        background:rgba(255,255,255,0.03);border-radius:10px;">
                                        <div style="flex:1;font-size:14px;font-weight:500;">${_escapeHtml(s.name)}</div>
                                        <input type="number" class="form-control" min="0" max="200"
                                            data-mark="${s.id}" value="${marks[s.id] !== undefined ? marks[s.id] : ''}"
                                            placeholder="${_i18n_t('teacher.markPlaceholder','Mark')}" style="width:110px;padding:8px 10px;">
                                    </div>
                                `).join('')}
                            </div>`
                        }
                    </div>

                    <button class="btn" id="btn-add-report" style="margin-top:16px;" ${roster.length === 0 ? 'disabled' : ''}>${_i18n_t('teacher.publishReport','Publish Report')}</button>
                </div>

                ${createGlassCard('Published Reports', `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>${_i18n_t('teacher.classLabel','Class')}</th><th>${_i18n_t('teacher.testCol','Test')}</th><th>${_i18n_t('teacher.subjectLabel','Subject')}</th><th>${_i18n_t('teacher.avgScoreCol','Avg Score')}</th><th>${_i18n_t('teacher.studentsLabel','Students')}</th><th>${_i18n_t('teacher.dateCol','Date')}</th><th>${_i18n_t('teacher.statusCol','Status')}</th></tr>
                            </thead>
                            <tbody>
                                ${testRows.length === 0
                                    ? `<tr><td colspan="7">${createEmptyState(_i18n_t('testReports.noReports','No reports added yet'), '', '📊')}</td></tr>`
                                    : testRows.map(r => `
                                        <tr>
                                            <td><span style="font-weight:600;">${_escapeHtml(selectedClass.name)}</span></td>
                                            <td>${_escapeHtml(r.name)}</td>
                                            <td>${_escapeHtml(r.subject)}</td>
                                            <td><span style="font-weight:600;">${r.avg}%</span></td>
                                            <td>${r.count}</td>
                                            <td>${fmtDate(r.date)}</td>
                                            <td>${createBadge('Published', 'green')}</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>
                `, '', 0.25)}
            </div>
        `;

        container.querySelector('#rep-class').addEventListener('change', async e => {
            selectedClassId = e.target.value;
            await loadRoster();
            await loadReports();
        });

        container.querySelectorAll('[data-mark]').forEach(input => {
            input.addEventListener('input', () => {
                marks[input.dataset.mark] = input.value;
            });
        });

        container.querySelector('#btn-add-report').addEventListener('click', async () => {
            const name = container.querySelector('#rep-name').value.trim();
            if (!name) { showToast(_i18n_t('teacher.enterTestName','Enter a test name.'), 'error'); return; }
            const subject = container.querySelector('#rep-subject').value;
            const max = Number(container.querySelector('#rep-max').value) || 0;
            if (max <= 0) { showToast(_i18n_t('teacher.enterMaxMarks','Enter a valid max marks value.'), 'error'); return; }

            const entries = [];
            roster.forEach(s => {
                const v = String(marks[s.id] ?? '').trim();
                if (v !== '') entries.push({ studentId: s.id, studentName: s.name, marks: Number(v) });
            });
            if (entries.length === 0) { showToast(_i18n_t('teacher.enterMarks','Enter at least one student mark.'), 'error'); return; }

            const btn = container.querySelector('#btn-add-report');
            btn.disabled = true;
            btn.textContent = 'Publishing…';
            try {
                for (const e of entries) {
                    await addDoc(collection(db, 'classes', selectedClassId, 'testReports'), {
                        studentId: e.studentId,
                        studentName: e.studentName,
                        testName: name,
                        subject,
                        marks: e.marks,
                        maxMarks: max,
                        grade: reportGrade(e.marks / max * 100),
                        createdBy: uid,
                        createdAt: serverTimestamp(),
                    });
                }
                showToast(`Report published for ${entries.length} student${entries.length === 1 ? '' : 's'} ✅`, 'success');
                container.querySelector('#rep-name').value = '';
                marks = {};
                await loadReports();
            } catch (err) {
                console.error('[teacherReports create]', err);
                showToast(`Failed to publish report: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'Publish Report';
            }
        });
    }

    await load();
}