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
        document.removeEventListener('keydown', onKey);
        if (reduceMotion) { overlay.remove(); return; }
        overlay.dataset.closing = 'true';
        window.setTimeout(() => overlay.remove(), 160);
    };
    overlay.querySelector('#modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    const onKey = e => { if (e.key === 'Escape') close(); };
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
var _notificationUid = null;
var _notificationPoll = null;
const NOTIFICATION_POLL_MS = 60000;

// Stop the realtime listener + polling fallback (e.g. on sign-out, so a
// revoked-credential listen doesn't retry the Firestore channel in a loop
// and spam `channel ... 400` console errors on shared devices).
function teardownNotifications() {
    _notificationUid = null;
    if (_notificationPoll) { try { clearInterval(_notificationPoll); } catch (_) {} _notificationPoll = null; }
    if (_notificationUnsub) { try { _notificationUnsub(); } catch (_) {} _notificationUnsub = null; }
}
if (typeof window !== 'undefined') window.teardownNotifications = teardownNotifications;

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
    // The error callback is required: without it a rejected listen (revoked
    // auth after sign-out, offline, rules deny) retries the Firestore Listen
    // channel indefinitely, logging `channel ... 400` on every attempt.
    try {
        if (typeof onSnapshot === 'function') {
            if (_notificationUid && _notificationUid !== uid) teardownNotifications();
            _notificationUid = uid;
            if (_notificationUnsub) { try { _notificationUnsub(); } catch(_){} _notificationUnsub = null; }
            if (_notificationPoll) { try { clearInterval(_notificationPoll); } catch(_){} _notificationPoll = null; }
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
            }, err => {
                // Log code only — never tokens, keys, or user data.
                const code = err && err.code ? String(err.code) : 'unknown';
                console.warn('[notification listen] stopped (' + code + '); using periodic refresh.');
                if (_notificationUnsub) { try { _notificationUnsub(); } catch(_){} _notificationUnsub = null; }
                if (code === 'permission-denied' || code === 'unauthenticated') {
                    // Likely signed out — stop entirely; bell remounts on next login.
                    teardownNotifications();
                    return;
                }
                // Transient failure: poll quietly instead of hammering the channel.
                if (!_notificationPoll && _notificationUid === uid) {
                    _notificationPoll = setInterval(() => {
                        if (_notificationUid !== uid) { try { clearInterval(_notificationPoll); } catch(_){} _notificationPoll = null; return; }
                        fetchNotifications(uid).then(list => {
                            _notificationCache = list;
                            renderNotificationList(uid, list);
                        });
                    }, NOTIFICATION_POLL_MS);
                }
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
// Single path: server-side /api/* endpoints. OPENROUTER_API_KEY lives
// server-side (Vercel env vars) and is the ONLY key ever used. No per-user
// key is ever read, stored, entered, or sent from the browser — in any role.
// Purge any previously stored personal key on load so it can never be seen,
// entered, edited, or re-stored. Wrapped in try/catch: must never throw.
(function purgeStoredUserApiKey() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('studyos_openrouter_key');
            localStorage.removeItem('openrouter_api_key');
        }
    } catch (e) {}
})();

function sanitizeServerMessage(msg, maxLen) {
    // Defense-in-depth: backend errors never contain keys, but redact anything
    // key-like before it can reach a toast/bubble. Never log or display raw
    // secrets, env values, or long upstream payloads.
    let s = (msg === null || msg === undefined) ? '' : String(msg);
    s = s.replace(/sk-or-[A-Za-z0-9\-_]+/g, '[redacted-key]');
    s = s.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
    s = s.replace(/(api[_-]?key\s*[:=]\s*)(['"]?)[^\s'";,}]+(['"]?)/gi, '$1[redacted]');
    s = s.replace(/([A-Za-z0-9\-_]{32,})/g, (m) => (/sk-or/i.test(m) ? '[redacted-key]' : m));
    const cap = maxLen || 280;
    if (s.length > cap) s = s.slice(0, cap);
    return s.trim();
}

async function safeApiCall(endpoint, payload) {
    // One request per action: same endpoint + same payload while a request is
    // still in flight → share the pending promise (rapid re-clicks, double
    // Enter presses, or handlers registered twice never fan out upstream).
    // Cap mode: after a `daily_limit` response, stop sending AI requests for
    // the rest of the session (simple in-memory flag, reset on reload) and
    // serve day-cached results where they exist — no more quota is spent.
    if (_aiDailyCapHit && /\/api\/ai/.test(String(endpoint || ''))) {
        throw _aiCodedError('daily_limit', aiErrorTextFor('daily_limit', ''));
    }
    let key = '';
    try {
        key = String(endpoint) + '|' + JSON.stringify(payload || {}).slice(0, 4000);
    } catch (e) { key = String(endpoint) + '|' + Date.now() + Math.random(); }
    if (_aiInflight.has(key)) return _aiInflight.get(key);
    const p = _safeApiCallInner(endpoint, payload).finally(() => {
        if (_aiInflight.get(key) === p) _aiInflight.delete(key);
    });
    _aiInflight.set(key, p);
    return p;
}

// In-memory AI session state: pending shared requests + daily-cap cooldown.
const _aiInflight = new Map();
let _aiDailyCapHit = false;

function _aiCodedError(code, message) {
    const err = new Error(message);
    if (code) err.code = code;
    return err;
}

// Accurate user messages for the /api/ai error contract, via t() with
// English defaults (other languages fall back to English until translated —
// flagged in the loop report). Contract codes with fixed canonical text use
// the translation; codes whose server message carries the specific cause
// (account_issue data-policy steps, bad_response feature detail) prefer the
// server message so the exact fix is never hidden behind a generic string.
function aiErrorTextFor(code, serverMessage, retryAfterSec) {
    const tt = (typeof t === 'function') ? t : ((k, d, p) => d);
    const srv = (serverMessage === null || serverMessage === undefined) ? '' : String(serverMessage).trim();
    const waitSecs = Number(retryAfterSec) > 0 ? Math.min(Math.floor(Number(retryAfterSec)), 600) : 0;
    switch (code) {
        case 'daily_limit':
            return tt('ai.err_daily_limit', "The AI's free daily limit has been reached. It resets daily — please try again later.");
        case 'rate_limited':
            // Honest timing only: a concrete wait is shown IFF the server
            // supplied Retry-After. Otherwise no wait is promised (a bare 429
            // may be a transient throttle OR a daily cap with an
            // undescriptive body — the two cannot always be told apart).
            if (waitSecs > 0) {
                const tpl = tt('ai.err_rate_limited_wait', 'The AI is busy. Try again in about {n} seconds.');
                return String(tpl).replace('{n}', String(waitSecs));
            }
            return tt('ai.err_rate_limited', 'The AI is busy. Please try again later.');
        case 'timeout':
            return tt('ai.err_timeout', 'The AI request timed out. Please try again.');
        case 'model_unavailable':
            return tt('ai.err_model_unavailable', 'The configured AI model is currently unavailable. Please try again in a bit.');
        case 'not_configured':
            return tt('ai.err_not_configured', 'AI server has no API key configured. Please tell your admin.');
        case 'account_issue':
        case 'bad_response':
        case 'upstream_error':
            if (srv) return srv;
            if (code === 'account_issue') return tt('ai.err_account_issue', 'The AI service has an account issue. Please tell your admin.');
            if (code === 'bad_response') return tt('ai.err_bad_response', 'The AI returned an unexpected format. Please try again.');
            return tt('ai.err_upstream', 'The AI service had a problem. Please try again.');
        default:
            return srv || tt('ai.err_upstream', 'AI service error. Please try again.');
    }
}

// Genuine-connectivity discriminator for error rendering. "Check your
// connection" may ONLY appear when the request itself never reached our
// server. Any structured server failure (contract `code` present) is by
// definition NOT a connectivity problem — even a network-flavored message
// with a code came back through the server. Contract names are untouched;
// this only reads them.
function isConnectivityError(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    if (err && typeof err.code === 'string' && err.code) return false;
    const m = String((err && err.message) || '');
    return /failed to fetch|networkerror|network request failed|load failed|fetch failed|offline|ERR_INTERNET|ERR_NETWORK|NS_ERROR_OFFLINE/i.test(m);
}

// Day-cache for automatic (no-click) AI widgets: stores {date, data} in
// localStorage under one key namespace. A hit never touches the network, so
// dashboard loads cost at most one AI request per day per widget instead of
// one per page view. Reuses the revisionCache idea (cache real AI output,
// serve it while fresh) without any new dependency.
function _aiDayCacheKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _aiDayCacheStore() {
    try {
        return JSON.parse(localStorage.getItem('stuvo_ai_daycache') || '{}') || {};
    } catch (e) { return {}; }
}
async function getDayCachedAI(cacheKey, loader) {
    const store = _aiDayCacheStore();
    const today = _aiDayCacheKey();
    const hit = store && store[cacheKey];
    if (hit && hit.date === today && hit.data !== undefined) return hit.data;
    const data = await loader();
    try {
        const fresh = _aiDayCacheStore();
        fresh[cacheKey] = { date: today, data };
        const keys = Object.keys(fresh);
        if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(k => { delete fresh[k]; });
        localStorage.setItem('stuvo_ai_daycache', JSON.stringify(fresh));
    } catch (e) {}
    return data;
}

async function _safeApiCallInner(endpoint, payload) {
    // NOTE: an earlier client-side cooldown breaker (fail-fast locally after
    // an HTTP 429) was removed per project decision — every user action now
    // sends its request. Upstream OpenRouter 429s still surface as clear
    // retry-later errors with the server-provided wait time.
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
        const fetchFailed = (typeof navigator !== 'undefined' && navigator.onLine === false)
            || /failed to fetch|networkerror|network request failed|load failed|fetch failed|offline|ERR_INTERNET|ERR_NETWORK|NS_ERROR_OFFLINE/i.test(String((err && err.message) || ''));
        try {
            return await handleClientFallback(endpoint, payload);
        } catch (fbErr) {
            // Genuine connectivity failure that no fallback could serve: say
            // so plainly instead of detouring into key setup (a key would not
            // help offline). Screens gate their "check your connection"
            // sentence on exactly this failure shape — see isConnectivityError.
            if (fetchFailed && !(fbErr && fbErr.code)) {
                const tt = (typeof t === 'function') ? t : ((k, d) => d);
                throw new Error(tt('ai.err_connectivity', 'Network request failed: could not reach the AI service. Please check your connection and try again.'));
            }
            throw fbErr;
        }
    }
    const status = response.status;
    const ct = (response.headers && response.headers.get) ? (response.headers.get('content-type') || '') : '';
    if (response.ok) {
        // Read as text first: some hosts return the SPA fallback (HTML) with
        // HTTP 200 for unknown /api/* routes. Returning {} for that would
        // surface downstream as misleading errors like "No question returned".
        const raw = await response.text().catch(() => '');
        if (!raw || !raw.trim()) {
            throw new Error(`AI endpoint ${endpoint} returned an empty response (HTTP ${status}, content-type: ${ct || 'unknown'}). Please try again.`);
        }
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            const looksHtml = /text\/html/i.test(ct) || /^\s*</.test(raw);
            // The backend route is absent on this host (static/SPA fallback
            // serves HTML for /api/*). This is a ROUTING problem — never
            // misdiagnose it as a missing OpenRouter key. Fail visibly (never
            // return {} — that surfaces as misleading downstream errors).
            throw new Error(looksHtml
                ? `AI endpoint ${endpoint} is not served by the backend (got HTML, not JSON; HTTP ${status}). The server deployment must route ${endpoint} to the API function before any SPA fallback — redeploy with the api/ functions and OPENROUTER_API_KEY set server-side, then retry.`
                : `AI endpoint ${endpoint} returned a non-JSON response (HTTP ${status}, content-type: ${sanitizeServerMessage(ct || 'unknown', 80)}). Please try again.`);
        }
        if (data && typeof data === 'object' && (data.error || data.ok === false)) {
            const code200 = (data && data.code) || '';
            if (code200 === 'daily_limit') _aiDailyCapHit = true;
            const wait200 = Number(data && (data.retryAfterSec || data.retryAfter)) > 0 ? Number(data.retryAfterSec || data.retryAfter) : 0;
            const err200 = _aiCodedError(code200, aiErrorTextFor(code200, sanitizeServerMessage((data && (data.message || data.error)) || '', 280), wait200));
            if (data && typeof data.escalationFlag === 'boolean') err200.escalationFlag = data.escalationFlag;
            if (wait200 > 0) err200.retryAfterSec = Math.min(Math.floor(wait200), 600);
            throw err200;
        }
        return data;
    }
    // If static web server returns 405 Method Not Allowed or 404 Not Found, use client-side direct fallback
    if (status === 405 || status === 404) {
        console.warn(`Endpoint ${endpoint} returned HTTP ${status}. Using direct AI fallback...`);
        return await handleClientFallback(endpoint, payload);
    }
    const errorText = await response.text().catch(() => '');
    let serverMsg = '';
    let serverCode = '';
    let serverRetryAfter = 0;
    let serverModel = '';
    let serverScope = '';
    let serverEscalation = undefined;
    try {
        const parsed = JSON.parse(errorText);
        serverMsg = parsed.error || parsed.message || '';
        serverCode = parsed.code || '';
        if (Number(parsed.retryAfterSec) > 0) serverRetryAfter = Math.min(Math.floor(Number(parsed.retryAfterSec)), 600);
        else if (Number(parsed.retryAfter) > 0) serverRetryAfter = Math.min(Math.floor(Number(parsed.retryAfter)), 600);
        serverModel = parsed.model || '';
        serverScope = parsed.scope || '';
        if (typeof parsed.escalationFlag === 'boolean') serverEscalation = parsed.escalationFlag;
    } catch (e) { serverMsg = errorText; }
    // Legacy server marker → contract code.
    if (serverCode === 'UPSTREAM_RATE_LIMIT') serverCode = 'rate_limited';
    // Older servers may send the daily-cap message without the code: detect
    // it from the real upstream phrasing so cap mode still engages.
    if (!serverCode && status === 429 && /dail|per-day|per day|day.*quota|quota.*day|free.*tier.*limit/i.test(serverMsg || '')) {
        serverCode = 'daily_limit';
    }
    const codedThrow = (code, message) => {
        const err = _aiCodedError(code || serverCode || '', message);
        if (serverEscalation !== undefined) err.escalationFlag = serverEscalation;
        if (Number(serverRetryAfter) > 0) err.retryAfterSec = serverRetryAfter;
        throw err;
    };
    // Honor a Retry-After response header when the JSON body carries none.
    if (!serverRetryAfter) {
        try {
            const hr = response.headers && response.headers.get ? response.headers.get('retry-after') : null;
            if (hr !== null && hr !== undefined && hr !== '' && Number(hr) > 0) {
                serverRetryAfter = Math.min(Math.floor(Number(hr)), 600);
            }
        } catch (e) {}
    }
    // Log status + a redacted preview server-side; never log raw secrets.
    console.error('AI service error:', status, sanitizeServerMessage(errorText, 300));
    // NOTE: only classify as a missing-key error when the body is JSON (or
    // plain text) from the API itself — never when it is HTML from an SPA
    // fallback. HTML routing failures are handled above and must not be
    // misdiagnosed as a missing OPENROUTER_API_KEY.
    const isHtmlError = /text\/html/i.test(ct) || /^\s*</.test(errorText || '');
    const missingServerKey = !isHtmlError && /OPENROUTER_API_KEY|environment variable is not set|No OpenRouter key/i.test(serverMsg || '');
    if (missingServerKey) {
        throw _aiCodedError('not_configured', aiErrorTextFor('not_configured', ''));
    }
    if (isHtmlError) {
        throw new Error(`AI endpoint ${endpoint} is not served by the backend (got HTML, not JSON; HTTP ${status}). The server deployment must route ${endpoint} to the API function before any SPA fallback — redeploy with the api/ functions and OPENROUTER_API_KEY set server-side, then retry.`);
    }
    if (status === 429) {
        // Contract codes first: daily_limit engages session cap mode (no more
        // AI requests are sent; the user retries tomorrow). Everything else
        // is a throttle of unknown duration — a concrete wait is stated ONLY
        // when the server supplied Retry-After (a bare 429 may be transient
        // or a daily cap with an undescriptive body; never invent a wait).
        // No automatic retry or key fallback here (that would add load while
        // throttled). NOTE: the former local cooldown breaker was removed —
        // every user action still sends its request; throttling is enforced
        // only by the server/upstream, plus cap mode above for daily caps.
        if (serverCode === 'daily_limit') {
            _aiDailyCapHit = true;
            throw codedThrow('daily_limit', aiErrorTextFor('daily_limit', serverMsg, serverRetryAfter));
        }
        const isAppLimit = serverCode === 'APP_RATE_LIMIT'
            || (!serverCode && /too many requests/i.test(serverMsg || '') && !/openrouter|provider/i.test(serverMsg || ''));
        if (isAppLimit) {
            const appWait = serverRetryAfter > 0 ? ` Please wait about ${serverRetryAfter}s and try again — no need to resend repeatedly.` : ' Please try again later — no need to resend repeatedly.';
            throw codedThrow('', `You're sending requests too quickly (application limit, HTTP 429 for ${endpoint}).${appWait}`);
        }
        if (serverCode === 'rate_limited' || serverCode === '' || serverScope === 'platform') {
            throw codedThrow('rate_limited', aiErrorTextFor('rate_limited', '', serverRetryAfter));
        }
        if (serverRetryAfter > 0) {
            const modelBit = serverModel ? ` (provider limit, model ${sanitizeServerMessage(serverModel, 80)})` : '';
            throw codedThrow('rate_limited', `The AI provider is rate-limited right now (HTTP 429 for ${endpoint}${modelBit}). Try again in about ${serverRetryAfter}s — your message is safe.`);
        }
        throw codedThrow('rate_limited', aiErrorTextFor('rate_limited', '', 0));
    }
    const clean = sanitizeServerMessage(serverMsg, 280);
    throw codedThrow('', aiErrorTextFor(serverCode, clean
        ? (serverCode ? clean : `AI service error for ${endpoint} (HTTP ${status}): ${clean}`)
        : `AI service error for ${endpoint} (HTTP ${status}). Please try again.`));
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

    // All AI actions are served server-side via /api/ai using the shared
    // prompt library (api/_lib/prompts.js). No inline prompt text remains
    // in client code. All AI actions go through the server /api/ai endpoint
    // using the server-side OpenRouter key; there is no client key fallback.
    throw new Error(`AI actions must go through the server /api/ai endpoint (endpoint="${endpoint}").`);
}

function renderFormattedAnswer(text) {
  if (!text) return '';
  return text.split('\n').filter(line => line.trim()).map(line =>
    `<p class="ai-answer-line" style="margin:0 0 8px 0;line-height:1.6;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  ).join('');
}
if (typeof window !== 'undefined') window.renderFormattedAnswer = renderFormattedAnswer;

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
    // Ethics page: static client-side entries, zero Firestore reads
    const ethicsResults = _globalSearchEthics(q);
    return {
        homework: homeworkResults.slice(0, 10),
        classes: classResults.slice(0, 10),
        announcements: announcementResults.slice(0, 10),
        revisions: revisionResults.slice(0, 10),
        ethics: ethicsResults.slice(0, 10)
    };
}

function _globalSearchEthics(queryLower) {
    const entries = [];
    const q = String(queryLower || '').toLowerCase().trim();
    const push = function (id, title, sub) {
        const t = String(title || '').toLowerCase();
        const s = String(sub || '').toLowerCase();
        if (!q || t.indexOf(q) !== -1 || s.indexOf(q) !== -1) {
            entries.push({ id: id, title: title, sub: sub, route: '#/ethics' });
        }
    };
    try {
        push('ethics-page', _i18n_t('ethics.title', 'Ethics'), 'Student ethics and safety guide');
        if (window.ETHICS_CONTENT && Array.isArray(window.ETHICS_CONTENT)) {
            window.ETHICS_CONTENT.forEach(function (part) {
                push('ethics-part-' + String(part.part), part.partTitle || '', 'Ethics guide · Part ' + String(part.part));
            });
        }
        // Scenario entries — static, zero Firestore reads
        if (window.ETHICS_SCENARIOS && Array.isArray(window.ETHICS_SCENARIOS)) {
            window.ETHICS_SCENARIOS.forEach(function (s) {
                var short = String(s.situation || '').slice(0, 60);
                push('ethics-scenario-' + String(s.id), 'Scenario ' + String(s.id) + ': ' + short, 'Ethics · What would you do?');
            });
        }
        // Myth or Fact entries — static, zero Firestore reads
        if (window.ETHICS_MYTH_FACTS && Array.isArray(window.ETHICS_MYTH_FACTS)) {
            window.ETHICS_MYTH_FACTS.forEach(function (m) {
                push('ethics-mythfact-' + String(m.id), m.statement || '', 'Ethics · Myth or Fact?');
            });
        }
        // Sources entry — static, zero Firestore reads
        push('ethics-sources', _i18n_t('ethics.sourcesTitle', 'Sources'), 'Ethics · Sources');
    } catch (e) {}
    return entries;
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
    if (grouped.ethics.length) {
        htmlParts.push(`
            <div class="gs-group" data-group="ethics">
                <div class="gs-group-label">Ethics <span class="count">${grouped.ethics.length}</span></div>
                <div class="gs-group-items">
                    ${grouped.ethics.map(e => `
                        <div class="gs-item" data-type="ethics" data-route="${_escAttr(e.route)}" tabindex="0" role="button">
                            <div class="gs-item-icon">E</div>
                            <div class="gs-item-main">
                                <div class="gs-item-title">${_highlightMatch(e.title, qLower)}</div>
                                <div class="gs-item-sub">${_escapeHtml(e.sub)}</div>
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
            else if (type === 'ethics') route = el.dataset.route || '#/student/dashboard';
            if (route) {
                // Assigning a different hash already triggers handleRoute via
                // the hashchange event — calling it manually too would render
                // (and re-fire boot-auto AI) twice. Only render manually when
                // the hash is unchanged (no event fires for same-hash sets).
                const before = window.location.hash;
                window.location.hash = route;
                if (before === window.location.hash && typeof handleRoute === 'function') {
                    try { handleRoute(); } catch(e){}
                }
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
