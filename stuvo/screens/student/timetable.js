const STUDENT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
const TODAY_IDX = new Date().getDay() === 0 ? -1 : Math.min(new Date().getDay() - 1, 5); // 0=Mon … 5=Sat, -1 on Sunday

const STUDENT_SUBJECT_COLORS = {
    'Mathematics': '#7C5CFC', 'Physics': '#4F8CFF', 'Chemistry': '#10B981',
    'English': '#F59E0B', 'History': '#EF4444', 'Biology': '#8B5CF6',
    [_i18n_t('timetable.freeStudy','Revision / Free Study')]: '#6B7280',
};

async function renderStudentTimetable(container) {
    const classIds = appState.userData?.classIds || [];

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.timetable','Timetable'), _i18n_t('timetable.subtitle','Read-only: managed by your teachers'))}
            ${createSkeleton(3)}
        </div>
    `;

    const slots = [];
    for (const classId of classIds) {
        try {
            const classSnap = await getDoc(doc(db, 'classes', classId));
            const className = classSnap.exists ? (classSnap.data().name || _i18n_t('testReports.class','Class')) : _i18n_t('testReports.class','Class');
            const ttSnap = await getDocs(collection(db, 'classes', classId, 'timetable'));
            ttSnap.forEach(d => {
                const s = d.data();
                slots.push({ id: d.id, className, day: s.day, startTime: s.startTime, endTime: s.endTime, subject: s.subject });
            });
        } catch (err) {
            console.error('[studentTimetable load]', err);
        }
    }

    const slotsByDay = {};
    STUDENT_DAYS.forEach(d => slotsByDay[d] = []);
    slots.forEach(s => { if (slotsByDay[s.day]) slotsByDay[s.day].push(s); });
    const allTimes = [...new Set(slots.map(s => s.startTime))].sort();

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.timetable','Timetable'), _i18n_t('timetable.subtitle','Read-only: managed by your teachers'))}

            ${createGlassCard(_i18n_t('timetable.weeklySchedule','Weekly Schedule'), `
                ${slots.length === 0
                    ? createEmptyState(_i18n_t('timetable.noTimetable','No timetable published yet'), _i18n_t('timetable.noTimetableSub','Your teachers will add classes here.'), '🕐')
                    : `<div style="overflow-x:auto;">
                        <div style="display:grid;grid-template-columns:80px repeat(6,1fr);gap:8px;min-width:700px;">
                            <div></div>
                            ${STUDENT_DAYS.map((d, i) => `
                                <div style="text-align:center;padding:10px 6px;border-radius:10px;
                                    font-size:12px;font-weight:600;
                                    ${i === TODAY_IDX
                                        ? 'background:linear-gradient(135deg,rgba(124,92,252,0.3),rgba(79,140,255,0.2));color:#C4B5FD;border:1px solid rgba(124,92,252,0.4);'
                                        : 'color:var(--text-dim);'}">
                                    ${d.slice(0,3).toUpperCase()}
                                    ${i === TODAY_IDX ? '<br><span style="font-size:10px;opacity:0.8;">' + _i18n_t('timetable.today','Today') + '</span>' : ''}
                                </div>
                            `).join('')}
                            ${generateStudentTimeRows(slotsByDay, allTimes)}
                        </div>
                    </div>`
                }
            `, '', 0.05)}

            ${createGlassCard('📅 Upcoming Exams & Deadlines', `
                ${createEmptyState(_i18n_t('timetable.noExams','No upcoming exams scheduled'), _i18n_t('timetable.noExamsSub','Exam dates set by your school will appear here.'), '📅')}
            `, '', 0.15)}
        </div>
    `;

}

function generateStudentTimeRows(slotsByDay, allTimes) {
    return allTimes.map(time => {
        const timeLabel = formatStudentTime(time);
        const cells = STUDENT_DAYS.map((day, i) => {
            const slot = (slotsByDay[day] || []).find(s => s.startTime === time);
            const color = slot ? (STUDENT_SUBJECT_COLORS[slot.subject] || '#7C5CFC') : null;
            return slot ? `
                <div style="border-radius:10px;padding:10px 8px;text-align:center;
                    background:${color}22;border:1px solid ${color}55;
                    ${i === TODAY_IDX ? 'box-shadow:0 0 12px ' + color + '30;' : ''}">
                    <div style="font-size:12px;font-weight:600;color:${color};">${_escapeHtml(slot.subject)}</div>
                    <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${slot.startTime}–${slot.endTime} · ${_escapeHtml(slot.className) || ''}</div>
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

function formatStudentTime(t) {
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`;
}