const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History'];
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
// Personalized subjects — uses canonical taxonomy ∪ enrolled classes (exact dedupe). Falls back to SUBJECTS.
async function getPracticePersonalizedSubjects(){
  try{
    var uid2 = (typeof appState!=='undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
    var grade = (typeof appState!=='undefined' && appState.userData) ? appState.userData.grade : null;
    var stream = (typeof appState!=='undefined' && appState.userData) ? appState.userData.stream : null;
    var classIds = (typeof appState!=='undefined' && appState.userData && Array.isArray(appState.userData.classIds)) ? appState.userData.classIds : [];
    var enrolled=[];
    if(typeof fetchEnrolledSubjects==='function' && uid2) enrolled = await fetchEnrolledSubjects(uid2, classIds);
    else {
      for(var i=0;i<classIds.length;i++){ try{ var s=await getDoc(doc(db,'classes',classIds[i])); if(s.exists && s.data().subject) enrolled.push(s.data().subject);}catch(e){} }
      enrolled=[...new Set(enrolled)];
    }
    if(typeof getMergedSubjects==='function') return getMergedSubjects(grade, stream, enrolled);
    if(typeof getSubjectsForStudent==='function'){
      var tax=getSubjectsForStudent(grade, stream);
      if(!grade && !tax.length) return enrolled.length?enrolled:SUBJECTS.slice();
      if(!tax.length) return enrolled.length?enrolled:SUBJECTS.slice();
      return [...new Set([].concat(tax, enrolled))];
    }
    return enrolled.length?enrolled:SUBJECTS.slice();
  }catch(e){ return SUBJECTS.slice(); }
}
// Canonical grade + language for AI calls (Part 5: no module invents these)
function getPracticeGrade(){
  try{ return (typeof appState!=='undefined' && appState.userData && appState.userData.grade != null) ? String(appState.userData.grade) : ''; }catch(e){ return ''; }
}
function getPracticeLangName(){
  try{
    var code = (typeof window!=='undefined' && window.currentUserLanguage) ? window.currentUserLanguage : 'en';
    var map = { en:'English', hi:'Hindi', bn:'Bengali', mr:'Marathi', te:'Telugu', ta:'Tamil' };
    if (map[code]) return map[code];
    return code || 'English';
  }catch(e){ return 'English'; }
}

async function renderStudentPracticeBits(container) {
    const uid = appState.user?.uid;
    const userData = appState.userData;
    const today = new Date().toISOString().split('T')[0];

    let todayBit = null;

    container.innerHTML = `<div class="flex-col">${createPageHeader(_i18n_t('nav.practiceBits','Practice Bits'), _i18n_t('practiceBits.subtitle','One AI-generated question per day to keep you sharp'))}<div class="spinner"></div></div>`;

    try {
        const todaySnap = await getDoc(doc(db, 'users', uid, 'practiceBits', today));
        if (todaySnap.exists) todayBit = todaySnap.data();
    } catch (err) {
        console.error('[practiceBits load today]', err);
    }

    let historyRaw = [];

    async function loadHistory() {
        historyRaw = [];
        try {
            const start = new Date();
            start.setDate(start.getDate() - 7);
            const startStr = start.toISOString().split('T')[0];
            const histSnap = await getDocs(collection(db, 'users', uid, 'practiceBits'));
            histSnap.forEach(d => {
                const h = d.data();
                if (d.id >= startStr && d.id < today) historyRaw.push({ date: d.id, ...h });
            });
        } catch (err) {
            console.error('[practiceBits history]', err);
        }
        historyRaw.sort((a, b) => b.date.localeCompare(a.date));
    }

    let personalizedSubjectsForBits = SUBJECTS.slice();
    (async function(){ try{ personalizedSubjectsForBits = await getPracticePersonalizedSubjects(); }catch(e){} })();
    function render() {
        const subjects = personalizedSubjectsForBits && personalizedSubjectsForBits.length ? personalizedSubjectsForBits : (userData?.subjects || SUBJECTS.slice(0, 3));
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.practiceBits','Practice Bits'), _i18n_t('practiceBits.subtitle','One AI-generated question per day to keep you sharp'))}

                <div class="glass-card" id="practice-card">
                    ${todayBit ? renderBitCard(todayBit) : renderGenerateCard()}
                </div>

                ${historyRaw.length ? createGlassCard('📜 ' + _i18n_t('practiceBits.past7Days','Past 7 Days'), `
                    ${historyRaw.map((h, i) => `
                        <div class="hw-item">
                            <div>
                                <div class="hw-title">${h.question?.slice(0, 70)}…</div>
                                <div class="hw-sub">${h.subject} · ${h.date}</div>
                            </div>
                            <div class="hw-badge ${h.isCorrect ? 'success' : 'urgent'}">
                                ${h.isCorrect ? '✓ ' + _i18n_t('practiceBits.correct','Correct') : '✗ ' + _i18n_t('practiceBits.incorrect','Incorrect')}
                            </div>
                        </div>
                    `).join('')}
                `, '', 0.15) : ''}
            </div>
        `;

        setupListeners();
    }

    function renderGenerateCard() {
        return `
            <div style="text-align:center;padding:20px;">
                <div style="font-size:44px;margin-bottom:12px;">⚡</div>
                <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:700;margin-bottom:8px;">
                    ${_i18n_t('practiceBits.readyForToday',"Ready for Today's Practice?")}
                </div>
                <p style="color:var(--text-dim);font-size:14px;margin-bottom:20px;">
                    ${_i18n_t('practiceBits.generateDaily','Generate your daily AI question and keep your streak alive!')}
                </p>
                <button class="btn" id="btn-generate-bit" style="width:auto;">${_i18n_t('practiceBits.generateToday',"Generate Today's Question")} ⚡</button>
            </div>
        `;
    }

    function renderBitCard(bit) {
        if (bit.studentAnswer !== undefined) {
            return `
                <div class="card-label">${bit.subject} · ${today}</div>
                <p style="font-size:15px;font-weight:500;line-height:1.7;margin-bottom:16px;">${bit.question}</p>
                ${bit.hint ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">💡 ${_i18n_t('practiceBits.hint','Hint')}: ${bit.hint}</div>` : ''}
                <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px;margin-bottom:14px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">${_i18n_t('practiceBits.yourAnswer','Your Answer')}:</div>
                    <div style="font-size:14px;">${bit.studentAnswer}</div>
                </div>
                <div style="background:${bit.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
                    border:1px solid ${bit.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};
                    border-radius:12px;padding:16px;">
                    <div style="font-weight:600;color:${bit.isCorrect ? '#6EE7B7' : '#FCA5A5'};margin-bottom:8px;">
                        ${bit.isCorrect ? '✅ ' + _i18n_t('practiceBits.correct','Correct') + '!' : '❌ ' + _i18n_t('practiceBits.notQuite','Not quite…')}
                        ${!bit.isCorrect && bit.correctAnswer ? `<span style="color:var(--text-dim);font-size:12px;"> ${_i18n_t('practiceBits.correct','Correct')}: ${bit.correctAnswer}</span>` : ''}
                    </div>
                    <div style="font-size:13px;line-height:1.7;color:var(--text-dim);">${bit.aiFeedback}</div>
                </div>
                <div style="margin-top:12px;text-align:center;font-size:12px;color:var(--text-dim);">
                    ${_i18n_t('practiceBits.comeBackTomorrow','Come back tomorrow for a new question!')} 🌟
                </div>
            `;
        }

        return `
            <div class="card-label">${bit.subject} · ${today}</div>
            <p style="font-size:15px;font-weight:500;line-height:1.7;margin-bottom:${bit.hint ? '8px' : '16px'}">${bit.question}</p>
            ${bit.hint ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;
                background:rgba(124,92,252,0.08);border-radius:8px;padding:8px 12px;">
                💡 ${_i18n_t('practiceBits.hint','Hint')}: ${bit.hint}</div>` : ''}
            <div class="form-group">
                <label>${_i18n_t('practiceBits.yourAnswer','Your Answer')}</label>
                <textarea class="form-control" id="bit-answer" rows="3"
                    placeholder="${_i18n_t('practiceBits.typeYourAnswer','Type your answer here…')}"></textarea>
            </div>
            <button class="btn" id="btn-submit-bit" style="margin-top:4px;">${_i18n_t('practiceBits.submitAnswer','Submit Answer')}</button>
        `;
    }

    function setupListeners() {
        const genBtn = container.querySelector('#btn-generate-bit');
        if (genBtn) {
            genBtn.addEventListener('click', async () => {
                genBtn.disabled = true; genBtn.textContent = _i18n_t('practiceBits.generating','Generating…');
                try {
                    var subsForGen = personalizedSubjectsForBits && personalizedSubjectsForBits.length ? personalizedSubjectsForBits : SUBJECTS.slice(0,3);
                    // Deterministic rotation: pick subject based on day-of-year modulo length to avoid random, uses personalized list
                    var dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0))/86400000);
                    var rotated = subsForGen[dayOfYear % subsForGen.length] || subsForGen[0];
                    // Pass full list; backend may pick first but we provide rotated as primary
                    const data = await safeApiCall('/api/ai', { action: 'practiceBit', subjects: subsForGen, subject: rotated, grade: getPracticeGrade(), languageName: getPracticeLangName() });
                    todayBit = { subject: data.subject, question: data.question, hint: data.hint || '' };
                    await setDoc(doc(db, 'users', uid, 'practiceBits', today), todayBit);
                    render();
                } catch (err) {
                    showToast(err.message, 'error');
                    genBtn.disabled = false; genBtn.textContent = _i18n_t('practiceBits.generateToday',"Generate Today's Question") + ' ⚡';
                }
            });
        }

        const submitBtn = container.querySelector('#btn-submit-bit');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const answer = container.querySelector('#bit-answer')?.value?.trim();
                if (!answer) { showToast(_i18n_t('practiceBits.pleaseWriteAnswer','Please write your answer first.'), 'error'); return; }
                submitBtn.disabled = true; submitBtn.textContent = _i18n_t('practiceBits.checking','Checking…');
                try {
                    const data = await safeApiCall('/api/ai', {
                        action: 'checkAnswer', question: todayBit.question, studentAnswer: answer, subject: todayBit.subject, grade: getPracticeGrade(), languageName: getPracticeLangName()
                    });
                    todayBit = { ...todayBit, studentAnswer: answer, isCorrect: data.isCorrect, correctAnswer: data.correctAnswer, aiFeedback: data.feedback };
                    await setDoc(doc(db, 'users', uid, 'practiceBits', today), todayBit);
                    render();
                } catch (err) {
                    showToast(err.message, 'error');
                    submitBtn.disabled = false; submitBtn.textContent = _i18n_t('practiceBits.submitAnswer','Submit Answer');
                }
            });
        }
    }

    await loadHistory();
    render();
}