async function renderAdminModeration(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    let communityReports = [];
    let wellnessReports = [];
    let supportRequests = [];
    let currentTab = 'wellness'; // default to wellness per E.4

    function fmtTime(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d)) return '';
        return d.toLocaleDateString((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN'), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    // Stored category values stay English (Firestore data); display labels are translated.
    function catLabel(cat) {
        const map = { Bullying: 'report.catBullying', Harassment: 'report.catHarassment', 'Threatening Behavior': 'report.catThreatening', Cyberbullying: 'report.catCyberbullying', Exclusion: 'report.catExclusion', Other: 'report.catOther', All: 'report.catAll' };
        const key = map[cat];
        if (key) { try { const v = _i18n_t(key, cat); if (v && v !== key) return v; } catch {} }
        return cat || '';
    }
    // Stored status values stay English (data); display labels are translated.
    function statusLabelAdmin(s) {
        const map = { open: 'admin.statusOpen', pending: 'admin.statusPending', under_review: 'admin.statusUnderReview', underReview: 'admin.statusUnderReview', escalated: 'admin.statusEscalated', resolved: 'admin.statusResolved', dismissed: 'admin.statusDismissed' };
        const key = map[s];
        if (key) { try { const v = _i18n_t(key, s); if (v && v !== key) return v; } catch {} }
        if (!s) return _i18n_t('admin.statusOpen','Open');
        return String(s).replace(/_/g, ' ');
    }
    function statusBadge(status) {
        const map = {
            open: { label: _i18n_t('admin.statusOpen','Open'), cls: 'badge-yellow' },
            pending: { label: _i18n_t('admin.statusOpen','Open'), cls: 'badge-yellow' },
            under_review: { label: _i18n_t('admin.statusUnderReview','Under Review'), cls: 'badge-blue' },
            underReview: { label: _i18n_t('admin.statusUnderReview','Under Review'), cls: 'badge-blue' },
            escalated: { label: _i18n_t('admin.statusEscalated','Escalated'), cls: 'badge-violet' },
            resolved: { label: _i18n_t('admin.statusResolved','Resolved'), cls: 'badge-green' },
            dismissed: { label: _i18n_t('admin.statusDismissed','Dismissed'), cls: 'badge-gray' }
        };
        const m = map[status] || { label: status || _i18n_t('admin.statusOpen','Open'), cls: 'badge-gray' };
        return `<span class="badge ${m.cls}">${m.label}</span>`;
    }

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.moderationQueue','Moderation Queue'), _i18n_t('admin.modSub','Review community reports, wellbeing concerns, and counselor requests'))}
                <div class="tabs" id="mod-tabs-bar">
                    <button class="tab-btn ${currentTab==='wellness'?'active':''}" data-tab="wellness">🛡️ ${_i18n_t('admin.wellnessTab','Wellness Reports')}</button>
                    <button class="tab-btn ${currentTab==='community'?'active':''}" data-tab="community">💬 ${_i18n_t('admin.communityTab','Community')}</button>
                    <button class="tab-btn ${currentTab==='support'?'active':''}" data-tab="support">📅 ${_i18n_t('admin.supportTab','Support Requests')}</button>
                </div>
                <div id="mod-tab-wellness" class="tab-panel ${currentTab==='wellness'?'active':''}">${createSkeleton(3)}</div>
                <div id="mod-tab-community" class="tab-panel ${currentTab==='community'?'active':''}" style="display:${currentTab==='community'?'block':'none'};">${createSkeleton(2)}</div>
                <div id="mod-tab-support" class="tab-panel ${currentTab==='support'?'active':''}" style="display:${currentTab==='support'?'block':'none'};">${createSkeleton(2)}</div>
            </div>
        `;
        // Bind tabs
        container.querySelectorAll('#mod-tabs-bar .tab-btn').forEach(btn=>{
            btn.addEventListener('click', ()=>{
                currentTab = btn.dataset.tab;
                container.querySelectorAll('#mod-tabs-bar .tab-btn').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                container.querySelectorAll('.tab-panel').forEach(p=> p.style.display='none');
                const target = container.querySelector('#mod-tab-'+currentTab);
                if(target) target.style.display='block';
                renderAll();
            });
        });

        // Load community reports (existing)
        try {
            const snap = await getDocs(collectionGroup(db, 'reports'));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, postId: d.ref.parent.parent.id, ...d.data() }));
            rows.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
            communityReports = rows;
        } catch (err) {
            console.error('[adminModeration community]', err);
            communityReports = [];
        }
        // Load wellnessReports (E.4)
        try {
            const snap = await getDocs(collection(db, 'wellnessReports'));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            // fallback sort
            rows.sort((a,b)=>{
                const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt? new Date(a.createdAt).getTime():0);
                const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt? new Date(b.createdAt).getTime():0);
                return tb - ta;
            });
            wellnessReports = rows;
        } catch (err) {
            console.error('[adminModeration wellness]', err);
            wellnessReports = [];
        }
        // Load supportRequests (counselor appointments, trusted adult) via collectionGroup
        try {
            const snap = await getDocs(collectionGroup(db, 'supportRequests'));
            const rows = [];
            snap.forEach(d => {
                const data = d.data();
                // only counselor_appointment and trusted_adult and wellness_report mirrors
                if (['counselor_appointment','trusted_adult'].includes(data.type)) {
                    rows.push({ id: d.id, studentUid: d.ref.parent.parent.id, ...data });
                }
            });
            rows.sort((a,b)=>{
                const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return tb - ta;
            });
            supportRequests = rows;
        } catch (err) {
            console.error('[adminModeration support]', err);
            supportRequests = [];
        }

        renderAll();
    }

    function renderAll(){
        renderCommunity();
        renderWellness();
        renderSupport();
    }

    function renderCommunity(){
        const host = container.querySelector('#mod-tab-community');
        if(!host) return;
        const pending = communityReports.filter(r => r.status === 'pending');
        const resolved = communityReports.filter(r => r.status === 'resolved');
        const dismissed = communityReports.filter(r => r.status === 'dismissed');
        host.innerHTML = `
            <div class="grid-cols-3" style="margin-bottom:16px;">
                ${createGlassCard('', `<div class="stat-num" style="color:#FDE68A;">${pending.length}</div><div class="stat-label">${_i18n_t('admin.pendingBadge','Pending')}</div>`, '', 0.05)}
                ${createGlassCard('', `<div class="stat-num" style="color:#6EE7B7;">${resolved.length}</div><div class="stat-label">${_i18n_t('admin.statusResolved','Resolved')}</div>`, '', 0.1)}
                ${createGlassCard('', `<div class="stat-num" style="color:var(--text-dim);">${dismissed.length}</div><div class="stat-label">${_i18n_t('admin.statusDismissed','Dismissed')}</div>`, '', 0.15)}
            </div>
            ${pending.length === 0
                ? createGlassCard('', createEmptyState(_i18n_t('admin.noCommunityReports','No community reports to review'), _i18n_t('admin.queueClear','The moderation queue is clear. 🎉'), '🛡️'), '', 0.2)
                : pending.map((r, i) => `
                    <div class="glass-card" id="creport-${r.id}">
                        <div class="card-header">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:15px;font-weight:600;">${r.type || _i18n_t('report.reportFallback','Report')}</div>
                                <div class="hw-sub">${_i18n_t('admin.reportedBy', {name: (r.reporterName || r.reporterUid || _i18n_t('admin.anonymousLabel','Anonymous'))})} · ${fmtTime(r.createdAt)}</div>
                            </div>
                            <span class="badge badge-yellow">${_i18n_t('admin.pendingBadge','Pending')}</span>
                        </div>
                        <p style="font-size:14px;line-height:1.7;color:var(--text);margin:12px 0 0;">${(r.detail||_i18n_t('admin.noDetails','No details.')).replace(/</g,'&lt;')}</p>
                        ${r.targetName ? `<div class="hw-sub" style="margin-top:8px;">🚩 ${_i18n_t('admin.targetLabel', {name: r.targetName})}</div>` : ''}
                        <div class="divider" style="margin:14px 0;"></div>
                        <div style="display:flex;gap:10px;justify-content:flex-end;">
                            <button class="btn btn-secondary" data-c-action="dismiss" data-id="${r.id}" style="margin-top:0;">${_i18n_t('admin.dismissBtn','Dismiss')}</button>
                            <button class="btn" data-c-action="resolve" data-id="${r.id}" style="margin-top:0;">${_i18n_t('admin.resolveBtn','Resolve')}</button>
                        </div>
                    </div>
                `).join('')}
            ${(resolved.length || dismissed.length) ? createGlassCard(_i18n_t('admin.historyTitle','History'), `
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${[...resolved, ...dismissed].map((r, i) => `
                        <div class="hw-item">
                            <div>
                                <div class="hw-title">${r.type || _i18n_t('report.reportFallback','Report')} · ${r.targetName || ''}</div>
                                <div class="hw-sub">${fmtTime(r.createdAt)}</div>
                            </div>
                            <div class="hw-badge ${r.status === 'resolved' ? 'success' : ''}">
                                ${r.status === 'resolved' ? _i18n_t('admin.resolvedBadge','✓ Resolved') : _i18n_t('admin.dismissedBadge','Dismissed')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `, '', 0.35) : ''}
        `;
        host.querySelectorAll('[data-c-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const action = btn.dataset.cAction;
                const report = communityReports.find(r => r.id === id);
                btn.disabled = true;
                btn.textContent = action === 'resolve' ? _i18n_t('admin.resolving','Resolving…') : _i18n_t('admin.dismissing','Dismissing…');
                try {
                    await updateDoc(doc(db, 'communityPosts', report?.postId || '_', 'reports', id), {
                        status: action,
                        resolvedBy: appState.user?.uid || '',
                        resolvedAt: serverTimestamp(),
                    });
                    showToast((action === 'resolve' ? _i18n_t('admin.reportResolved','Report resolved') : _i18n_t('admin.reportDismissed','Report dismissed')) + (action === 'resolve' ? ' ✅' : ''), action === 'resolve' ? 'success' : '');
                    load();
                } catch (err) {
                    console.error('[moderation community]', err);
                    showToast(_i18n_t('admin.reportActionFailed','Failed to {action} report').replace('{action}', action) + ': ' + err.message, 'error');
                    load();
                }
            });
        });
    }

    function renderWellness(){
        const host = container.querySelector('#mod-tab-wellness');
        if(!host) return;
        const categories = ['All','Bullying','Harassment','Threatening Behavior','Cyberbullying','Exclusion','Other'];
        const statuses = ['open','under_review','escalated','resolved','dismissed'];
        // Filter state stored on container
        if(!host.dataset.filterCat) host.dataset.filterCat = 'All';
        if(!host.dataset.filterStatus) host.dataset.filterStatus = 'All';
        const fCat = host.dataset.filterCat;
        const fStatus = host.dataset.filterStatus;
        let filtered = wellnessReports.slice();
        if(fCat!=='All') filtered = filtered.filter(r=> (r.category||'Other')===fCat);
        if(fStatus!=='All') filtered = filtered.filter(r=> (r.status||'open')===fStatus);
        // Stats
        const openCount = wellnessReports.filter(r=> (r.status||'open')==='open').length;
        const reviewCount = wellnessReports.filter(r=> r.status==='under_review').length;
        const escCount = wellnessReports.filter(r=> r.status==='escalated').length;
        const resolvedCount = wellnessReports.filter(r=> r.status==='resolved').length;

        host.innerHTML = `
            <div class="grid-cols-3" style="margin-bottom:16px;">
                ${createGlassCard('', `<div class="stat-num" style="color:#FDE68A;">${openCount}</div><div class="stat-label">${_i18n_t('admin.statusOpen','Open')}</div>`, '', 0.05)}
                ${createGlassCard('', `<div class="stat-num" style="color:#93C5FD;">${reviewCount}</div><div class="stat-label">${_i18n_t('admin.statusUnderReview','Under Review')}</div>`, '', 0.08)}
                ${createGlassCard('', `<div class="stat-num" style="color:#C4B5FD;">${escCount}</div><div class="stat-label">${_i18n_t('admin.statusEscalated','Escalated')}</div>`, '', 0.10)}
                ${createGlassCard('', `<div class="stat-num" style="color:#6EE7B7;">${resolvedCount}</div><div class="stat-label">${_i18n_t('admin.statusResolved','Resolved')}</div>`, '', 0.12)}
            </div>
            <div class="glass-card" style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                <div style="font-weight:700; font-size:13px;">${_i18n_t('admin.filtersLabel','Filters:')}</div>
                <select class="form-control" id="wellness-filter-cat" style="width:auto; max-width:200px;">
                    ${categories.map(c=>`<option value="${c}" ${c===fCat?'selected':''}>${catLabel(c)}</option>`).join('')}
                </select>
                <select class="form-control" id="wellness-filter-status" style="width:auto; max-width:200px;">
                    <option value="All" ${fStatus==='All'?'selected':''}>${_i18n_t('admin.allStatuses','All statuses')}</option>
                    ${statuses.map(s=>`<option value="${s}" ${s===fStatus?'selected':''}>${statusLabelAdmin(s)}</option>`).join('')}
                </select>
                <span style="font-size:12px; color: var(--text-dim); margin-left:auto;">${_i18n_t('admin.reportsCount', {count: filtered.length})}</span>
            </div>
            ${filtered.length===0
                ? `<div class="glass-card">${createEmptyState(_i18n_t('admin.noWellnessReports','No wellness reports matching filters'), _i18n_t('admin.changeFilters','Try changing category or status.'), '🛡️')}</div>`
                : filtered.map((r,i)=>`
                    <div class="glass-card" id="wreport-${r.id}">
                        <div class="card-header">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:15px;font-weight:700;">${catLabel(r.category || 'Other')} ${r.isAnonymous ? '<span style="font-size:11px;color:var(--text-dim);font-weight:400;">· ' + _i18n_t('admin.anonymousLabel','Anonymous') + '</span>' : ''}</div>
                                <div class="hw-sub">
                                    ${r.isAnonymous ? _i18n_t('admin.anonymousLabel','Anonymous') : (r.reportedByName || r.reportedByUid || _i18n_t('auth.student','Student'))} · ${fmtTime(r.createdAt)}
                                    ${r.assignedTo ? `· ${_i18n_t('admin.assignedTo', {name: (r.assignedTo===appState.user?.uid ? _i18n_t('admin.assignedYou','you') : r.assignedTo)})}` : `· ${_i18n_t('admin.unassigned','Unassigned')}`}
                                    ${r.location ? `· ${r.location}` : ''}
                                </div>
                            </div>
                            ${statusBadge(r.status||'open')}
                        </div>
                        <div style="margin-top:12px;">
                            <div style="font-size:13px;font-weight:600;color:var(--text-dim);margin-bottom:4px;">${_i18n_t('admin.descriptionLabel','Description')}</div>
                            <p style="font-size:14px;line-height:1.7;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:10px;padding:12px;">${(r.description||_i18n_t('admin.noDetails','No details.')).replace(/</g,'&lt;')}</p>
                            ${r.supportingInfo ? `<div style="margin-top:10px;"><div style="font-size:12px;font-weight:600;color:var(--text-dim);">${_i18n_t('admin.supportingInfoLabel','Supporting info')}</div><p style="font-size:13px;color:var(--text-dim);margin-top:4px;">${r.supportingInfo.replace(/</g,'&lt;')}</p></div>` : ''}
                            ${r.dateTime ? `<div style="font-size:12px;color:var(--text-dim);margin-top:8px;">${_i18n_t('admin.incidentTime', {time: r.dateTime})}</div>` : ''}
                        </div>
                        ${r.auditTrail && r.auditTrail.length ? `
                            <div style="margin-top:12px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:10px;padding:10px;">
                                <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;">${_i18n_t('admin.auditTrail','Audit trail')}</div>
                                <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
                                    ${r.auditTrail.slice(-5).map(a=>`<div style="font-size:11px;color:var(--text-dim);display:flex;justify-content:space-between;gap:12px;"><span>${a.action} · ${a.status||''} by ${a.by||'admin'}</span><span>${a.at ? new Date(a.at).toLocaleString((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN')) : ''}</span></div>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="divider" style="margin:14px 0;"></div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                            <select class="form-control" data-wellness-status="${r.id}" style="width:auto; max-width:200px;">
                                ${statuses.map(s=>`<option value="${s}" ${(r.status||'open')===s?'selected':''}>${statusLabelAdmin(s)}</option>`).join('')}
                            </select>
                            <button class="btn btn-secondary btn-sm" data-wellness-assign="${r.id}" style="margin-top:0;width:auto;">${r.assignedTo===appState.user?.uid ? (_i18n_t('admin.assignedToYou','Assigned to you') + ' ✓') : _i18n_t('admin.assignToMe','Assign to me')}</button>
                            <button class="btn btn-sm" data-wellness-save="${r.id}" style="margin-top:0;width:auto;">${_i18n_t('admin.saveStatus','Save status')}</button>
                            <span style="font-size:11px;color:var(--text-dim);margin-left:auto;">ID: ${r.id.slice(0,8)}</span>
                        </div>
                    </div>
                `).join('')}
        `;
        // Filter listeners
        host.querySelector('#wellness-filter-cat')?.addEventListener('change', e=>{
            host.dataset.filterCat = e.target.value;
            renderWellness();
        });
        host.querySelector('#wellness-filter-status')?.addEventListener('change', e=>{
            host.dataset.filterStatus = e.target.value;
            renderWellness();
        });
        // Assign to me
        host.querySelectorAll('[data-wellness-assign]').forEach(btn=>{
            btn.addEventListener('click', async()=>{
                const id = btn.dataset.wellnessAssign;
                btn.disabled = true; btn.textContent = _i18n_t('admin.assigning','Assigning...');
                try{
                    const ref = doc(db, 'wellnessReports', id);
                    const cur = wellnessReports.find(r=>r.id===id);
                    const newTrail = [...(cur.auditTrail||[]), { action:'assigned', by: appState.user?.uid||'admin', at: new Date().toISOString(), status: cur.status||'open' }];
                    await updateDoc(ref, { assignedTo: appState.user?.uid||'', assignedAt: serverTimestamp(), auditTrail: newTrail, updatedAt: serverTimestamp() });
                    showToast(_i18n_t('admin.assignedToYou','Assigned to you'),'success');
                    load();
                } catch(e){ console.error(e); showToast(_i18n_t('admin.assignFailed','Failed to assign'),'error'); btn.disabled=false; btn.textContent=_i18n_t('admin.assignToMe','Assign to me'); }
            });
        });
        // Save status
        host.querySelectorAll('[data-wellness-save]').forEach(btn=>{
            btn.addEventListener('click', async()=>{
                const id = btn.dataset.wellnessSave;
                const sel = host.querySelector(`[data-wellness-status="${id}"]`);
                if(!sel) return;
                const newStatus = sel.value;
                btn.disabled = true; btn.textContent = _i18n_t('admin.saving','Saving...');
                try{
                    const ref = doc(db, 'wellnessReports', id);
                    const cur = wellnessReports.find(r=>r.id===id);
                    const newTrail = [...(cur.auditTrail||[]), { action:'status_change', by: appState.user?.uid||'admin', at: new Date().toISOString(), status: newStatus, prevStatus: cur.status||'open' }];
                    await updateDoc(ref, { status: newStatus, auditTrail: newTrail, updatedAt: serverTimestamp() });
                    // also mirror to supportRequests if exists? not needed
                    showToast(_i18n_t('admin.statusUpdated', {status: statusLabelAdmin(newStatus)}),'success');
                    load();
                } catch(e){ console.error(e); showToast(_i18n_t('admin.updateStatusFailed','Failed to update status'),'error'); btn.disabled=false; btn.textContent=_i18n_t('admin.saveStatus','Save status'); }
            });
        });
    }

    function renderSupport(){
        const host = container.querySelector('#mod-tab-support');
        if(!host) return;
        if(supportRequests.length===0){
            host.innerHTML = `<div class="glass-card">${createEmptyState(_i18n_t('admin.noSupportRequests','No support requests'), _i18n_t('admin.supportRequestsSub','Counselor appointment and trusted adult requests will appear here.'), '📅')}</div>`;
            return;
        }
        host.innerHTML = supportRequests.map((r,i)=>`
            <div class="glass-card">
                <div class="card-header">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;font-weight:700;">${r.type==='counselor_appointment' ? ('📅 ' + _i18n_t('admin.counselorAppt','Counselor Appointment')) : ('🧑‍🏫 ' + _i18n_t('admin.trustedAdult','Trusted Adult'))} · ${r.studentUid||_i18n_t('admin.anonymousLabel','Anonymous')}</div>
                        <div class="hw-sub">${fmtTime(r.createdAt)} · ${_i18n_t('admin.statusWithLabel', {status: statusLabelAdmin(r.status||'open')})}</div>
                    </div>
                    ${statusBadge(r.status||'open')}
                </div>
                <div style="margin-top:10px;font-size:13px;line-height:1.6;">
                    ${r.type==='counselor_appointment' ? `
                        <div><strong>${_i18n_t('admin.preferredLabel','Preferred:')}</strong> ${r.preferredDate||''} ${r.preferredTime||''}</div>
                        ${r.reason ? `<div style="margin-top:6px;"><strong>${_i18n_t('admin.reasonLabel','Reason:')}</strong> ${r.reason.replace(/</g,'&lt;')}</div>` : ''}
                    ` : `
                        <div><strong>${_i18n_t('admin.messageLabel','Message:')}</strong> ${(r.message||'').replace(/</g,'&lt;')}</div>
                        ${r.contact ? `<div style="margin-top:6px;"><strong>${_i18n_t('admin.contactLabel','Contact:')}</strong> ${r.contact}</div>` : ''}
                    `}
                </div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                    <select class="form-control" data-support-status="${r.id}" style="width:auto;">
                        <option value="open" ${r.status==='open'?'selected':''}>${statusLabelAdmin('open')}</option>
                        <option value="under_review" ${r.status==='under_review'?'selected':''}>${statusLabelAdmin('under_review')}</option>
                        <option value="escalated" ${r.status==='escalated'?'selected':''}>${statusLabelAdmin('escalated')}</option>
                        <option value="resolved" ${r.status==='resolved'?'selected':''}>${statusLabelAdmin('resolved')}</option>
                        <option value="dismissed" ${r.status==='dismissed'?'selected':''}>${statusLabelAdmin('dismissed')}</option>
                    </select>
                    <button class="btn btn-sm" data-support-save="${r.id}" style="margin-top:0;width:auto;">${_i18n_t('admin.updateBtn','Update')}</button>
                </div>
            </div>
        `).join('');
        host.querySelectorAll('[data-support-save]').forEach(btn=>{
            btn.addEventListener('click', async()=>{
                const id = btn.dataset.supportSave;
                const sel = host.querySelector(`[data-support-status="${id}"]`);
                const newStatus = sel.value;
                const req = supportRequests.find(r=>r.id===id);
                btn.disabled=true; btn.textContent=_i18n_t('admin.updating','Updating...');
                try{
                    // supportRequests are under users/{uid}/supportRequests/{id}
                    const ref = doc(db, 'users', req.studentUid, 'supportRequests', id);
                    await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
                    showToast(_i18n_t('admin.supportUpdated','Support request updated'),'success');
                    load();
                } catch(e){ console.error(e); showToast(_i18n_t('admin.updateFailed','Failed to update'),'error'); btn.disabled=false; btn.textContent=_i18n_t('admin.updateBtn','Update'); }
            });
        });
    }

    load();
}