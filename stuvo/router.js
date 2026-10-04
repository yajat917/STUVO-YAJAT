// State
const appState = {
    user: null,
    role: null,
    userData: null
};

// Parse hash + query params
function parseHash() {
    const full = window.location.hash || '#/login';
    const [path, qs] = full.split('?');
    const params = {};
    if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = decodeURIComponent(v || ''); });
    return { path, params };
}

const authRoutes = new Set(['#/login', '#/pending']);

const routeMap = {
    '#/login':                  renderLogin,
    '#/pending':                renderPending,
    // Student
    '#/student/dashboard':      renderStudentDashboard,
    '#/student/attendance':     renderStudentAttendance,
    '#/student/homework':       renderStudentHomework,
    '#/student/test-reports':   renderStudentTestReports,
    '#/student/timetable':      renderStudentTimetable,
    '#/student/study-hub':      renderStudentStudyHub,
    '#/student/practice-bits':  renderStudentPracticeBits,
    '#/student/community':      renderStudentCommunity,
    // E.1-E.6 Wellbeing System
    '#/student/wellbeing':           renderStudentWellbeing,
    '#/student/accessibility':       renderStudentAccessibility,
    '#/student/report':              renderStudentReport,
    '#/student/wellbeingAssistant':  renderStudentWellbeingAssistant,
    // D.3 Quick Actions aliases — map legacy routes to Study Hub
    '#/student/doubt':          renderStudentStudyHub,
    '#/student/focus':          renderStudentStudyHub,
    '#/student/revision':       renderStudentStudyHub,
    '#/student/studyhub':       renderStudentStudyHub,
    // Teacher
    '#/teacher/dashboard':      renderTeacherDashboard,
    '#/teacher/classes':        renderTeacherClasses,
    '#/teacher/class-detail':   renderTeacherClassDetail,
    '#/teacher/attendance':     renderTeacherAttendance,
    '#/teacher/homework':       renderTeacherHomework,
    '#/teacher/test-reports':   renderTeacherTestReports,
    '#/teacher/timetable':      renderTeacherTimetable,
    // Admin
    '#/admin/dashboard':        renderAdminDashboard,
    '#/admin/teacher-approvals': renderTeacherApprovals,
    '#/admin/users':            renderAdminUsers,
    '#/admin/moderation':       renderAdminModeration,
    '#/admin/moderationQueue':  renderAdminModeration,
};

const roleHome = {
    student: '#/student/dashboard',
    teacher: '#/teacher/dashboard',
    admin:   '#/admin/dashboard',
};

// ─── Final Polish: per-route titles + meta descriptions (Rules 5 & 6) ───
// SPA has a single <head>; update document.title + meta[name=description]
// on every navigation. Format: `[Page Name] — Stuvo`, <160 chars, unique.
const ROUTE_META = {
    '#/login':                 { title: 'Sign In: Stuvo',               desc: 'Sign in to Stuvo with Google to access your school dashboard.' },
    '#/pending':               { title: 'Pending Approval: Stuvo',      desc: 'Your teacher account is pending admin approval on Stuvo.' },
    '#/parent-view':           { title: 'Progress Summary: Stuvo',      desc: 'View-only student progress summary shared by a Stuvo student. No sign-in required.' },
    '#/student/dashboard':     { title: 'Dashboard: Stuvo',             desc: 'Student dashboard: streak, focus plan, homework and practice at a glance.' },
    '#/student/attendance':    { title: 'Attendance: Stuvo',            desc: 'View your attendance calendar and monthly attendance stats.' },
    '#/student/homework':      { title: 'Homework: Stuvo',              desc: 'See assigned homework, submit answers and track quiz submissions.' },
    '#/student/test-reports':  { title: 'Test Reports: Stuvo',          desc: 'Review your test marks, subject trends and teacher feedback.' },
    '#/student/timetable':     { title: 'Timetable: Stuvo',             desc: 'Your weekly class timetable, day by day, on Stuvo.' },
    '#/student/study-hub':     { title: 'Study Hub: Stuvo',             desc: 'AI study hub: doubts, revision notes, quizzes and weekly plans.' },
    '#/student/practice-bits': { title: 'Practice Bits: Stuvo',         desc: 'Daily bite-size AI practice questions to build your streak.' },
    '#/student/community':     { title: 'Community: Stuvo',             desc: 'School community feed: posts, announcements and discussions.' },
    '#/student/wellbeing':     { title: 'Wellbeing: Stuvo',             desc: 'Check in with your mood, breathing breaks and private journal.' },
    '#/student/accessibility': { title: 'Accessibility: Stuvo',         desc: 'Adjust text size, contrast, speech and focus settings on Stuvo.' },
    '#/student/report':        { title: 'Report a Concern: Stuvo',      desc: 'Privately report a concern to a school admin on Stuvo.' },
    '#/student/wellbeingAssistant': { title: 'Wellbeing Assistant: Stuvo', desc: 'Private reflective chat with the Stuvo wellbeing assistant.' },
    '#/student/doubt':         { title: 'Ask AI: Stuvo',                desc: 'Ask study doubts and get step-by-step AI explanations.' },
    '#/student/focus':         { title: 'Focus Mode: Stuvo',            desc: 'Start a focus timer session and earn XP on Stuvo.' },
    '#/student/revision':      { title: 'Revision: Stuvo',              desc: 'Generate revision notes and checklists for any chapter.' },
    '#/student/studyhub':      { title: 'Study Hub: Stuvo',             desc: 'AI study hub: doubts, revision notes, quizzes and weekly plans.' },
    '#/teacher/dashboard':     { title: 'Teacher Dashboard: Stuvo',     desc: 'Teacher overview: classes, homework activity and class pulse.' },
    '#/teacher/classes':       { title: 'Classes: Stuvo',               desc: 'Manage your classes, rosters and create new classes.' },
    '#/teacher/class-detail':  { title: 'Class Detail: Stuvo',          desc: 'Class roster, announcements and student management.' },
    '#/teacher/attendance':    { title: 'Mark Attendance: Stuvo',       desc: 'Mark and save daily attendance for your classes.' },
    '#/teacher/homework':      { title: 'Homework Manager: Stuvo',      desc: 'Publish assignments and AI quizzes to your classes.' },
    '#/teacher/test-reports':  { title: 'Test Reports Manager: Stuvo',  desc: 'Publish student marks and review class performance.' },
    '#/teacher/timetable':     { title: 'Timetable Manager: Stuvo',     desc: 'Build and edit weekly timetables for your classes.' },
    '#/admin/dashboard':       { title: 'Admin Dashboard: Stuvo',       desc: 'Admin overview: users, approvals and moderation stats.' },
    '#/admin/teacher-approvals': { title: 'Teacher Approvals: Stuvo',   desc: 'Approve or reject teacher accounts awaiting access.' },
    '#/admin/users':           { title: 'User Management: Stuvo',       desc: 'Search and review all students, teachers and admins.' },
    '#/admin/moderation':      { title: 'Moderation Queue: Stuvo',      desc: 'Review reported content, wellness flags and support requests.' },
    '#/admin/moderationQueue': { title: 'Moderation Queue: Stuvo',      desc: 'Review reported content, wellness flags and support requests.' },
    '#/404':                   { title: 'Page Not Found: Stuvo',        desc: 'The page you requested was not found. Return to your Stuvo dashboard.' },
};

function updateDocumentHead(path) {
    const meta = ROUTE_META[path] || ROUTE_META['#/404'];
    if (meta) {
        document.title = meta.title;
        let tag = document.querySelector('meta[name="description"]');
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('name', 'description');
            document.head.appendChild(tag);
        }
        tag.setAttribute('content', meta.desc);
    }
}

const studentNav = [
    { path: '#/student/dashboard',     label: 'Dashboard',      icon: '🏠',     tKey: 'nav.dashboard' },
    { path: '#/student/attendance',    label: 'Attendance',     icon: '📅',     tKey: 'nav.attendance' },
    { path: '#/student/homework',      label: 'Homework',       icon: '📚',     tKey: 'nav.homework' },
    { path: '#/student/test-reports',  label: 'Test Reports',   icon: '📊',     tKey: 'nav.testReports' },
    { path: '#/student/timetable',     label: 'Timetable',      icon: '🕐',     tKey: 'nav.timetable' },
    { path: '#/student/study-hub',     label: 'Study Hub',      icon: '🧠',     tKey: 'nav.studyHub' },
    { path: '#/student/practice-bits', label: 'Practice Bits',  icon: '⚡',     tKey: 'nav.practiceBits' },
    { path: '#/student/community',     label: 'Community',      icon: '💬',     tKey: 'nav.community' },
    { path: '#/student/wellbeing',     label: 'Wellbeing',      icon: '🌿',     tKey: 'nav.wellbeing' },
    { path: '#/student/accessibility', label: 'Accessibility',  icon: '♿',     tKey: 'nav.accessibility' },
];

const teacherNav = [
    { path: '#/teacher/dashboard',     label: 'Dashboard',      icon: '🏠', tKey: 'nav.dashboard' },
    { path: '#/teacher/classes',       label: 'Classes',        icon: '🏫', tKey: 'nav.classes' },
    { path: '#/teacher/attendance',    label: 'Attendance',     icon: '📅', tKey: 'nav.attendance' },
    { path: '#/teacher/homework',      label: 'Homework',       icon: '📚', tKey: 'nav.homework' },
    { path: '#/teacher/test-reports',  label: 'Test Reports',   icon: '📊', tKey: 'nav.testReports' },
    { path: '#/teacher/timetable',     label: 'Timetable',      icon: '🕐', tKey: 'nav.timetable' },
];

const adminNav = [
    { path: '#/admin/dashboard',           label: 'Dashboard',          icon: '🏠', tKey: 'nav.dashboard' },
    { path: '#/admin/teacher-approvals',   label: 'Teacher Approvals',  icon: '✅', tKey: 'nav.teacherApprovals' },
    { path: '#/admin/users',               label: 'User Management',    icon: '👥', tKey: 'nav.userManagement' },
    { path: '#/admin/moderation',          label: 'Moderation Queue',   icon: '🛡️', tKey: 'nav.moderationQueue' },
];

async function handleRoute() {
    const { path, params } = parseHash();

    // ─── Public parent share view — zero sign-in, zero app chrome ───
    // Prefix match (router is otherwise exact-match only): #/parent-view/{token}
    if (path === '#/parent-view' || path.startsWith('#/parent-view/')) {
        const raw = path.startsWith('#/parent-view/') ? path.slice('#/parent-view/'.length) : '';
        let token = '';
        try { token = decodeURIComponent((raw.split('?')[0].split('/')[0] || '').trim()); } catch { token = ''; }
        const authContainer = document.getElementById('auth-container');
        const appLayout = document.getElementById('app-layout');
        updateDocumentHead('#/parent-view');
        if (appLayout) appLayout.style.display = 'none';
        try {
            const bottomNav = document.getElementById('mobile-bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';
            const topHeader = document.getElementById('mobile-top-header');
            if (topHeader) topHeader.style.display = 'none';
            try { closeHamburger(); } catch {}
            const appFooter = document.getElementById('app-footer');
            if (appFooter) appFooter.style.display = 'none';
        } catch {}
        if (authContainer) {
            authContainer.style.display = 'flex';
            authContainer.innerHTML = '';
            try {
                if (typeof renderParentView === 'function') await renderParentView(authContainer, token);
            } catch (err) { console.error('[parentView]', err); }
            try { renderAuthFooter(authContainer); } catch {}
        }
        return;
    }

    if (!appState.user && !authRoutes.has(path)) {
        window.location.hash = '#/login';
        return;
    }

    if (appState.user && !authRoutes.has(path)) {
        const allowed = appState.role === 'student' ? '#/student/'
                      : appState.role === 'teacher'  ? '#/teacher/'
                      : '#/admin/';
        if (!path.startsWith(allowed)) {
            window.location.hash = roleHome[appState.role] || '#/login';
            return;
        }
    }

    // Keep mobile nav globals in sync (for mobile bottom nav)
    if (appState.role) window.currentUserRole = appState.role;
    if (appState.user && appState.user.uid) window.currentUserUid = appState.user.uid;
    if (appState.userData && appState.userData.officialName) window.currentUserName = appState.userData.officialName;
    // Sync language from Firestore profile — but never clobber a newer local
    // choice mid-switch, and reload translations only when it actually changed.
    if (appState.userData && appState.userData.languagePreference
        && appState.userData.languagePreference !== window.currentUserLanguage
        && !window._langSwitching) {
        window.currentUserLanguage = appState.userData.languagePreference;
        if (typeof loadLanguage === 'function') {
            window._langLoading = true;
            loadLanguage(appState.userData.languagePreference)
                .catch(()=>{})
                .finally(()=>{ window._langLoading = false; try { handleRoute(); } catch {} });
        }
    }

    const renderFunc = routeMap[path] || renderNotFound;
    const outlet = document.getElementById('router-outlet');
    const authContainer = document.getElementById('auth-container');
    const appLayout = document.getElementById('app-layout');

    updateDocumentHead(routeMap[path] ? path : '#/404');

    if (authRoutes.has(path)) {
        appLayout.style.display = 'none';
        authContainer.style.display = 'flex';
        authContainer.innerHTML = '';
        renderFunc(authContainer);
        try { renderAuthFooter(authContainer); } catch {}
    } else if (!routeMap[path]) {
        // ─── Rule 8: branded 404 catch-all (unknown authed route) ───
        authContainer.style.display = 'none';
        appLayout.style.display = 'grid';
        outlet.innerHTML = '';
        updateSidebar();
        updateTopbar();
        renderNotFound(outlet);
        try { renderAppFooter(); } catch {}
        try { closeHamburger(); } catch {}
    } else {
        authContainer.style.display = 'none';
        appLayout.style.display = 'grid';
        outlet.innerHTML = '';
        updateSidebar();
        updateTopbar();
        renderFunc(outlet, params);
        try { renderAppFooter(); } catch {}
        try { closeHamburger(); } catch {}
    }
    // Refresh mobile nav active state after every render (instant, no animation)
    try { if (typeof renderMobileNav === 'function') renderMobileNav(window.currentUserRole || (typeof appState !== 'undefined' && appState.role) || 'student', window.location.hash); } catch {}
}

function updateSidebar() {
    const sidebar = document.getElementById('sidebar');
    const prevScrollTop = sidebar ? sidebar.scrollTop : 0;
    const navItems = appState.role === 'student' ? studentNav
                   : appState.role === 'teacher'  ? teacherNav
                   : adminNav;
    const current = parseHash().path;
    const _t = (typeof t === 'function') ? t : (k, d) => d || k;
    const _label = (item) => {
        if (item.tKey && typeof t === 'function') {
            try { const v = t(item.tKey); if (v !== item.tKey) return v; } catch {}
        }
        return item.label;
    };

    sidebar.innerHTML = `
        <a href="${(typeof roleHome !== 'undefined' && appState.role && roleHome[appState.role]) || '#/login'}" class="logo-link" aria-label="Stuvo home" style="text-decoration:none;"><div class="logo">Stuvo</div></a>
        ${navItems.map(item => `
            <a href="${item.path}" class="nav-item ${current === item.path ? 'active' : ''}" id="nav-${item.label.replace(/\s+/g,'-').toLowerCase()}">
                <span style="font-size:15px;">${item.icon}</span> ${_label(item)}
            </a>
        `).join('')}
        <div class="sidebar-footer">
            <button class="nav-item btn-secondary" id="btn-logout" style="width:100%; margin-top:0; border:none; cursor:pointer; text-align:left;">
                <span style="font-size:15px;">🚪</span> ${_t('common.signOut', 'Sign Out')}
            </button>
        </div>
    `;
    // Preserve sidebar scroll position across navigation — prevents jump to top after clicking lower items
    try {
        sidebar.scrollTop = prevScrollTop;
        // Ensure active item stays visible if it was out of view after recreation
        const active = sidebar.querySelector('.nav-item.active');
        if (active) {
            const sidebarRect = sidebar.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();
            if (activeRect.top < sidebarRect.top || activeRect.bottom > sidebarRect.bottom) {
                active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }
        }
    } catch {}

    document.getElementById('btn-logout').addEventListener('click', async () => {
        try { if (typeof clearScopedLangCache === 'function') clearScopedLangCache(); } catch {}
        try { await signOut(auth); } catch (err) { console.error('[logout]', err); }
        appState.user = null;
        appState.role = null;
        appState.userData = null;
        window.location.hash = '#/login';
    });
}

function updateTopbar() {
    const greeting = document.getElementById('topbar-greeting');
    const avatar = document.getElementById('topbar-avatar');
    if (appState.userData) {
        const name = appState.userData.officialName || 'User';
        const _t = (typeof t === 'function') ? t : (k, d) => d || k;
        const roleLabel = appState.role === 'student' ? _t('auth.student', 'Student')
                        : appState.role === 'teacher' ? _t('auth.teacher', 'Teacher') : _t('common.administrator', 'Administrator');
        // Try to translate greeting if available
        const greetKey = 'dashboard.greeting';
        let greetText = _t('dashboard.hello', 'Hello');
        try { if (typeof t === 'function') { const vt = t(greetKey); if (vt !== greetKey) greetText = vt; } } catch {}
        let dateStr = '';
        try {
            const locale = (typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN');
            dateStr = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
        } catch { dateStr = new Date().toLocaleDateString(); }
        greeting.innerHTML = `
            <h1>${greetText}, ${name.split(' ')[0]} 👋</h1>
            <p>${roleLabel} · ${dateStr}</p>
        `;
        avatar.textContent = name.charAt(0).toUpperCase();
    }
    // Language switcher in topbar (desktop) — small globe button next to avatar
    try {
        const actions = document.querySelector('.topbar-actions');
        if (actions) {
            let langBtn = document.getElementById('lang-switcher');
            if (!langBtn) {
                langBtn = document.createElement('button');
                langBtn.id = 'lang-switcher';
                langBtn.className = 'lang-switcher-btn';
                const _cl = (typeof t === 'function') ? t('common.changeLanguage', 'Change language') : 'Change language';
                langBtn.setAttribute('aria-label', _cl);
                langBtn.title = _cl;
                const code = (window.currentUserLanguage || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'en') || 'en').toUpperCase();
                langBtn.innerHTML = `🌐 <span id="lang-current-code">${code}</span>`;
                // Insert before avatar
                const avatarEl = document.getElementById('topbar-avatar');
                if (avatarEl && avatarEl.parentNode === actions) actions.insertBefore(langBtn, avatarEl);
                else actions.prepend(langBtn);
            } else {
                const codeEl = document.getElementById('lang-current-code');
                if (codeEl) codeEl.textContent = (window.currentUserLanguage || 'en').toUpperCase();
            }
            if (langBtn && !langBtn.dataset.bound) {
                langBtn.dataset.bound = '1';
                langBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Toggle dropdown
                    let dd = document.getElementById('lang-dropdown');
                    if (dd) { dd.classList.toggle('hidden'); return; }
                    // Create dropdown
                    dd = document.createElement('div');
                    dd.id = 'lang-dropdown';
                    dd.className = 'lang-dropdown';
                    dd.setAttribute('role', 'dialog');
                    const langs = (typeof SUPPORTED_LANGUAGES !== 'undefined' ? SUPPORTED_LANGUAGES : {en:'English', hi:'हिन्दी', bn:'বাংলা', mr:'मराठी', te:'తెలుగు', ta:'தமிழ்'});
                    dd.innerHTML = Object.entries(langs).map(([code, name]) => `
                        <button class="lang-option ${ (window.currentUserLanguage||'en')===code ? 'active' : ''}" data-lang="${code}" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:none;background:${(window.currentUserLanguage||'en')===code ? 'rgba(124,92,252,0.12)' : 'transparent'};color:var(--text);cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;border-radius:8px;">
                            <span>${name}</span><span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">${code}</span>
                        </button>
                    `).join('');
                    dd.style.cssText = 'position:absolute;top:calc(100% + 10px);right:0;min-width:180px;background:#111827;border:1px solid var(--glass-border);border-radius:12px;padding:6px;box-shadow:0 20px 60px rgba(0,0,0,0.5);z-index:1000;display:flex;flex-direction:column;gap:4px;';
                    langBtn.style.position = 'relative';
                    // Wrap langBtn in relative container if needed
                    let wrapper = langBtn.parentNode;
                    if (!wrapper.classList.contains('lang-switcher-wrapper')) {
                        const w = document.createElement('div');
                        w.className = 'lang-switcher-wrapper';
                        w.style.position = 'relative';
                        wrapper.insertBefore(w, langBtn);
                        w.appendChild(langBtn);
                        w.appendChild(dd);
                    } else {
                        wrapper.appendChild(dd);
                    }
                    dd.querySelectorAll('.lang-option').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const c = btn.dataset.lang;
                            if (typeof setLanguage === 'function') await setLanguage(c);
                            else if (typeof window.setLanguage === 'function') await window.setLanguage(c);
                            dd.classList.add('hidden');
                            // Update code display
                            const codeEl2 = document.getElementById('lang-current-code');
                            if (codeEl2) codeEl2.textContent = c.toUpperCase();
                            // Close and refresh
                            try { if (typeof handleRoute === 'function') handleRoute(); } catch {}
                        });
                    });
                    // Close on outside click
                    setTimeout(() => {
                        const closeHandler = (ev) => {
                            if (!dd.contains(ev.target) && ev.target !== langBtn) { dd.classList.add('hidden'); document.removeEventListener('click', closeHandler); }
                        };
                        document.addEventListener('click', closeHandler);
                    }, 0);
                });
            }
            // Ensure styles for lang switcher injected
            if (!document.getElementById('lang-switcher-styles')) {
                const s = document.createElement('style');
                s.id = 'lang-switcher-styles';
                s.textContent = `
                    .lang-switcher-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:20px;background:var(--glass);border:1px solid var(--glass-border);backdrop-filter:blur(12px);color:var(--text);font-family:var(--font-ui);font-size:12px;font-weight:600;cursor:pointer;transition:transform var(--dur-press) var(--ease-out),background-color 160ms ease;}
                    .lang-switcher-btn:active{transform:scale(var(--press-scale));}
                    @media (hover: hover) and (pointer: fine){
                    .lang-switcher-btn:hover{background:rgba(255,255,255,0.08);}
                    }
                    .lang-dropdown.hidden{display:none !important;}
                    .lang-dropdown{transform-origin:top right;}
                    @media (hover: hover) and (pointer: fine){
                    .lang-option:hover{background:rgba(124,92,252,0.08) !important;}
                    }
                    .lang-option.active{color:#C4B5FD !important;}
                    .mth-accessibility-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid var(--glass-border);color:var(--text);font-size:14px;cursor:pointer;transition:transform var(--dur-press) var(--ease-out),background-color 160ms ease,border-color 160ms ease;}
                    .mth-accessibility-btn:active{transform:scale(var(--press-scale));}
                    @media (hover: hover) and (pointer: fine){
                    .mth-accessibility-btn:hover{background:rgba(124,92,252,0.15);border-color:rgba(124,92,252,0.35);}
                    }
                    @media (max-width: 768px){ .mth-accessibility-btn{width:28px;height:28px;font-size:13px;} }
                `;
                document.head.appendChild(s);
            }
        }
    } catch (e) { console.error('[updateTopbar lang]', e); }
    // D.1 Smart Notification Center — mount bell in topbar
    try {
        const uid = appState.user?.uid;
        if (uid && typeof renderNotificationBell === 'function') {
            // Ensure container exists (defensive if index.html not updated)
            let bellHost = document.getElementById('notification-bell');
            if (!bellHost) {
                const actions = document.querySelector('.topbar-actions');
                if (actions) {
                    bellHost = document.createElement('div');
                    bellHost.id = 'notification-bell';
                    actions.insertBefore(bellHost, actions.firstChild);
                }
            }
            renderNotificationBell(uid);
        }
    } catch (e) { console.error('[updateTopbar notification]', e); }
    // D.4 Global Search — wire topbar button to openGlobalSearch
    try {
        let searchBtn = document.getElementById('global-search-btn');
        if (!searchBtn) {
            const actions = document.querySelector('.topbar-actions');
            if (actions) {
                searchBtn = document.createElement('button');
                searchBtn.id = 'global-search-btn';
                searchBtn.className = 'global-search-btn';
                const _sl = (typeof t === 'function') ? t('common.search', 'Search') : 'Search';
                searchBtn.setAttribute('aria-label', _sl);
                searchBtn.title = _sl;
                searchBtn.textContent = '🔍';
                const bell = document.getElementById('notification-bell');
                const avatar = document.getElementById('topbar-avatar');
                if (bell && bell.parentNode === actions) actions.insertBefore(searchBtn, bell);
                else if (avatar) actions.insertBefore(searchBtn, avatar);
                else actions.prepend(searchBtn);
            }
        }
        if (searchBtn && !searchBtn.dataset.bound) {
            searchBtn.dataset.bound = '1';
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof openGlobalSearch === 'function') openGlobalSearch();
                else if (typeof window.openGlobalSearch === 'function') window.openGlobalSearch();
                else console.warn('[globalSearch] openGlobalSearch not found');
            });
        }
        // Ensure styles are injected even before first open
        if (typeof ensureGlobalSearchStyles === 'function') ensureGlobalSearchStyles();
    } catch (e) { console.error('[updateTopbar globalSearch]', e); }
}

// Expose navigate helper (renders the route for the given hash immediately)
window._navigate = function(route) {
  if (route) window.location.hash = route;
  else handleRoute();
};

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

// Seed admin accounts — checked before any Firestore role lookup on session restore
// (SEED_ADMINS is declared in screens/auth/login.js, which loads before router.js)

onAuthStateChanged(auth, async (user) => {
    if (user) {
        appState.user = user;
        if (SEED_ADMINS.includes(user.email)) {
            try {
                const ref = doc(db, 'users', user.uid);
                const snap = await getDoc(ref);
                if (!snap.exists) {
                    await setDoc(ref, {
                        role: 'admin',
                        status: 'active',
                        email: user.email || '',
                        officialName: user.displayName || '',
                        photoURL: user.photoURL || '',
                        username: '',
                        classIds: [],
                        createdAt: new Date(),
                        lastActiveAt: serverTimestamp(),
                    }, { merge: true });
                }
                const data = snap.exists ? snap.data() : {};
                appState.role = 'admin';
                appState.userData = { ...data, role: 'admin', status: 'active' };
            } catch (err) {
                console.error('[router seed admin restore]', err);
                appState.role = 'admin';
                appState.userData = { role: 'admin', status: 'active', officialName: user.displayName };
            }
        } else {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists) {
                    const data = snap.data();
                    appState.role = data.role;
                    appState.userData = data;
                } else {
                    appState.role = null;
                    appState.userData = null;
                }
            } catch (err) {
                console.error('[router role restore]', err);
                appState.role = null;
                appState.userData = null;
            }
        }
        // Track last activity for Admin Platform Health (covers persisted-session
        // restores that bypass the sign-in handler) — best-effort, never blocks.
        try { updateDoc(doc(db, 'users', user.uid), { lastActiveAt: serverTimestamp() }).catch(()=>{}); } catch {}
        // Mobile nav globals — required for mobile bottom nav role-based rendering
        window.currentUserRole = appState.role;
        window.currentUserUid = user.uid;
        window.currentUserName = (appState.userData && appState.userData.officialName) || (user && user.displayName) || 'User';
        // Load language preference from Firestore (default: cached choice > browser > 'en')
        try {
            const langPref = appState.userData && appState.userData.languagePreference ? appState.userData.languagePreference : null;
            const cached = (typeof getCachedLang === 'function' ? getCachedLang() : null) || 'en';
            if (langPref && typeof loadLanguage === 'function') {
                window.currentUserLanguage = langPref;
                loadLanguage(langPref).then(()=>{ try{handleRoute();}catch{} }).catch(()=>{});
            } else if (langPref) {
                window.currentUserLanguage = langPref;
            } else {
                window.currentUserLanguage = cached;
                if (typeof loadLanguage === 'function') loadLanguage(cached).catch(()=>{});
                // Show first-time language prompt only if the user never chose anywhere
                if (cached === 'en') setTimeout(()=>{ try{ if(typeof showFirstTimeLanguagePrompt==='function') showFirstTimeLanguagePrompt(); }catch{} }, 800);
            }
            // Keep also currentLanguage global in i18n synced
            if (!window.currentUserLanguage) window.currentUserLanguage = 'en';
        } catch(e){}
        // E.2 Apply accessibility prefs on session restore
        try {
            if (appState.user && typeof loadAccessibilityPrefs === 'function') {
                loadAccessibilityPrefs(appState.user.uid).then(p=>{
                    window._accessPrefsCache = p;
                    try{ localStorage.setItem('stuvo_accessibility_cache', JSON.stringify(p)); }catch{}
                });
            }
            if (appState.userData && appState.userData.notificationPrefs) window._notificationPrefs = appState.userData.notificationPrefs;
            else if (appState.userData && appState.userData.accessibilityPrefs) window._notificationPrefs = appState.userData.accessibilityPrefs;
        } catch(e){}
        handleRoute();
    } else {
        appState.user = null;
        appState.role = null;
        appState.userData = null;
        window.currentUserRole = null;
        window.currentUserUid = null;
        window.currentUserName = 'User';
        // Keep the logged-out language choice for the login screen (never force English flash)
        const loggedOutLang = (typeof getCachedLang === 'function' ? getCachedLang() : null) || 'en';
        window.currentUserLanguage = loggedOutLang;
        try { if (typeof loadLanguage === 'function') loadLanguage(loggedOutLang).catch(()=>{}); } catch {}
        handleRoute();
    }
});

// ─── Mobile bottom nav + top header (navigation UI) ───
function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

const MOBILE_NAV_ITEMS = {
  student: [
    { route: '#/student/dashboard', icon: '🏠', label: 'Home' },
    { route: '#/student/homework', icon: '📚', label: 'Homework' },
    { route: '#/student/studyhub', icon: '📖', label: 'Study' },
    { route: '#/student/wellbeing', icon: '💙', label: 'Wellbeing' },
    { route: '#/student/community', icon: '💬', label: 'Community' },
  ],
  teacher: [
    { route: '#/teacher/dashboard', icon: '🏠', label: 'Home' },
    { route: '#/teacher/classes', icon: '🏫', label: 'Classes' },
    { route: '#/teacher/homework', icon: '📚', label: 'Homework' },
    { route: '#/teacher/attendance', icon: '✅', label: 'Attendance' },
    { route: '#/teacher/test-reports', icon: '📊', label: 'Analytics' },
  ],
  admin: [
    { route: '#/admin/dashboard', icon: '🏠', label: 'Home' },
    { route: '#/admin/teacher-approvals', icon: '✅', label: 'Approvals' },
    { route: '#/admin/users', icon: '👥', label: 'Users' },
    { route: '#/admin/moderation', icon: '🛡️', label: 'Reports' },
  ],
};

function renderMobileNav(currentRole, currentRoute) {
  if (!isMobileViewport()) return;

  const bottomNav = document.getElementById('mobile-bottom-nav');
  const topHeader = document.getElementById('mobile-top-header');
  if (!bottomNav || !topHeader) return;

  // Resolve role fallback from appState if global not yet set
  if (!currentRole || !MOBILE_NAV_ITEMS[currentRole]) {
    const fallbackRole = (typeof appState !== 'undefined' && appState.role) || window.currentUserRole || 'student';
    currentRole = MOBILE_NAV_ITEMS[fallbackRole] ? fallbackRole : 'student';
  }

  const items = MOBILE_NAV_ITEMS[currentRole] || [];

  // Alias map for routes that use camelCase but router uses kebab-case, and legacy aliases
  const ROUTE_ALIASES = {
    '#/admin/teacherApprovals': '#/admin/teacher-approvals',
    '#/admin/userManagement': '#/admin/users',
    '#/teacher/analytics': '#/teacher/test-reports',
    '#/student/studyhub': '#/student/study-hub'
  };

  // Translate mobile labels if t() available
  const MOBILE_LABEL_KEYS = {
    '#/student/dashboard': 'nav.dashboard',
    '#/student/homework': 'nav.homework',
    '#/student/studyhub': 'nav.studyHub',
    '#/student/study-hub': 'nav.studyHub',
    '#/student/wellbeing': 'nav.wellbeing',
    '#/student/community': 'nav.community',
    '#/teacher/dashboard': 'nav.dashboard',
    '#/teacher/classes': 'nav.classes',
    '#/teacher/homework': 'nav.homework',
    '#/teacher/attendance': 'nav.attendance',
    '#/teacher/analytics': 'nav.testReports',
    '#/teacher/test-reports': 'nav.testReports',
    '#/admin/dashboard': 'nav.dashboard',
    '#/admin/teacherApprovals': 'nav.teacherApprovals',
    '#/admin/teacher-approvals': 'nav.teacherApprovals',
    '#/admin/userManagement': 'nav.userManagement',
    '#/admin/users': 'nav.userManagement',
    '#/admin/moderationQueue': 'nav.moderationQueue',
    '#/admin/moderation': 'nav.moderationQueue'
  };
  function _mLabel(item) {
    const key = MOBILE_LABEL_KEYS[item.route];
    if (key && typeof t === 'function') {
      try { const v = t(key); if (v !== key) return v; } catch {}
    }
    // fallback simple shorten for mobile
    return item.label;
  }

  bottomNav.innerHTML = items.map(item => {
    const aliasHit = Object.keys(ROUTE_ALIASES).some(a => ROUTE_ALIASES[a] === item.route && currentRoute === a);
    const isActive = currentRoute === item.route || currentRoute === ROUTE_ALIASES[item.route] || aliasHit;
    return `
    <button class="mobile-nav-item ${isActive ? 'active' : ''}" data-route="${item.route}">
      <span class="mni-icon">${item.icon}</span>
      <span>${_mLabel(item)}</span>
    </button>
  `}).join('');
  bottomNav.style.display = 'flex';

  const userInitial = (window.currentUserName || (typeof appState !== 'undefined' && appState.userData && appState.userData.officialName) || 'U').charAt(0).toUpperCase();
  const curLang = (window.currentUserLanguage || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'en') || 'en').toUpperCase();
  const isStudent = currentRole === 'student';
  const _homeForRole = (typeof roleHome !== 'undefined' && roleHome[currentRole]) || '#/student/dashboard';
  topHeader.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <button class="mth-hamburger" id="mth-hamburger" aria-label="Open menu" aria-expanded="false" title="Menu">☰</button>
      <a href="${_homeForRole}" class="mth-logo-link" aria-label="Stuvo home" style="text-decoration:none;"><span class="mth-logo">Stuvo</span></a>
    </div>
    <div class="mth-actions" style="display:flex;align-items:center;gap:8px;">
      <button class="mth-lang-btn" id="mth-lang-btn" aria-label="${(typeof t === 'function' ? t('common.changeLanguage', 'Change language') : 'Change language')}" title="${(typeof t === 'function' ? t('common.changeLanguage', 'Change language') : 'Change language')}">🌐 ${curLang}</button>
      ${isStudent ? `<button class="mth-accessibility-btn" aria-label="${(typeof t === 'function' ? t('nav.accessibility', 'Accessibility') : 'Accessibility')}" title="${(typeof t === 'function' ? t('nav.accessibility', 'Accessibility') : 'Accessibility')}" onclick="window.location.hash='#/student/accessibility'">♿</button>` : ''}
      <span class="mth-avatar">${userInitial}</span>
    </div>
  `;
  topHeader.style.display = 'flex';

  // Mobile language dropdown handler
  try {
    const mLangBtn = topHeader.querySelector('#mth-lang-btn');
    if (mLangBtn && !mLangBtn.dataset.bound) {
      mLangBtn.dataset.bound = '1';
      mLangBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let dd = document.getElementById('m-lang-dropdown');
        if (dd) { dd.classList.toggle('hidden'); return; }
        dd = document.createElement('div');
        dd.id = 'm-lang-dropdown';
        dd.className = 'lang-dropdown';
        dd.setAttribute('role', 'dialog');
        const langs = (typeof SUPPORTED_LANGUAGES !== 'undefined' ? SUPPORTED_LANGUAGES : {en:'English', hi:'हिन्दी', bn:'বাংলা', mr:'मराठी', te:'తెలుగు', ta:'தமிழ்'});
        dd.innerHTML = Object.entries(langs).map(([code, name]) => `
          <button class="lang-option ${(window.currentUserLanguage||'en')===code ? 'active' : ''}" data-lang="${code}" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;border:none;background:${(window.currentUserLanguage||'en')===code ? 'rgba(124,92,252,0.12)' : 'transparent'};color:var(--text);cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;border-radius:8px;">
            <span>${name}</span><span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;">${code}</span>
          </button>
        `).join('');
        dd.style.cssText = 'position:absolute;top:52px;right:10px;min-width:180px;background:#111827;border:1px solid var(--glass-border);border-radius:12px;padding:6px;box-shadow:0 20px 60px rgba(0,0,0,0.5);z-index:101;display:flex;flex-direction:column;gap:4px;';
        dd.classList.add('hidden');
        // Ensure hidden class handling
        const styleCheck = document.getElementById('lang-switcher-styles');
        if (!styleCheck) {
          const s = document.createElement('style');
          s.id = 'lang-switcher-styles';
          s.textContent = '.lang-dropdown.hidden{display:none !important;}';
          document.head.appendChild(s);
        }
        topHeader.appendChild(dd);
        // Toggle visible
        dd.classList.remove('hidden');
        dd.querySelectorAll('.lang-option').forEach(btn => {
          btn.addEventListener('click', async () => {
            const c = btn.dataset.lang;
            if (typeof setLanguage === 'function') await setLanguage(c);
            else if (typeof window.setLanguage === 'function') await window.setLanguage(c);
            dd.classList.add('hidden');
            const mBtn = document.getElementById('mth-lang-btn');
            if (mBtn) mBtn.textContent = '🌐 ' + c.toUpperCase();
            const deskCode = document.getElementById('lang-current-code');
            if (deskCode) deskCode.textContent = c.toUpperCase();
            try { if (typeof handleRoute === 'function') handleRoute(); } catch {}
            renderMobileNav(window.currentUserRole || currentRole, window.location.hash);
          });
        });
        setTimeout(() => {
          const closeH = (ev) => { if (!dd.contains(ev.target) && ev.target !== mLangBtn) { dd.classList.add('hidden'); document.removeEventListener('click', closeH); } };
          document.addEventListener('click', closeH);
        }, 0);
      });
    }
  } catch(e){ console.error('[mLang]', e); }

  bottomNav.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const rawRoute = btn.dataset.route;
      // Prefer alias when it exists and original route is not registered
      const useRoute = (typeof routeMap !== 'undefined' && !routeMap[rawRoute] && ROUTE_ALIASES[rawRoute]) ? ROUTE_ALIASES[rawRoute] : rawRoute;
      window.location.hash = useRoute;
    });
  });

  // ─── Rule 3: hamburger drawer trigger (full nav, same order as desktop) ───
  try {
    const ham = topHeader.querySelector('#mth-hamburger');
    if (ham && !ham.dataset.bound) {
      ham.dataset.bound = '1';
      ham.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHamburger();
      });
    }
  } catch(e){ console.error('[hamburger bind]', e); }
}

// ─── Rule 3 — Hamburger-triggered mobile nav (full role nav, same order) ───
function getRoleNavItems(role) {
  if (role === 'teacher') return (typeof teacherNav !== 'undefined' ? teacherNav : []);
  if (role === 'admin') return (typeof adminNav !== 'undefined' ? adminNav : []);
  return (typeof studentNav !== 'undefined' ? studentNav : []);
}
function toggleHamburger(force) {
  const drawer = document.getElementById('hamburger-drawer');
  const overlay = document.getElementById('hamburger-overlay');
  if (!drawer || !overlay) return;
  const show = typeof force === 'boolean' ? force : drawer.classList.contains('hidden');
  if (show) openHamburger();
  else closeHamburger();
}
function openHamburger() {
  const drawer = document.getElementById('hamburger-drawer');
  const overlay = document.getElementById('hamburger-overlay');
  const ham = document.getElementById('mth-hamburger');
  if (!drawer || !overlay) return;
  const role = window.currentUserRole || (typeof appState !== 'undefined' && appState.role) || 'student';
  const items = getRoleNavItems(role);
  const current = (typeof parseHash === 'function' ? parseHash().path : window.location.hash);
  const _t = (typeof t === 'function') ? t : (k, d) => d || k;
  drawer.innerHTML = `
    <div class="ham-header">
      <a href="${(typeof roleHome !== 'undefined' && roleHome[role]) || '#/student/dashboard'}" class="ham-logo" data-ham-link>Stuvo</a>
      <button class="ham-close" id="ham-close" aria-label="Close menu">✕</button>
    </div>
    <div class="ham-list">
      ${items.map(item => {
        let label = item.label;
        try { if (item.tKey && typeof t === 'function') { const v = t(item.tKey); if (v !== item.tKey) label = v; } } catch {}
        return `<a href="${item.path}" class="ham-item ${current === item.path ? 'active' : ''}" data-ham-link><span style="font-size:15px;">${item.icon}</span> ${label}</a>`;
      }).join('')}
    </div>
    <div class="ham-footer">
      <button class="ham-item ham-signout" id="ham-logout"><span style="font-size:15px;">🚪</span> ${_t('common.signOut', 'Sign Out')}</button>
    </div>
  `;
  drawer.classList.remove('hidden');
  overlay.classList.remove('hidden');
  // Purpose: spatial consistency. Double rAF guarantees the drawer paints at
  // translateX(-105%) before .open flips, so the slide runs instead of jumping.
  requestAnimationFrame(() => requestAnimationFrame(() => { drawer.classList.add('open'); }));
  if (ham) ham.setAttribute('aria-expanded', 'true');
  drawer.querySelectorAll('[data-ham-link]').forEach(a => {
    a.addEventListener('click', () => closeHamburger());
  });
  const closeBtn = drawer.querySelector('#ham-close');
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeHamburger(); });
  const logoutBtn = drawer.querySelector('#ham-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { if (typeof clearScopedLangCache === 'function') clearScopedLangCache(); } catch {}
    try { await signOut(auth); } catch (err) { console.error('[logout]', err); }
    appState.user = null; appState.role = null; appState.userData = null;
    closeHamburger();
    window.location.hash = '#/login';
  });
}
function closeHamburger() {
  const drawer = document.getElementById('hamburger-drawer');
  const overlay = document.getElementById('hamburger-overlay');
  const ham = document.getElementById('mth-hamburger');
  if (!drawer || !overlay) return;
  // Purpose: exits run faster than entrances. Honor the 150ms close slide,
  // then hide. Reduced motion hides instantly with no slide.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  drawer.classList.remove('open');
  overlay.classList.add('hidden');
  if (ham) ham.setAttribute('aria-expanded', 'false');
  if (reduceMotion || drawer.classList.contains('hidden')) { drawer.classList.add('hidden'); return; }
  window.setTimeout(() => {
    if (!drawer.classList.contains('open')) drawer.classList.add('hidden');
  }, 160);
}
// Outside-tap closes hamburger (bound once)
(function initHamburgerOutsideTap() {
  let bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', (e) => {
      const drawer = document.getElementById('hamburger-drawer');
      const overlay = document.getElementById('hamburger-overlay');
      if (!drawer || drawer.classList.contains('hidden')) return;
      if (drawer.contains(e.target)) return;
      const ham = document.getElementById('mth-hamburger');
      if (ham && (e.target === ham || ham.contains(e.target))) return;
      closeHamburger();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') try { closeHamburger(); } catch {} });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  window.addEventListener('hashchange', () => { try { closeHamburger(); } catch {} });
})();

// ─── Rule 8 — Branded 404 page (liquid glass, brand system) ───
function renderNotFound(container) {
  const role = (typeof appState !== 'undefined' && appState.role) || window.currentUserRole || null;
  const home = (role && typeof roleHome !== 'undefined' && roleHome[role]) || '#/login';
  const homeLabel = role ? 'Back to Dashboard' : 'Back to Sign In';
  container.innerHTML = `
    <div class="flex-col" style="align-items:center;text-align:center;padding:48px 16px;">
      <div class="glass-card" style="max-width:480px;width:100%;padding:40px 32px;">
        <div style="font-size:52px;margin-bottom:12px;">🧭</div>
        <div class="page-title" style="font-size:28px;">Page not found</div>
        <div class="page-sub" style="margin-top:8px;line-height:1.6;">The link you followed doesn't match any Stuvo page. Check the address or return home.</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:13px;color:#C4B5FD;margin-top:16px;letter-spacing:0.06em;">ERROR 404 · STUVO</div>
        <a href="${home}" class="btn" style="margin-top:20px;text-decoration:none;">${homeLabel} →</a>
      </div>
    </div>
  `;
}

// ─── Rules 7 & 9 — Shared footer (verified links + dynamic year) ───
function footerLinksFor(role) {
  if (role === 'teacher') return [
    { path: '#/teacher/dashboard', label: 'Dashboard' },
    { path: '#/teacher/classes', label: 'Classes' },
    { path: '#/teacher/homework', label: 'Homework' },
  ];
  if (role === 'admin') return [
    { path: '#/admin/dashboard', label: 'Dashboard' },
    { path: '#/admin/users', label: 'Users' },
    { path: '#/admin/moderation', label: 'Moderation' },
  ];
  return [
    { path: '#/student/dashboard', label: 'Dashboard' },
    { path: '#/student/study-hub', label: 'Study Hub' },
    { path: '#/student/community', label: 'Community' },
    { path: '#/student/wellbeing', label: 'Wellbeing' },
  ];
}
function renderAppFooter() {
  const footer = document.getElementById('app-footer');
  if (!footer) return;
  const role = (typeof appState !== 'undefined' && appState.role) || window.currentUserRole || 'student';
  const links = footerLinksFor(role);
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="app-footer-links">${links.map(l => `<a href="${l.path}">${l.label}</a>`).join('<span class="app-footer-dot">·</span>')}</div>
    <div class="app-footer-copy">© ${year} Stuvo. All rights reserved.</div>
  `;
  footer.style.display = 'block';
}
function renderAuthFooter(authContainer) {
  let footer = document.getElementById('auth-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.id = 'auth-footer';
    footer.className = 'auth-footer';
    authContainer.appendChild(footer);
  }
  const year = new Date().getFullYear();
  footer.innerHTML = `<div class="app-footer-copy">© ${year} Stuvo. All rights reserved.</div>`;
}

function initMobileNav() {
  window.addEventListener('hashchange', () => {
    const role = window.currentUserRole || (typeof appState !== 'undefined' && appState.role) || 'student';
    renderMobileNav(role, window.location.hash);
  });
  window.addEventListener('resize', () => {
    const bottomNav = document.getElementById('mobile-bottom-nav');
    const topHeader = document.getElementById('mobile-top-header');
    if (!isMobileViewport()) {
      if (bottomNav) bottomNav.style.display = 'none';
      if (topHeader) topHeader.style.display = 'none';
      try { closeHamburger(); } catch {}
    } else {
      const role = window.currentUserRole || (typeof appState !== 'undefined' && appState.role) || 'student';
      renderMobileNav(role, window.location.hash);
    }
  });
  const role = window.currentUserRole || (typeof appState !== 'undefined' && appState.role) || 'student';
  renderMobileNav(role, window.location.hash);
  // Hamburger overlay outside-tap
  try {
    const overlay = document.getElementById('hamburger-overlay');
    if (overlay && !overlay.dataset.bound) {
      overlay.dataset.bound = '1';
      overlay.addEventListener('click', () => { try { closeHamburger(); } catch {} });
    }
  } catch {}
}
initMobileNav();

// ─── D.5 Offline-Friendly Experience — offline banner (idempotent) ───
(function initOfflineBanner() {
  function ensureStyles() {
    if (document.getElementById('offline-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'offline-banner-styles';
    style.textContent = `
      #offline-banner { position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #F59E0B, #EF4444); color: var(--text-bright); text-align: center; font-size: 13px; font-weight: 600; padding: 10px 16px; z-index: 9999; display: none; box-shadow: 0 2px 12px rgba(0,0,0,0.3); font-family: var(--font-ui); }
      #offline-banner.show { display: block !important; }
    `;
    document.head.appendChild(style);
  }
  function ensureBanner() {
    let banner = document.getElementById('offline-banner');
    if (banner) return banner;
    ensureStyles();
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.textContent = "You're offline: showing previously loaded content";
    banner.style.display = 'none';
    if (document.body) document.body.prepend(banner);
    else document.addEventListener('DOMContentLoaded', () => { if (!document.getElementById('offline-banner')) document.body.prepend(banner); });
    return banner;
  }
  function update() {
    const banner = ensureBanner();
    if (!banner) return;
    ensureStyles();
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) { banner.style.display = 'block'; banner.classList.add('show'); }
    else { banner.style.display = 'none'; banner.classList.remove('show'); }
  }
  ensureStyles(); ensureBanner();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update);
  else update();
})();
