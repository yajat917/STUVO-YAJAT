async function renderTeacherApprovals(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.teacherApprovals','Teacher Approvals'), _i18n_t('admin.approvalsSub','Approve or reject teacher accounts awaiting access'))}
                ${createSkeleton(3)}
            </div>
        `;

        try {
            // NOTE: Requires a composite index on `users` (role ASC, status ASC).
            // Firebase Console → Firestore → Indexes → Add composite index.
            const approvalsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'teacher'),
                where('status', '==', 'pending')
            );
            const snap = await getDocs(approvalsQuery);
            const approvals = [];
            snap.forEach(d => approvals.push({ id: d.id, ...d.data() }));

            renderList(approvals);
        } catch (err) {
            console.error('[teacherApprovals]', err);
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.teacherApprovals','Teacher Approvals'), _i18n_t('admin.approvalsSub','Approve or reject teacher accounts awaiting access'))}
                    ${createGlassCard(_i18n_t('admin.errorTitle','Error'), `
                        ${createEmptyState(_i18n_t('admin.loadApprovalsFailed','Failed to load approvals'), err.message, '⚠️')}
                    `)}
                </div>
            `;
        }
    }

    function renderList(approvals) {
        if (approvals.length === 0) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('nav.teacherApprovals','Teacher Approvals'), _i18n_t('admin.approvalsSub','Approve or reject teacher accounts awaiting access'))}
                    <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px;">${_i18n_t('admin.indexHint','Create composite index on users collection: role (Ascending) + status (Ascending) in Firebase Console → Firestore → Indexes')}</div>
                    ${createGlassCard('', createEmptyState(_i18n_t('admin.noPending','No pending approvals'), _i18n_t('admin.noPendingSub','All teacher requests have been reviewed.'), '✅'), '', 0.05)}
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.teacherApprovals','Teacher Approvals'), _i18n_t('admin.awaitingReview', {count: approvals.length}))}
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">${_i18n_t('admin.indexHint','Create composite index on users collection: role (Ascending) + status (Ascending) in Firebase Console → Firestore → Indexes')}</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                    <span class="badge badge-yellow">⏳ ${approvals.length} ${_i18n_t('admin.pendingBadge','Pending')}</span>
                </div>
                ${approvals.map((t, i) => `
                    <div class="glass-card" id="approval-card-${t.id}">
                        <div class="card-header">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:15px;font-weight:600;">${t.officialName || _i18n_t('admin.unnamedTeacher','Unnamed Teacher')}</div>
                                <div class="hw-sub">${t.email ? `<a href="mailto:${String(t.email).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" style="color:inherit;">${String(t.email).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>` : _i18n_t('admin.noEmail','No email')} · @${t.username || '—'}</div>
                            </div>
                            <span class="badge badge-yellow">${_i18n_t('admin.pendingBadge','Pending')}</span>
                        </div>
                        <div class="divider"></div>
                        <div style="display:flex;gap:10px;justify-content:flex-end;">
                            <button class="btn btn-secondary" data-action="reject" data-id="${t.id}" style="margin-top:0;">${_i18n_t('admin.rejectBtn','Reject')}</button>
                            <button class="btn" data-action="approve" data-id="${t.id}" style="margin-top:0;">${_i18n_t('admin.approveBtn','Approve')}</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const card = container.querySelector(`#approval-card-${id}`);
                btn.disabled = true;
                btn.textContent = action === 'approve' ? _i18n_t('admin.approving','Approving…') : _i18n_t('admin.rejecting','Rejecting…');

                try {
                    await updateDoc(doc(db, 'users', id), {
                        status: action === 'approve' ? 'active' : 'rejected'
                    });
                    showToast((action === 'approve' ? _i18n_t('admin.teacherApproved','Teacher approved') : _i18n_t('admin.teacherRejected','Teacher rejected')) + (action === 'approve' ? ' ✅' : ''), action === 'approve' ? 'success' : 'error');
                    load();
                } catch (err) {
                    console.error('[teacherApprovals]', err);
                    showToast(_i18n_t('admin.actionTeacherFailed', {action}) + ': ' + err.message, 'error');
                    load();
                }
            });
        });
    }

    load();
}