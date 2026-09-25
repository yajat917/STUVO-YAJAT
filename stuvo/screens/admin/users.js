async function renderAdminUsers(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    let filter = 'all';
    let search = '';

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.userManagement','User Management'), _i18n_t('admin.usersSub','All students, teachers, and admins on the platform'))}
                ${createSkeleton(3)}
            </div>
        `;

        let users = [];
        try {
            const snap = await getDocs(collection(db, 'users'));
            snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        } catch (err) {
            console.error('[adminUsers]', err);
            showToast(_i18n_t('admin.failedUsers','Failed to load users from Firestore.'), 'error');
            users = [];
        }

        renderList(users);
    }

    function renderList(users) {
        const filtered = users.filter(u => {
            const okFilter = filter === 'all' || u.role === filter;
            const q = search.toLowerCase();
            const okSearch = !q || (u.officialName || '').toLowerCase().includes(q)
                || (u.email || '').toLowerCase().includes(q)
                || (u.username || '').toLowerCase().includes(q);
            return okFilter && okSearch;
        });

        const counts = {
            all: users.length,
            student: users.filter(u => u.role === 'student').length,
            teacher: users.filter(u => u.role === 'teacher').length,
            admin: users.filter(u => u.role === 'admin').length,
        };

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.userManagement','User Management'), _i18n_t('admin.usersSummary', {all: counts.all, students: counts.student, teachers: counts.teacher, admins: counts.admin}))}

                <div class="glass-card">
                    <div class="card-header" style="margin-bottom:16px;">
                        <input type="text" class="form-control" id="user-search" placeholder="🔍 ${_i18n_t('admin.searchUsers','Search by name, email, or username…')}"
                            style="max-width:340px;margin-right:auto;" value="${search}">
                        <select class="form-control" id="role-filter" style="width:auto;padding:8px 12px;">
                            <option value="all" ${filter === 'all' ? 'selected' : ''}>${_i18n_t('admin.allRoles','All Roles')}</option>
                            <option value="student" ${filter === 'student' ? 'selected' : ''}>${_i18n_t('admin.studentsOpt','Students')}</option>
                            <option value="teacher" ${filter === 'teacher' ? 'selected' : ''}>${_i18n_t('admin.teachersOpt','Teachers')}</option>
                            <option value="admin" ${filter === 'admin' ? 'selected' : ''}>${_i18n_t('admin.adminsOpt','Admins')}</option>
                        </select>
                    </div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>${_i18n_t('teacher.nameCol','Name')}</th><th>${_i18n_t('teacher.usernameCol','Username')}</th><th>${_i18n_t('teacher.emailCol','Email')}</th><th>${_i18n_t('admin.roleCol','Role')}</th><th>${_i18n_t('teacher.statusCol','Status')}</th></tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0
                                    ? `<tr><td colspan="5">${createEmptyState(_i18n_t('admin.noUsers','No users found'), _i18n_t('admin.noUsersSub','Try a different search or filter.'))}</td></tr>`
                                    : filtered.map(u => `
                                        <tr>
                                            <td>
                                                <div style="display:flex;align-items:center;gap:10px;">
                                                    <div class="avatar" style="width:30px;height:30px;font-size:13px;">${_escapeHtml((u.officialName || '?').charAt(0).toUpperCase())}</div>
                                                    <span style="font-weight:600;">${_escapeHtml(u.officialName) || _i18n_t('admin.unnamedUser','Unnamed')}</span>
                                                </div>
                                            </td>
                                            <td style="color:var(--text-dim);">@${_escapeHtml(u.username) || '—'}</td>
                                            <td style="color:var(--text-dim);">${u.email ? `<a href="mailto:${_escapeHtml(u.email)}" style="color:inherit;">${_escapeHtml(u.email)}</a>` : '—'}</td>
                                            <td>${createBadge(u.role === 'admin' ? _i18n_t('admin.roleAdmin','Admin') : u.role === 'teacher' ? _i18n_t('auth.teacher','Teacher') : _i18n_t('auth.student','Student'),
                                                u.role === 'admin' ? 'violet' : u.role === 'teacher' ? 'blue' : 'green')}</td>
                                            <td>${createBadge(u.status === 'pending' ? _i18n_t('admin.statusPending','Pending') : u.status === 'rejected' ? _i18n_t('admin.statusRejected','Rejected') : _i18n_t('admin.statusActive','Active'),
                                                u.status === 'active' ? 'green' : u.status === 'pending' ? 'yellow' : 'red')}</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#user-search').addEventListener('input', e => {
            search = e.target.value;
            renderList(users);
        });

        container.querySelector('#role-filter').addEventListener('change', e => {
            filter = e.target.value;
            renderList(users);
        });
    }

    load();
}