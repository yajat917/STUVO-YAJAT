var TEACHER_DAYS = typeof TEACHER_DAYS !== 'undefined' ? TEACHER_DAYS : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');

var TEACHER_SUBJECT_COLORS = typeof TEACHER_SUBJECT_COLORS !== 'undefined' ? TEACHER_SUBJECT_COLORS : {
    'Physics': '#4F8CFF', 'Mathematics': '#7C5CFC', 'Chemistry': '#10B981',
    'Biology': '#8B5CF6', 'English': '#F59E0B', 'History': '#EF4444',
};

async function renderTeacherTimetable(container) {
    const uid = appState.user?.uid;
    let classes = [];
    let selectedClassId = null;
    let slots = [];

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.timetable','Timetable'), _i18n_t('teacher.timetableSub','Your weekly teaching schedule'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            classes = rows;
        } catch (err) {
            console.error('[teacherTimetable classes]', err);
            showToast(_i18n_t('teacher.failedToLoadClasses','Failed to load classes from Firestore.'), 'error');
            classes = [];
        }

        if (classes.length > 0 && !selectedClassId) selectedClassId = classes[0].id;
        await loadSlots();
    }

    async function loadSlots() {
        slots = [];
        if (selectedClassId) {
            try {
                const snap = await getDocs(collection(db, 'classes', selectedClassId, 'timetable'));
                const rows = [];
                snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
                slots = rows;
            } catch (err) {
                console.error('[teacherTimetable list]', err);
                showToast(_i18n_t('teacher.failedTimetable','Failed to load timetable from Firestore.'), 'error');
            }
        }
        render();
    }

    function render() {
        if (classes.length === 0) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.timetable','Timetable'), _i18n_t('teacher.timetableSub','Your weekly teaching schedule'))}
                    <div class="glass-card">${createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassTimetableSub','Create a class first to build a timetable.'), '🏫')}</div>
                </div>
            `;
            return;
        }

        const selectedClass = classes.find(c => c.id === selectedClassId);
        const slotsByDay = {};
        TEACHER_DAYS.forEach(d => slotsByDay[d] = []);
        slots.forEach(s => { if (slotsByDay[s.day]) slotsByDay[s.day].push(s); });

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.timetable','Timetable'), _i18n_t('teacher.timetableSub','Your weekly teaching schedule'))}

                <div class="glass-card">
                    <div class="card-label">➕ Add Class Slot</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>${_i18n_t('teacher.dayLabel','Day')}</label>
                            <select class="form-control" id="slot-day">
                                ${TEACHER_DAYS.map(d => `<option>${d}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.classLabel','Class')}</label>
                            <select class="form-control" id="slot-class">
                                ${classes.map(c => `
                                    <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.subjectLabel','Subject')}</label>
                            <select class="form-control" id="slot-subject">
                                <option>Physics</option><option>Mathematics</option><option>Chemistry</option>
                                <option>Biology</option><option>English</option><option>History</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.startLabel','Start')}</label>
                            <input type="time" class="form-control" id="slot-start" value="09:00">
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.endLabel','End')}</label>
                            <input type="time" class="form-control" id="slot-end" value="09:45">
                        </div>
                    </div>
                    <button class="btn" id="btn-add-slot" style="margin-top:0;">${_i18n_t('teacher.addSlotBtn','Add Slot')}</button>
                </div>

                ${createGlassCard(_i18n_t('timetable.weeklySchedule','Weekly Schedule'), `
                    <div style="overflow-x:auto;">
                        <div style="display:grid;grid-template-columns:80px repeat(6,1fr);gap:8px;min-width:700px;">
                            <div></div>
                            ${TEACHER_DAYS.map(d => `
                                <div style="text-align:center;padding:10px 6px;border-radius:10px;
                                    font-size:12px;font-weight:600;color:var(--text-dim);">
                                    ${d.slice(0, 3).toUpperCase()}
                                </div>
                            `).join('')}
                            ${generateTeacherTimeRows(slotsByDay)}
                        </div>
                    </div>
                `, '', 0.1)}

                ${slots.length === 0
                    ? `<div class="glass-card">${createEmptyState('No slots yet', 'Add the first teaching slot for ' + (selectedClass.name || 'this class') + '.', '🕐')}</div>`
                    : `<div style="display:flex;flex-direction:column;gap:10px;">
                        ${slots.map((s, i) => `
                            <div class="glass-card">
                                <div class="card-header">
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:14px;font-weight:600;color:${TEACHER_SUBJECT_COLORS[s.subject] || '#7C5CFC'};">${s.subject}</div>
                                        <div class="hw-sub">${selectedClass.name} · ${s.day} · ${s.startTime}–${s.endTime}</div>
                                    </div>
                                    <button class="btn btn-secondary btn-sm" data-del="${s.id}" style="margin-top:0;">${_i18n_t('teacher.removeStudent','Remove')}</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;

        container.querySelector('#slot-class').addEventListener('change', async e => {
            selectedClassId = e.target.value;
            await loadSlots();
        });

        container.querySelector('#btn-add-slot').addEventListener('click', async () => {
            const day = container.querySelector('#slot-day').value;
            const subject = container.querySelector('#slot-subject').value;
            const start = container.querySelector('#slot-start').value;
            const end = container.querySelector('#slot-end').value;
            if (!start || !end) { showToast(_i18n_t('teacher.selectTimes','Select start and end times.'), 'error'); return; }

            const btn = container.querySelector('#btn-add-slot');
            btn.disabled = true;
            btn.textContent = 'Adding…';
            try {
                await addDoc(collection(db, 'classes', selectedClassId, 'timetable'), {
                    day, startTime: start, endTime: end, subject,
                    createdBy: uid,
                });
                showToast(_i18n_t('teacher.slotAdded','Slot added') + ' ✅', 'success');
                await loadSlots();
            } catch (err) {
                console.error('[teacherTimetable add]', err);
                showToast(`Failed to add slot: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'Add Slot';
            }
        });

        container.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.del;
                btn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'classes', selectedClassId, 'timetable', id));
                    showToast(_i18n_t('teacher.slotRemoved','Slot removed.'), 'success');
                    await loadSlots();
                } catch (err) {
                    console.error('[teacherTimetable delete]', err);
                    showToast(`Failed to remove slot: ${err.message}`, 'error');
                    btn.disabled = false;
                }
            });
        });
    }

    await load();
}

function generateTeacherTimeRows(slotsByDay) {
    const allTimes = [...new Set(slotsByDay && Object.values(slotsByDay).flat().map(s => s.startTime))].sort();
    return allTimes.map(time => {
        const timeLabel = formatTeacherTime(time);
        const cells = TEACHER_DAYS.map(day => {
            const slot = (slotsByDay[day] || []).find(s => s.startTime === time);
            const color = slot ? (TEACHER_SUBJECT_COLORS[slot.subject] || '#7C5CFC') : null;
            return slot ? `
                <div style="border-radius:10px;padding:10px 8px;text-align:center;
                    background:${color}22;border:1px solid ${color}55;">
                    <div style="font-size:12px;font-weight:600;color:${color};">${slot.subject}</div>
                    <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${slot.startTime}–${slot.endTime}</div>
                </div>
            ` : `<div style="border-radius:10px;background:rgba(255,255,255,0.02);
                    border:1px dashed rgba(255,255,255,0.06);min-height:54px;"></div>`;
        }).join('');

        return `
            <div style="font-size:11px;color:var(--text-dim);text-align:right;
                padding-right:10px;display:flex;align-items:center;justify-content:flex-end;">
                ${timeLabel}
            </div>
            ${cells}
        `;
    }).join('');
}

var formatTeacherTime = typeof formatTeacherTime !== 'undefined' ? formatTeacherTime : function(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`;
};