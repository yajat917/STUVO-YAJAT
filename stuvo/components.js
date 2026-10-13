// ─── i18n helper (shared) ─────────────────────────────────────────
// NOTE: screens also declare `var _i18n_t`; `var` redeclaration is safe.
// Dynamic lookup: i18n.js loads AFTER this file, so resolve t() lazily.
// Define only if missing so load order never throws ReferenceError.
if (typeof _i18n_t === 'undefined') var _i18n_t = function(k, d) {
  try { if (typeof t === 'function') return t(k, d); } catch {}
  return (typeof d !== 'undefined' && d !== null) ? d : k;
};
function createGlassCard(title, contentHTML, extraClasses = '', delay = 0) {
    return `
        <div class="glass-card ${extraClasses}">
            ${title ? `<div class="card-label">${title}</div>` : ''}
            ${contentHTML}
        </div>
    `;
}

// ─── Stats row ────────────────────────────────────────────────
function createStatRow(stats) {
    const cols = stats.length >= 4 ? 'cols-4' : '';
    return `
        <div class="stats-row ${cols}">
            ${stats.map((s, i) => `
                <div class="stat-card" style="color:${s.color || '#fff'};">
                    <div class="stat-num">${s.num}</div>
                    <div class="stat-label">${s.label}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── HW item ──────────────────────────────────────────────────
function createHwItem(title, subtitle, badgeText = null, badgeClass = '', delay = 0) {
    const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
        <div class="hw-item">
            <div>
                <div class="hw-title">${esc(title)}</div>
                <div class="hw-sub">${esc(subtitle)}</div>
            </div>
            ${badgeText ? `<div class="hw-badge ${badgeClass}">${esc(badgeText)}</div>` : ''}
        </div>
    `;
}

// ─── Streak orb ───────────────────────────────────────────────
function createStreakOrb(streakNum, label, subtext, buttonText = null) {
    return `
        <div class="streak-card">
          <div class="orb"><div class="orb-num">${streakNum}</div></div>
          <div class="streak-label">${label}</div>
          <div class="streak-sub">${subtext}</div>
          ${buttonText ? `<button class="btn mt-4">${buttonText}</button>` : ''}
        </div>
    `;
}

// ─── Page header ──────────────────────────────────────────────
function createPageHeader(title, subtitle = '', actionHTML = '') {
    return `
        <div class="page-header">
            <div>
                <div class="page-title">${title}</div>
                ${subtitle ? `<div class="page-sub">${subtitle}</div>` : ''}
            </div>
            ${actionHTML ? `<div class="flex-row">${actionHTML}</div>` : ''}
        </div>
    `;
}

// ─── Table ────────────────────────────────────────────────────
function createTable(headers, rows) {
    return `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.length === 0
                        ? `<tr><td colspan="${headers.length}">${createEmptyState(_i18n_t('common.noData','No data available'), '')}</td></tr>`
                        : rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
                    }
                </tbody>
            </table>
        </div>
    `;
}

// ─── Tabs ─────────────────────────────────────────────────────
function createTabs(tabs) {
    // tabs: [{id, label, contentHTML}]
    return `
        <div class="tabs" id="tabs-bar">
            ${tabs.map((t, i) => `
                <button class="tab-btn ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
            `).join('')}
        </div>
        ${tabs.map((t, i) => `
            <div class="tab-panel ${i === 0 ? 'active' : ''}" id="tab-${t.id}">
                ${t.contentHTML}
            </div>
        `).join('')}
    `;
}

function initTabs(container) {
    const bar = container.querySelector('#tabs-bar');
    if (!bar) return;
    bar.addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const targetId = btn.dataset.tab;
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = container.querySelector(`#tab-${targetId}`);
        if (panel) panel.classList.add('active');
    });
}

// ─── Modal ────────────────────────────────────────────────────
// Purpose: spatial consistency. Centered enter from scale(0.95) plus opacity.
// Exit is faster than entrance. Uses CSS transitions so rapid retrigger retargets.
function openModal(title, bodyHTML, onSubmit = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal" id="modal-box" data-mounted="false">
            <div class="modal-header">
                <div class="modal-title">${title}</div>
                <button class="modal-close" id="modal-close-btn">✕</button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
            ${onSubmit ? `
                <div style="margin-top:20px;">
                    <button class="btn" id="modal-submit-btn" style="margin-top:0;">${_i18n_t('common.confirm','Confirm')}</button>
                </div>
            ` : ''}
        </div>
    `;
    document.body.appendChild(overlay);
    const box = overlay.querySelector('#modal-box');

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mounted flag dance without frameworks: append hidden, then flip the flag
    // on the next frame so the CSS transition runs from the entry state.
    if (reduceMotion) {
        box.dataset.mounted = 'true';
    } else {
        requestAnimationFrame(() => requestAnimationFrame(() => { box.dataset.mounted = 'true'; }));
    }

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        if (reduceMotion) { overlay.remove(); return; }
        overlay.dataset.closing = 'true';
        window.setTimeout(() => overlay.remove(), 160);
    };
    overlay.querySelector('#modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    if (onSubmit) {
        overlay.querySelector('#modal-submit-btn').addEventListener('click', () => {
            onSubmit(overlay, close);
        });
    }

    return { overlay, close };
}

// ─── Toast ────────────────────────────────────────────────────
// Purpose: prevent jarring pop-in. Same-edge enter and exit, calm ease.
// CSS transitions retarget smoothly when toasts stack or replace each other.
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    while (container.children.length >= 3) container.removeChild(container.firstChild);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    if (!reduceMotion) toast.dataset.mounted = 'false';
    container.appendChild(toast);
    if (!reduceMotion) {
        requestAnimationFrame(() => requestAnimationFrame(() => { toast.dataset.mounted = 'true'; }));
    }
    window.setTimeout(() => {
        if (reduceMotion) { toast.remove(); return; }
        toast.dataset.leaving = 'true';
        window.setTimeout(() => toast.remove(), 340);
    }, 3000);
}

// ─── List stagger ─────────────────────────────────────────────
// Purpose: prevent jarring pop-in when a list renders many items at once.
// Each item fades and slides in 50ms after the previous one. Items stay
// tappable mid-animation, and only the first screenful staggers.
function stageListEnter(scope, selector, maxItems = 12) {
    if (!scope || !scope.querySelectorAll) return;
    if (scope.dataset && scope.dataset.staggered === '1') return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const items = scope.querySelectorAll(selector);
    const n = Math.min(items.length, maxItems);
    if (!n) return;
    for (let i = 0; i < n; i++) {
        items[i].classList.add('list-enter');
        items[i].style.setProperty('--stagger-index', String(i));
    }
    let flipped = false;
    const flip = () => {
        if (flipped) return;
        flipped = true;
        for (let i = 0; i < n; i++) { if (items[i].isConnected) items[i].dataset.mounted = 'true'; }
    };
    requestAnimationFrame(() => requestAnimationFrame(flip));
    window.setTimeout(flip, 150);
    try { scope.dataset.staggered = '1'; } catch {}
}

// ─── Badge ────────────────────────────────────────────────────
function createBadge(text, color = 'violet') {
    const safe = String(text ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="badge badge-${color}">${safe}</span>`;
}

// ─── Empty state ──────────────────────────────────────────────
function createEmptyState(title, subtitle = '', icon = '📭') {
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <div class="empty-title">${title}</div>
            ${subtitle ? `<div class="empty-sub">${subtitle}</div>` : ''}
        </div>
    `;
}

// ─── Skeleton loading ─────────────────────────────────────────
function createSkeleton(lines = 3) {
    return `
        <div class="skeleton-wrap">
            ${Array(lines).fill('<div class="skeleton-line"></div>').join('')}
        </div>
    `;
}

// ─── Shared Teacher Constants ─────────────────────────────────
var TEACHER_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function formatTeacherTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`;
}
// ─── Shared attendance % (single source of truth) ────────────────────
// Same formula as the Student Attendance screen: per-day values keyed by day
// (present overrides absent when several classes mark the same day),
// pct = round(present/total*100). Pure — callers only differ in how they fetch.
function tallyAttendancePct(uid, dayEntries) {
    const perDay = {};
    for (const entry of dayEntries || []) {
        if (!entry || !entry.value) continue;
        if (!perDay[entry.day] || entry.value === 'present') perDay[entry.day] = entry.value;
    }
    const vals = Object.values(perDay);
    const presentCount = vals.filter(v => v === 'present').length;
    const absentCount = vals.filter(v => v === 'absent').length;
    const total = presentCount + absentCount;
    return { pct: total ? Math.round((presentCount / total) * 100) : 0, presentCount, absentCount, total };
}
function timeAgoShared(ts) {
    if (!ts) return 'recently';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
}

// ─── D.1 Smart Notification Center ──────────────────────────────
// Implements renderNotificationBell(uid) that:
// - Fetches users/{uid}/notifications orderBy createdAt desc
// - Shows bell icon with unread count badge
// - Click opens dropdown panel listing notifications newest first
// - Mark as read on click, Mark all read button
// - Handles types: new_homework, deadline_approaching, announcement, approval_status, ai_reminder
// - For deadline_approaching, on Student Dashboard load, scan upcoming homework, if any deadline is 20-28 hours away and no notification exists yet for it, create one (client-side check, no Cloud Functions)
// - For new homework, when teacher creates homework, write notification to every enrolled student (see teacher/homework.js — implemented)
// - The bell should be added to topbar via renderNotificationBell() call (see router.js updateTopbar and index.html #notification-bell)
var _notificationUnsub = null;
var _notificationCache = [];
var _notificationBellBound = false;

function getNotificationMeta(type) {
    switch (type) {
        case 'new_homework': return { icon: '📚', label: 'New Homework', color: '#C4B5FD', bg: 'rgba(124,92,252,0.15)' };
        case 'deadline_approaching': return { icon: '⏰', label: 'Deadline Approaching', color: '#FDE68A', bg: 'rgba(245,158,11,0.15)' };
        case 'announcement': return { icon: '📢', label: 'Announcement', color: '#93C5FD', bg: 'rgba(79,140,255,0.15)' };
        case 'approval_status': return { icon: '✅', label: 'Approval Status', color: '#6EE7B7', bg: 'rgba(16,185,129,0.15)' };
        case 'ai_reminder': return { icon: '🤖', label: 'AI Reminder', color: '#C4B5FD', bg: 'rgba(124,92,252,0.15)' };
        default: return { icon: '🔔', label: type || 'Notification', color: '#9AA3C4', bg: 'rgba(255,255,255,0.06)' };
    }
}

function ensureNotificationStyles() {
    if (document.getElementById('notification-bell-styles')) return;
    const style = document.createElement('style');
    style.id = 'notification-bell-styles';
    style.textContent = `
        .notification-bell-wrapper { position: relative; display: flex; align-items: center; }
        .notification-bell-btn {
            position: relative; width: 42px; height: 42px; border-radius: 50%;
            background: var(--glass); border: 1px solid var(--glass-border);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 18px;
            transition: transform var(--dur-press) var(--ease-out), background-color 160ms ease;
        }
        .notification-bell-btn:active { transform: scale(var(--press-scale)); }
        @media (hover: hover) and (pointer: fine) {
        .notification-bell-btn:hover { background: rgba(255,255,255,0.08); }
        }
        .notification-badge {
            position: absolute; top: -4px; right: -4px;
            min-width: 18px; height: 18px; padding: 0 5px;
            border-radius: 10px; background: linear-gradient(135deg,#EF4444,#F59E0B);
            color: var(--text-bright); font-size: 11px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.2); line-height: 1;
        }
        .notification-badge.hidden { display: none !important; }
        .notification-dropdown {
            position: absolute; top: calc(100% + 12px); right: 0;
            width: 360px; max-width: 92vw; max-height: 420px;
            background: #111827; border: 1px solid var(--glass-border);
            border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            z-index: 1000; overflow: hidden; display: flex; flex-direction: column;
            transform-origin: top right;
        }
        .notification-dropdown.hidden { display: none !important; }
        .notification-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 16px; border-bottom: 1px solid var(--glass-border);
            font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
        }
        .notification-header button {
            font-size: 12px; font-weight: 600; color: #93C5FD;
            background: transparent; border: none; cursor: pointer; font-family: var(--font-ui);
            transition: color 160ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
        .notification-header button:hover { color: #C4B5FD; text-decoration: underline; }
        }
        .notification-list { overflow-y: auto; flex: 1; max-height: 360px; }
        .notification-item {
            display: flex; gap: 12px; padding: 12px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            cursor: pointer; align-items: flex-start;
            transition: background-color 160ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
        .notification-item:hover { background: rgba(255,255,255,0.04); }
        }
        .notification-item.unread { background: rgba(124,92,252,0.06); }
        @media (hover: hover) and (pointer: fine) {
        .notification-item.unread:hover { background: rgba(124,92,252,0.10); }
        }
        .notification-icon {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.06);
        }
        .notification-content { flex: 1; min-width: 0; }
        .notification-title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.4; }
        .notification-body { font-size: 12px; color: var(--text-dim); margin-top: 3px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .notification-time { font-size: 11px; color: var(--text-dim); margin-top: 6px; }
        .notification-dot { width: 8px; height: 8px; border-radius: 50%; background: #7C5CFC; flex-shrink: 0; margin-top: 8px; }
        .notification-dot.read { background: transparent; }
        .notification-empty { padding: 32px 16px; text-align: center; color: var(--text-dim); font-size: 13px; }
    `;
    document.head.appendChild(style);
}

async function fetchNotifications(uid) {
    try {
        // Fetches users/{uid}/notifications orderBy createdAt desc
        const colRef = collection(db, 'users', uid, 'notifications');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => {
            const data = d.data();
            list.push({ id: d.id, ...data });
        });
        // Ensure newest first (desc) — fallback sort if createdAt missing
        list.sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return tb - ta;
        });
        return list;
    } catch (err) {
        console.error('[fetchNotifications]', err);
        return [];
    }
}

function renderNotificationList(uid, notifications) {
    const listEl = document.getElementById('notification-list');
    const badgeEl = document.getElementById('notification-badge');
    if (!listEl) return;
    const unreadCount = notifications.filter(n => !n.read).length;
    if (badgeEl) {
        badgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badgeEl.classList.toggle('hidden', unreadCount === 0);
    }
    if (notifications.length === 0) {
        listEl.innerHTML = `<div class="notification-empty"><div style="font-size:28px;margin-bottom:8px;">🔔</div>${_i18n_t('notifications.empty','No notifications yet')}</div>`;
        return;
    }
    listEl.innerHTML = notifications.map(n => {
        const meta = getNotificationMeta(n.type);
        const isUnread = !n.read;
        const timeStr = timeAgoShared(n.createdAt);
        const title = (n.title || meta.label || n.type || 'Notification').replace(/</g, '&lt;');
        const body = (n.body || n.message || '').replace(/</g, '&lt;');
        return `
            <div class="notification-item ${isUnread ? 'unread' : ''}" data-notif-id="${n.id}" role="button" tabindex="0">
                <div class="notification-icon" style="background:${meta.bg};color:${meta.color};">${meta.icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    ${body ? `<div class="notification-body">${body}</div>` : ''}
                    <div class="notification-time">${timeStr} · ${meta.label}</div>
                </div>
                <div class="notification-dot ${isUnread ? '' : 'read'}"></div>
            </div>
        `;
    }).join('');

    // Bind click to mark as read
    listEl.querySelectorAll('.notification-item').forEach(el => {
        const markRead = async () => {
            const nid = el.dataset.notifId;
            const notif = notifications.find(x => x.id === nid);
            if (!notif || notif.read) return;
            try {
                await updateDoc(doc(db, 'users', uid, 'notifications', nid), { read: true });
                notif.read = true;
                el.classList.remove('unread');
                const dot = el.querySelector('.notification-dot');
                if (dot) dot.classList.add('read');
                const remaining = notifications.filter(x => !x.read).length;
                if (badgeEl) {
                    badgeEl.textContent = remaining > 99 ? '99+' : String(remaining);
                    badgeEl.classList.toggle('hidden', remaining === 0);
                }
            } catch (e) { console.error('[mark read]', e); }
        };
        el.addEventListener('click', markRead);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') markRead(); });
    });
}

async function markAllNotificationsRead(uid) {
    const unread = _notificationCache.filter(n => !n.read);
    if (unread.length === 0) { showToast(_i18n_t('notifications.noUnread','No unread notifications'), 'info'); return; }
    const btn = document.getElementById('mark-all-read-btn');
    if (btn) { btn.disabled = true; btn.textContent = _i18n_t('notifications.marking','Marking...'); }
    try {
        await Promise.all(unread.map(n => updateDoc(doc(db, 'users', uid, 'notifications', n.id), { read: true }).catch(e => console.error('[markAll]', e))));
        _notificationCache.forEach(n => n.read = true);
        renderNotificationList(uid, _notificationCache);
        showToast(_i18n_t('notifications.allRead','All notifications marked as read'), 'success');
    } catch (e) {
        console.error('[markAllNotificationsRead]', e);
        showToast(_i18n_t('notifications.markFailed','Failed to mark all as read'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = _i18n_t('notifications.markAllRead','Mark all read'); }
    }
}

function renderNotificationBell(uid) {
    if (!uid) return;
    ensureNotificationStyles();
    const host = document.getElementById('notification-bell');
    if (!host) {
        console.warn('[renderNotificationBell] #notification-bell not found in topbar');
        return;
    }
    // Avoid re-creating if already rendered for same uid
    if (host.dataset.renderedUid === uid && host.innerHTML.trim() !== '') {
        // Refresh data in background
        fetchNotifications(uid).then(list => {
            _notificationCache = list;
            renderNotificationList(uid, list);
        });
        return;
    }
    host.dataset.renderedUid = uid;
    host.innerHTML = `
        <div class="notification-bell-wrapper">
            <button id="notification-bell-btn" class="notification-bell-btn" aria-label="${_i18n_t('common.notifications','Notifications')}" title="${_i18n_t('common.notifications','Notifications')}">
                <span style="font-size:18px; line-height:1;">🔔</span>
                <span id="notification-badge" class="notification-badge hidden">0</span>
            </button>
            <div id="notification-dropdown" class="notification-dropdown hidden" role="dialog" aria-label="${_i18n_t('common.notifications','Notifications')}">
                <div class="notification-header">
                    <span>${_i18n_t('common.notifications','Notifications')}</span>
                    <button id="mark-all-read-btn">${_i18n_t('notifications.markAllRead','Mark all read')}</button>
                </div>
                <div id="notification-list" class="notification-list">
                    <div class="notification-empty">${_i18n_t('common.loading','Loading...')}</div>
                </div>
            </div>
        </div>
    `;

    const btn = document.getElementById('notification-bell-btn');
    const dropdown = document.getElementById('notification-dropdown');
    const markAllBtn = document.getElementById('mark-all-read-btn');

    if (!_notificationBellBound) {
        _notificationBellBound = true;
        // Close on outside click — delegated once
        document.addEventListener('click', e => {
            const wrapper = document.querySelector('.notification-bell-wrapper');
            const dd = document.getElementById('notification-dropdown');
            if (!wrapper || !dd || dd.classList.contains('hidden')) return;
            if (!wrapper.contains(e.target)) dd.classList.add('hidden');
        });
    }

    btn.addEventListener('click', async e => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
            dropdown.classList.remove('hidden');
            // Refresh on open
            const fresh = await fetchNotifications(uid);
            _notificationCache = fresh;
            renderNotificationList(uid, fresh);
        } else {
            dropdown.classList.add('hidden');
        }
    });

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async e => {
            e.stopPropagation();
            await markAllNotificationsRead(uid);
        });
    }

    // Initial fetch — Fetches users/{uid}/notifications orderBy createdAt desc, shows unread badge
    fetchNotifications(uid).then(list => {
        _notificationCache = list;
        renderNotificationList(uid, list);
    });

    // Optional live updates via onSnapshot if available
    try {
        if (typeof onSnapshot === 'function') {
            if (_notificationUnsub) { try { _notificationUnsub(); } catch(_){} }
            const colRef = collection(db, 'users', uid, 'notifications');
            const q = query(colRef, orderBy('createdAt', 'desc'));
            _notificationUnsub = onSnapshot(q, snap => {
                const list = [];
                snap.forEach(d => list.push({ id: d.id, ...d.data() }));
                list.sort((a, b) => {
                    const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                    const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                    return tb - ta;
                });
                _notificationCache = list;
                renderNotificationList(uid, list);
            });
        }
    } catch (e) { console.warn('[notification onSnapshot]', e); }
}

// D.1 — deadline_approaching client-side check
// Scans upcoming homework; if any deadline is 20-28 hours away and no notification exists yet for it, create one.
async function checkDeadlineApproachingNotifications(uid, classIds) {
    if (!uid || !Array.isArray(classIds) || classIds.length === 0) return;
    try {
        const existing = await fetchNotifications(uid);
        const existingKeys = new Set(
            existing.filter(n => n.type === 'deadline_approaching' && n.relatedHomeworkId).map(n => n.relatedHomeworkId + '|' + (n.relatedClassId || ''))
        );
        const now = Date.now();
        for (const classId of classIds) {
            let hwSnap;
            try { hwSnap = await getDocs(collection(db, 'classes', classId, 'homework')); } catch (e) { continue; }
            for (const d of hwSnap.docs) {
                const hw = d.data();
                const hwId = d.id;
                const key = hwId + '|' + classId;
                if (existingKeys.has(key)) continue;
                if (!hw.deadline) continue;
                // deadline is YYYY-MM-DD, treat as end of that day midnight; create Date at 23:59 local
                let deadlineDate;
                if (hw.deadline.includes('T')) {
                    deadlineDate = new Date(hw.deadline);
                } else {
                    const parts = hw.deadline.split('-').map(Number);
                    if (parts.length === 3) deadlineDate = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
                    else deadlineDate = new Date(hw.deadline);
                }
                if (isNaN(deadlineDate)) continue;
                const diffMs = deadlineDate.getTime() - now;
                const diffHours = diffMs / (1000 * 60 * 60);
                // 20-28 hours away
                if (diffHours >= 20 && diffHours <= 28) {
                    // Optional: skip if already submitted
                    try {
                        const subSnap = await getDoc(doc(db, 'classes', classId, 'homework', hwId, 'submissions', uid));
                        if (subSnap.exists) continue;
                    } catch (e) {}
                    try {
                        await addDoc(collection(db, 'users', uid, 'notifications'), {
                            type: 'deadline_approaching',
                            title: `Deadline approaching: ${hw.title || _i18n_t('nav.homework','Homework')}`,
                            body: `${hw.subject ? hw.subject + ': ' : ''}${hw.title || ''} is due on ${hw.deadline}. Submit soon!`,
                            relatedClassId: classId,
                            relatedHomeworkId: hwId,
                            read: false,
                            createdAt: serverTimestamp()
                        });
                        existingKeys.add(key);
                        // Also update local cache if bell is mounted
                        if (_notificationCache) {
                            // will be refreshed on next bell open via fetch; optionally push optimistic
                        }
                    } catch (e) { console.error('[deadline_approaching create]', e); }
                }
            }
        }
    } catch (e) { console.error('[checkDeadlineApproachingNotifications]', e); }
}

// Legacy alias for dashboard callers
async function checkAndCreateDeadlineNotifications(uid, classIds) {
    return checkDeadlineApproachingNotifications(uid, classIds);
}

// ─── AI Client & API Gateway ──────────────────────────────────
// Primary path: server-side /api/* endpoints (OPENROUTER_API_KEY lives
// server-side via Vercel env vars). Fallback path: per-user OpenRouter key
// stored ONLY in this browser (localStorage studyos_openrouter_key),
// set via Settings → AI Key. Never fetch or store the server key client-side.
const STUVO_FALLBACK_MODELS = [
    "google/gemma-4-31b-it:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free"
];
const STUVO_AI_KEY_NAMES = ['studyos_openrouter_key', 'openrouter_api_key'];

function getUserApiKey() {
    try {
        if (typeof localStorage === 'undefined') return '';
        for (const name of STUVO_AI_KEY_NAMES) {
            const v = (localStorage.getItem(name) || '').trim();
            if (v) return v;
        }
    } catch (e) {}
    return '';
}

function isValidOpenRouterKey(key) {
    const k = String(key || '').trim();
    // OpenRouter keys look like sk-or-v1-... (64+ hex chars). Accept leniently
    // so free-tier / rotated formats don't get rejected at the UI layer.
    return k.length >= 10 && (k.startsWith('sk-or-') || k.length >= 20);
}

function setUserApiKey(key) {
    const k = String(key || '').trim();
    if (!k) return false;
    if (!isValidOpenRouterKey(k)) return false;
    try {
        localStorage.setItem('studyos_openrouter_key', k);
        try { localStorage.removeItem('openrouter_api_key'); } catch (e) {}
    } catch (e) { return false; }
    _serverHasKeyCache = null;
    return true;
}

function clearUserApiKey() {
    try {
        localStorage.removeItem('studyos_openrouter_key');
        localStorage.removeItem('openrouter_api_key');
    } catch (e) {}
    _serverHasKeyCache = null;
}

function hasUserApiKey() {
    return Boolean(getUserApiKey());
}

let _serverHasKeyCache = null; // null = unknown, true/false = cached
let _serverHasKeyAt = 0;
const _SERVER_KEY_TTL = 5 * 60 * 1000;

async function checkServerHasKey() {
    const now = Date.now();
    if (_serverHasKeyCache !== null && (now - _serverHasKeyAt) < _SERVER_KEY_TTL) {
        return _serverHasKeyCache;
    }
    // Secure check: endpoint returns {hasKey:boolean} only, never the key.
    const attempts = [
        () => fetch('/api/check-key', { method: 'GET' }),
        () => fetch('/api/check-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    ];
    for (const fn of attempts) {
        try {
            const res = await fn();
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                _serverHasKeyCache = Boolean(data.hasKey);
                _serverHasKeyAt = now;
                return _serverHasKeyCache;
            }
        } catch (e) {}
    }
    return null; // unreachable — don't cache
}

function buildOpenRouterMessages(prompt) {
    if (Array.isArray(prompt)) {
        return prompt
            .map(m => {
                if (typeof m === 'string') return { role: 'user', content: m };
                if (m && typeof m === 'object') {
                    return {
                        role: m.role === 'system' || m.role === 'assistant' ? m.role : 'user',
                        content: String(m.content || '')
                    };
                }
                return null;
            })
            .filter(Boolean)
            .slice(-12);
    }
    return [{ role: 'user', content: String(prompt || '') }];
}

function aiSetupHint() {
    return 'Open Settings → AI Key to add your own OpenRouter key (stored only in this browser), or ask your admin to set OPENROUTER_API_KEY on the server and redeploy.';
}

async function callDirectOpenRouter(prompt, attempt = 0) {
    const apiKey = getUserApiKey();
    if (!apiKey) {
        const serverHasKey = await checkServerHasKey();
        if (serverHasKey === true) {
            // Server is configured but this request fell back (bad route / transient).
            // Tell the user to retry — their key is not the problem.
            throw new Error('AI server is configured but unreachable for this request (route/network issue). Please retry. If it persists, ' + aiSetupHint());
        }
        throw new Error('AI service unavailable: no API key found. ' + aiSetupHint());
    }
    return callDirectOpenRouterFromAPI(prompt, apiKey, attempt);
}

async function callDirectOpenRouterFromAPI(prompt, apiKey, attempt = 0) {
    const MODELS = STUVO_FALLBACK_MODELS;
    const selectedModel = MODELS[Math.min(attempt, MODELS.length - 1)];
    const messages = buildOpenRouterMessages(prompt);
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = controller ? setTimeout(() => { try { controller.abort(); } catch (e) {} }, 20000) : null;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://stuvo-eosin.vercel.app",
                "X-Title": "Stuvo"
            },
            body: JSON.stringify({
                model: selectedModel,
                messages,
                max_tokens: 1000,
                temperature: 0.7
            }),
            signal: controller ? controller.signal : undefined
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error("OpenRouter rejected the API key (HTTP " + response.status + "). Check Settings → AI Key and save a valid sk-or-v1-... key.");
            }
            if ((response.status === 429 || (response.status >= 500 && response.status <= 599)) && attempt < MODELS.length - 1) {
                if (response.status === 429) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                return callDirectOpenRouterFromAPI(prompt, apiKey, attempt + 1);
            }
            const errText = await response.text().catch(() => '');
            if (response.status === 429) {
                throw new Error("OpenRouter rate limit reached (HTTP 429). Wait a minute and try again.");
            }
            throw new Error("OpenRouter error (" + response.status + "): " + (errText || 'request failed').slice(0, 300));
        }
        const rawText = await response.text();
        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("OpenRouter returned non-JSON"); }
        if (data.error) throw new Error(data.error.message || "OpenRouter error");
        if (!data.choices || !data.choices[0] || !data.choices[0].message) throw new Error("Unexpected OpenRouter response");
        const content = data.choices[0].message.content;
        if (content === null || content === undefined || String(content).trim().length === 0) {
            throw new Error("The AI model returned an empty response. Please try again.");
        }
        return content;
    } catch (err) {
        if (err && err.name === 'AbortError') throw new Error("AI request timed out after 20s. Please try again.");
        // Retry across fallback models for transient/network errors only —
        // never retry auth errors (they will fail identically on every model).
        const msg = String((err && err.message) || '');
        const isAuth = msg.includes('rejected the API key') || msg.includes('(HTTP 401') || msg.includes('(HTTP 403');
        if (!isAuth && attempt < MODELS.length - 1) {
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            return callDirectOpenRouterFromAPI(prompt, apiKey, attempt + 1);
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function safeApiCall(endpoint, payload) {
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        // Network failure (static host, offline, CORS): try per-user-key fallback.
        console.warn(`Fallback triggered for ${endpoint} due to network error:`, err && err.message);
        return await handleClientFallback(endpoint, payload);
    }
    if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error) throw new Error(data.error);
        return data;
    }
    // If static web server returns 405 Method Not Allowed or 404 Not Found, use client-side direct fallback
    if (response.status === 405 || response.status === 404) {
        console.warn(`Endpoint ${endpoint} returned HTTP ${response.status}. Using direct AI fallback...`);
        return await handleClientFallback(endpoint, payload);
    }
    const errorText = await response.text().catch(() => '');
    let serverMsg = '';
    try {
        const parsed = JSON.parse(errorText);
        serverMsg = parsed.error || '';
    } catch (e) { serverMsg = errorText; }
    console.error('AI service error:', response.status, errorText);
    const missingServerKey = /OPENROUTER_API_KEY|environment variable is not set|No OpenRouter key/i.test(serverMsg || '');
    if (missingServerKey && hasUserApiKey()) {
        // Server env missing but user provided their own key — serve via direct fallback.
        console.warn(`Server key missing for ${endpoint}; using per-user key fallback...`);
        return await handleClientFallback(endpoint, payload);
    }
    if (missingServerKey) {
        throw new Error('AI server has no API key configured. ' + aiSetupHint());
    }
    if (response.status === 429) {
        throw new Error('AI is rate-limited right now. Wait a minute and try again.');
    }
    throw new Error(serverMsg ? `AI service error: ${String(serverMsg).slice(0, 280)}` : `AI service error (${response.status}). Please try again.`);
}

async function handleClientFallback(endpoint, payload = {}) {
    let ep = endpoint.replace('/api/', '').split('?')[0];
    // Support consolidated /api/ai endpoint — map action field to effective endpoint
    if (ep === 'ai' && payload && payload.action) {
        ep = payload.action;
    }
    const strictJSON = (txt, what) => {
        if (txt === null || txt === undefined || String(txt).trim().length === 0) {
            throw new Error((what || 'AI') + ' returned an empty response. Please try again.');
        }
        const clean = String(txt).replace(/```json|```/g, '').trim();
        try { return JSON.parse(clean); }
        catch (e) {
            // Extract [...] before {...}: for quiz arrays the object-first
            // order would return only the first question object.
            const s = String(txt);
            const ab = s.indexOf('['), ae = s.lastIndexOf(']');
            if (ab !== -1 && ae > ab) { try { return JSON.parse(s.slice(ab, ae + 1)); } catch (e3) {} }
            const fb = s.indexOf('{'), lb = s.lastIndexOf('}');
            if (fb !== -1 && lb > fb) { try { return JSON.parse(s.slice(fb, lb + 1)); } catch (e2) {} }
            throw new Error((what || 'AI') + ' returned an unexpected format. Please try again.');
        }
    };
    const requireText = (v, what) => {
        const s = (v === null || v === undefined) ? '' : String(v).trim();
        if (!s) throw new Error((what || 'AI') + ' returned an empty response. Please try again.');
        return s;
    };

    if (ep === 'studyPlan') {
        const { examDate = 'upcoming', subjects = [], weakTopics = {}, hours = 4 } = payload;
        const weakStr = Object.entries(weakTopics).map(([s, t]) => `${s}: ${Array.isArray(t) ? t.join(', ') : t}`).join('; ') || 'None';
        const plan = await callDirectOpenRouter([
            { role: 'system', content: 'You are an AI study planner. Format daily study plans using day ranges, topics, hours, and priority (HIGH/MEDIUM/LOW).' },
            { role: 'user', content: `Create a study plan for subjects: ${subjects.join(', ')}. Exam date: ${examDate}. Daily study hours: ${hours}. Weak topics: ${weakStr}.\n\nFormat with Day 1-3, Day 4-6 blocks with Subject, Topic, hours, and Priority.` }
        ]);
        return { plan: requireText(plan, 'Study planner') };
    }

    if (ep === 'generateRevision') {
        const { subject = 'General', chapter = 'Chapter', grade = '' } = payload;
        const prompt = `Create revision material for a grade ${grade || 'school'} student on "${chapter}" in ${subject}. Return ONLY JSON:\n{\n  "keyConcepts": ["concept 1", "concept 2"],\n  "formulas": ["formula or rule 1"],\n  "quickNotes": "summary paragraph",\n  "practiceQuestions": [{"question": "q1", "answer": "a1"}],\n  "checklist": ["revision step 1", "revision step 2", "revision step 3"]\n}`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Revision generator');
        if (!Array.isArray(parsed.keyConcepts) || !parsed.keyConcepts.length || !parsed.quickNotes) {
            throw new Error('Revision generator returned an incomplete response. Please try again.');
        }
        return parsed;
    }

    if (ep === 'generateQuiz') {
        const { topic = 'General', difficulty = 'medium', questionCount = 8, sourceText = '' } = payload;
        const src = sourceText ? `based on: "${sourceText}"` : `about "${topic}"`;
        const prompt = `Generate ${questionCount} multiple choice questions ${src} for a school student, difficulty: ${difficulty}. Return ONLY JSON array: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}]`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Quiz generator');
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions) || !questions.length) {
            throw new Error('No questions were generated. Try a different topic.');
        }
        return { questions };
    }

    if (ep === 'doubt' || ep === 'askDoubt') {
        const { question = '', subject = 'General', mode = '', previousAnswer = '', grade = '' } = payload;
        let prompt = `You are a patient school tutor for ${subject}. A grade ${grade || 'school'} student asks: "${question}". Give a clear step-by-step explanation. Number each step. End with a clear final answer line starting with "Answer: ".`;
        if (mode === 'simpler') prompt = `A grade ${grade || 'school'} student found this explanation too complex: "${previousAnswer}". Re-explain "${question}" (${subject}) using simpler words, shorter sentences, and a more basic analogy. Number each step. End with a clear final answer line starting with "Answer: ".`;
        if (mode === 'alternative') prompt = `A grade ${grade || 'school'} student wants a different way to understand "${question}" (${subject}). Original explanation: "${previousAnswer}". Provide a genuinely different method or approach, step-by-step. Number each step. End with a clear final answer line starting with "Answer: ".`;
        const answer = await callDirectOpenRouter(prompt);
        return { answer: requireText(answer, 'Tutor') };
    }

    if (ep === 'practiceBit') {
        const { subject = 'General', topic = '' } = payload;
        const s = payload.subjects?.[0] || subject;
        const prompt = `Generate one short practice question about ${s} (${topic || s}). Return ONLY JSON: {"question": "...", "correctAnswer": "...", "hint": "..."}`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Question generator');
        if (!parsed.question || !parsed.correctAnswer) {
            throw new Error('No question returned. Please try again.');
        }
        return {
            subject: s,
            question: String(parsed.question),
            correctAnswer: String(parsed.correctAnswer),
            hint: parsed.hint ? String(parsed.hint) : ''
        };
    }

    if (ep === 'checkPracticeBit' || ep === 'checkAnswer') {
        const { question = '', studentAnswer = '', subject = 'General', correctAnswer = '' } = payload;
        const prompt = `Evaluate student's answer for ${subject}.\nQuestion: ${question}\nCorrect answer: ${correctAnswer}\nStudent Answer: ${studentAnswer}\nReturn ONLY JSON: {"isCorrect": true/false, "correctAnswer": "...", "feedback": "encouraging feedback"}`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Answer checker');
        if (parsed.isCorrect === undefined || !parsed.feedback) {
            throw new Error('Answer checker returned an incomplete evaluation. Please try again.');
        }
        return {
            isCorrect: Boolean(parsed.isCorrect),
            correctAnswer: parsed.correctAnswer ? String(parsed.correctAnswer) : (correctAnswer || ''),
            feedback: String(parsed.feedback)
        };
    }

    if (ep === 'summarizeHomework') {
        const { homeworkText = '', mode } = payload;
        const prompt = `Summarize this homework assignment:\n"${homeworkText}"\nReturn ONLY JSON: {"summary": "...", "keyPoints": ["..."], "whatYouNeedToDo": "...", "importantConcepts": ["..."]}`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Homework summarizer');
        if (!parsed.summary || !Array.isArray(parsed.keyPoints)) {
            throw new Error('Homework summarizer returned an incomplete response. Please try again.');
        }
        return parsed;
    }

    if (ep === 'analyzeWeakness') {
        const { marks = {}, studyTime = {}, focusCount = 0, weakSubjects = [] } = payload;
        const analysis = await callDirectOpenRouter(`Analyze performance:\nMarks: ${JSON.stringify(marks)}\nStudy Time: ${JSON.stringify(studyTime)}\nWeak Subjects: ${weakSubjects.join(', ')}\n\nFormat as Strong, Weak, and Recommendations.`);
        return { analysis: requireText(analysis, 'Analyzer') };
    }

    if (ep === 'classPulse') {
        const prompt = `Class summary: ${JSON.stringify(payload)}. Give ONE short recommendation under 20 words. Return JSON: {"recommendation": "..."}`;
        const raw = await callDirectOpenRouter(prompt);
        const parsed = strictJSON(raw, 'Class assistant');
        if (!parsed.recommendation) throw new Error('Class assistant returned an incomplete response. Please try again.');
        return parsed;
    }

    if (ep === 'wellbeingAssistant') {
        const { prompt = '', message = '', conversationHistory = [] } = payload;
        const effectivePrompt = prompt || message || '';
        if (!String(effectivePrompt).trim()) throw new Error('Message required.');
        const reply = await callDirectOpenRouter([
            { role: 'system', content: 'You are the Stuvo Wellbeing Assistant: a warm, supportive wellbeing companion for students. Empathetic, non-judgmental, encouraging. Hold a real conversation: respond directly to what the student just shared, keep it to 2-5 sentences, end with ONE open follow-up question (unless they asked for a specific calming technique — then guide them through it step by step). Refer back to earlier turns when relevant and never repeat the same generic lines.' },
            ...conversationHistory.slice(-8),
            { role: 'user', content: effectivePrompt }
        ]);
        const concernKeywords = ['hurt myself', 'suicide', 'kill myself', 'want to die', 'self harm', 'self-harm', 'end my life', 'suicidal', 'take my life'];
        const escalationFlag = concernKeywords.some(kw => String(effectivePrompt).toLowerCase().includes(kw));
        return { reply: requireText(reply, 'Wellbeing assistant'), escalationFlag };
    }

    if (ep === 'nextBestAction') {
        // No synthetic priorities: callers already render a deterministic
        // real-data fallback (studyHub/dashboard). Failing visibly lets them do so.
        throw new Error('Study recommender unavailable offline. Please try again when online.');
    }

    throw new Error(`Unknown endpoint ${endpoint}`);
}

function renderFormattedAnswer(text) {
  if (!text) return '';
  return text.split('\n').filter(line => line.trim()).map(line =>
    `<p class="ai-answer-line" style="margin:0 0 8px 0;line-height:1.6;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  ).join('');
}
if (typeof window !== 'undefined') window.renderFormattedAnswer = renderFormattedAnswer;
if (typeof window !== 'undefined') {
    window.getUserApiKey = getUserApiKey;
    window.setUserApiKey = setUserApiKey;
    window.clearUserApiKey = clearUserApiKey;
    window.hasUserApiKey = hasUserApiKey;
    window.checkServerHasKey = checkServerHasKey;
    window.openAiKeySettings = openAiKeySettings;
}

// ─── AI Key Settings UI (per-user OpenRouter key, browser-only) ───
function ensureAiKeyStyles() {
    if (document.getElementById('ai-key-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-key-styles';
    style.textContent = `
        .ai-key-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ai-key-modal { width: 100%; max-width: 480px; background: rgba(17,24,39,0.95); border: 1px solid var(--glass-border); border-radius: 20px; padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .ai-key-title { font-size: 17px; font-weight: 800; color: var(--text); margin: 0 0 6px; }
        .ai-key-sub { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0 0 14px; }
        .ai-key-sub a { color: #C4B5FD; }
        .ai-key-row { display: flex; gap: 8px; }
        .ai-key-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: var(--text); padding: 11px 12px; border-radius: 12px; font-size: 13px; font-family: ui-monospace, monospace; min-width: 0; }
        .ai-key-input:focus { outline: none; border-color: var(--violet); }
        .ai-key-toggle { flex-shrink: 0; width: 44px; border-radius: 12px; background: var(--glass); border: 1px solid var(--glass-border); color: var(--text); cursor: pointer; font-size: 16px; }
        .ai-key-status { font-size: 12px; margin-top: 10px; min-height: 18px; }
        .ai-key-status.ok { color: #6EE7B7; }
        .ai-key-status.err { color: #FCA5A5; }
        .ai-key-status.dim { color: var(--text-dim); }
        .ai-key-actions { display: flex; gap: 10px; margin-top: 14px; }
        .ai-key-actions .btn { flex: 1; }
    `;
    document.head.appendChild(style);
}

function aiKeyStatusText() {
    if (hasUserApiKey()) return { cls: 'ok', text: '✓ Personal key saved in this browser.' };
    return { cls: 'dim', text: 'No personal key saved — app uses the shared server key.' };
}

function openAiKeySettings() {
    ensureAiKeyStyles();
    if (document.getElementById('ai-key-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ai-key-overlay';
    overlay.className = 'ai-key-overlay';
    const st = aiKeyStatusText();
    overlay.innerHTML = `
        <div class="ai-key-modal" role="dialog" aria-modal="true" aria-label="AI key settings">
            <h3 class="ai-key-title">🤖 AI Key</h3>
            <p class="ai-key-sub">By default Stuvo uses the shared server key. Optionally add your own free key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a> — it stays only in this browser.</p>
            <div class="ai-key-row">
                <input id="ai-key-input" class="ai-key-input" type="password" placeholder="sk-or-v1-..." autocomplete="off" spellcheck="false" />
                <button id="ai-key-toggle" class="ai-key-toggle" aria-label="Show or hide key">👁</button>
            </div>
            <div id="ai-key-status" class="ai-key-status ${st.cls}">${st.text}</div>
            <div class="ai-key-actions">
                <button id="ai-key-remove" class="btn btn-secondary">Remove</button>
                <button id="ai-key-close" class="btn btn-secondary">Close</button>
                <button id="ai-key-save" class="btn btn-primary">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#ai-key-input');
    const status = overlay.querySelector('#ai-key-status');
    const setStatus = (cls, text) => { status.className = 'ai-key-status ' + cls; status.textContent = text; };
    try { input.value = getUserApiKey(); } catch (e) {}
    overlay.querySelector('#ai-key-toggle').addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    overlay.querySelector('#ai-key-save').addEventListener('click', () => {
        const v = input.value.trim();
        if (!v) { setStatus('err', 'Paste a key first, or press Remove to clear.'); return; }
        if (!isValidOpenRouterKey(v)) { setStatus('err', 'That does not look like an OpenRouter key (expected sk-or-v1-...).'); return; }
        if (setUserApiKey(v)) {
            setStatus('ok', '✓ Saved. AI will prefer your key on this device.');
            try { if (typeof showToast === 'function') showToast('AI key saved in this browser', 'success'); } catch (e) {}
        } else {
            setStatus('err', 'Could not save the key in this browser.');
        }
    });
    overlay.querySelector('#ai-key-remove').addEventListener('click', () => {
        clearUserApiKey();
        input.value = '';
        setStatus('dim', 'Removed. App uses the shared server key.');
        try { if (typeof showToast === 'function') showToast('Personal AI key removed', 'info'); } catch (e) {}
    });
    const close = () => overlay.remove();
    overlay.querySelector('#ai-key-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
}

// Mount a persistent 🤖 AI Key button in the topbar (all roles, desktop+mobile).
function initAiKeyButton() {
    try {
        const actions = document.querySelector('.topbar-actions');
        if (!actions) return;
        if (document.getElementById('ai-key-btn')) return;
        ensureAiKeyStyles();
        const btn = document.createElement('button');
        btn.id = 'ai-key-btn';
        btn.className = 'global-search-btn';
        btn.setAttribute('aria-label', 'AI key settings');
        btn.title = 'AI key settings';
        btn.textContent = '🤖';
        const searchBtn = document.getElementById('global-search-btn');
        if (searchBtn && searchBtn.parentNode === actions) actions.insertBefore(btn, searchBtn);
        else actions.prepend(btn);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openAiKeySettings();
        });
    } catch (e) {}
}
if (typeof window !== 'undefined') {
    window.initAiKeyButton = initAiKeyButton;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { setTimeout(initAiKeyButton, 300); });
    } else {
        setTimeout(initAiKeyButton, 300);
    }
    window.addEventListener('hashchange', () => setTimeout(initAiKeyButton, 300));
}

// ─── D.4 Global Search ─────────────────────────────────────
// Implements openGlobalSearch() that:
// - Creates a full-screen overlay modal with single search input, debounced 300ms
// - Searches across: homework titles (from all enrolled/taught classes), class names, announcements, revision cache chapter names
//   — all client-side filtering of already-fetched data where possible to avoid excessive Firestore reads;
//   for larger searches, queries each relevant collection with a where prefix match on lowercased title fields
// - Results grouped by type (Homework, Classes, Announcements, Study Material) with click-to-navigate
// - Empty state: _i18n_t('common.noResults','No results for \'{query}\'')
// - Use glass card design, consistent with app

var _globalSearchDebounce = null;
var _globalSearchCacheRaw = { ts: 0, classes: [], homework: [], announcements: [], revisions: [] };
var _globalSearchCacheDuration = 30000; // 30s
var _globalSearchOpen = false;

function ensureGlobalSearchStyles() {
    if (document.getElementById('global-search-styles')) return;
    const style = document.createElement('style');
    style.id = 'global-search-styles';
    style.textContent = `
        .global-search-btn {
            position: relative; width: 42px; height: 42px; border-radius: 50%;
            background: var(--glass); border: 1px solid var(--glass-border);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 18px;
            transition: transform var(--dur-press) var(--ease-out), background-color 160ms ease;
        }
        .global-search-btn:active { transform: scale(var(--press-scale)); }
        @media (hover: hover) and (pointer: fine) {
        .global-search-btn:hover { background: rgba(255,255,255,0.08); }
        }
        .global-search-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            z-index: 1100;
            display: flex; align-items: flex-start; justify-content: center;
            padding: 80px 16px 16px;
            overflow-y: auto;
        }
        .global-search-modal {
            background: rgba(17,24,39,0.92);
            border: 1px solid var(--glass-border);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-radius: 20px;
            width: 100%; max-width: 640px;
            max-height: 80vh;
            display: flex; flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .global-search-header {
            display: flex; gap: 12px; align-items: center;
            padding: 16px;
            border-bottom: 1px solid var(--glass-border);
            flex-shrink: 0;
        }
        .global-search-input-wrap {
            flex: 1; position: relative; display: flex; align-items: center;
        }
        .global-search-icon {
            position: absolute; left: 14px; font-size: 14px; opacity: 0.7; pointer-events: none;
        }
        #global-search-input {
            width: 100%;
            background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border);
            color: var(--text); padding: 12px 42px 12px 40px; border-radius: 12px;
            font-family: 'Inter', sans-serif; font-size: 14px;
        }
        #global-search-input::placeholder { color: var(--text-dim); }
        #global-search-input:focus { outline: none; border-color: var(--violet); }
        .global-search-clear {
            position: absolute; right: 8px;
            width: 28px; height: 28px; border-radius: 8px;
            background: var(--glass); border: 1px solid var(--glass-border);
            color: var(--text-dim); cursor: pointer; font-size: 12px;
            display: flex; align-items: center; justify-content: center;
        }
        .global-search-clear.hidden { display: none !important; }
        .global-search-clear { transition: background-color 160ms ease, color 160ms ease; }
        @media (hover: hover) and (pointer: fine) {
        .global-search-clear:hover { background: rgba(255,255,255,0.08); color: var(--text); }
        }
        .global-search-results {
            flex: 1; overflow-y: auto; padding: 16px;
            max-height: 60vh;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .global-search-results::-webkit-scrollbar { width: 6px; }
        .global-search-results::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 6px; }
        .gs-group { margin-bottom: 18px; }
        .gs-group:last-child { margin-bottom: 0; }
        .gs-group-label {
            font-size: 11px; font-weight: 700; color: var(--text-dim);
            text-transform: uppercase; letter-spacing: 0.08em;
            margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
        }
        .gs-group-label span.count {
            background: rgba(124,92,252,0.15); border: 1px solid rgba(124,92,252,0.25);
            color: #C4B5FD; padding: 2px 7px; border-radius: 20px; font-size: 11px; font-weight: 600;
        }
        .gs-item {
            display: flex; gap: 12px; align-items: center;
            padding: 12px 14px; border-radius: 14px;
            background: var(--glass); border: 1px solid var(--glass-border);
            cursor: pointer; margin-bottom: 8px;
            transition: transform var(--dur-press) var(--ease-out), background-color 160ms ease, border-color 160ms ease;
        }
        .gs-item:active { transform: scale(0.99); }
        @media (hover: hover) and (pointer: fine) {
        .gs-item:hover { background: rgba(124,92,252,0.12); border-color: rgba(124,92,252,0.35); }
        }
        .gs-item-icon {
            width: 36px; height: 36px; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; flex-shrink: 0;
            background: rgba(124,92,252,0.15); border: 1px solid rgba(255,255,255,0.06);
        }
        .gs-item-main { flex: 1; min-width: 0; }
        .gs-item-title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gs-item-sub { font-size: 12px; color: var(--text-dim); margin-top: 3px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gs-item-arrow { color: var(--text-dim); font-size: 13px; margin-left: auto; flex-shrink: 0; opacity: 0.7; transition: color 160ms ease, opacity 160ms ease; }
        @media (hover: hover) and (pointer: fine) {
        .gs-item:hover .gs-item-arrow { color: #C4B5FD; opacity: 1; }
        }
        .global-search-hint {
            padding: 12px 16px; border-top: 1px solid var(--glass-border);
            font-size: 11px; color: var(--text-dim); text-align: center;
            background: rgba(0,0,0,0.15); flex-shrink: 0;
        }
        .global-search-empty-hint {
            text-align: center; padding: 36px 16px; color: var(--text-dim); font-size: 13px;
        }
        .gs-highlight { background: rgba(124,92,252,0.25); color: #C4B5FD; padding: 0 2px; border-radius: 3px; }
        @media (max-width: 640px) {
            .global-search-overlay { padding: 40px 12px 12px; }
            .global-search-modal { max-height: 88vh; }
        }
    `;
    document.head.appendChild(style);
}

function _escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _escAttr(s) { return _escapeHtml(s); }
function _highlightMatch(text, queryLower) {
    if (!queryLower || !text) return _escapeHtml(text);
    const lower = String(text).toLowerCase();
    const idx = lower.indexOf(queryLower);
    if (idx === -1) return _escapeHtml(text);
    const before = _escapeHtml(text.slice(0, idx));
    const match = _escapeHtml(text.slice(idx, idx + queryLower.length));
    const after = _escapeHtml(text.slice(idx + queryLower.length));
    return before + '<span class="gs-highlight">' + match + '</span>' + after;
}

async function _getRelevantClassIdsForSearch() {
    const role = (typeof appState !== 'undefined' && appState.role) ? appState.role : null;
    const uid = (typeof appState !== 'undefined' && appState.user && appState.user.uid) ? appState.user.uid : null;
    const userData = (typeof appState !== 'undefined' && appState.userData) ? appState.userData : {};
    const ids = new Set();
    if (role === 'student') {
        (userData.classIds || []).forEach(id => ids.add(id));
        return Array.from(ids);
    }
    if (role === 'teacher') {
        (userData.classIds || []).forEach(id => ids.add(id));
        if (uid) {
            try {
                const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid)));
                snap.forEach(d => ids.add(d.id));
            } catch (e) { console.error('[globalSearch teacher classes]', e); }
        }
        return Array.from(ids);
    }
    if (role === 'admin') {
        try {
            const snap = await getDocs(query(collection(db, 'classes'), limit(20)));
            snap.forEach(d => ids.add(d.id));
        } catch (e) { console.error('[globalSearch admin classes]', e); }
        return Array.from(ids);
    }
    (userData.classIds || []).forEach(id => ids.add(id));
    return Array.from(ids);
}

async function _fetchClassesForSearch(classIds) {
    const results = [];
    if (!classIds || classIds.length === 0) return results;
    for (const cid of classIds.slice(0, 20)) {
        try {
            const snap = await getDoc(doc(db, 'classes', cid));
            if (snap.exists) {
                const data = snap.data();
                results.push({ id: snap.id, ...data });
            }
        } catch (e) { console.error('[globalSearch fetch class]', cid, e); }
    }
    if (results.length === 0 && classIds.length === 0) {
        try {
            const snap = await getDocs(query(collection(db, 'classes'), limit(20)));
            snap.forEach(d => results.push({ id: d.id, ...d.data() }));
        } catch (e) {}
    }
    return results;
}

async function _fetchHomeworkForSearch(classIds) {
    const all = [];
    for (const cid of (classIds || []).slice(0, 20)) {
        try {
            const snap = await getDocs(collection(db, 'classes', cid, 'homework'));
            let className = '';
            try {
                const cSnap = await getDoc(doc(db, 'classes', cid));
                if (cSnap.exists) className = cSnap.data().name || cid;
                else className = cid;
            } catch (e) { className = cid; }
            snap.forEach(d => {
                const hw = d.data();
                all.push({ id: d.id, classId: cid, className: className, title: hw.title || 'Untitled', subject: hw.subject || '', deadline: hw.deadline || '', description: hw.description || '', ...hw });
            });
        } catch (e) { console.error('[globalSearch homework]', cid, e); }
    }
    return all;
}

async function _fetchAnnouncementsForSearch(classIds) {
    const all = [];
    for (const cid of (classIds || []).slice(0, 20)) {
        try {
            const snap = await getDocs(query(collection(db, 'classes', cid, 'announcements'), orderBy('createdAt', 'desc'), limit(10)));
            let className = cid;
            try {
                const cSnap = await getDoc(doc(db, 'classes', cid));
                if (cSnap.exists) className = cSnap.data().name || cid;
            } catch (e) {}
            snap.forEach(d => {
                const a = d.data();
                all.push({ id: d.id, classId: cid, className: className, title: a.title || a.text || 'Announcement', text: a.text || a.title || '', createdAt: a.createdAt, ...a });
            });
        } catch (e) {
            try {
                const snap2 = await getDocs(collection(db, 'classes', cid, 'announcements'));
                let className = cid;
                try { const cSnap = await getDoc(doc(db, 'classes', cid)); if (cSnap.exists) className = cSnap.data().name || cid; } catch(_){}
                snap2.forEach(d => {
                    const a = d.data();
                    all.push({ id: d.id, classId: cid, className: className, title: a.title || a.text || 'Announcement', text: a.text || a.title || '', createdAt: a.createdAt, ...a });
                });
            } catch (e2) { console.error('[globalSearch announcements]', cid, e2); }
        }
    }
    return all;
}

async function _fetchRevisionsForSearch() {
    const all = [];
    try {
        const snap = await getDocs(query(collection(db, 'revisionCache'), limit(30)));
        snap.forEach(d => {
            const r = d.data();
            all.push({ id: d.id, chapter: r.chapter || d.id, subject: r.subject || 'General', keyConcepts: r.keyConcepts || r.keyConcepts || [], quickNotes: r.quickNotes || '', ...r });
        });
    } catch (e) {
        console.error('[globalSearch revisionCache]', e);
        try {
            const snap2 = await getDocs(collection(db, 'revisionCache'));
            snap2.forEach(d => {
                const r = d.data();
                all.push({ id: d.id, chapter: r.chapter || d.id, subject: r.subject || 'General', ...r });
            });
        } catch (e2) {}
    }
    return all;
}

async function _tryPrefixQuery(colRef, lowerField, queryLower) {
    try {
        const q = query(colRef, where(lowerField, '>=', queryLower), where(lowerField, '<=', queryLower + '\uf8ff'));
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        if (arr.length > 0) return arr;
        return null;
    } catch (e) {
        return null;
    }
}

async function performGlobalSearch(queryLower, rawQuery) {
    const classIds = await _getRelevantClassIdsForSearch();
    const now = Date.now();
    let rawData;
    if (now - _globalSearchCacheRaw.ts < _globalSearchCacheDuration && _globalSearchCacheRaw.classes.length > 0) {
        rawData = _globalSearchCacheRaw;
    } else {
        const [classes, homework, announcements, revisions] = await Promise.all([
            _fetchClassesForSearch(classIds),
            _fetchHomeworkForSearch(classIds),
            _fetchAnnouncementsForSearch(classIds),
            _fetchRevisionsForSearch()
        ]);
        rawData = { classes, homework, announcements, revisions, ts: now };
        _globalSearchCacheRaw = rawData;
    }
    const q = queryLower.trim();
    const filter = (text) => {
        if (!text) return false;
        const lower = String(text).toLowerCase();
        return lower.includes(q);
    };
    let homeworkResults = rawData.homework.filter(hw => {
        return filter(hw.title) || filter(hw.subject) || filter(hw.description) || filter(hw.title_lower) || filter(hw.titleLower);
    });
    if (homeworkResults.length === 0 && rawData.homework.length > 20) {
        for (const cid of (classIds || []).slice(0, 5)) {
            try {
                const colRef = collection(db, 'classes', cid, 'homework');
                const pref = await _tryPrefixQuery(colRef, 'title_lower', q);
                if (pref && pref.length) {
                    let className = cid;
                    try { const cSnap = await getDoc(doc(db, 'classes', cid)); if (cSnap.exists) className = cSnap.data().name || cid; } catch(_){}
                    pref.forEach(p => {
                        const exists = homeworkResults.find(h => h.id === p.id && h.classId === cid);
                        if (!exists) homeworkResults.push({ id: p.id, classId: cid, className, title: p.title || p.title_lower || 'Untitled', subject: p.subject || '', deadline: p.deadline || '', ...p });
                    });
                }
            } catch (e) {}
        }
    }
    const classResults = rawData.classes.filter(c => filter(c.name) || filter(c.subject) || filter(c.room) || filter(c.name_lower));
    if (classResults.length === 0 && rawData.classes.length > 10) {
        try {
            const pref = await _tryPrefixQuery(collection(db, 'classes'), 'name_lower', q);
            if (pref && pref.length) {
                pref.forEach(p => {
                    if (!classResults.find(x => x.id === p.id)) classResults.push({ id: p.id, ...p });
                });
            }
        } catch (e) {}
    }
    const announcementResults = rawData.announcements.filter(a => filter(a.title) || filter(a.text) || filter(a.body) || filter(a.title_lower));
    const revisionResults = rawData.revisions.filter(r => filter(r.chapter) || filter(r.subject) || filter(r.chapterName) || filter(r.title) || filter(r.title_lower));
    if (revisionResults.length === 0 && rawData.revisions.length > 10) {
        try {
            const pref = await _tryPrefixQuery(collection(db, 'revisionCache'), 'chapter_lower', q);
            if (pref && pref.length) {
                pref.forEach(p => {
                    if (!revisionResults.find(x => x.id === p.id)) revisionResults.push({ id: p.id, chapter: p.chapter || p.chapter_lower || p.id, subject: p.subject || 'General', ...p });
                });
            }
        } catch (e) {}
    }
    return {
        homework: homeworkResults.slice(0, 10),
        classes: classResults.slice(0, 10),
        announcements: announcementResults.slice(0, 10),
        revisions: revisionResults.slice(0, 10)
    };
}

function _getHomeworkRoute() {
    const role = (typeof appState !== 'undefined' && appState.role) ? appState.role : 'student';
    if (role === 'teacher') return '#/teacher/homework';
    if (role === 'admin') return '#/admin/dashboard';
    return '#/student/homework';
}
function _getClassesRoute(classId) {
    const role = (typeof appState !== 'undefined' && appState.role) ? appState.role : 'student';
    if (role === 'teacher') return '#/teacher/class-detail?classId=' + encodeURIComponent(classId);
    if (role === 'admin') return '#/admin/users';
    return '#/student/dashboard';
}
function _getAnnouncementRoute() {
    const role = (typeof appState !== 'undefined' && appState.role) ? appState.role : 'student';
    if (role === 'teacher') return '#/teacher/dashboard';
    if (role === 'admin') return '#/admin/dashboard';
    return '#/student/dashboard';
}
function _getRevisionRoute() {
    const role = (typeof appState !== 'undefined' && appState.role) ? appState.role : 'student';
    if (role === 'student') return '#/student/study-hub?tab=revision';
    if (role === 'teacher') return '#/teacher/dashboard';
    return '#/admin/dashboard';
}

function renderGlobalSearchResults(grouped, rawQuery, container) {
    const total = grouped.homework.length + grouped.classes.length + grouped.announcements.length + grouped.revisions.length;
    const qEsc = _escapeHtml(rawQuery);
    const qLower = rawQuery.toLowerCase();
    if (total === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-title">No results for '${qEsc}'</div>
                <div class="empty-sub">Try different keywords or check spelling</div>
            </div>
        `;
        return;
    }
    const htmlParts = [];
    if (grouped.homework.length) {
        htmlParts.push(`
            <div class="gs-group" data-group="homework">
                <div class="gs-group-label">📚 Homework <span class="count">${grouped.homework.length}</span></div>
                <div class="gs-group-items">
                    ${grouped.homework.map(hw => `
                        <div class="gs-item" data-type="homework" data-id="${_escAttr(hw.id)}" data-class-id="${_escAttr(hw.classId)}" tabindex="0" role="button">
                            <div class="gs-item-icon">📚</div>
                            <div class="gs-item-main">
                                <div class="gs-item-title">${_highlightMatch(hw.title, qLower)}</div>
                                <div class="gs-item-sub">${_escapeHtml(hw.subject ? hw.subject + ' · ' : '')}${_escapeHtml(hw.className)}${hw.deadline ? ' · Due ' + _escapeHtml(hw.deadline) : ''}</div>
                            </div>
                            <div class="gs-item-arrow">→</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    }
    if (grouped.classes.length) {
        htmlParts.push(`
            <div class="gs-group" data-group="classes">
                <div class="gs-group-label">🏫 Classes <span class="count">${grouped.classes.length}</span></div>
                <div class="gs-group-items">
                    ${grouped.classes.map(c => `
                        <div class="gs-item" data-type="classes" data-id="${_escAttr(c.id)}" tabindex="0" role="button">
                            <div class="gs-item-icon">🏫</div>
                            <div class="gs-item-main">
                                <div class="gs-item-title">${_highlightMatch(c.name || 'Unnamed Class', qLower)}</div>
                                <div class="gs-item-sub">${_escapeHtml(c.subject || ',')}${c.room ? ' · ' + _escapeHtml(c.room) : ''}</div>
                            </div>
                            <div class="gs-item-arrow">→</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    }
    if (grouped.announcements.length) {
        htmlParts.push(`
            <div class="gs-group" data-group="announcements">
                <div class="gs-group-label">📢 Announcements <span class="count">${grouped.announcements.length}</span></div>
                <div class="gs-group-items">
                    ${grouped.announcements.map(a => `
                        <div class="gs-item" data-type="announcements" data-id="${_escAttr(a.id)}" data-class-id="${_escAttr(a.classId)}" tabindex="0" role="button">
                            <div class="gs-item-icon">📢</div>
                            <div class="gs-item-main">
                                <div class="gs-item-title">${_highlightMatch(a.title || a.text || 'Announcement', qLower)}</div>
                                <div class="gs-item-sub">${_escapeHtml(a.className)}${a.createdAt ? ' · ' + _escapeHtml(timeAgoShared(a.createdAt)) : ''}</div>
                            </div>
                            <div class="gs-item-arrow">→</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    }
    if (grouped.revisions.length) {
        htmlParts.push(`
            <div class="gs-group" data-group="revisions">
                <div class="gs-group-label">📖 Study Material <span class="count">${grouped.revisions.length}</span></div>
                <div class="gs-group-items">
                    ${grouped.revisions.map(r => `
                        <div class="gs-item" data-type="revisions" data-id="${_escAttr(r.id)}" tabindex="0" role="button">
                            <div class="gs-item-icon">📖</div>
                            <div class="gs-item-main">
                                <div class="gs-item-title">${_highlightMatch(r.chapter || r.chapterName || r.id, qLower)}</div>
                                <div class="gs-item-sub">${_escapeHtml(r.subject || 'General')}</div>
                            </div>
                            <div class="gs-item-arrow">→</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    }
    container.innerHTML = htmlParts.join('');
    container.querySelectorAll('.gs-item').forEach(el => {
        const go = () => {
            const type = el.dataset.type;
            closeGlobalSearch();
            let route = '#/student/dashboard';
            if (type === 'homework') route = _getHomeworkRoute();
            else if (type === 'classes') route = _getClassesRoute(el.dataset.id);
            else if (type === 'announcements') route = _getAnnouncementRoute();
            else if (type === 'revisions') route = _getRevisionRoute();
            if (route) {
                window.location.hash = route;
                if (typeof handleRoute === 'function') setTimeout(() => { try { handleRoute(); } catch(e){} }, 50);
            }
        };
        el.addEventListener('click', go);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
}

function closeGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    if (overlay) overlay.remove();
    _globalSearchOpen = false;
    document.removeEventListener('keydown', _globalSearchEsc);
}

function _globalSearchEsc(e) {
    if (e.key === 'Escape') closeGlobalSearch();
}

function openGlobalSearch() {
    if (_globalSearchOpen && document.getElementById('global-search-overlay')) {
        const inp = document.getElementById('global-search-input');
        if (inp) inp.focus();
        return;
    }
    ensureGlobalSearchStyles();
    _globalSearchOpen = true;
    const overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.className = 'global-search-overlay';
    overlay.innerHTML = `
        <div class="global-search-modal" id="global-search-box" role="dialog" aria-modal="true" aria-label="Global search">
            <div class="global-search-header">
                <div class="global-search-input-wrap">
                    <span class="global-search-icon">🔍</span>
                    <input id="global-search-input" type="text" placeholder="${_i18n_t('common.searchPlaceholder','Search homework, classes, announcements, study material...')}" autocomplete="off" spellcheck="false" />
                    <button id="global-search-clear" class="global-search-clear hidden" aria-label="${_i18n_t('wellbeing.clear','Clear')}">✕</button>
                </div>
                <button id="global-search-close" class="modal-close" aria-label="${_i18n_t('common.close','Close')}">✕</button>
            </div>
            <div id="global-search-results" class="global-search-results">
                <div class="global-search-empty-hint">
                    <div style="font-size:28px;margin-bottom:10px;">🔍</div>
                    <div>${_i18n_t('common.searchHint','Start typing to search across')}</div>
                    <div style="margin-top:6px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                        <span class="badge badge-violet">${_i18n_t('nav.homework','Homework')}</span>
                        <span class="badge badge-blue">${_i18n_t('nav.classes','Classes')}</span>
                        <span class="badge badge-green">${_i18n_t('dashboard.announcements','Announcements')}</span>
                        <span class="badge badge-yellow">${_i18n_t('common.studyMaterial','Study Material')}</span>
                    </div>
                </div>
            </div>
            <div class="global-search-hint">${_i18n_t('common.searchFooter','Press ESC to close · Results grouped by type · Click to navigate')}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#global-search-input');
    const resultsEl = overlay.querySelector('#global-search-results');
    const clearBtn = overlay.querySelector('#global-search-clear');
    const closeBtn = overlay.querySelector('#global-search-close');
    const close = () => closeGlobalSearch();
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', _globalSearchEsc);
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.add('hidden');
        resultsEl.innerHTML = `
            <div class="global-search-empty-hint">
                <div style="font-size:28px;margin-bottom:10px;">🔍</div>
                <div>Start typing to search across</div>
                <div style="margin-top:6px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    <span class="badge badge-violet">Homework</span>
                    <span class="badge badge-blue">Classes</span>
                    <span class="badge badge-green">Announcements</span>
                    <span class="badge badge-yellow">Study Material</span>
                </div>
            </div>
        `;
        input.focus();
        if (_globalSearchDebounce) { clearTimeout(_globalSearchDebounce); _globalSearchDebounce = null; }
    });
    input.addEventListener('input', () => {
        const val = input.value;
        clearBtn.classList.toggle('hidden', val.trim().length === 0);
        if (_globalSearchDebounce) clearTimeout(_globalSearchDebounce);
        _globalSearchDebounce = setTimeout(async () => {
            const q = input.value.trim();
            if (!q) {
                resultsEl.innerHTML = `
                    <div class="global-search-empty-hint">
                        <div style="font-size:28px;margin-bottom:10px;">🔍</div>
                        <div>Start typing to search across</div>
                        <div style="margin-top:6px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                            <span class="badge badge-violet">Homework</span>
                            <span class="badge badge-blue">Classes</span>
                            <span class="badge badge-green">Announcements</span>
                            <span class="badge badge-yellow">Study Material</span>
                        </div>
                    </div>
                `;
                return;
            }
            resultsEl.innerHTML = `<div class="skeleton-wrap"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>`;
            try {
                const grouped = await performGlobalSearch(q.toLowerCase(), q);
                renderGlobalSearchResults(grouped, q, resultsEl);
            } catch (err) {
                console.error('[globalSearch]', err);
                resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Search failed</div><div class="empty-sub">${_escapeHtml(err.message || 'Please try again')}</div></div>`;
            }
        }, 300);
    });
    setTimeout(() => input.focus(), 50);
}

document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if ((mod && e.key.toLowerCase() === 'k') || (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))) {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (e.key === '/' && ['INPUT','TEXTAREA'].includes(tag)) return;
        e.preventDefault();
        openGlobalSearch();
    }
});

if (typeof window !== 'undefined') {
    window.openGlobalSearch = openGlobalSearch;
    window.closeGlobalSearch = closeGlobalSearch;
}

// ─── D.5 Offline-Friendly Experience: offline banner ─────────
(function initOfflineBanner() {
    function ensureOfflineBannerStyles() {
        if (document.getElementById('offline-banner-styles')) return;
        const style = document.createElement('style');
        style.id = 'offline-banner-styles';
        style.textContent = `
            #offline-banner {
                position: fixed; top: 0; left: 0; right: 0;
                background: linear-gradient(135deg, #F59E0B, #EF4444);
                color: var(--text-bright); text-align: center; font-size: 13px; font-weight: 600;
                padding: 10px 16px; z-index: 9999; display: none;
                box-shadow: 0 2px 12px rgba(0,0,0,0.3);
                font-family: 'Inter', sans-serif; letter-spacing: 0.02em;
            }
            #offline-banner.show { display: block !important; }
            body.has-offline-banner { padding-top: 40px; }
        `;
        document.head.appendChild(style);
    }
    function ensureBanner() {
        let banner = document.getElementById('offline-banner');
        if (banner) return banner;
        ensureOfflineBannerStyles();
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.textContent = "You're offline: showing previously loaded content";
        banner.style.display = 'none';
        if (document.body) document.body.prepend(banner);
        else document.addEventListener('DOMContentLoaded', () => {
            if (!document.getElementById('offline-banner')) document.body.prepend(banner);
        });
        return banner;
    }
    function updateOfflineBanner() {
        const banner = ensureBanner();
        if (!banner) return;
        ensureOfflineBannerStyles();
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (isOffline) {
            banner.style.display = 'block';
            banner.classList.add('show');
            document.body.classList.add('has-offline-banner');
        } else {
            banner.style.display = 'none';
            banner.classList.remove('show');
            document.body.classList.remove('has-offline-banner');
        }
    }
    ensureOfflineBannerStyles();
    ensureBanner();
    window.addEventListener('online', updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureBanner();
            updateOfflineBanner();
        });
    } else {
        updateOfflineBanner();
    }
    // expose for testing
    if (typeof window !== 'undefined') window.updateOfflineBanner = updateOfflineBanner;
})();
