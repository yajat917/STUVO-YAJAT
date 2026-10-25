function todayStr() {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function renderTeacherClasses(container) {
    const uid = appState.user?.uid;
    let classes = [];

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('teacher.myClasses','My Classes'), _i18n_t('teacher.myClassesSub','Classes you teach this term'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            classes = rows;
        } catch (err) {
            console.error('[teacherClasses]', err);
            showToast(_i18n_t('teacher.failedToLoadClasses','Failed to load classes from Firestore.'), 'error');
            classes = [];
        }

        render();
    }

    async function computeStats(c) {
        const studentIds = c.studentIds || [];
        let present = null;
        let avgPct = null;
        try {
            const attSnap = await getDoc(doc(db, 'classes', c.id, 'attendance', todayStr()));
            if (attSnap.exists) {
                const recs = attSnap.data().records || {};
                const vals = Object.values(recs);
                present = vals.filter(v => v === 'present').length;
            }
            const trSnap = await getDocs(collection(db, 'classes', c.id, 'testReports'));
            const entries = [];
            trSnap.forEach(d => {
                const r = d.data();
                const max = Number(r.maxMarks) || 0;
                const mark = Number(r.marks);
                if (max > 0 && !isNaN(mark)) entries.push(mark / max * 100);
            });
            if (entries.length) avgPct = Math.round(entries.reduce((s, x) => s + x, 0) / entries.length);
        } catch (err) {
            console.error('[teacherClasses stats]', err);
        }
        return { present, avgPct };
    }

    function render() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('teacher.myClasses','My Classes'), _i18n_t('teacher.myClassesSub','Classes you teach this term'))}

                <div class="glass-card">
                    <div class="card-label">➕ ${_i18n_t('teacher.createClass','Create Class')}</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>${_i18n_t('teacher.classNameLabel','Class Name')}</label>
                            <input type="text" class="form-control" id="cls-name" placeholder="${_i18n_t('teacher.classNamePlaceholder','e.g. 10-A')}">
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.subjectLabel','Subject')}</label>
                            <select class="form-control" id="cls-subject">
                                <option>Mathematics</option><option>Physics</option><option>Chemistry</option>
                                <option>Biology</option><option>English</option><option>History</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.roomLabel','Room')}</label>
                            <input type="text" class="form-control" id="cls-room" placeholder="${_i18n_t('teacher.roomPlaceholder','e.g. Room 204')}">
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.scheduleLabel','Schedule')}</label>
                            <input type="text" class="form-control" id="cls-schedule" placeholder="${_i18n_t('teacher.schedulePlaceholder','e.g. Mon · Wed · Fri')}">
                        </div>
                    </div>
                    <button class="btn" id="btn-create-class" style="margin-top:0;">${_i18n_t('teacher.createClass','Create Class')}</button>
                </div>

                ${classes.length === 0
                    ? `<div class="glass-card">${createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassGenericSub','Create your first class above.'), '🏫')}</div>`
                    : `<div class="grid-cols-3">
                        ${classes.map((c, i) => `
                            <a href="#/teacher/class-detail?classId=${c.id}" style="text-decoration:none;color:inherit;display:block;">
                                <div class="glass-card" style="cursor:pointer;">
                                    <div class="card-header" style="margin-bottom:14px;">
                                        <div>
                                            <div style="font-family:'Sora',sans-serif;font-size:20px;font-weight:800;color:#C4B5FD;">${c.name || _i18n_t('teacher.unnamedClass','Unnamed Class')}</div>
                                            <div class="hw-sub">${c.subject || ','}</div>
                                        </div>
                                        ${createBadge(c.room || _i18n_t('teacher.noRoom','No room'), 'blue')}
                                    </div>
                                    <div class="divider" style="margin:10px 0;"></div>
                                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">
                                        <span style="color:var(--text-dim);">👥 ${_i18n_t('teacher.studentsLabel','Students')}</span>
                                        <span style="font-weight:600;">${(c.studentIds || []).length}</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;font-size:13px;">
                                        <span style="color:var(--text-dim);">🗓 _i18n_t('teacher.scheduleLabel2','Schedule')</span>
                                        <span style="font-weight:600;">${c.schedule || ','}</span>
                                    </div>
                                </div>
                            </a>
                        `).join('')}
                    </div>`
                }

                ${createGlassCard(_i18n_t('teacher.rosterOverview','Roster Overview'), `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>${_i18n_t('teacher.classCol','Class')}</th><th>${_i18n_t('teacher.subjectCol','Subject')}</th><th>${_i18n_t('teacher.studentsCol','Students')}</th><th>${_i18n_t('teacher.presentTodayCol','Present Today')}</th><th>${_i18n_t('teacher.avgPerfCol','Avg. Performance')}</th></tr>
                            </thead>
                            <tbody>
                                ${classes.map(c => `
                                    <tr>
                                        <td><span style="font-weight:600;">${c.name || _i18n_t('teacher.unnamedClass','Unnamed Class')}</span></td>
                                        <td>${c.subject || ','}</td>
                                        <td>${(c.studentIds || []).length}</td>
                                        <td style="color:#6EE7B7;">${c._present === null ? ',' : `${c._present}/${(c.studentIds || []).length}`}</td>
                                        <td>${c._avgPct === null ? ',' : `${c._avgPct}%`}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `, '', 0.2)}
            </div>
        `;

        container.querySelector('#btn-create-class').addEventListener('click', async () => {
            const name = container.querySelector('#cls-name').value.trim();
            if (!name) { showToast(_i18n_t('teacher.classNameRequired','Class name is required.'), 'error'); return; }
            const subject = container.querySelector('#cls-subject').value;
            const room = container.querySelector('#cls-room').value.trim();
            const schedule = container.querySelector('#cls-schedule').value.trim();
            const btn = container.querySelector('#btn-create-class');
            btn.disabled = true;
            btn.textContent = _i18n_t('teacher.creating','Creating…');
            try {
                await addDoc(collection(db, 'classes'), {
                    name, subject, room, schedule,
                    teacherId: uid,
                    studentIds: [],
                    createdAt: serverTimestamp(),
                });
                showToast(_i18n_t('teacher.classCreated','Class created') + ' ✅', 'success');
                load();
            } catch (err) {
                console.error('[teacherClasses create]', err);
                showToast(`${_i18n_t('teacher.createClassFailed','Failed to create class')}: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = _i18n_t('teacher.createClass','Create Class');
            }
        });
    }

    await load();
    const stats = await Promise.all(classes.map(computeStats));
    classes.forEach((c, i) => {
        c._present = stats[i].present;
        c._avgPct = stats[i].avgPct;
    });
    render();
}