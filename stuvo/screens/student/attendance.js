async function renderStudentAttendance(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;
    const classIds = appState.userData?.classIds || [];
    const now = new Date();
    const year = now.getFullYear();
    const monthIdx = now.getMonth();
    const today = now.getDate();
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.attendance','Attendance'), _i18n_t('attendance.subtitle','Your attendance record for this month'))}
            ${createSkeleton(3)}
        </div>
    `;

    const records = {}; // dayNumber -> 'present' | 'absent'  (aggregated across classes)

    for (const classId of classIds) {
        try {
            const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const ds = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                try {
                    const attSnap = await getDoc(doc(db, 'classes', classId, 'attendance', ds));
                    if (attSnap.exists) {
                        const recs = attSnap.data().records || {};
                        if (recs[uid]) {
                            // Present overrides absent if multiple classes marked the same day
                            if (!records[day] || recs[uid] === 'present') records[day] = recs[uid];
                        }
                    }
                } catch (err) {
                    console.error('[studentAttendance day]', err);
                }
            }
        } catch (err) {
            console.error('[studentAttendance class]', err);
        }
    }

    const presentCount = Object.values(records).filter(v => v === 'present').length;
    const absentCount = Object.values(records).filter(v => v === 'absent').length;
    const total = presentCount + absentCount;
    const pct = total ? Math.round((presentCount / total) * 100) : 0;

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const firstDay = new Date(year, monthIdx, 1).getDay();
    const dayCells = [];
    for (let i = 0; i < firstDay; i++) dayCells.push(`<div class="cal-day empty"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
        const rec = records[d];
        const isToday = d === today;
        const isFuture = d > today;
        let cls = 'cal-day';
        if (rec === 'present') cls += ' present';
        else if (rec === 'absent') cls += ' absent';
        else if (isFuture) cls += ' future';
        if (isToday) cls += ' today';
        dayCells.push(`<div class="${cls}">${d}</div>`);
    }

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.attendance','Attendance'), _i18n_t('attendance.subtitle','Your attendance record for this month'))}

            <div class="grid-cols-3">
                ${createGlassCard('', `<div class="stat-num" style="color:#6EE7B7;">${pct}%</div><div class="stat-label">${_i18n_t('attendance.overallAttendance','Overall Attendance')}</div>`, '', 0.05)}
                ${createGlassCard('', `<div class="stat-num" style="color:#C4B5FD;">${presentCount}</div><div class="stat-label">${_i18n_t('attendance.daysPresent','Days Present')}</div>`, '', 0.1)}
                ${createGlassCard('', `<div class="stat-num" style="color:#FCA5A5;">${absentCount}</div><div class="stat-label">${_i18n_t('attendance.daysAbsent','Days Absent')}</div>`, '', 0.15)}
            </div>

            ${total === 0
                ? createGlassCard(monthName, createEmptyState(_i18n_t('attendance.noRecords','No attendance records yet'), _i18n_t('attendance.noRecordsSub','Records marked by your teachers will appear here.'), '📅'), '', 0.2)
                : createGlassCard(monthName, `
                    <div class="cal-grid" style="margin-bottom:6px;">
                        ${dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('')}
                    </div>
                    <div class="cal-grid">
                        ${dayCells.join('')}
                    </div>
                    <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);">
                            <div style="width:12px;height:12px;border-radius:4px;background:rgba(16,185,129,0.3);border:1px solid rgba(16,185,129,0.5);"></div> Present
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);">
                            <div style="width:12px;height:12px;border-radius:4px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);"></div> Absent
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);">
                            <div style="width:12px;height:12px;border-radius:4px;border:2px solid var(--violet);"></div> Today
                        </div>
                    </div>
                `, '', 0.2)}

            ${pct > 0 && pct < 75 ? `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:14px;padding:16px 20px;">
                    <div style="color:#FCA5A5;font-weight:600;font-size:14px;">⚠️ Low Attendance Warning</div>
                    <div style="color:var(--text-dim);font-size:13px;margin-top:4px;">
                        Your attendance is below 75%. Please contact your teacher if you have valid reasons.
                    </div>
                </div>
            ` : ''}
        </div>
    `;

}