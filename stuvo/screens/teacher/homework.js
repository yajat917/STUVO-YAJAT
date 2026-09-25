async function renderTeacherHomework(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;
    let classes = [];
    let selectedClassId = null;
    let homeworks = [];
    let quizDraft = null;
    let quizTopic = '';

    function formatDueDate(s) {
        if (!s) return 'No deadline';
        const parts = s.split('-');
        if (parts.length !== 3) return s;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.homework','Homework'), _i18n_t('teacher.homeworkSub','Create and track assignments'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            classes = rows;
        } catch (err) {
            console.error('[teacherHomework classes]', err);
            showToast(_i18n_t('teacher.failedToLoadClasses','Failed to load classes from Firestore.'), 'error');
            classes = [];
        }

        if (classes.length > 0 && !selectedClassId) selectedClassId = classes[0].id;
        await loadHomework();
    }

    async function loadHomework() {
        homeworks = [];
        if (selectedClassId) {
            const cls = classes.find(c => c.id === selectedClassId);
            const total = (cls?.studentIds || []).length;

            try {
                const snap = await getDocs(collection(db, 'classes', selectedClassId, 'homework'));
                const items = [];
                for (const d of snap.docs) {
                    const hw = { id: d.id, ...d.data() };
                    let submitted = 0;
                    try {
                        const subSnap = await getDocs(collection(db, 'classes', selectedClassId, 'homework', hw.id, 'submissions'));
                        submitted = subSnap.size;
                    } catch (err) {
                        console.error('[teacherHomework submissions]', err);
                    }
                    items.push({ ...hw, submitted, total });
                }
                items.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
                homeworks = items;
            } catch (err) {
                console.error('[teacherHomework list]', err);
                showToast(_i18n_t('teacher.failedHomework','Failed to load homework from Firestore.'), 'error');
            }
        }
        render();
    }

    function render() {
        if (classes.length === 0) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.homework','Homework'), _i18n_t('teacher.homeworkSub','Create and track assignments'))}
                    <div class="glass-card">${createEmptyState(_i18n_t('teacher.noClassesYet','No classes yet'), _i18n_t('teacher.noClassHomeworkSub','Create a class first to publish homework.'), '🏫')}</div>
                </div>
            `;
            return;
        }

        const today = new Date().toISOString().slice(0, 10);
        const myHW = homeworks.map(h => ({
            ...h,
            status: h.deadline && h.deadline < today ? 'closed' : 'open',
        }));
        const selectedClass = classes.find(c => c.id === selectedClassId);

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.homework','Homework'), _i18n_t('teacher.homeworkSub','Create and track assignments'))}

                <div class="glass-card">
                    <div class="card-label">📝 New Assignment</div>
                    <div class="form-group">
                        <label>${_i18n_t('teacher.titleLabel','Title')}</label>
                        <input type="text" class="form-control" id="hw-title" placeholder="e.g. Chapter 5 Worksheet">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>${_i18n_t('teacher.classLabel','Class')}</label>
                            <select class="form-control" id="hw-class">
                                ${classes.map(c => `
                                    <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.subjectLabel','Subject')}</label>
                            <select class="form-control" id="hw-subject">
                                <option>Mathematics</option><option>Physics</option><option>Chemistry</option>
                                <option>Biology</option><option>English</option><option>History</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${_i18n_t('teacher.deadlineLabel','Deadline')}</label>
                            <input type="date" class="form-control" id="hw-deadline">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>${_i18n_t('teacher.descLabel','Description')}</label>
                        <textarea class="form-control" id="hw-desc" rows="2" placeholder="${_i18n_t('teacher.descPlaceholder','Instructions for students…')}"></textarea>
                    </div>
                    <button class="btn" id="btn-create-hw" style="margin-top:0;">${_i18n_t('teacher.publishAssignment','Publish Assignment')}</button>
                </div>

                <div class="glass-card">
                    <div class="card-label">🤖 AI Quiz Generator</div>
                    <div class="form-row">
                        <div class="form-group" style="flex:2;">
                            <input type="text" class="form-control" id="quiz-topic" value="${quizTopic}"
                                placeholder="e.g. Photosynthesis, Quadratic Equations, World War II…">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <button class="btn btn-secondary" id="btn-generate-quiz" style="margin-top:0;width:100%;">${_i18n_t('teacher.generateQuizBtn','Generate Quiz')}</button>
                        </div>
                    </div>
                    ${quizDraft && quizDraft.length ? renderQuizEditor(selectedClass) : ''}
                </div>

                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                    <span class="badge badge-yellow">⏳ ${myHW.filter(h => h.status === 'open').length} Open</span>
                    <span class="badge badge-green">✓ ${myHW.filter(h => h.status === 'closed').length} Closed</span>
                </div>

                ${myHW.length === 0
                    ? `<div class="glass-card">${createEmptyState(_i18n_t('homework.noHomeworkAtAll','No homework yet'), 'Publish the first assignment for ' + (selectedClass.name || 'this class') + '.', '📚')}</div>`
                    : myHW.map((h, i) => `
                        <div class="glass-card">
                            <div class="card-header">
                                <div style="flex:1;min-width:0;">
                                    <div style="font-size:15px;font-weight:600;">${h.title}</div>
                                    <div class="hw-sub">${selectedClass.name} · ${h.subject || '—'} · Due ${formatDueDate(h.deadline)}</div>
                                </div>
                                <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                                    <span class="badge ${h.status === 'open' ? 'badge-yellow' : 'badge-green'}">
                                        ${h.status === 'open' ? 'Open' : 'Closed'}
                                    </span>
                                    <button class="btn btn-sm btn-secondary" data-edit-hw="${h.id}" style="margin-top:0;">✏️ Edit</button>
                                    <button class="btn btn-sm btn-danger" data-del-hw="${h.id}" style="margin-top:0;">🗑</button>
                                </div>
                            </div>
                            <div class="divider" style="margin:12px 0;"></div>
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div style="flex:1;height:8px;border-radius:6px;background:rgba(255,255,255,0.06);overflow:hidden;">
                                    <div style="height:100%;border-radius:6px;
                                        background:linear-gradient(90deg,#7C5CFC,#4F8CFF);
                                        width:${h.total ? Math.round((h.submitted / h.total) * 100) : 0}%;"></div>
                                </div>
                                <span style="font-size:13px;color:var(--text-dim);flex-shrink:0;">
                                    ${h.submitted}/${h.total} submitted
                                </span>
                            </div>
                        </div>
                    `).join('')}
            </div>
        `;

        container.querySelector('#hw-class').addEventListener('change', async e => {
            selectedClassId = e.target.value;
            await loadHomework();
        });

        container.querySelectorAll('[data-edit-hw]').forEach(btn => {
            btn.addEventListener('click', () => {
                const hw = homeworks.find(h => h.id === btn.dataset.editHw);
                if (!hw) return;
                openModal('Edit Assignment', `
                    <div class="form-group">
                        <label>${_i18n_t('teacher.titleLabel','Title')}</label>
                        <input type="text" class="form-control" id="edit-hw-title" value="${(hw.title || '').replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label>${_i18n_t('teacher.deadlineLabel','Deadline')}</label>
                        <input type="date" class="form-control" id="edit-hw-deadline" value="${hw.deadline || ''}">
                    </div>
                    <div class="form-group">
                        <label>${_i18n_t('teacher.descLabel','Description')}</label>
                        <textarea class="form-control" id="edit-hw-desc" rows="3">${(hw.description || '').replace(/</g, '&lt;')}</textarea>
                    </div>
                `, async (overlay, close) => {
                    const title = overlay.querySelector('#edit-hw-title').value.trim();
                    const deadline = overlay.querySelector('#edit-hw-deadline').value;
                    if (!title || !deadline) { showToast(_i18n_t('teacher.titleDeadlineRequired','Title and deadline are required.'), 'error'); return; }
                    try {
                        await updateDoc(doc(db, 'classes', selectedClassId, 'homework', hw.id), {
                            title,
                            deadline,
                            description: overlay.querySelector('#edit-hw-desc').value.trim(),
                        });
                        showToast(_i18n_t('teacher.assignmentUpdated','Assignment updated') + ' ✅', 'success');
                        close();
                        await loadHomework();
                    } catch (err) {
                        console.error('[teacherHomework edit]', err);
                        showToast(`Failed to update: ${err.message}`, 'error');
                    }
                });
            });
        });

        container.querySelectorAll('[data-del-hw]').forEach(btn => {
            btn.addEventListener('click', () => {
                openModal('Delete Assignment?', '<p style="font-size:14px;color:var(--text-dim);">This will permanently remove the assignment and all student submissions.</p>', async (overlay, close) => {
                    try {
                        await deleteDoc(doc(db, 'classes', selectedClassId, 'homework', btn.dataset.delHw));
                        showToast(_i18n_t('teacher.assignmentDeleted','Assignment deleted.'), 'success');
                        close();
                        await loadHomework();
                    } catch (err) {
                        console.error('[teacherHomework delete]', err);
                        showToast(`Failed to delete: ${err.message}`, 'error');
                    }
                });
            });
        });

        container.querySelector('#btn-create-hw').addEventListener('click', async () => {
            const title = container.querySelector('#hw-title').value.trim();
            const deadline = container.querySelector('#hw-deadline').value;
            if (!title || !deadline) { showToast(_i18n_t('teacher.titleDeadlineRequired','Title and deadline are required.'), 'error'); return; }
            const subject = container.querySelector('#hw-subject').value;
            const desc = container.querySelector('#hw-desc').value.trim();
            const btn = container.querySelector('#btn-create-hw');
            btn.disabled = true;
            btn.textContent = 'Publishing…';
            try {
                const hwRef = await addDoc(collection(db, 'classes', selectedClassId, 'homework'), {
                    title,
                    description: desc,
                    subject,
                    deadline,
                    createdBy: uid,
                    createdAt: serverTimestamp(),
                });
                // D.1 Smart Notification Center — new_homework: fan-out to enrolled students
                // Implemented: fan-out new_homework notification to all enrolled students client-side (no Cloud Functions)
                try {
                    const clsForNotif = classes.find(c => c.id === selectedClassId);
                    const studentIds = (clsForNotif && clsForNotif.studentIds) || [];
                    const notifPayload = {
                        type: 'new_homework',
                        title: `New homework: ${title}`,
                        body: `${clsForNotif ? clsForNotif.name + ' · ' : ''}${subject} — due ${deadline}`,
                        relatedClassId: selectedClassId,
                        relatedHomeworkId: hwRef.id,
                        read: false,
                        createdAt: serverTimestamp()
                    };
                    await Promise.all(studentIds.map(sid =>
                        addDoc(collection(db, 'users', sid, 'notifications'), notifPayload).catch(e => console.error('[new_homework notify]', sid, e))
                    ));
                } catch (notifyErr) { console.error('[new_homework fanout]', notifyErr); }

                showToast(_i18n_t('teacher.assignmentPublished','Assignment published') + ' ✅', 'success');
                container.querySelector('#hw-title').value = '';
                container.querySelector('#hw-desc').value = '';
                await loadHomework();
            } catch (err) {
                console.error('[teacherHomework create]', err);
                showToast(`Failed to publish homework: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'Publish Assignment';
            }
        });

        container.querySelector('#btn-generate-quiz').addEventListener('click', generateQuiz);
        setupQuizEditor();
    }

    function renderQuizEditor(selectedClass) {
        return `
            <div class="divider" style="margin:14px 0;"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:600;color:var(--text-dim);">
                    📝 ${quizDraft.length} question${quizDraft.length === 1 ? '' : 's'} generated — edit before publishing
                </div>
                <button class="btn btn-danger btn-sm" id="btn-cancel-quiz" style="margin-top:0;">✕ Discard</button>
            </div>
            ${quizDraft.map((q, qi) => `
                <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;margin-bottom:12px;">
                    <div class="form-group">
                        <label>Question ${qi + 1}</label>
                        <input type="text" class="form-control quiz-q" data-qi="${qi}" value="${(q.question || '').replace(/"/g, '&quot;')}">
                    </div>
                    ${(q.options || []).map((opt, oi) => `
                        <div class="form-group" style="margin-bottom:6px;">
                            <label style="display:inline-block;width:28px;">${'ABCD'[oi]}</label>
                            <input type="text" class="form-control quiz-opt" data-qi="${qi}" data-oi="${oi}"
                                value="${(opt || '').replace(/"/g, '&quot;')}" style="display:inline-block;width:calc(100% - 36px);">
                        </div>
                    `).join('')}
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${_i18n_t('teacher.correctAnswerLabel','Correct answer')}</label>
                        <select class="form-control quiz-correct" data-qi="${qi}" style="width:auto;">
                            ${(q.options || []).map((_, oi) => `
                                <option value="${oi}" ${oi === q.correctIndex ? 'selected' : ''}>${'ABCD'[oi]}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `).join('')}
            <div class="form-row">
                <div class="form-group">
                    <label>${_i18n_t('teacher.quizTitleLabel','Quiz Title')}</label>
                    <input type="text" class="form-control" id="quiz-title" placeholder="e.g. Photosynthesis Quiz">
                </div>
                <div class="form-group">
                    <label>${_i18n_t('teacher.deadlineLabel','Deadline')}</label>
                    <input type="date" class="form-control" id="quiz-deadline">
                </div>
            </div>
            <button class="btn" id="btn-publish-quiz" style="margin-top:0;">Publish Quiz to ${(selectedClass && selectedClass.name) || 'class'}</button>
        `;
    }

    async function generateQuiz() {
        const topic = container.querySelector('#quiz-topic').value.trim();
        if (!topic) { showToast(_i18n_t('teacher.enterTopic','Enter a topic to generate a quiz.'), 'error'); return; }
        const btn = container.querySelector('#btn-generate-quiz');
        btn.disabled = true;
        btn.textContent = 'Generating…';
        try {
            const data = await safeApiCall('/api/ai', { action: 'generateQuiz', topic, difficulty: 'medium', questionCount: 8 });
            const _questions = data.questions || data.quiz;
            if (!_questions || !Array.isArray(_questions) || _questions.length === 0) {
                throw new Error('No quiz questions were returned. Try again.');
            }
            quizDraft = _questions;
            quizTopic = topic;
            render();
        } catch (err) {
            console.error('[teacherHomework generateQuiz]', err);
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = _i18n_t('studyHub.generateQuiz','Generate Quiz');
        }
    }

    function setupQuizEditor() {
        const cancelBtn = container.querySelector('#btn-cancel-quiz');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                quizDraft = null;
                quizTopic = '';
                render();
            });
        }

        container.querySelectorAll('.quiz-q').forEach(input => {
            input.addEventListener('input', () => {
                quizDraft[parseInt(input.dataset.qi)].question = input.value;
            });
        });

        container.querySelectorAll('.quiz-opt').forEach(input => {
            input.addEventListener('input', () => {
                const q = quizDraft[parseInt(input.dataset.qi)];
                q.options[parseInt(input.dataset.oi)] = input.value;
            });
        });

        container.querySelectorAll('.quiz-correct').forEach(select => {
            select.addEventListener('change', () => {
                quizDraft[parseInt(select.dataset.qi)].correctIndex = parseInt(select.value);
            });
        });

        const publishBtn = container.querySelector('#btn-publish-quiz');
        if (publishBtn) {
            publishBtn.addEventListener('click', async () => {
                const cls = classes.find(c => c.id === selectedClassId);
                const title = container.querySelector('#quiz-title').value.trim() || `Quiz: ${quizTopic || 'AI Generated'}`;
                const deadline = container.querySelector('#quiz-deadline').value;
                const cleanQuiz = quizDraft.map(q => ({
                    question: String(q.question || '').trim(),
                    options: (q.options || []).map(o => String(o || '').trim()),
                    correctIndex: Math.min(Math.max(parseInt(q.correctIndex) || 0, 0), 3),
                })).filter(q => q.question && q.options.filter(Boolean).length === 4);
                if (cleanQuiz.length === 0) { showToast(_i18n_t('teacher.quizInvalid','Quiz has no valid questions. Fill in question text and all 4 options.'), 'error'); return; }

                publishBtn.disabled = true;
                publishBtn.textContent = 'Publishing…';
                try {
                    const hwRef2 = await addDoc(collection(db, 'classes', selectedClassId, 'homework'), {
                        title,
                        source: 'ai_quiz',
                        quizData: cleanQuiz,
                        subject: (cls && cls.subject) || 'General',
                        deadline,
                        description: `AI-generated quiz on ${quizTopic || title}.`,
                        createdBy: uid,
                        createdAt: serverTimestamp(),
                    });
                    // D.1 Smart Notification Center — new_homework (AI quiz): fan-out to enrolled students
                    try {
                        const studentIds2 = (cls && cls.studentIds) || (classes.find(c => c.id === selectedClassId)?.studentIds) || [];
                        const payload2 = {
                            type: 'new_homework',
                            title: `New homework: ${title}`,
                            body: `${(cls && cls.name ? cls.name + ' · ' : '')}AI Quiz — due ${deadline || 'soon'}`,
                            relatedClassId: selectedClassId,
                            relatedHomeworkId: hwRef2.id,
                            read: false,
                            createdAt: serverTimestamp()
                        };
                        await Promise.all(studentIds2.map(sid =>
                            addDoc(collection(db, 'users', sid, 'notifications'), payload2).catch(e => console.error('[new_homework quiz notify]', e))
                        ));
                    } catch (e) { console.error('[new_homework quiz fanout]', e); }
                    showToast(_i18n_t('teacher.aiQuizPublished','AI Quiz published') + ' ✅', 'success');
                    quizDraft = null;
                    quizTopic = '';
                    await loadHomework();
                } catch (err) {
                    console.error('[teacherHomework publishQuiz]', err);
                    showToast(`Failed to publish quiz: ${err.message}`, 'error');
                    publishBtn.disabled = false;
                    publishBtn.textContent = 'Publish Quiz';
                }
            });
        }
    }

    await load();
}