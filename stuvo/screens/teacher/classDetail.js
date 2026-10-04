async function renderTeacherClassDetail(container, params) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const classId = params.classId;
    const uid = appState.user?.uid;
    let cls = null;
    let roster = [];
    let announcements = [];
    let activeTab = 'roster';

    async function load() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('testReports.class','Class'), _i18n_t('teacher.loadingClass','Loading class…'))}
                <div style="text-align:center;padding:60px 0;color:var(--text-dim);font-size:14px;">
                    ${_i18n_t('teacher.loadingClass','Loading class…')}
                </div>
            </div>
        `;

        try {
            const snap = await getDoc(doc(db, 'classes', classId));
            if (!snap.exists) {
                container.innerHTML = `
                    <div class="flex-col">
                        ${createPageHeader(_i18n_t('testReports.class','Class'), '')}
                        <div class="glass-card">${createEmptyState(_i18n_t('teacher.classNotFound','Class not found'), _i18n_t('teacher.classNotFoundSub','It may have been deleted.'), '🏫')}</div>
                    </div>
                `;
                return;
            }
            cls = { id: snap.id, ...snap.data() };
            if (cls.teacherId !== uid) {
                container.innerHTML = `
                    <div class="flex-col">
                        ${createPageHeader(_i18n_t('testReports.class','Class'), '')}
                        <div class="glass-card">${createEmptyState(_i18n_t('teacher.accessDenied','Access denied'), _i18n_t('teacher.accessDeniedSub','You do not teach this class.'), '🚫')}</div>
                    </div>
                `;
                return;
            }

            roster = [];
            const ids = cls.studentIds || [];
            for (const sid of ids) {
                try {
                    const us = await getDoc(doc(db, 'users', sid));
                    if (us.exists) roster.push({ id: us.id, ...us.data() });
                } catch (err) {
                    console.error('[classDetail roster]', err);
                }
            }
            await loadAnnouncements();
        } catch (err) {
            console.error('[classDetail]', err);
            showToast(`${_i18n_t('teacher.failedToLoadClass','Failed to load class')}: ${err.message}`, 'error');
        }

        render();
    }

    async function loadAnnouncements() {
        announcements = [];
        try {
            const annSnap = await getDocs(query(
                collection(db, 'classes', classId, 'announcements'),
                orderBy('createdAt', 'desc')
            ));
            annSnap.forEach(d => announcements.push({ id: d.id, ...d.data() }));
        } catch (err) {
            console.error('[classDetail announcements]', err);
            showToast(_i18n_t('teacher.failedAnnouncements','Failed to load announcements.'), 'error');
        }
    }

    function fmtAnnouncementTime(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d)) return '';
        return d.toLocaleString((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN'), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function render() {
        if (!cls) {
            container.innerHTML = `
                <div class="flex-col">
                    ${createPageHeader(_i18n_t('testReports.class','Class'), '')}
                    <div class="glass-card">${createEmptyState(_i18n_t('teacher.failedToLoadClass','Failed to load class'), '', '⚠️')}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(cls.name || 'Unnamed Class', `${cls.subject || ','} · ${cls.room || 'No room'}`)}

                <a href="#/teacher/classes" style="color:#C4B5FD;font-size:13px;text-decoration:none;margin-bottom:4px;">← ${_i18n_t('teacher.backToClasses','Back to Classes')}</a>

                <div class="tabs" style="margin-bottom:16px;">
                    <button class="tab-btn ${activeTab === 'roster' ? 'active' : ''}" data-tab="roster">👥 ${_i18n_t('teacher.rosterTab','Roster')}</button>
                    <button class="tab-btn ${activeTab === 'announcements' ? 'active' : ''}" data-tab="announcements">📢 ${_i18n_t('teacher.announcementsTab','Announcements')}</button>
                </div>

                ${activeTab === 'roster' ? renderRosterTab() : renderAnnouncementsTab()}
            </div>
        `;

        container.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                render();
            });
        });

        if (activeTab === 'roster') setupRosterTab();
        else setupAnnouncementsTab();
    }

    function renderRosterTab() {
        return `
            <div class="glass-card">
                <div class="card-label">➕ ${_i18n_t('teacher.addStudentByUsername','Add Student by Username')}</div>
                <div class="form-row">
                    <div class="form-group" style="flex:2;">
                        <input type="text" class="form-control" id="add-student-username"
                            placeholder="${_i18n_t('teacher.usernamePlaceholder','e.g. ananya.sharma.1234')}">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <button class="btn" id="btn-add-student" style="margin-top:0;width:100%;">${_i18n_t('teacher.addStudent','Add Student')}</button>
                    </div>
                </div>
            </div>

            ${createGlassCard(_i18n_t('teacher.rosterWithCount', {count: roster.length}), `
                <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
                    <button class="btn btn-secondary btn-sm" id="btn-export-csv" style="margin-top:0;">⬇ ${_i18n_t('teacher.exportCsv','Export CSV')}</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr><th>${_i18n_t('teacher.nameCol','Name')}</th><th>${_i18n_t('teacher.usernameCol','Username')}</th><th>${_i18n_t('teacher.emailCol','Email')}</th><th></th></tr>
                        </thead>
                        <tbody>
                            ${roster.length === 0
                                ? `<tr><td colspan="4">${createEmptyState(_i18n_t('teacher.noStudentsAdded','No students added yet'), _i18n_t('teacher.searchToAdd','Search by username to add students.'), '👥')}</td></tr>`
                                : roster.map(s => `
                                    <tr>
                                        <td>
                                            <div style="display:flex;align-items:center;gap:10px;">
                                                <div class="avatar" style="width:30px;height:30px;font-size:13px;">${_escapeHtml((s.officialName || '?').charAt(0).toUpperCase())}</div>
                                                <span style="font-weight:600;">${_escapeHtml(s.officialName) || _i18n_t('teacher.unnamed','Unnamed')}</span>
                                            </div>
                                        </td>
                                        <td style="color:var(--text-dim);">@${_escapeHtml(s.username) || ','}</td>
                                        <td style="color:var(--text-dim);">${s.email ? `<a href="mailto:${_escapeHtml(s.email)}" style="color:inherit;">${_escapeHtml(s.email)}</a>` : ','}</td>
                                        <td style="text-align:right;">
                                            <button class="btn btn-danger btn-sm" data-remove-student="${s.id}" style="margin-top:0;">${_i18n_t('teacher.removeStudent','Remove')}</button>
                                        </td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                </div>
            `, '', 0.1)}
        `;
    }

    function renderAnnouncementsTab() {
        return `
            <div class="glass-card">
                <div class="card-label">📢 ${_i18n_t('teacher.newAnnouncement','New Announcement')}</div>
                <div class="form-group">
                    <input type="text" class="form-control" id="ann-title" placeholder="${_i18n_t('teacher.titleOptional','Title (optional)')}">
                </div>
                <div class="form-group">
                    <textarea class="form-control" id="ann-text" rows="2" placeholder="${_i18n_t('teacher.writeAnnouncement','Write your announcement…')}"></textarea>
                </div>
                <button class="btn" id="btn-post-announcement" style="margin-top:0;">${_i18n_t('teacher.postAnnouncement','Post Announcement')}</button>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
                ${announcements.length === 0
                    ? `<div class="glass-card">${createEmptyState(_i18n_t('dashboard.noAnnouncements','No announcements yet'), _i18n_t('teacher.postFirstAnnouncement','Post the first announcement for this class.'), '📢')}</div>`
                    : announcements.map((a, i) => `
                        <div class="glass-card">
                            <div style="font-size:14px;line-height:1.7;color:var(--text);">${a.text || ''}</div>
                            ${a.title ? `<div class="hw-sub" style="margin-top:6px;">${a.title}</div>` : ''}
                            <div class="hw-sub" style="margin-top:8px;">${_i18n_t('teacher.postedAt', {time: fmtAnnouncementTime(a.createdAt)})}</div>
                        </div>
                    `).join('')}
            </div>
        `;
    }

    function setupRosterTab() {
        const exportBtn = container.querySelector('#btn-export-csv');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (!roster.length) { showToast(_i18n_t('teacher.noStudentsExport','No students to export.'), 'error'); return; }
                const rows = [
                    ['Name', 'Username', 'Email'],
                    ...roster.map(s => [s.officialName || 'Unnamed', '@' + (s.username || ''), s.email || ''])
                ];
                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(cls.name || 'class').replace(/\s+/g, '_')}_roster.csv`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(_i18n_t('teacher.rosterExported','Roster exported') + ' ✅', 'success');
            });
        }

        container.querySelectorAll('[data-remove-student]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sid = btn.dataset.removeStudent;
                btn.disabled = true;
                try {
                    await updateDoc(doc(db, 'classes', classId), { studentIds: arrayRemove(sid) });
                    await updateDoc(doc(db, 'users', sid), { classIds: arrayRemove(classId) });
                    showToast(_i18n_t('teacher.studentRemoved','Student removed from class.'), 'success');
                    load();
                } catch (err) {
                    console.error('[classDetail removeStudent]', err);
                    showToast(`${_i18n_t('teacher.removeStudentFailed','Failed to remove student')}: ${err.message}`, 'error');
                    btn.disabled = false;
                }
            });
        });

        container.querySelector('#btn-add-student').addEventListener('click', async () => {
            const input = container.querySelector('#add-student-username');
            const username = input.value.trim().replace(/^@/, '').toLowerCase();
            if (!username) { showToast(_i18n_t('teacher.enterUsername','Enter a student username.'), 'error'); return; }

            const btn = container.querySelector('#btn-add-student');
            btn.disabled = true;
            btn.textContent = _i18n_t('teacher.adding','Adding…');

            try {
                let match = null;
                const exactSnap = await getDocs(query(
                    collection(db, 'users'),
                    where('username', '==', username),
                    where('role', '==', 'student')
                ));
                exactSnap.forEach(d => {
                    const u = d.data();
                    if (!match && u.role === 'student') match = { id: d.id, ...u };
                });

                if (!match) {
                    const scanSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
                    scanSnap.forEach(d => {
                        const u = d.data();
                        if (!match && (u.username || '').toLowerCase() === username) match = { id: d.id, ...u };
                    });
                }

                if (!match) {
                    showToast(_i18n_t('teacher.noStudentFoundUser', {name: input.value.trim()}), 'error');
                    btn.disabled = false;
                    btn.textContent = _i18n_t('teacher.addStudent','Add Student');
                    return;
                }

                if ((cls.studentIds || []).includes(match.id)) {
                    showToast(_i18n_t('teacher.alreadyInClass', {username: match.username}), 'error');
                    btn.disabled = false;
                    btn.textContent = _i18n_t('teacher.addStudent','Add Student');
                    return;
                }

                await updateDoc(doc(db, 'classes', classId), { studentIds: arrayUnion(match.id) });
                await updateDoc(doc(db, 'users', match.id), { classIds: arrayUnion(classId) });
                showToast(_i18n_t('teacher.addedToClass', {name: (match.officialName || match.username), class: cls.name}) + ' ✅', 'success');
                load();
            } catch (err) {
                console.error('[classDetail addStudent]', err);
                showToast(`${_i18n_t('teacher.addStudentFailed','Failed to add student')}: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = _i18n_t('teacher.addStudent','Add Student');
            }
        });
    }

    function setupAnnouncementsTab() {
        container.querySelector('#btn-post-announcement').addEventListener('click', async () => {
            const title = container.querySelector('#ann-title').value.trim();
            const text = container.querySelector('#ann-text').value.trim();
            if (!text) { showToast(_i18n_t('teacher.writeAnnouncementFirst','Write an announcement first.'), 'error'); return; }

            const btn = container.querySelector('#btn-post-announcement');
            btn.disabled = true;
            btn.textContent = _i18n_t('community.posting','Posting…');
            try {
                await addDoc(collection(db, 'classes', classId, 'announcements'), {
                    title,
                    text,
                    createdBy: uid,
                    createdAt: serverTimestamp(),
                });
                showToast(_i18n_t('teacher.announcementPosted','Announcement posted') + ' ✅', 'success');
                container.querySelector('#ann-text').value = '';
                container.querySelector('#ann-title').value = '';
                await loadAnnouncements();
                render();
            } catch (err) {
                console.error('[classDetail announcement post]', err);
                showToast(`${_i18n_t('teacher.postAnnouncementFailed','Failed to post announcement')}: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = _i18n_t('teacher.postAnnouncement','Post Announcement');
            }
        });
    }

    await load();
}