// FIRESTORE: classes/{classId}/homework — getDocs, then submissions/{studentId}
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/z7zmikbs/auto/upload';
const CLOUDINARY_UPLOAD_PRESET = 'stuvo_submissions'; // set this unsigned preset in Cloudinary dashboard

// ─── D.5 Offline-Friendly Experience — IndexedDB queue for homework submissions ───
const OFFLINE_DB_NAME = 'stuvo_offline';
const OFFLINE_STORE = 'offlineHomeworkQueue';
const OFFLINE_DB_VERSION = 1;

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
                    db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('IndexedDB blocked'));
        } catch (err) {
            reject(err);
        }
    });
}

function queueOfflineHomework(classId, homeworkId, uid, data) {
    return openOfflineDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_STORE, 'readwrite');
        const store = tx.objectStore(OFFLINE_STORE);
        const entry = { classId, homeworkId, uid, data, timestamp: Date.now() };
        const req = store.add(entry);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
    }));
}

function getAllQueuedHomework() {
    return openOfflineDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
    }));
}

function deleteQueuedHomework(id) {
    return openOfflineDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(OFFLINE_STORE, 'readwrite');
        tx.objectStore(OFFLINE_STORE).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
    }));
}

async function drainOfflineHomeworkQueue() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let items = [];
    try { items = await getAllQueuedHomework(); } catch (e) { console.error('[offlineQueue getAll]', e); return; }
    if (!items.length) return;
    for (const item of items) {
        const payload = item.data || {};
        // Ensure submittedAt is serverTimestamp on retry
        const dataToSubmit = { ...payload, submittedAt: (typeof serverTimestamp === 'function' ? serverTimestamp() : new Date()) };
        try {
            await setDoc(doc(db, 'classes', item.classId, 'homework', item.homeworkId, 'submissions', item.uid), dataToSubmit);
            await deleteQueuedHomework(item.id);
            try { showToast(_i18n_t('homework.assignmentSubmitted','Assignment submitted!')+' ✓', 'success'); } catch(_){}
        } catch (err) {
            console.error('[offlineQueue drain submit]', item, err);
            // keep in queue for next online event
            if (err && err.message && /offline|network|Failed to fetch/i.test(err.message)) {
                // stay queued
            } else {
                // For other errors, keep queued as well to retry; don't delete
            }
            // stop draining if still offline
            if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        }
    }
    // Optionally refresh homework view if any submitted
    try {
        // If homework screen is active, reload could be triggered externally
    } catch(_){}
}

// Auto-retry on online event
if (typeof window !== 'undefined' && !window._offlineQueueBound) {
    window._offlineQueueBound = true;
    window.addEventListener('online', () => {
        drainOfflineHomeworkQueue().catch(e => console.error('[offlineQueue online drain]', e));
    });
    // Also try draining on load if already online
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        // delay until db/firebase ready
        setTimeout(() => { drainOfflineHomeworkQueue().catch(()=>{}); }, 2000);
    }
    // expose for testing/manual
    window.drainOfflineHomeworkQueue = drainOfflineHomeworkQueue;
    window.queueOfflineHomework = queueOfflineHomework;
    window.getAllQueuedHomework = getAllQueuedHomework;
}

function parseDeadline(s) {
    if (!s) return null;
    const parts = s.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d) ? null : d;
}

function formatDueDate(s) {
    const d = parseDeadline(s);
    if (!d) return _i18n_t('homework.noDeadline','No deadline');
    try {
        const loc = (typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN');
        return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
}

function getBadge(hw) {
    if (hw.submissionStatus === 'submitted') return { text: _i18n_t('homework.submitted','Submitted')+' ✓', cls: 'success' };
    if (hw.submissionStatus === 'late') return { text: _i18n_t('homework.late','Late'), cls: 'urgent' };
    if (hw.daysLeft === 0) return { text: _i18n_t('homework.dueToday','Due Today'), cls: 'urgent' };
    return { text: _i18n_t('homework.daysLeft',{count: hw.daysLeft}), cls: '' };
}

function categorizeHomework(list) {
  const now = new Date();
  const dueSoon = [], upcoming = [], completed = [];
  list.forEach(hw => {
    if (hw.submissionStatus === 'submitted') completed.push(hw);
    else {
      const deadline = parseDeadline(hw.deadline);
      const hoursLeft = deadline ? (deadline - now) / (1000*60*60) : 999;
      if (hoursLeft <= 48) dueSoon.push(hw);
      else upcoming.push(hw);
    }
  });
  dueSoon.sort((a,b) => (a.deadline||'9999').localeCompare(b.deadline||'9999'));
  upcoming.sort((a,b) => (a.deadline||'9999').localeCompare(b.deadline||'9999'));
  completed.sort((a,b) => (b.deadline||'9999').localeCompare(a.deadline||'9999'));
  return { dueSoon, upcoming, completed };
}

async function predictWorkload(studentUid, subject) {
  try {
    const historySnap = await getDocs(query(collection(db, 'users', studentUid, 'homeworkTimingHistory'), where('subject', '==', subject), limit(10)));
    if (historySnap.empty || historySnap.size < 2) return null;
    let total = 0;
    historySnap.forEach(d => { total += (d.data().sessionsUsed || 1); });
    const avg = total / historySnap.size;
    return Math.round(avg);
  } catch(e) { return null; }
}

// Upload a file to Cloudinary using the unsigned preset
async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.secure_url;
}

async function renderStudentHomework(container) {
    const uid = appState.user?.uid;
    let openHwId = null;
    let quizAnswers = {};
    let homework = [];

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.homework','Homework'), _i18n_t('common.loading','Loading…'))}
                ${createSkeleton(3)}
            </div>
        `;

        homework = [];
        const classIds = appState.userData?.classIds || [];
        for (const classId of classIds) {
            try {
                const classSnap = await getDoc(doc(db, 'classes', classId));
                const className = classSnap.exists ? (classSnap.data().name || _i18n_t('testReports.class','Class')) : _i18n_t('testReports.class','Class');
                const hwSnap = await getDocs(collection(db, 'classes', classId, 'homework'));
                for (const d of hwSnap.docs) {
                    const hw = { id: d.id, classId, className, ...d.data() };
                    if (!hw.source) hw.source = 'manual';

                    let submissionStatus = 'pending';
                    try {
                        const subSnap = await getDoc(doc(db, 'classes', classId, 'homework', hw.id, 'submissions', uid));
                        if (subSnap.exists) submissionStatus = 'submitted';
                    } catch (err) {
                        console.error('[studentHomework submission]', err);
                    }

                    const deadline = parseDeadline(hw.deadline);
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    if (submissionStatus === 'pending' && hw.deadline && hw.deadline < todayStr) submissionStatus = 'late';

                    homework.push({
                        ...hw,
                        submissionStatus,
                        daysLeft: deadline ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000) : 0,
                    });
                }
            } catch (err) {
                console.error('[studentHomework load]', err);
            }
        }

        homework.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
        render();
    }

    function render() {
        const { dueSoon, upcoming, completed } = categorizeHomework(homework);
        const pending = dueSoon.length + upcoming.length;

        function hwCardHTML(hw, i, isOpen) {
            const badge = getBadge(hw);
            return `
            <div class="glass-card" id="hw-card-${hw.id}" style="cursor:pointer;margin-bottom:10px;">
                <div class="card-header" style="margin-bottom:${isOpen ? '12px' : '0'};">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:15px;font-weight:600;">${_escapeHtml(hw.title)}</div>
                        <div class="hw-sub">${_escapeHtml(hw.subject) || '—'} · ${_escapeHtml(hw.className)} · ${_i18n_t('homework.dueWithDate',{date: formatDueDate(hw.deadline)})}</div>
                        <div style="font-size:11px;color:#FDE68A;margin-top:2px;" id="pred-${hw.id}"></div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                        <div class="hw-badge ${badge.cls}">${badge.text}</div>
                        <span style="color:var(--text-dim);font-size:16px;">${isOpen ? '▲' : '▼'}</span>
                    </div>
                </div>
                ${isOpen ? `<div class="divider"></div><p style="font-size:14px;line-height:1.7;color:var(--text-dim);margin-bottom:12px;">${_escapeHtml(hw.description)||_i18n_t('homework.noInstructions','No instructions.')}</p>
                    <div style="margin-bottom:12px;">
                        <button class="btn btn-secondary btn-sm" id="btn-summarize-${hw.id}" data-hw-id="${hw.id}" style="margin-top:0;">${_i18n_t('homework.summariseForMe','Summarise for me')}</button>
                        <div id="summary-out-${hw.id}" style="margin-top:12px;"></div>
                    </div>
                    ${renderSubmissionForm(hw)}` : ''}
            </div>`;
        }

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.homework','Homework'), (pending === 1 ? _i18n_t('homework.pendingSubmissions',{count: pending}) : _i18n_t('homework.pendingSubmissions_plural',{count: pending})))}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                    <span class="badge" style="background:rgba(255,155,155,0.15);color:#FF9B9B;border:1px solid rgba(255,155,155,0.3);">🔴 ${dueSoon.length} ${_i18n_t('homework.dueSoon','Due Soon')}</span>
                    <span class="badge" style="background:rgba(253,230,138,0.15);color:#FDE68A;border:1px solid rgba(253,230,138,0.3);">🟡 ${upcoming.length} ${_i18n_t('homework.upcoming','Upcoming')}</span>
                    <span class="badge badge-green">🟢 ${completed.length} ${_i18n_t('homework.completed','Completed')}</span>
                </div>
                ${homework.length === 0 ? `<div class="glass-card">${createEmptyState(_i18n_t('homework.noHomeworkAtAll','No homework yet'),_i18n_t('homework.noHomeworkSub','When a teacher assigns homework to your class, it will appear here.'),'📚')}</div>` : `
                <div class="glass-card" style="border-left:3px solid #FF9B9B;">
                    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-toggle="dueSoon">
                        <div style="font-weight:700;color:#FF9B9B;">🔴 ${_i18n_t('homework.dueSoon','Due Soon')} — ${_i18n_t('homework.dueSoonDesc','within 48 hours')}</div>
                        <span style="color:var(--text-dim);font-size:12px;">${_i18n_t('homework.itemsCount',{count: dueSoon.length})} ▼</span>
                    </div>
                    <div id="section-dueSoon" style="margin-top:12px;">
                        ${dueSoon.length ? dueSoon.map((hw,i) => hwCardHTML(hw,i, openHwId===hw.id)).join('') : `<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:12px;">${_i18n_t('homework.noHomeworkDueSoon',"No assignments due soon — you're on track!")}</div>`}
                    </div>
                </div>
                <div class="glass-card" style="border-left:3px solid #FDE68A;margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-toggle="upcoming">
                        <div style="font-weight:700;color:#FDE68A;">🟡 ${_i18n_t('homework.upcoming','Upcoming')} — ${_i18n_t('homework.upcomingDesc','more than 48 hours away')}</div>
                        <span style="color:var(--text-dim);font-size:12px;">${_i18n_t('homework.itemsCount',{count: upcoming.length})} ▼</span>
                    </div>
                    <div id="section-upcoming" style="margin-top:12px;">
                        ${upcoming.length ? upcoming.map((hw,i) => hwCardHTML(hw,i, openHwId===hw.id)).join('') : `<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:12px;">${_i18n_t('homework.noUpcoming','No upcoming assignments.')}</div>`}
                    </div>
                </div>
                <div class="glass-card" style="border-left:3px solid #7EFFD4;margin-top:12px;opacity:0.95;">
                    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-toggle="completed">
                        <div style="font-weight:700;color:#7EFFD4;">🟢 ${_i18n_t('homework.completed','Completed')} — ${_i18n_t('homework.completedDesc','collapsed by default')}</div>
                        <span style="color:var(--text-dim);font-size:12px;">${_i18n_t('homework.itemsCount',{count: completed.length})} ${completed.length ? '▼' : ''}</span>
                    </div>
                    <div id="section-completed" style="display:none;margin-top:12px;">
                        ${completed.length ? completed.map((hw,i) => hwCardHTML(hw,i, openHwId===hw.id)).join('') : `<div style="font-size:13px;color:var(--text-dim);text-align:center;padding:12px;">${_i18n_t('homework.noCompleted','No completed assignments yet.')}</div>`}
                    </div>
                </div>
                `}
            </div>
        `;

        [...dueSoon, ...upcoming, ...completed].forEach(hw => {
            const card = container.querySelector(`#hw-card-${hw.id}`);
            if (!card) return;
            card.addEventListener('click', e => {
                if (e.target.closest('.quiz-option, button, input, textarea, select')) return;
                openHwId = openHwId === hw.id ? null : hw.id;
                quizAnswers = {};
                render();
            });
            if (openHwId === hw.id) setupListeners(hw);
            // Deadline prediction — only if within 4 days and has history
            const predEl = container.querySelector(`#pred-${hw.id}`);
            if (predEl && hw.subject) {
              const deadline = parseDeadline(hw.deadline);
              const daysLeft = deadline ? Math.ceil((deadline - new Date())/86400000) : 99;
              if (daysLeft >=0 && daysLeft <=4) {
                predictWorkload(uid, hw.subject).then(sessions => {
                  if (sessions) predEl.textContent = `⚠️ ${_i18n_t('homework.predictWorkload',{sessions})}`;
                });
              }
            }
        });

        container.querySelector('[data-toggle="dueSoon"]')?.addEventListener('click', () => {
            const el = container.querySelector('#section-dueSoon');
            if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
        });
        container.querySelector('[data-toggle="upcoming"]')?.addEventListener('click', () => {
            const el = container.querySelector('#section-upcoming');
            if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
        });
        container.querySelector('[data-toggle="completed"]')?.addEventListener('click', () => {
            const el = container.querySelector('#section-completed');
            if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
        });
    }

    function renderSubmissionForm(hw) {
        if (hw.submissionStatus === 'submitted') {
            return `
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);
                    border-radius:12px;padding:20px;text-align:center;">
                    <div style="font-size:28px;margin-bottom:8px;">✅</div>
                    <div style="color:#6EE7B7;font-weight:600;">${_i18n_t('homework.alreadySubmitted','Already Submitted')}</div>
                    <div style="color:var(--text-dim);font-size:12px;margin-top:4px;">${_i18n_t('homework.alreadySubmittedSub','Your work has been received by the teacher.')}</div>
                </div>
            `;
        }

        if (hw.source === 'ai_quiz') {
            return `
                <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin-bottom:14px;">
                    📝 ${_i18n_t('homework.quizQuestions',{count: (hw.quizData || []).length})}
                </div>
                ${(hw.quizData || []).map((q, qi) => `
                    <div style="margin-bottom:20px;">
                        <div style="font-size:14px;font-weight:500;margin-bottom:10px;">
                            ${qi + 1}. ${q.question}
                        </div>
                        ${(q.options || []).map((opt, oi) => `
                            <div class="quiz-option ${quizAnswers[qi] === oi ? 'selected' : ''}"
                                data-qi="${qi}" data-oi="${oi}">
                                <div class="quiz-letter">${'ABCD'[oi]}</div>
                                ${opt}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
                <button class="btn" id="btn-submit-quiz-${hw.id}" style="margin-top:4px;">${_i18n_t('homework.submitQuiz','Submit Quiz')}</button>
            `;
        }

        // Manual submission
        return `
            <div class="form-group">
                <label>${_i18n_t('homework.textAnswer','Text Answer')}</label>
                <textarea class="form-control" id="text-answer-${hw.id}"
                    placeholder="${_i18n_t('homework.textAnswerPlaceholder','Type your answer here...')}" rows="4"></textarea>
            </div>
            <div class="form-group">
                <label>${_i18n_t('homework.fileAttachment','File Attachment')} <span style="color:var(--text-dim);">(${_i18n_t('homework.fileOptional','optional')})</span></label>
                <input type="file" class="form-control" id="file-input-${hw.id}"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">
                    ${_i18n_t('homework.cloudinaryNote','Uploaded via Cloudinary (cloud: z7zmikbs)')}
                </div>
            </div>
            <div id="upload-status-${hw.id}" style="display:none;font-size:12px;color:var(--text-dim);margin-bottom:8px;"></div>
            <button class="btn" id="btn-submit-${hw.id}" style="margin-top:4px;">${_i18n_t('homework.submitAssignment','Submit Assignment')}</button>
        `;
    }

    function setupListeners(hw) {
        // Quiz option clicks
        container.querySelectorAll('.quiz-option').forEach(opt => {
            opt.addEventListener('click', () => {
                quizAnswers[parseInt(opt.dataset.qi)] = parseInt(opt.dataset.oi);
                render();
                setupListeners(hw);
            });
        });

        // Quiz submit — D.5 offline queuing via IndexedDB
        const quizBtn = container.querySelector(`#btn-submit-quiz-${hw.id}`);
        if (quizBtn) {
            quizBtn.addEventListener('click', async () => {
                const n = (hw.quizData || []).length;
                if (Object.keys(quizAnswers).length < n) {
                    showToast(_i18n_t('homework.answerAllQuestions',{count: n}), 'error');
                    return;
                }
                const quizPayload = {
                    status: 'submitted',
                    quizAnswers: Object.values(quizAnswers),
                    submittedAt: serverTimestamp(),
                };
                // If offline, queue in IndexedDB and show offline message
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    try {
                        await queueOfflineHomework(hw.classId, hw.id, uid, quizPayload);
                        showToast(_i18n_t('homework.willSubmitWhenOnline','Will submit when you\'re back online'), 'info');
                        quizBtn.disabled = true;
                        quizBtn.textContent = _i18n_t('homework.queuedForSync','Queued for sync');
                    } catch (e) {
                        console.error('[offlineQueue quiz queue]', e);
                        showToast(_i18n_t('homework.queueFailed','Failed to queue submission'), 'error');
                    }
                    return;
                }
                try {
                    await setDoc(doc(db, 'classes', hw.classId, 'homework', hw.id, 'submissions', uid), quizPayload);
                    showToast(_i18n_t('homework.quizSubmitted','Quiz submitted!')+' ✅', 'success');
                    openHwId = null;
                    load();
                } catch (err) {
                    console.error('[studentHomework quiz submit]', err);
                    // If failure due to offline/network, queue as fallback
                    const isOffline = (typeof navigator !== 'undefined' && navigator.onLine === false) || (err && err.message && /offline|network|Failed to fetch|Failed to get document/i.test(err.message));
                    if (isOffline) {
                        try {
                            await queueOfflineHomework(hw.classId, hw.id, uid, quizPayload);
                            showToast(_i18n_t('homework.willSubmitWhenOnline','Will submit when you\'re back online'), 'info');
                            return;
                        } catch (qe) { console.error('[offlineQueue fallback]', qe); }
                    }
                    showToast(_i18n_t('homework.submitFailed',{error: err.message}), 'error');
                }
            });
        }

        // Manual submit (with optional Cloudinary upload) — D.5 offline queuing via IndexedDB
        const submitBtn = container.querySelector(`#btn-submit-${hw.id}`);
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const textAnswer = container.querySelector(`#text-answer-${hw.id}`)?.value?.trim() || '';
                const fileInput = container.querySelector(`#file-input-${hw.id}`);
                const statusEl = container.querySelector(`#upload-status-${hw.id}`);
                let fileURL = '';

                if (!textAnswer && !fileInput?.files?.length) {
                    showToast(_i18n_t('homework.writeAnswerOrAttach','Write an answer or attach a file.'), 'error');
                    return;
                }

                // D.5: If offline, queue in IndexedDB (not localStorage) and show offline message — auto-retry on online
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    const offlineData = { status: 'submitted', textAnswer, fileURL: '', submittedAt: new Date().toISOString() };
                    try {
                        await queueOfflineHomework(hw.classId, hw.id, uid, offlineData);
                        showToast(_i18n_t('homework.willSubmitWhenOnline','Will submit when you\'re back online'), 'info');
                        submitBtn.disabled = true;
                        submitBtn.textContent = _i18n_t('homework.queuedForSync','Queued for sync');
                        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = "📴 " + _i18n_t('homework.offlineQueued',"You're offline — queued and will submit automatically when back online."); }
                    } catch (e) {
                        console.error('[offlineQueue manual queue]', e);
                        showToast(_i18n_t('homework.queueFailed','Failed to queue submission'), 'error');
                    }
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = _i18n_t('homework.submitting','Submitting…');

                try {
                    if (fileInput?.files?.length > 0) {
                        // If we went offline between click and upload, queue instead
                        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                            throw new Error('offline');
                        }
                        statusEl.style.display = 'block';
                        statusEl.textContent = '⬆️ ' + _i18n_t('homework.uploadStatus','Uploading file to Cloudinary…');
                        fileURL = await uploadToCloudinary(fileInput.files[0]);
                        statusEl.textContent = '✅ ' + _i18n_t('homework.fileUploaded','File uploaded.');
                    }

                    const payload = {
                        status: 'submitted',
                        textAnswer,
                        fileURL,
                        submittedAt: serverTimestamp(),
                    };
                    await setDoc(doc(db, 'classes', hw.classId, 'homework', hw.id, 'submissions', uid), payload);
                    showToast(_i18n_t('homework.assignmentSubmitted','Assignment submitted!')+' ✅', 'success');
                    openHwId = null;
                    load();
                } catch (err) {
                    console.error(err);
                    const isOffline = (typeof navigator !== 'undefined' && navigator.onLine === false) || (err && err.message && /offline|network|Failed to fetch|Failed to get document/i.test(err.message));
                    if (isOffline) {
                        const offlineData = { status: 'submitted', textAnswer, fileURL, submittedAt: new Date().toISOString() };
                        try {
                            await queueOfflineHomework(hw.classId, hw.id, uid, offlineData);
                            showToast(_i18n_t('homework.willSubmitWhenOnline','Will submit when you\'re back online'), 'info');
                            submitBtn.textContent = _i18n_t('homework.queuedForSync','Queued for sync');
                        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = "📴 " + _i18n_t('homework.offlineQueued',"You're offline — queued and will submit automatically when back online."); }
                            return;
                        } catch (qe) { console.error('[offlineQueue fallback queue]', qe); }
                    }
                    showToast(err.message === 'offline' ? _i18n_t('homework.willSubmitWhenOnline','Will submit when you\'re back online') : _i18n_t('homework.uploadFailed','Upload failed. Check your Cloudinary preset.'), 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = _i18n_t('homework.submitAssignment','Submit Assignment');
                }
            });
        }

        // Summarise for me — B.4
        const sumBtn = container.querySelector(`#btn-summarize-${hw.id}`);
        if (sumBtn) {
            let simplerMode = false;
            sumBtn.addEventListener('click', async () => {
                const out = container.querySelector(`#summary-out-${hw.id}`);
                if (!out) return;
                out.innerHTML = `<div class="skeleton-wrap"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>`;
                sumBtn.disabled = true; sumBtn.textContent = _i18n_t('homework.summarising','Summarising...');
                try {
                    const data = await safeApiCall('/api/ai', { action: 'summarizeHomework', homeworkText: hw.description || hw.title, mode: simplerMode ? 'simpler' : undefined });
                    const esc = (s) => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    const fmt = (typeof renderFormattedAnswer === 'function') ? renderFormattedAnswer : (t) => esc(t).replace(/\n/g,'<br>');
                    out.innerHTML = `
                        <div class="glass-card" style="margin-top:8px;background:rgba(124,92,252,0.06);">
                            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${_i18n_t('homework.summary','Summary')}</div>
                            <div style="font-size:14px;line-height:1.7;margin-bottom:12px;">${fmt(data.summary)}</div>
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${_i18n_t('homework.keyPoints','Key Points')}</div>
                            <ul style="padding-left:18px;margin-bottom:12px;">${(data.keyPoints||[]).map(k=>`<li style="font-size:13px;line-height:1.6;">${esc(k)}</li>`).join('')}</ul>
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${_i18n_t('homework.whatYouNeedToDo','What You Need To Do')}</div>
                            <div style="font-size:13px;line-height:1.6;margin-bottom:12px;">${fmt(data.whatYouNeedToDo||'')}</div>
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${_i18n_t('homework.importantConcepts','Important Concepts')}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${(data.importantConcepts||[]).map(c=>`<span class="badge badge-violet">${esc(c)}</span>`).join('')}</div>
                            <button class="btn btn-secondary btn-sm" id="btn-simpler-${hw.id}" style="margin-top:0;">${_i18n_t('homework.explainSimpler','Explain Simpler')}</button>
                        </div>
                    `;
                    const simplerBtn = out.querySelector(`#btn-simpler-${hw.id}`);
                    if (simplerBtn) simplerBtn.addEventListener('click', async () => {
                        simplerMode = !simplerMode;
                        simplerBtn.textContent = simplerMode ? _i18n_t('homework.showOriginal','Show Original') : _i18n_t('homework.explainSimpler','Explain Simpler');
                        sumBtn.click();
                    });
                } catch (err) {
                    out.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;">${_i18n_t('homework.couldNotGenerateSummary',"Couldn't generate a summary right now — you can still read the full assignment above.")}</div>`;
                    console.error('[summarize]', err);
                } finally {
                    sumBtn.disabled = false; sumBtn.textContent = _i18n_t('homework.summariseForMe','Summarise for me');
                }
            });
        }
    }

    // E.2 + Accessibility expansion: TTS, STT, auto-read, simplify, extended-time checks after load
    const _origRenderHomework = render;
    const _origSetup = setupListeners;
    // Wrap render to add enhancements
    const _wrappedRender = () => {
        _origRenderHomework();
        try { if (typeof enhanceInputsWithSTT === 'function') enhanceInputsWithSTT(container); } catch {}
        try { if (typeof enhanceWithSimplify === 'function') enhanceWithSimplify(container); } catch {}
        // Auto-read new content when enabled (homework description)
        try {
            const prefs = window._accessPrefsCache || {};
            if (openHwId && prefs.autoReadNewContent && typeof maybeAutoRead === 'function') {
                const hw = homework.find(h=>h.id===openHwId);
                if (hw && hw.description) {
                    const para = container.querySelector(`#hw-card-${hw.id} p`);
                    maybeAutoRead(hw.description, para);
                }
            }
        } catch {}
        // TTS for homework descriptions (only for open card)
        try {
            if (openHwId) {
                const descPara = container.querySelector(`#hw-card-${openHwId} p`);
                if (descPara && !descPara.dataset.ttsDone && typeof createTTSButtonForText === 'function') {
                    const btn = createTTSButtonForText(() => descPara.textContent || '');
                    btn.style.marginTop = '8px';
                    descPara.insertAdjacentElement('afterend', btn);
                    descPara.dataset.ttsDone = '1';
                }
            }
        } catch {}
        // Extended-time check for open homework
        (async()=>{
            if (!openHwId) return;
            const hw = homework.find(h=>h.id===openHwId);
            if(!hw) return;
            try{
                const snap = await getDoc(doc(db, 'classes', hw.classId, 'extendedTimeSettings', uid));
                if(snap.exists){
                    const d=snap.data();
                    if(d.enabled || d.extraTimeMinutes || d.note){
                        const card = container.querySelector(`#hw-card-${hw.id}`);
                        if(card && !card.querySelector('.ext-time-note')){
                            const note = document.createElement('div');
                            note.className='ext-time-note';
                            note.style.cssText='background:rgba(79,140,255,0.08);border:1px solid rgba(79,140,255,0.2);border-radius:10px;padding:10px;margin-top:10px;font-size:12px;color:#93C5FD;';
                            note.textContent=_i18n_t('homework.extraTimeNote','You have extra time on this assignment') + (d.extraTimeMinutes? ` (+${d.extraTimeMinutes} minutes)`:'') + (d.note? ` — ${d.note}`:'');
                            card.appendChild(note);
                        }
                    }
                }
            }catch{}
        })();
    };
    // Override render and setupListeners to include enhancements (monkey patch container flow)
    render = _wrappedRender;
    // Also ensure STT on inputs inside setupListeners
    setupListeners = (hw) => {
        _origSetup(hw);
        try { if (typeof enhanceInputsWithSTT === 'function') enhanceInputsWithSTT(container); } catch {}
        try {
            const descPara = container.querySelector(`#hw-card-${hw.id} p`);
            if (descPara && !descPara.dataset.ttsDone && typeof createTTSButtonForText === 'function') {
                const btn = createTTSButtonForText(() => descPara.textContent || '');
                btn.style.marginTop='8px';
                descPara.insertAdjacentElement('afterend', btn);
                descPara.dataset.ttsDone='1';
            }
        } catch {}
    };

    await load();
}