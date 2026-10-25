async function renderStudentCommunity(container) {
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
    const uid = appState.user?.uid;

    container.innerHTML = `
        <div class="flex-col">
            ${createPageHeader(_i18n_t('nav.community','Community'), _i18n_t('community.subtitle','Ask, share, and learn together'))}
            ${createSkeleton(3)}
        </div>
    `;

    let liked = new Set();
    let posts = [];
    let comments = {};

    function fmtTime(ts) {
        if (!ts) return _i18n_t('common.timeRecently','recently');
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return _i18n_t('common.timeJustNow','just now');
        if (sec < 3600) return _i18n_t('common.timeMinAgo',{count: Math.floor(sec / 60)});
        if (sec < 86400) return _i18n_t('common.timeHourAgo',{count: Math.floor(sec / 3600)});
        return _i18n_t('common.timeDayAgo',{count: Math.floor(sec / 86400)});
    }

    async function load() {
        posts = [];
        comments = {};
        try {
            const snap = await getDocs(query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'), limit(50)));
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            posts = rows;
        } catch (err) {
            console.error('[community load]', err);
        }

        for (const p of posts) {
            if ((p.likes || []).includes(uid)) liked.add(p.id);
            try {
                const cSnap = await getDocs(collection(db, 'communityPosts', p.id, 'comments'));
                const cs = [];
                cSnap.forEach(d => cs.push({ id: d.id, ...d.data() }));
                comments[p.id] = cs;
            } catch (err) {
                console.error('[community comments]', err);
                comments[p.id] = [];
            }
        }

        render();
    }

    function render() {
        container.innerHTML = `
            <div class="flex-col">
                ${createPageHeader(_i18n_t('nav.community','Community'), _i18n_t('community.subtitle','Ask, share, and learn together'))}

                <div class="glass-card">
                    <div class="form-group">
                        <textarea class="form-control" id="post-text" rows="3"
                            placeholder="${_i18n_t('community.sharePlaceholder','Share a doubt, tip, or resource with your classmates…')}"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex:1;">
                            <select class="form-control" id="post-subject">
                                <option value="">${_i18n_t('community.noSubject','No subject')}</option>
                                <option>Mathematics</option><option>Physics</option><option>Chemistry</option>
                                <option>Biology</option><option>English</option><option>History</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:auto;">
                            <button class="btn" id="btn-post" style="margin-top:0;width:100%;">${_i18n_t('community.post','Post')}</button>
                        </div>
                    </div>
                </div>

                ${posts.length === 0
                    ? `<div class="glass-card">${createEmptyState(_i18n_t('community.noPosts','No posts yet'), _i18n_t('community.noPostsSub','Be the first to share a doubt, tip, or resource.'), '💬')}</div>`
                    : posts.map((p, i) => `
                        <div class="glass-card" id="post-${p.id}">
                            <div class="card-header">
                                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                                    <div class="avatar" style="width:38px;height:38px;font-size:16px;">${_escapeHtml((p.authorName || '?').charAt(0).toUpperCase())}</div>
                                    <div style="min-width:0;">
                                        <div style="font-size:14px;font-weight:600;">${_escapeHtml(p.authorName) || _i18n_t('auth.student','Student')}</div>
                                        <div class="hw-sub">${_escapeHtml(p.role) || _i18n_t('auth.student','Student')} · ${fmtTime(p.createdAt)}</div>
                                    </div>
                                </div>
                                ${p.subject ? createBadge(_escapeHtml(p.subject), 'violet') : ''}
                            </div>
                            <p style="font-size:14px;line-height:1.7;margin:14px 0;">${_escapeHtml(p.text)}</p>
                            <div class="divider" style="margin:12px 0;"></div>
                            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
                                <button class="btn btn-secondary btn-sm ${liked.has(p.id) ? 'liked' : ''}"
                                    id="like-${p.id}" style="margin-top:0;">
                                    ${liked.has(p.id) ? '❤️' : '🤍'} ${(p.likes || []).length}
                                </button>
                                <button class="btn btn-secondary btn-sm" data-toggle-comments="${p.id}" style="margin-top:0;">
                                    💬 ${(comments[p.id] || []).length} ${((comments[p.id] || []).length === 1 ? _i18n_t('community.comment','comment') : _i18n_t('community.comments','comments'))}
                                </button>
                            </div>
                            <div class="comment-box" id="comment-box-${p.id}" style="display:none;margin-top:14px;">
                                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:10px;">
                                    ${(comments[p.id] || []).map(c => `
                                        <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 14px;">
                                            <div style="font-size:12px;font-weight:600;margin-bottom:3px;">${_escapeHtml(c.authorName) || _i18n_t('community.someone','Someone')}</div>
                                            <div style="font-size:13px;color:var(--text-dim);">${_escapeHtml(c.text)}</div>
                                        </div>
                                    `).join('')}
                                    ${(comments[p.id] || []).length === 0 ? `<div style="font-size:12px;color:var(--text-dim);">${_i18n_t('community.noComments','No comments yet.')}</div>` : ''}
                                </div>
                                <form class="comment-form" data-post="${p.id}" style="display:flex;gap:8px;">
                                    <input type="text" class="form-control" placeholder="${_i18n_t('community.writeComment','Write a comment…')}" style="flex:1;">
                                    <button type="submit" class="btn btn-sm" style="margin-top:0;">${_i18n_t('community.send','Send')}</button>
                                </form>
                            </div>
                        </div>
                    `).join('')}
            </div>
        `;

        container.querySelector('#btn-post').addEventListener('click', async () => {
            const text = container.querySelector('#post-text').value.trim();
            if (!text) { showToast(_i18n_t('community.writeSomething','Write something before posting.'), 'error'); return; }
            const subject = container.querySelector('#post-subject').value;
            const btn = container.querySelector('#btn-post');
            btn.disabled = true;
            btn.textContent = _i18n_t('community.posting','Posting…');
            const me = appState.userData?.officialName || _i18n_t('auth.student','Student');
            try {
                await addDoc(collection(db, 'communityPosts'), {
                    authorId: uid,
                    authorName: me,
                    role: appState.role || _i18n_t('auth.student','Student'),
                    subject,
                    text,
                    likes: [],
                    createdAt: serverTimestamp(),
                });
                showToast(_i18n_t('community.posted','Posted to the community!') + ' ✅', 'success');
                container.querySelector('#post-text').value = '';
                await load();
            } catch (err) {
                console.error('[community post]', err);
                showToast(`${_i18n_t('community.failedPost','Failed to post')}: ${err.message}`, 'error');
                btn.disabled = false;
                btn.textContent = _i18n_t('community.post','Post');
            }
        });

        posts.forEach(p => {
            const likeBtn = container.querySelector(`#like-${p.id}`);
            if (likeBtn) likeBtn.addEventListener('click', async () => {
                const ref = doc(db, 'communityPosts', p.id);
                try {
                    if (liked.has(p.id)) {
                        await updateDoc(ref, { likes: arrayRemove(uid) });
                        liked.delete(p.id);
                    } else {
                        await updateDoc(ref, { likes: arrayUnion(uid) });
                        liked.add(p.id);
                    }
                    await load();
                } catch (err) {
                    console.error('[community like]', err);
                    showToast(_i18n_t('community.likeFailed','Failed to update like.'), 'error');
                }
            });

            const toggleBtn = container.querySelector(`[data-toggle-comments="${p.id}"]`);
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const box = container.querySelector(`#comment-box-${p.id}`);
                    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
                });
            }
        });

        // Brief staggered entrance for feed posts. Runs once per mount so likes
        // and new comments do not replay the animation. Posts stay tappable.
        try { if (typeof stageListEnter === 'function') stageListEnter(container, '[id^="post-"]'); } catch {}

        container.querySelectorAll('.comment-form').forEach(form => {            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const postId = form.dataset.post;
                const input = form.querySelector('input');
                const text = input.value.trim();
                if (!text) return;
                try {
                    await addDoc(collection(db, 'communityPosts', postId, 'comments'), {
                        authorId: uid,
                        authorName: appState.userData?.officialName || _i18n_t('auth.student','Student'),
                        text,
                        createdAt: serverTimestamp(),
                    });
                    input.value = '';
                    await load();
                } catch (err) {
                    console.error('[community comment]', err);
                    showToast(`${_i18n_t('community.commentFailed','Failed to comment')}: ${err.message}`, 'error');
                }
            });
        });

        // Accessibility: mic input on post box + comment inputs (shared STT utility)
        try {
            if (typeof attachSTT === 'function') {
                const postInput = container.querySelector('#post-text');
                if (postInput) attachSTT(postInput);
                container.querySelectorAll('.comment-form input').forEach(el => { try { attachSTT(el); } catch {} });
            } else if (typeof window.attachSTT === 'function') {
                const postInput = container.querySelector('#post-text');
                if (postInput) window.attachSTT(postInput);
                container.querySelectorAll('.comment-form input').forEach(el => { try { window.attachSTT(el); } catch {} });
            }
        } catch {}
    }

    load();
}