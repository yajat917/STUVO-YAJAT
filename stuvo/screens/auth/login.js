// Generate a unique username: firstname.lastname.XXXX
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
function generateUsername(displayName) {
    const parts = (displayName || 'user').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
    const base = parts.slice(0, 2).join('.');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${base}.${suffix}`;
}

// Seed admin accounts — checked before any Firestore role lookup.
// Gmail addresses are case-sensitive: keep this exactly as written.
const SEED_ADMINS = ['stuvoinnosphere@gmail.com'];

async function ensureSeedAdmin(user) {
    await setDoc(doc(db, 'users', user.uid), {
        role: 'admin',
        status: 'active',
        email: user.email || '',
        officialName: user.displayName || '',
        photoURL: user.photoURL || '',
        username: generateUsername(user.displayName),
        classIds: [],
        createdAt: new Date(),
    }, { merge: true });
}

function renderLogin(container) {
    let registerAsTeacher = false;

    function render() {
        container.innerHTML = `
            <div style="position:relative;z-index:1;width:100%;max-width:440px;padding:20px;">
                <div style="text-align:center;margin-bottom:32px;">
                    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:42px;
                        background:linear-gradient(135deg,#fff 30%,#4F8CFF);
                        -webkit-background-clip:text;background-clip:text;color:transparent;
                        letter-spacing:-1.5px;margin-bottom:8px;">Stuvo</div>
                    <p style="color:var(--text-dim);font-size:14px;letter-spacing:0.02em;">
                        ${_i18n_t('auth.welcomeTitle','Smart School Platform')} · ${_i18n_t('auth.welcomeSubtitle','Student & Teacher Life')}
                    </p>
                </div>

                <div class="glass-card" style="padding:32px;">
                    <!-- Role toggle -->
                    <div style="margin-bottom:24px;">
                        <div class="tabs" style="margin-bottom:0;">
                            <button class="tab-btn ${!registerAsTeacher ? 'active' : ''}" id="role-student">
                                🎓 ${_i18n_t('auth.student','Student')}
                            </button>
                            <button class="tab-btn ${registerAsTeacher ? 'active' : ''}" id="role-teacher">
                                🧑‍🏫 ${_i18n_t('auth.teacher','Teacher')}
                            </button>
                        </div>
                        <p style="font-size:12px;color:var(--text-dim);margin-top:10px;text-align:center;">
                            ${registerAsTeacher
                                ? _i18n_t('auth.teacherApprovalNote','Teacher accounts need admin approval before access is granted.')
                                : _i18n_t('auth.signInHint','Sign in with your Google account to access your school dashboard.')}
                        </p>
                    </div>

                    <button id="btn-google" class="btn" style="gap:12px;font-size:14px;
                        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            width="20" height="20" alt="Google" loading="lazy" decoding="async">
                        Continue with Google as ${registerAsTeacher ? _i18n_t('auth.teacher','Teacher') : _i18n_t('auth.student','Student')}
                    </button>

                    <div style="margin:20px 0;display:flex;align-items:center;gap:12px;">
                        <div style="flex:1;height:1px;background:var(--glass-border);"></div>
                        <span style="font-size:11px;color:var(--text-dim);">${_i18n_t('auth.secureSignIn','secure sign-in')}</span>
                        <div style="flex:1;height:1px;background:var(--glass-border);"></div>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:12px;padding:16px;
                        background:rgba(0,0,0,0.2);border-radius:14px;border:1px solid var(--glass-border);">
                        <div style="font-size:12px;color:var(--text-dim);font-weight:600;
                            text-transform:uppercase;letter-spacing:0.06em;">
                            🔐 ${_i18n_t('auth.howItWorksTitle','How It Works')}
                        </div>
                        ${registerAsTeacher ? `
                            <div style="font-size:13px;color:var(--text-dim);line-height:1.6;">
                                1. ${_i18n_t('auth.howItWorksStep1','Sign in with Google')}<br>
                                2. ${_i18n_t('auth.howItWorksTeacher2','Your account is created with Pending status')}<br>
                                3. ${_i18n_t('auth.howItWorksTeacher3','An admin approves you → you get full access')}
                            </div>
                        ` : `
                            <div style="font-size:13px;color:var(--text-dim);line-height:1.6;">
                                1. ${_i18n_t('auth.howItWorksStep1','Sign in with Google')}<br>
                                2. ${_i18n_t('auth.howItWorksStep2','Your unique username is auto-generated')}<br>
                                3. ${_i18n_t('auth.howItWorksStep3','A teacher adds you to your class by username')}
                            </div>
                        `}
                    </div>

                    <p style="margin-top:16px;font-size:11px;color:var(--text-dim);text-align:center;">
                        ${_i18n_t('auth.termsNotice',"By continuing you agree to Stuvo's Terms of Service")}
                    </p>
                </div>
            </div>
        `;

        container.querySelector('#role-student').addEventListener('click', () => {
            if (registerAsTeacher) { registerAsTeacher = false; render(); }
        });
        container.querySelector('#role-teacher').addEventListener('click', () => {
            if (!registerAsTeacher) { registerAsTeacher = true; render(); }
        });
        container.querySelector('#btn-google').addEventListener('click', handleGoogleSignIn);
    }

    async function handleGoogleSignIn() {
        const btn = container.querySelector('#btn-google');
        btn.disabled = true;
        btn.textContent = _i18n_t('auth.signingIn','Signing in…');

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Seed admin check runs first, before any Firestore role lookup
            if (SEED_ADMINS.includes(user.email)) {
                await ensureSeedAdmin(user);
                const seedDoc = await getDoc(doc(db, 'users', user.uid));
                const seedData = seedDoc.exists ? seedDoc.data() : { role: 'admin', status: 'active' };
                appState.user = user;
                appState.role = 'admin';
                appState.userData = { ...seedData, role: 'admin', status: 'active' };
                window.currentUserRole = 'admin';
                window.currentUserUid = user.uid;
                window.currentUserName = seedData.officialName || user.displayName || 'Admin';
                window.currentUserLanguage = seedData.languagePreference || 'en';
                try { if (typeof loadLanguage === 'function') await loadLanguage(window.currentUserLanguage); } catch {}
                window.location.hash = '#/admin/dashboard';
                return;
            }

            // For all other users, check the existing Firestore role
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists) {
                const data = userSnap.data();
                appState.user = user;
                appState.role = data.role;
                appState.userData = data;
                window.currentUserRole = data.role;
                window.currentUserUid = user.uid;
                window.currentUserName = data.officialName || user.displayName || 'User';
                window.currentUserLanguage = data.languagePreference || ((typeof getCachedLang === 'function' ? getCachedLang() : null)) || 'en';
                try { if (typeof loadLanguage === 'function') await loadLanguage(window.currentUserLanguage); } catch {}

                if (data.status === 'pending') {
                    window.location.hash = '#/pending';
                } else if (data.status === 'rejected') {
                    showToast(_i18n_t('auth.accountRejected','Your account has been rejected. Contact your admin.'), 'error');
                    await signOut(auth);
                    try { if (typeof clearScopedLangCache === 'function') clearScopedLangCache(); } catch {}
                    appState.user = null;
                    appState.role = null;
                    appState.userData = null;
                    window.currentUserRole = null;
                    window.currentUserUid = null;
                } else {
                    // First-time language prompt if no preference set
                    if (!data.languagePreference && typeof showFirstTimeLanguagePrompt === 'function') {
                        setTimeout(()=>{ try{ showFirstTimeLanguagePrompt(); }catch{} }, 600);
                    }
                    window.location.hash = `#/${data.role}/dashboard`;
                }
            } else {
                // First login — create user doc
                const role = registerAsTeacher ? 'teacher' : 'student';
                const username = generateUsername(user.displayName);
                const newUser = {
                    role,
                    officialName: user.displayName || '',
                    nickname: '',
                    email: user.email || '',
                    photoURL: user.photoURL || '',
                    status: role === 'teacher' ? 'pending' : 'active',
                    username,
                    classIds: [],
                    createdAt: new Date(),
                };
                await setDoc(userRef, newUser);

                appState.user = user;
                appState.role = role;
                appState.userData = newUser;
                window.currentUserRole = role;
                window.currentUserUid = user.uid;
                window.currentUserName = newUser.officialName || user.displayName || 'User';
                // Honor a pre-sign-in language choice (cached / ?lang= / browser), else English
                window.currentUserLanguage = (typeof getCachedLang === 'function' ? getCachedLang() : null) || 'en';
                try { if (typeof loadLanguage === 'function') await loadLanguage(window.currentUserLanguage); } catch {}
                // First-time language prompt for new user
                setTimeout(()=>{ try{ if(typeof showFirstTimeLanguagePrompt==='function') showFirstTimeLanguagePrompt(); }catch{} }, 600);

                if (role === 'teacher') {
                    window.location.hash = '#/pending';
                } else {
                    window.location.hash = '#/student/dashboard';
                }
            }
        } catch (err) {
            console.error('[login]', err);
            showToast(err.code === 'auth/popup-closed-by-user'
                ? _i18n_t('auth.signInCancelled','Sign-in cancelled.')
                : `${_i18n_t('auth.signInFailed','Sign-in failed')}: ${err.message}`, 'error');
            if (container.querySelector('#btn-google')) {
                btn.disabled = false;
                btn.textContent = `Continue with Google as ${registerAsTeacher ? _i18n_t('auth.teacher','Teacher') : _i18n_t('auth.student','Student')}`;
            }
        }
    }

    render();
}