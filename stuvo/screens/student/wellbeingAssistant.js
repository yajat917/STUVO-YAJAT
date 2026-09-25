// ─── E.5 Wellbeing Assistant ───────────────────────────────────
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
// Chat-style, distinct branding _i18n_t('wellbeing.wellbeingAssistant','Stuvo Wellbeing Assistant') never "AI Counselor"
// Saves to users/{uid}/wellbeingChats/{chatId} with escalationFlag, private unless escalated
// API: /api/ai (action: wellbeingAssistant) handles SYSTEM_CONTEXT, conversationHistory, prompt, reply, escalationFlag via keywords

async function renderStudentWellbeingAssistant(container) {
  const uid = appState.user?.uid;
  const userName = (appState.userData?.officialName || _i18n_t('auth.student','Student')).split(' ')[0];

  // Distinct branding
  container.innerHTML = `
    <div class="flex-col" style="max-width: 760px; margin: 0 auto;">
      ${createPageHeader(_i18n_t('wellbeing.wellbeingAssistant','Stuvo Wellbeing Assistant'), 'A supportive space to reflect — not a counselor, not a diagnosis. If you need urgent help, reach a trusted adult right away.')}
      <div class="glass-card" style="padding: 0; overflow:hidden; display:flex; flex-direction:column; height: 68vh; min-height: 420px; max-height: 720px;">
        <div style="padding: 14px 16px; border-bottom: 1px solid var(--glass-border); display:flex; align-items:center; gap:10px; background: linear-gradient(135deg, rgba(124,92,252,0.12), rgba(79,140,255,0.08));">
          <div style="width:36px; height:36px; border-radius:50%; background: linear-gradient(135deg,#7C5CFC,#4F8CFF); display:flex; align-items:center; justify-content:center; font-size:16px;">🌿</div>
          <div>
            <div style="font-weight:800; font-family:'Sora',sans-serif; font-size:14px;">Stuvo Wellbeing Assistant</div>
            <div style="font-size:11px; color: var(--text-dim);">Supportive wellbeing companion · Private unless you ask to share</div>
          </div>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="btn-new-chat" style="margin-top:0; font-size:11px;">+ New chat</button>
            <button class="btn btn-secondary btn-sm" id="btn-clear-chat" style="margin-top:0; font-size:11px;">Clear</button>
          </div>
        </div>

        <div id="wb-chat-thread" style="flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:14px; background: rgba(0,0,0,0.12);">
          <div style="align-self:center; text-align:center; max-width: 520px; background: rgba(124,92,252,0.08); border:1px solid rgba(124,92,252,0.15); border-radius:14px; padding:14px;">
            <div style="font-size:13px; font-weight:600;">Hi ${userName} — I'm the Stuvo Wellbeing Assistant 🌿</div>
            <div style="font-size:12px; color: var(--text-dim); line-height:1.6; margin-top:6px;">I'm here to help you think through stress, focus, sleep or study worries with practical, gentle ideas. I'm not a counselor or medical professional, and I don't diagnose. If you're feeling unsafe or need urgent help, please reach out to a trusted adult, school counselor, or local helpline right away.</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
              <button class="badge badge-violet" data-suggest="I'm feeling stressed about exams" style="cursor:pointer;">I'm feeling stressed</button>
              <button class="badge badge-blue" data-suggest="How can I focus better?" style="cursor:pointer;">Focus help</button>
              <button class="badge badge-gray" data-suggest="I had trouble sleeping last night" style="cursor:pointer;">Sleep help</button>
              <button class="badge badge-gray" data-suggest="I want a 2-minute calming exercise" style="cursor:pointer;">2-min calm</button>
            </div>
          </div>
        </div>

        <div id="wb-escalation-banner" style="display:none; background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(245,158,11,0.15)); border-top:1px solid rgba(239,68,68,0.3); padding:10px 14px; font-size:12px; line-height:1.6;">
          <div style="font-weight:700; color:#FCA5A5;">If you need urgent support, please reach out right now:</div>
          <div style="color: var(--text-dim);">Contact a trusted adult, school counselor, or a local helpline. If you are in immediate danger, please contact emergency services in your area. You don't have to face this alone — talking to someone you trust can help.</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <a href="#/student/report" class="btn btn-secondary btn-sm" style="margin-top:0; width:auto;">Report a concern</a>
            <a href="#/student/wellbeing" class="btn btn-secondary btn-sm" style="margin-top:0; width:auto;">Wellbeing home</a>
          </div>
        </div>

        <form id="wb-chat-form" style="display:flex; gap:10px; padding:12px; border-top:1px solid var(--glass-border); background: rgba(17,24,39,0.5); align-items:flex-end;">
          <textarea class="form-control" id="wb-input" rows="2" placeholder="${_i18n_t('wellbeing.shareWhatsOnMind','Share what\'s on your mind...')}" style="flex:1; resize:vertical; min-height:44px; max-height:120px;"></textarea>
          <button type="submit" class="btn" id="wb-send" style="margin-top:0; width:auto; padding:10px 18px; flex-shrink:0;">Send ↑</button>
        </form>
      </div>

      <div class="glass-card">
        <div style="font-size:12px; font-weight:700; color: var(--text-dim); text-transform: uppercase; letter-spacing:0.06em; margin-bottom:8px;">Your privacy</div>
        <p style="font-size:12px; color: var(--text-dim); line-height:1.6;">Chats are saved privately under <code>users/{uid}/wellbeingChats/{chatId}</code> with an escalation flag if needed. They are not shared with teachers or other students. If an escalation is detected, a school admin may be notified so they can offer help — you'll see a note when this happens.</p>
        <div id="wb-history" style="margin-top:12px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Recent wellbeing chats</div>
          <div id="wb-history-list" style="display:flex; flex-direction:column; gap:8px; min-height:24px;">
            <div style="font-size:12px; color: var(--text-dim);">Loading...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const thread = container.querySelector('#wb-chat-thread');
  const form = container.querySelector('#wb-chat-form');
  const input = container.querySelector('#wb-input');
  const escalationBanner = container.querySelector('#wb-escalation-banner');

  let chatId = null;
  let conversationHistory = []; // [{role:'user'|'assistant', content:string}]
  let currentEscalation = false;

  // Try to restore last chatId from session
  try { chatId = sessionStorage.getItem('stuvo_wb_chatId') || null; } catch {}

  async function ensureChatId() {
    if (chatId) return chatId;
    // Create new doc id
    const colRef = collection(db, 'users', uid, 'wellbeingChats');
    const newRef = doc(colRef); // auto id compat: doc(collection)
    // For compat SDK, we can generate via addDoc then reuse; simpler: create via addDoc on first message
    // We'll lazy create on first message and store id
    return null; // will create on save
  }

  function addBubble(role, content, opts = {}) {
    const wrap = document.createElement('div');
    wrap.style.cssText = role === 'user'
      ? 'align-self:flex-end; background:rgba(124,92,252,0.18); border:1px solid rgba(124,92,252,0.3); border-radius:14px 14px 4px 14px; padding:12px 14px; max-width:78%; font-size:14px; line-height:1.6;'
      : 'align-self:flex-start; background:rgba(255,255,255,0.06); border:1px solid var(--glass-border); border-radius:14px 14px 14px 4px; padding:14px; max-width:84%; font-size:14px; line-height:1.7;';
    if (role === 'assistant') {
      const formatted = (typeof renderFormattedAnswer === 'function') ? renderFormattedAnswer(content) : String(content).replace(/</g,'&lt;').replace(/>/g,'&gt;').split('\n').filter(l=>l.trim()).map(l=>`<p style="margin:0 0 8px 0;">${l}</p>`).join('');
      wrap.innerHTML = `<div style="font-size:11px; font-weight:700; color:#C4B5FD; margin-bottom:6px; letter-spacing:0.04em;">Stuvo Wellbeing Assistant</div><div>${formatted}</div>${opts.escalation ? `<div style="margin-top:10px; font-size:12px; color:#FCA5A5; background: rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:8px;">I noticed you might be going through a tough time. If you feel unsafe, please reach out to a trusted adult or counselor right away. You deserve support.</div>` : ''}`;
    } else {
      wrap.textContent = content;
    }
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.id = 'wb-typing';
    el.style.cssText = 'align-self:flex-start; background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:14px 14px 14px 4px; padding:12px 14px; font-size:13px; color: var(--text-dim);';
    el.textContent = _i18n_t('wellbeing.thinking','Stuvo Wellbeing Assistant is thinking...');
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }

  // STT for input
  try { attachSTT(input); } catch {}

  // Suggestion chips
  container.querySelectorAll('[data-suggest]').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.suggest;
      input.focus();
    });
  });

  container.querySelector('#btn-new-chat')?.addEventListener('click', () => {
    conversationHistory = [];
    chatId = null;
    try { sessionStorage.removeItem('stuvo_wb_chatId'); } catch {}
    thread.querySelectorAll('div').forEach(el => { if (!el.textContent.includes('Hi ')) {} });
    // Clear bubbles except welcome
    const welcome = thread.firstElementChild;
    thread.innerHTML = '';
    if (welcome) thread.appendChild(welcome);
    else thread.innerHTML = `<div style="align-self:center; text-align:center; max-width: 520px; background: rgba(124,92,252,0.08); border:1px solid rgba(124,92,252,0.15); border-radius:14px; padding:14px;"><div style="font-size:13px; font-weight:600;">New chat started</div></div>`;
    escalationBanner.style.display = 'none';
    currentEscalation = false;
    showToast(_i18n_t('wellbeing.startedNewChat','Started a new wellbeing chat'), 'info');
  });
  container.querySelector('#btn-clear-chat')?.addEventListener('click', () => {
    const welcome = thread.firstElementChild;
    thread.innerHTML = '';
    if (welcome) thread.appendChild(welcome);
    conversationHistory = [];
    escalationBanner.style.display = 'none';
  });

  // Persist helper
  async function saveChatToFirestore(userPrompt, assistantReply, escalationFlag) {
    try {
      const data = {
        messages: [...conversationHistory, { role: 'user', content: userPrompt }, { role: 'assistant', content: assistantReply }],
        escalationFlag: !!escalationFlag,
        updatedAt: serverTimestamp(),
      };
      if (chatId) {
        await setDoc(doc(db, 'users', uid, 'wellbeingChats', chatId), { ...data, createdAt: serverTimestamp() }, { merge: true });
      } else {
        const ref = await addDoc(collection(db, 'users', uid, 'wellbeingChats'), {
          ...data,
          createdAt: serverTimestamp(),
          chatId: null,
        });
        chatId = ref.id;
        try { sessionStorage.setItem('stuvo_wb_chatId', chatId); } catch {}
        // Also update chatId field
        try { await updateDoc(doc(db, 'users', uid, 'wellbeingChats', chatId), { chatId: chatId }); } catch {}
      }
      loadHistory();
    } catch (e) { console.error('[wellbeingChat save]', e); }
  }

  async function loadHistory() {
    const listEl = container.querySelector('#wb-history-list');
    if (!listEl) return;
    try {
      const snap = await getDocs(query(collection(db, 'users', uid, 'wellbeingChats'), orderBy('updatedAt', 'desc'), limit(5)));
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      if (rows.length === 0) {
        listEl.innerHTML = `<div style="font-size:12px; color: var(--text-dim);">No previous wellbeing chats.</div>`;
        return;
      }
      listEl.innerHTML = rows.map(r => {
        const preview = (r.messages && r.messages.length ? r.messages[r.messages.length-1].content : '').slice(0,80);
        const time = r.updatedAt?.toDate ? r.updatedAt.toDate().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit'}) : 'recently';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; background: rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:10px; padding:10px 12px; cursor:pointer;" data-load-chat="${r.id}">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preview || 'Wellbeing chat'} </div>
              <div style="font-size:11px; color: var(--text-dim);">${time} ${r.escalationFlag ? '· ⚠️ flagged for support' : ''}</div>
            </div>
            <span class="badge ${r.escalationFlag ? 'badge-red' : 'badge-gray'}" style="flex-shrink:0;">${r.escalationFlag ? _i18n_t('wellbeing.supportFlagged','Support flagged') : 'Private'}</span>
          </div>
        `;
      }).join('');
      listEl.querySelectorAll('[data-load-chat]').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.dataset.loadChat;
          try {
            const snap = await getDoc(doc(db, 'users', uid, 'wellbeingChats', id));
            if (snap.exists) {
              const data = snap.data();
              chatId = id;
              try { sessionStorage.setItem('stuvo_wb_chatId', chatId); } catch {}
              conversationHistory = (data.messages || []).slice(0, -1); // will add last exchange via addBubble loop
              // Rebuild thread
              const welcome = thread.firstElementChild;
              thread.innerHTML = '';
              if (welcome) thread.appendChild(welcome);
              (data.messages || []).forEach(m => addBubble(m.role, m.content, { escalation: data.escalationFlag && m.role==='assistant' }));
              if (data.escalationFlag) escalationBanner.style.display = 'block';
              showToast('Loaded previous chat', 'info');
            }
          } catch (e) { console.error('[load chat]', e); }
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div style="font-size:12px; color: var(--text-dim);">Could not load history.</div>`;
    }
  }
  loadHistory();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = '';
    addBubble('user', prompt);
    conversationHistory.push({ role: 'user', content: prompt });
    const typing = showTyping();
    const sendBtn = container.querySelector('#wb-send');
    sendBtn.disabled = true; sendBtn.textContent = '...';
    try {
      const data = await safeApiCall('/api/ai', {
        action: 'wellbeingAssistant', prompt, message: prompt,
        conversationHistory: conversationHistory.slice(0, -1)
      });
      const reply = data.reply || "I'm here to listen. Would you like to try a short breathing exercise or talk more about what's on your mind?";
      const escalationFlag = !!data.escalationFlag;
      typing.remove();
      addBubble('assistant', reply, { escalation: escalationFlag });
      conversationHistory.push({ role: 'assistant', content: reply });
      if (escalationFlag) {
        escalationBanner.style.display = 'block';
        currentEscalation = true;
        showToast(_i18n_t('wellbeing.supportFlaggedToast','This chat was flagged so a school counselor can offer extra support'), 'info');
      }
      // Save
      await saveChatToFirestore(prompt, reply, escalationFlag);
    } catch (err) {
      console.error('[wellbeingAssistant]', err);
      typing.remove();
      addBubble('assistant', "I'm having trouble connecting right now. If you need support, please reach out to a trusted adult or counselor. You can also try a 2-minute breathing break on the Wellbeing home.");
      showToast(err.message || 'Failed to get response', 'error');
    } finally {
      sendBtn.disabled = false; sendBtn.textContent = 'Send ↑';
      input.focus();
    }
  });

  // Also allow Enter to send (Shift+Enter for newline)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable:true }));
    }
  });
}