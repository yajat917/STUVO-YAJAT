async function renderTeacherAnalytics(container, params) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const classId = params.classId || new URLSearchParams(window.location.hash.split('?')[1]||'').get('classId');
    const uid = appState.user?.uid;
    container.innerHTML = `<div class="flex-col">${createPageHeader(_i18n_t('teacher.classAnalytics','Class Analytics'),_i18n_t('common.loading','Loading...'))}${createSkeleton(3)}</div>`;
    try {
        let classIds = [];
        if (classId) classIds = [classId];
        else {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId','==',uid)));
            snap.forEach(d => classIds.push(d.id));
        }
        if (!classIds.length) {
            container.innerHTML = `<div class="flex-col">${createPageHeader(_i18n_t('teacher.classAnalytics','Class Analytics'),_i18n_t('teacher.noClassesFound','No classes found'))}${createGlassCard('', createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassGenericSub','Create your first class above.'),'🏫'))}</div>`;
        }
        let html = `<div class="flex-col">${createPageHeader(_i18n_t('teacher.classAnalytics','Class Analytics'),_i18n_t('teacher.analyticsSub','Per-class completion and submissions'))}`;
        const _pulseData = [];
        for (const cid of classIds) {
            const clsSnap = await getDoc(doc(db, 'classes', cid));
            const cls = clsSnap.exists ? { id: cid, ...clsSnap.data() } : { id: cid, name: _i18n_t('testReports.class','Class'), studentIds: [] };
            const hwSnap = await getDocs(collection(db, 'classes', cid, 'homework'));
            let totalHw = hwSnap.size;
            let totalSubs = 0;
            let onTime = 0, late = 0, missing = 0;
            let notSubmitters = [];
            let avgScores = [];
            for (const hwDoc of hwSnap.docs) {
                const hw = hwDoc.data();
                const subSnap = await getDocs(collection(db, 'classes', cid, 'homework', hwDoc.id, 'submissions'));
                const subs = [];
                subSnap.forEach(s => subs.push(s.data()));
                totalSubs += subs.length;
                const totalStudents = (cls.studentIds||[]).length;
                // simplistic on-time vs late based on deadline
                subs.forEach(s => {
                    const dl = hw.deadline ? new Date(hw.deadline) : null;
                    const subTime = s.submittedAt?.toDate ? s.submittedAt.toDate() : new Date();
                    if (dl && subTime > dl) late++; else onTime++;
                    if (s.quizAnswers && hw.quizData) {
                        let correct = 0;
                        hw.quizData.forEach((q, i) => { if (s.quizAnswers[i] === q.correctIndex) correct++; });
                        avgScores.push(correct/hw.quizData.length*100);
                    }
                });
                const submittedIds = new Set(subSnap.docs.map(d=>d.id));
                (cls.studentIds||[]).forEach(sid => {
                    if (!submittedIds.has(sid)) notSubmitters.push({ studentId: sid, hwTitle: hw.title, hwId: hwDoc.id });
                });
            }
            const totalPossible = totalHw * (cls.studentIds||[]).length;
            const completionPct = totalPossible ? Math.round(totalSubs/totalPossible*100) : 0;
            const avgScore = avgScores.length ? Math.round(avgScores.reduce((a,b)=>a+b,0)/avgScores.length) : 0;
            // weak topics from quiz
            let weakTopics = [];
            _pulseData.push({ cid, completionPct, notSubmittedCount: notSubmitters.length, avgScore, weakTopics: weakTopics.slice() });
            // simple: group by subject
            html += `
                <div class="glass-card">
                    <div class="card-label">${cls.name || _i18n_t('testReports.class','Class')} — ${_i18n_t('nav.analytics','Analytics')}</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
                        <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:#C4B5FD;">${completionPct}%</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('teacher.completionLabel','Completion')}</div></div>
                        <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:#93C5FD;">${onTime}/${late+onTime+missing}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('teacher.onTimeLate','On-time / Late')}</div></div>
                        <div style="text-align:center;"><div style="font-size:22px;font-weight:700;color:#FDE68A;">${avgScore}%</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('teacher.avgQuiz','Avg Quiz')}</div></div>
                    </div>
                    <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;margin-bottom:12px;"><div style="height:100%;width:${completionPct}%;background:linear-gradient(90deg,#7C5CFC,#4F8CFF);"></div></div>
                    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${_i18n_t('teacher.notSubmitted','Students who haven\'t submitted')} — ${notSubmitters.length ? '' : _i18n_t('teacher.allCaughtUpShort','All caught up!')}</div>
                    ${notSubmitters.slice(0,5).map(n => `
                        <div class="hw-item">
                            <div><div class="hw-title">${n.studentId.slice(0,8)}</div><div class="hw-sub">${n.hwTitle}</div></div>
                            <button class="btn btn-secondary btn-sm" data-remind="${n.studentId}" data-hw="${n.hwId}" data-class="${cid}" style="margin-top:0;">${_i18n_t('teacher.sendReminder','Send Reminder')}</button>
                        </div>
                    `).join('')}
                     ${weakTopics.length ? `<div style="margin-top:12px;font-size:12px;color:var(--text-dim);">${_i18n_t('teacher.weakTopicsLabel', {topics: weakTopics.join(', ')})}</div>` : ''}
                    <div id="class-pulse-${cid}" style="margin-top:14px;padding:12px;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.2);border-radius:10px;min-height:36px;display:flex;align-items:center;">
                        <div style="font-size:13px;color:var(--text-dim);">🤖 ${_i18n_t('teacher.loadingAI','Loading AI recommendation...')}</div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;
        // Fetch Class Pulse AI recommendation for each class
        _pulseData.forEach(async ({ cid, completionPct, notSubmittedCount, avgScore, weakTopics }) => {
            const pulseEl = container.querySelector(`#class-pulse-${cid}`);
            if (!pulseEl) return;
            try {
                const data = await safeApiCall('/api/ai', {
                    action: 'classPulse', completionPercent: completionPct, notSubmittedCount, avgQuizScore: avgScore, weakTopics
                });
                if (data && data.recommendation) {
                    pulseEl.innerHTML = `<div style="font-size:13px;font-weight:600;color:#C4B5FD;">🤖 ${_i18n_t('teacher.aiRecommendation','AI Recommendation:')}</div><div style="font-size:13px;line-height:1.6;margin-top:4px;">${data.recommendation}</div>`;
                } else {
                    pulseEl.innerHTML = `<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('teacher.noRecommendation','No recommendation available.')}</div>`;
                }
            } catch (e) {
                console.error('[classPulse]', e);
                pulseEl.innerHTML = `<div style="font-size:13px;color:#FCA5A5;">${_i18n_t('teacher.aiUnavailable','AI recommendation unavailable')}: ${e.message}</div>`;
            }
        });
        container.querySelectorAll('[data-remind]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sid = btn.dataset.remind;
                const hwId = btn.dataset.hw;
                const cid = btn.dataset.class;
                btn.disabled = true; btn.textContent = _i18n_t('teacher.sending','Sending...');
                try {
                    await addDoc(collection(db, 'users', sid, 'notifications'), {
                        type: 'ai_reminder',
                        titleKey: 'notifications.reminderTitle', title: 'Reminder: Homework pending',
                        bodyKey: 'notifications.reminderBody', body: 'You have a pending assignment — please submit soon.',
                        relatedClassId: cid, relatedHomeworkId: hwId, read: false, createdAt: serverTimestamp()
                    });
                    showToast(_i18n_t('teacher.reminderSent','Reminder sent'),'success');
                    btn.textContent = _i18n_t('teacher.sent','Sent');
                } catch(e) { showToast(e.message,'error'); btn.disabled=false; btn.textContent=_i18n_t('teacher.sendReminder','Send Reminder'); }
            });
        });
    } catch(err) {
        console.error('[teacherAnalytics]', err);
        container.innerHTML = `<div class="flex-col">${createPageHeader(_i18n_t('nav.analytics','Analytics'),'')}${createGlassCard(_i18n_t('common.error','Something went wrong'), createEmptyState(_i18n_t('teacher.loadFailed','Failed to load. Please try again.'), err.message,'⚠️'))}</div>`;
    }
}