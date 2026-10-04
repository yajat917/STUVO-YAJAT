// ─── E.4 Anti-Bullying Reporting ────────────────────────────────
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
// Form fields: Category, Anonymous/Confidential toggle, Description required, Supporting info optional, Date/time optional
// Submit -> wellnessReports with isAnonymous, reportedByUid null if anonymous, status open, auditTrail
// Rules: No student/teacher sees reported list, only own report status via My Reports list, wellnessReports admin-only
// We allow student to see own non-anonymous reports via query, and also store local reference for anonymous via users/{uid}/supportRequests fallback if needed.
// For admin view, moderation.js handles full queue; here we just student form.

async function renderStudentReport(container) {
  const catLabel = (cat) => { const map = { Bullying: 'report.catBullying', Harassment: 'report.catHarassment', 'Threatening Behavior': 'report.catThreatening', Cyberbullying: 'report.catCyberbullying', Exclusion: 'report.catExclusion', Other: 'report.catOther', All: 'report.catAll' }; const key = map[cat]; if (key) { try { const v = _i18n_t(key, cat); if (v && v !== key) return v; } catch {} } return cat || ''; };
  const statusLabelR = (s) => { const map = { open: 'admin.statusOpen', pending: 'admin.statusPending', under_review: 'admin.statusUnderReview', underReview: 'admin.statusUnderReview', escalated: 'admin.statusEscalated', resolved: 'admin.statusResolved', dismissed: 'admin.statusDismissed' }; const key = map[s]; if (key) { try { const v = _i18n_t(key, s); if (v && v !== key) return v; } catch {} } if (!s) return _i18n_t('admin.statusOpen','Open'); return String(s).replace(/_/g, ' '); };
  const uid = appState.user?.uid;
  const userName = appState.userData?.officialName || _i18n_t('auth.student','Student');

  container.innerHTML = `
    <div class="flex-col">
      ${createPageHeader(_i18n_t('report.title','Report a Concern'), _i18n_t('report.subtitle','Your report is private and will be reviewed by a school admin. You can stay anonymous.'))}
      <div class="glass-card">
        <div class="card-label">${_i18n_t('report.newReport','New Report')}</div>
        <div class="form-group">
          <label>${_i18n_t('report.category','Category')} *</label>
          <select class="form-control" id="report-category">
            <option value="Bullying">${catLabel("Bullying")}</option>
            <option value="Harassment">${catLabel("Harassment")}</option>
            <option value="Threatening Behavior">${catLabel("Threatening Behavior")}</option>
            <option value="Cyberbullying">${catLabel("Cyberbullying")}</option>
            <option value="Exclusion">${catLabel("Exclusion")}</option>
            <option value="Other">${catLabel("Other")}</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <span>${_i18n_t('report.privacy','Privacy')} *</span>
          </label>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
            <button class="btn btn-secondary" id="btn-confidential" style="margin-top:0; width:auto; flex:1;">🔒 ${_i18n_t('report.confidential','Confidential (admin sees your name)')}</button>
            <button class="btn btn-secondary" id="btn-anonymous" style="margin-top:0; width:auto; flex:1;">🕵️ ${_i18n_t('report.anonymous','Anonymous (hide my identity)')}</button>
          </div>
          <div id="privacy-hint" style="font-size:12px; color: var(--text-dim); margin-top:8px;"></div>
        </div>
        <div class="form-group">
          <label>${_i18n_t('report.description','Description')} *</label>
          <textarea class="form-control" id="report-description" rows="4" placeholder="${_i18n_t('report.descriptionPlaceholder','Describe what happened...')}"></textarea>
        </div>
        <div class="form-group">
          <label>${_i18n_t('report.supportingInfo','Supporting info')} <span style="color: var(--text-dim); font-weight:400;">${_i18n_t('report.optionalTag','(optional)')}</span></label>
          <textarea class="form-control" id="report-supporting" rows="2" placeholder="${_i18n_t('report.supportingPlaceholder','Links, screenshots description, witnesses...')}"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>${_i18n_t('report.dateTime','Date / time')} <span style="color: var(--text-dim); font-weight:400;">${_i18n_t('report.optionalTag','(optional)')}</span></label>
            <input type="datetime-local" class="form-control" id="report-datetime">
          </div>
          <div class="form-group">
            <label>${_i18n_t('report.location','Location')} ${_i18n_t('report.optionalTag','(optional)')}</label>
            <input type="text" class="form-control" id="report-location" placeholder="${_i18n_t('report.locationPlaceholder','e.g. Classroom 10A, community post')}">
          </div>
        </div>
        <button class="btn" id="btn-submit-report" style="margin-top:8px;">${_i18n_t('report.submitReport','Submit Report')}</button>
        <p style="font-size:11px; color: var(--text-dim); margin-top:10px; line-height:1.5;">${_i18n_t('report.consentNote','By submitting, you agree this information will be reviewed by school admins only.')}</p>
      </div>

      <div class="glass-card" id="my-reports-card">
        <div class="card-label">${_i18n_t('report.myReports','My Reports')}</div>
        <div id="my-reports-list" style="display:flex; flex-direction:column; gap:10px;">
          <div style="text-align:center; padding:20px; color: var(--text-dim); font-size:13px;">${_i18n_t('report.loadingReports','Loading your reports...')}</div>
        </div>
      </div>

      <div class="glass-card status-tab is-info">
        <div style="font-size:13px; font-weight:700; color:#93C5FD;">${_i18n_t('report.needImmediateHelp','Need immediate help?')}</div>
        <p style="font-size:13px; color: var(--text-dim); line-height:1.6; margin-top:6px;">${_i18n_t('report.needImmediateHelpDesc','If you or someone else is in danger, please contact a trusted adult, school counselor, or local helpline right away.')}</p>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <a href="#/student/wellbeing" class="btn btn-secondary btn-sm" style="margin-top:0; width:auto;">${_i18n_t('report.goToWellbeing','Go to Wellbeing')}</a>
          <a href="#/student/wellbeingAssistant" class="btn btn-secondary btn-sm" style="margin-top:0; width:auto;">${_i18n_t('report.talkToAssistant','Talk to Wellbeing Assistant')}</a>
        </div>
      </div>
    </div>
  `;

  let isAnonymous = false;
  const btnConf = container.querySelector('#btn-confidential');
  const btnAnon = container.querySelector('#btn-anonymous');
  const hint = container.querySelector('#privacy-hint');

  function syncPrivacyUI() {
    if (isAnonymous) {
      btnAnon.style.background = 'linear-gradient(135deg,#7C5CFC,#4F8CFF)'; btnAnon.style.color = 'var(--text-bright)'; btnAnon.style.borderColor = 'rgba(124,92,252,0.5)';
      btnConf.style.background = ''; btnConf.style.color = ''; btnConf.style.borderColor = '';
      hint.textContent = _i18n_t('report.privacyHintAnonymous','Anonymous: your report will be submitted without your name or UID. You will not be able to track status afterwards via My Reports, but admins will still review it.');
    } else {
      btnConf.style.background = 'linear-gradient(135deg,#7C5CFC,#4F8CFF)'; btnConf.style.color = 'var(--text-bright)'; btnConf.style.borderColor = 'rgba(124,92,252,0.5)';
      btnAnon.style.background = ''; btnAnon.style.color = ''; btnAnon.style.borderColor = '';
      hint.textContent = _i18n_t('report.privacyHintConfidential','Confidential: your name is shared only with admins reviewing the report.') + ' ' + _i18n_t('report.trackInMyReports','You can track status in My Reports.');
    }
  }
  syncPrivacyUI();
  btnConf.addEventListener('click', () => { isAnonymous = false; syncPrivacyUI(); });
  btnAnon.addEventListener('click', () => { isAnonymous = true; syncPrivacyUI(); });

  // STT enhancement
  try {
    attachSTT(container.querySelector('#report-description'));
    attachSTT(container.querySelector('#report-supporting'));
  } catch {}

  // Submit
  container.querySelector('#btn-submit-report')?.addEventListener('click', async () => {
    const category = container.querySelector('#report-category').value;
    const description = container.querySelector('#report-description').value.trim();
    const supportingInfo = container.querySelector('#report-supporting').value.trim();
    const dateTime = container.querySelector('#report-datetime').value;
    const location = container.querySelector('#report-location').value.trim();
    if (!description) { showToast(_i18n_t('report.descriptionRequired','Description is required'), 'error'); return; }
    const btn = container.querySelector('#btn-submit-report');
    btn.disabled = true; btn.textContent = _i18n_t('report.submitting','Submitting...');
    try {
      const payload = {
        category,
        description,
        supportingInfo: supportingInfo || '',
        dateTime: dateTime || '',
        location: location || '',
        isAnonymous: !!isAnonymous,
        reportedByUid: isAnonymous ? null : uid,
        reportedByName: isAnonymous ? null : userName,
        status: 'open',
        auditTrail: [{ action: 'created', by: isAnonymous ? 'anonymous' : uid, at: new Date().toISOString(), status: 'open' }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'wellnessReports'), payload);
      // Also store a private copy for My Reports if confidential, to allow student read even before rules allow
      if (!isAnonymous) {
        try {
          await setDoc(doc(db, 'users', uid, 'supportRequests', ref.id), {
            type: 'wellness_report',
            wellnessReportId: ref.id,
            category, description, status: 'open', createdAt: serverTimestamp()
          });
        } catch (e) { console.warn('[report mirror]', e); }
      } else {
        // For anonymous, store locally so user knows it was submitted (not queryable)
        try { localStorage.setItem('stuvo_last_anon_report', JSON.stringify({ id: ref.id, category, at: Date.now() })); } catch {}
      }
      showToast(_i18n_t('report.reportSubmitted','Your report has been submitted. A school admin will review it.'), 'success');
      container.querySelector('#report-description').value = '';
      container.querySelector('#report-supporting').value = '';
      container.querySelector('#report-datetime').value = '';
      container.querySelector('#report-location').value = '';
      await loadMyReports();
    } catch (err) {
      console.error('[report submit]', err);
      showToast(_i18n_t('report.failedSubmit','Failed to submit report') + ': ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = _i18n_t('report.submitReport','Submit Report');
    }
  });

  async function loadMyReports() {
    const listEl = container.querySelector('#my-reports-list');
    if (!listEl) return;
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color: var(--text-dim); font-size:13px;">${_i18n_t('report.loadingReports','Loading your reports...')}</div>`;
    let reports = [];
    // Primary: try wellnessReports where reportedByUid == uid (requires rule allow; fallback to supportRequests)
    try {
      const snap = await getDocs(query(collection(db, 'wellnessReports'), where('reportedByUid', '==', uid)));
      snap.forEach(d => reports.push({ id: d.id, ...d.data() }));
    } catch (e) {
      // Fallback: read from users/{uid}/supportRequests where type == wellness_report
      try {
        const snap2 = await getDocs(query(collection(db, 'users', uid, 'supportRequests'), where('type', '==', 'wellness_report')));
        snap2.forEach(d => {
          const data = d.data();
          // need to fetch actual report? But we have mirror status
          reports.push({ id: d.id, category: data.category, description: data.description || '', status: data.status || 'open', createdAt: data.createdAt, wellnessReportId: data.wellnessReportId });
        });
      } catch (e2) { console.error('[myReports fallback]', e2); }
    }
    // Also include supportRequests mirror if wellnessReports query succeeded but some missing due to rule, merge
    // For anonymous, we cannot show; but show hint
    const anonInfo = (() => { try { return JSON.parse(localStorage.getItem('stuvo_last_anon_report')||'null'); } catch { return null; } })();
    if (reports.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:18px;">
          <div style="font-size:28px; margin-bottom:8px;">📋</div>
          <div style="font-size:13px; color: var(--text-dim);">${_i18n_t('report.noReports','No reports yet.')}</div>
          ${anonInfo ? `<div style="font-size:12px; color: #FDE68A; margin-top:10px; background: rgba(245,158,11,0.08); padding:8px; border-radius:8px;">${_i18n_t('report.anonymousNotListed', {category: catLabel(anonInfo.category)})}</div>` : ''}
        </div>
      `;
      return;
    }
    // Sort newest first
    reports.sort((a,b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tb - ta;
    });
    const statusColor = (s) => {
      if (s === 'open') return 'badge-yellow';
      if (s === 'under_review' || s === 'underReview') return 'badge-blue';
      if (s === 'escalated') return 'badge-violet';
      if (s === 'resolved') return 'badge-green';
      if (s === 'dismissed') return 'badge-gray';
      return 'badge-gray';
    };
    const statusLabel = (s) => statusLabelR(s);
    listEl.innerHTML = reports.map(r => `
      <div style="background: rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:14px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <div style="font-weight:700; font-size:14px;">${catLabel(r.category) || _i18n_t('report.reportFallback','Report')} ${r.isAnonymous ? '· ' + _i18n_t('report.anonymousTag','Anonymous') : ''}</div>
            <div style="font-size:12px; color: var(--text-dim); margin-top:4px; line-height:1.5;">${(r.description||'').slice(0,120)}${(r.description||'').length>120?'...':''}</div>
            <div style="font-size:11px; color: var(--text-dim); margin-top:6px;">${r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleString((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN')) : new Date(r.createdAt).toLocaleString((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN'))) : _i18n_t('common.timeRecently','recently')}</div>
          </div>
          <span class="badge ${statusColor(r.status)}">${statusLabel(r.status)}</span>
        </div>
        ${r.auditTrail && r.auditTrail.length ? `<div style="font-size:11px; color: var(--text-dim); margin-top:8px;">${_i18n_t('report.lastUpdate', {action: r.auditTrail[r.auditTrail.length-1].action, status: statusLabelR(r.auditTrail[r.auditTrail.length-1].status)})}</div>` : ''}
      </div>
    `).join('') + (anonInfo ? `<div style="font-size:12px; color: #FDE68A; margin-top:10px; background: rgba(245,158,11,0.08); padding:8px; border-radius:8px;">${_i18n_t('report.anonSubmittedNote', {category: catLabel(anonInfo.category)})}</div>` : '');
  }

  loadMyReports();

  // ─── Accessibility integrations ───────────────────────────────
  try {
    const prefs = window._accessPrefsCache || {};
    if (prefs.stepByStepForms && typeof makeStepForm === 'function') {
      const formCard = container.querySelector('.glass-card');
      if (formCard) {
        formCard.id = 'report-step-form';
        // Ensure groups are direct children for step splitter
        makeStepForm(container, '#report-step-form');
      }
    }
    if (prefs.autoReadNewContent && typeof maybeAutoRead === 'function') {
      const headerText = container.querySelector('.page-sub')?.textContent || '';
      if (headerText) maybeAutoRead(headerText, container.querySelector('.glass-card'));
    }
    if (typeof enhanceWithSimplify === 'function') enhanceWithSimplify(container);
    if (typeof enhanceInputsWithSTT === 'function') enhanceInputsWithSTT(container);
  } catch (e) { console.error('[report accessibility]', e); }
}