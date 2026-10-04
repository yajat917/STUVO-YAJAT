// ─── Public parent view — standalone read-only summary, zero sign-in ───
// Route: #/parent-view/{token} (token is the shareSnapshots document ID).
// Renders into #auth-container with no sidebar, nav, topbar, or app chrome.
// Only the explicitly-approved summary fields are ever read or displayed.
var _i18n_t = (typeof t === 'function' ? t : ((k, d) => d || k));

async function renderParentView(container, token) {
    const _t = (typeof t === 'function') ? t : ((k, d) => d || k);

    function langOptions() {
        const langs = (typeof SUPPORTED_LANGUAGES !== 'undefined' ? SUPPORTED_LANGUAGES : { en: 'English' });
        const cur = (typeof getCachedLang === 'function' ? getCachedLang() : null) || window.currentUserLanguage || 'en';
        return Object.entries(langs).map(([code, name]) =>
            `<option value="${code}" ${code === cur ? 'selected' : ''}>${name}</option>`
        ).join('');
    }

    function shell(inner) {
        return `
            <div style="width:100%;max-width:640px;margin:0 auto;padding:24px 16px 48px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;">
                    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:22px;">Stuvo</div>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);">
                        <span>🌐 ${_t('parentShare.changeLanguage', 'Language')}</span>
                        <select id="pv-lang" class="form-control" style="width:auto;padding:6px 10px;font-size:12px;">${langOptions()}</select>
                    </label>
                </div>
                ${inner}
            </div>
        `;
    }

    function unavailable() {
        container.innerHTML = shell(
            createGlassCard('', createEmptyState(
                _t('parentShare.unavailable', 'This link is no longer available.'), '', '🔗'
            ))
        );
        bindLang();
    }

    function bindLang() {
        const sel = container.querySelector('#pv-lang');
        if (sel && !sel.dataset.bound) {
            sel.dataset.bound = '1';
            sel.addEventListener('change', async () => {
                try {
                    if (typeof setLanguage === 'function') await setLanguage(sel.value);
                    else if (typeof window.setLanguage === 'function') await window.setLanguage(sel.value);
                } catch (err) { console.error('[parentView lang]', err); }
                renderParentView(container, token);
            });
        }
    }

    function fmtUpdated(ts) {
        try {
            const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
            if (!d || isNaN(d)) return '';
            const loc = (typeof stuvoBcp47 === 'function' ? stuvoBcp47((typeof getCachedLang === 'function' ? getCachedLang() : null) || 'en') : 'en-IN');
            return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return ''; }
    }

    if (!token) { unavailable(); return; }

    container.innerHTML = shell(
        createGlassCard('', `<p style="font-size:14px;color:var(--text-dim);">${_t('common.loading', 'Loading...')}</p>`)
    );
    bindLang();

    let data = null;
    try {
        const snap = await getDoc(doc(db, 'shareSnapshots', token));
        if (snap.exists) data = snap.data();
    } catch (err) {
        // Expected states (unknown token, revoked link, rules deny) stay silent:
        // the view below already reports "no longer available". Log only bugs.
        const code = err && err.code;
        if (code !== 'permission-denied' && code !== 'not-found') console.error('[parentView load]', err);
    }
    if (!data || data.revoked === true || !data.studentUid) { unavailable(); return; }

    const deadlines = Array.isArray(data.upcomingDeadlines) ? data.upcomingDeadlines.slice(0, 5) : [];
    const grades = Array.isArray(data.recentGrades) ? data.recentGrades.slice(0, 5) : [];
    const att = (typeof data.attendancePercent === 'number') ? data.attendancePercent + '%' : '—';
    const updated = fmtUpdated(data.generatedAt);

    container.innerHTML = shell(`
        ${createGlassCard('👪 ' + _t('parentShare.summaryFor', 'Progress summary'), `
            <div style="font-size:18px;font-weight:700;font-family:'Sora',sans-serif;">${_escapeHtml(data.studentName || '')}</div>
            ${updated ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${_t('parentShare.lastUpdated', 'Updated {date}').replace('{date}', _escapeHtml(updated))}</div>` : ''}
        `)}
        ${createGlassCard('📅 ' + _t('parentShare.attendance', 'Attendance'), createStatRow([
            { num: _escapeHtml(att), label: _t('parentShare.attendance', 'Attendance'), color: '#C4B5FD' }
        ]))}
        ${createGlassCard('📚 ' + _t('parentShare.deadlines', 'Upcoming deadlines'), (
            deadlines.length === 0
                ? createEmptyState(_t('parentShare.noDeadlines', 'No upcoming deadlines.'), '', '📚')
                : deadlines.map(h => createHwItem(
                    h.title || '',
                    [h.subject, h.dueDate].filter(Boolean).join(' · '),
                    null, ''
                )).join('')
        ))}
        ${createGlassCard('📊 ' + _t('parentShare.grades', 'Recent grades'), (
            grades.length === 0
                ? createEmptyState(_t('parentShare.noGrades', 'No recent grades yet.'), '', '📊')
                : grades.map(g => `
                    <div class="hw-item">
                        <div>
                            <div class="hw-title">${_escapeHtml(g.testName || '')}</div>
                            <div class="hw-sub">${_escapeHtml(g.subject || '')}</div>
                        </div>
                        <div class="hw-badge">${_escapeHtml(g.grade || '')}</div>
                    </div>
                `).join('')
        ))}
    `);
    bindLang();
}
