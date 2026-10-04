function renderPending(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    container.innerHTML = `
        <div style="max-width:460px;text-align:center;padding:20px;">
            <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:28px;
                background:linear-gradient(135deg,#F4F2FF,#4F8CFF);-webkit-background-clip:text;
                background-clip:text;color:transparent;margin-bottom:28px;">
                Stuvo
            </div>

            <div class="glass-card" style="padding:40px 32px;">
                <div style="font-size:52px;margin-bottom:16px;">⏳</div>
                <div style="font-family:'Sora',sans-serif;font-size:20px;font-weight:700;margin-bottom:10px;">
                    ${_i18n_t('auth.pendingTitle','Pending Approval')}
                </div>
                <p style="color:var(--text-dim);font-size:14px;line-height:1.7;margin-bottom:24px;">
                    ${_i18n_t('auth.pendingDesc',"Your teacher account is under review. An admin will approve your access shortly. You'll be able to log in once approved.")}
                </p>

                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);
                    border-radius:12px;padding:14px;margin-bottom:24px;">
                    <div style="color:#FDE68A;font-size:13px;font-weight:600;">🔔 ${_i18n_t('auth.pendingNextTitle','What happens next?')}</div>
                    <div style="color:var(--text-dim);font-size:12px;margin-top:6px;line-height:1.6;">
                        ${_i18n_t('auth.pendingNextDesc','An administrator will review your registration and approve or reject your account. This typically happens within 24 hours.')}
                    </div>
                </div>

                <button id="btn-pending-logout" class="btn btn-secondary" style="margin-top:0;width:100%;">
                    🚪 ${_i18n_t('auth.pendingLogout','Sign Out & Try Another Account')}
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-pending-logout').addEventListener('click', async () => {
        try { await signOut(auth); } catch (err) { console.error('[pending-logout]', err); }
        try { if (typeof clearScopedLangCache === 'function') clearScopedLangCache(); } catch {}
        appState.user = null;
        appState.role = null;
        appState.userData = null;
        window.location.hash = '#/login';
    });
}