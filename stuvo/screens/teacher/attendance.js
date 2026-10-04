async function renderTeacherAttendance(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;
    let classes = [];
    let selectedClassId = null;
    let roster = [];
    let marks = {};

    function today() {
        return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.attendance','Attendance'), _i18n_t('teacher.attendanceSub','Mark attendance for today'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            classes = rows;
        } catch (err) {
            console.error('[teacherAttendance classes]', err);
            showToast(_i18n_t('teacher.failedToLoadClasses','Failed to load classes from Firestore.'), 'error');
            classes = [];
        }

        if (classes.length > 0 && !selectedClassId) selectedClassId = classes[0].id;
        await loadRoster();
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
                    console.error('[teacherAttendance roster]', err);
                }
            }

            try {
                const attSnap = await getDoc(doc(db, 'classes', selectedClassId, 'attendance', todayStr()));
                if (attSnap.exists) {
                    const recs = attSnap.data().records || {};
                    roster.forEach(s => { if (recs[s.id]) marks[s.id] = recs[s.id] === 'present'; });
                }
            } catch (err) {
                console.error('[teacherAttendance loadMarks]', err);
            }
            // Bulk default: any student without a saved status starts as Present.
            // Fresh class/date (no saved doc) => all-present. Editing existing =>
            // saved values kept, newly-added students default to present.
            roster.forEach(s => { if (!(s.id in marks)) marks[s.id] = true; });
        }
        render();
    }

    function render() {
        if (classes.length === 0) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.attendance','Attendance'), _i18n_t('teacher.attendanceSub','Mark attendance for today'))}
                    <div class="glass-card">${createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassAttendanceSub','Create a class first to mark attendance.'), '🏫')}</div>
                </div>
            `;
            return;
        }

        const selectedClass = classes.find(c => c.id === selectedClassId);
        const presentCount = roster.filter(s => marks[s.id]).length;
        const absentCount = roster.length - presentCount;

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.attendance','Attendance'), _i18n_t('teacher.attendanceSub','Mark attendance for today'))}

                <div class="glass-card">
                    <div class="card-header" style="margin-bottom:16px;">
                        <div>
                            <div class="card-title">${selectedClass.name || _i18n_t('testReports.class','Class')} · ${today()}</div>
                            <div class="hw-sub" id="attendance-counter">${_i18n_t('teacher.presentAbsentCount', { present: presentCount, absent: absentCount })}</div>
                        </div>
                        <select class="form-control" id="class-select" style="width:auto;padding:8px 12px;">
                            ${classes.map(c => `
                                <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>
                            `).join('')}
                        </select>
                    </div>

                    ${roster.length === 0
                        ? createEmptyState(_i18n_t('teacher.noStudents','No students in this class'), _i18n_t('teacher.noStudentsSub','Add students by username from the class page.'), '👥')
                        : `<button class="btn btn-secondary" id="btn-mark-all-present" style="width:100%;margin-bottom:12px;">${_i18n_t('teacher.markAllPresent','Mark All Present')}</button>
                        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
                            ${roster.map((s, i) => `
                                <div class="roster-item" style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                                    background:rgba(255,255,255,0.03);border-radius:10px;">
                                    <div style="flex:1;font-size:14px;font-weight:500;">${_escapeHtml(s.name)}</div>
                                    <button class="btn btn-sm ${marks[s.id] ? '' : 'btn-secondary'}"
                                        id="toggle-${s.id}" data-id="${s.id}" data-toggle="1"
                                        style="margin-top:0;width:92px;">
                                        ${marks[s.id] ? '✓ ' + _i18n_t('attendance.present','Present') : '✗ ' + _i18n_t('attendance.absent','Absent')}
                                    </button>
                                </div>
                            `).join('')}
                        </div>`
                    }

                    <button class="btn" id="btn-save-attendance" style="width:100%;" ${roster.length === 0 ? 'disabled' : ''}>${_i18n_t('teacher.saveAttendanceBtn','Save Attendance')}</button>
                </div>
            </div>
        `;

        container.querySelector('#class-select').addEventListener('change', async e => {
            selectedClassId = e.target.value;
            await loadRoster();
        });

        container.querySelectorAll('[data-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                marks[id] = !marks[id];
                render();
            });
        });

        const markAllBtn = container.querySelector('#btn-mark-all-present');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                roster.forEach(s => { marks[s.id] = true; });
                render();
            });
        }

        container.querySelector('#btn-save-attendance').addEventListener('click', async () => {
            const btn = container.querySelector('#btn-save-attendance');
            btn.disabled = true;
            btn.textContent = 'Saving…';
            const records = {};
            roster.forEach(s => { records[s.id] = marks[s.id] ? 'present' : 'absent'; });
            try {
                await setDoc(doc(db, 'classes', selectedClassId, 'attendance', todayStr()), {
                    records,
                    markedBy: uid,
                    createdAt: serverTimestamp(),
                });
                showToast(`Attendance saved for ${selectedClass.name} ✅`, 'success');
                render();
            } catch (err) {
                console.error('[teacherAttendance save]', err);
                showToast(`Failed to save attendance: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'Save Attendance';
            }
        });
    }

    await load();
}