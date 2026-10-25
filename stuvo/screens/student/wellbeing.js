function getWellnessDateString(d=new Date()){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
let _screenTracker=null;
function initScreenTimeTracker(uid){
 if(!uid||_screenTracker) return;
 let activeStart=document.visibilityState==="visible"?Date.now():null;
 let acc=0, catStart=Date.now(), curCat=getCat(), studyMs=0, commMs=0;
 function getCat(){const h=window.location.hash||""; if(h.startsWith("#/student/community")) return "community"; if(h.startsWith("#/student/study-hub")||h.startsWith("#/student/studyhub")||h.startsWith("#/student/homework")||h.startsWith("#/student/practice-bits")||h.startsWith("#/student/doubt")||h.startsWith("#/student/focus")) return "study"; return "other";}
 async function flush(force){
  const ms=acc+(activeStart?Date.now()-activeStart:0);
  if(ms<5000&&!force) return;
  const mins=Math.max(1,Math.round(ms/60000));
  const sMin=Math.round((studyMs+(curCat==="study"&&activeStart?Date.now()-catStart:0))/60000);
  const cMin=Math.round((commMs+(curCat==="community"&&activeStart?Date.now()-catStart:0))/60000);
  const ds=getWellnessDateString();
  try{const ref=doc(db,"users",uid,"wellness",ds); const snap=await getDoc(ref); const ex=snap.exists?snap.data():{}; await setDoc(ref,{screenTimeMinutes:Math.max(mins,ex.screenTimeMinutes||0),studyMinutes:Math.max(sMin,ex.studyMinutes||0),communityMinutes:Math.max(cMin,ex.communityMinutes||0),updatedAt:serverTimestamp()},{merge:true});}catch(e){console.error(e);}
 }
 function onVis(){ if(document.visibilityState==="visible"){activeStart=Date.now(); catStart=Date.now(); curCat=getCat();} else { if(activeStart) acc+=Date.now()-activeStart; activeStart=null; const dur=Date.now()-catStart; if(curCat==="study") studyMs+=dur; else if(curCat==="community") commMs+=dur; flush(false);} }
 function onHash(){ const now=Date.now(); const dur=now-catStart; if(curCat==="study") studyMs+=dur; else if(curCat==="community") commMs+=dur; catStart=now; curCat=getCat(); }
 document.addEventListener("visibilitychange",onVis); window.addEventListener("hashchange",onHash); window.addEventListener("beforeunload",()=>{ if(activeStart) acc+=Date.now()-activeStart; flush(true);}); _screenTracker={flush}; setInterval(()=>flush(false),60000);
}
let _breakTimer=null,_focusStart=null;
function initBreakReminder(){
 if(_breakTimer) return;
 let lastToast=0;
 _breakTimer=setInterval(()=>{
  const vis=document.visibilityState==="visible";
  if(!vis){_focusStart=null;return;}
  const isFocus=window._focusRunning===true || (window.location.hash.includes("focus")&&vis) || window.location.hash.includes("study-hub");
  const now=Date.now();
  if(isFocus){
   if(!_focusStart) _focusStart=now;
   const mins=(now-_focusStart)/60000;
   if(mins>=45 && now-lastToast>3600000){
    const prefs=window._notificationPrefs||{};
    if(prefs.breakReminders!==false) showToast(_i18n_t('wellbeing.focusedAwhile',"You've been focused for a while: a short break might help."),"info");
    lastToast=now; _focusStart=now;
   }
  } else {
   if(_focusStart && now-_focusStart>50*60*1000) _focusStart=null;
  }
 },60000);
}
function maybeBedtime(container){
 const now=new Date(); const after=(now.getHours()>21|| (now.getHours()==21&&now.getMinutes()>=30));
 if(!after) return;
 const ds=getWellnessDateString(); if(localStorage.getItem("stuvo_bedtime_dismiss_"+ds)==="1") return;
 const prefs=window._notificationPrefs||{}; if(prefs.bedtimeNudge===false) return;
 const banner=document.createElement("div");
 banner.id="bedtime-banner";
 banner.style.cssText="background:linear-gradient(135deg,rgba(124,92,252,0.15),rgba(79,140,255,0.12));border:1px solid rgba(124,92,252,0.3);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:16px;";
  banner.innerHTML = '<div style="font-size:22px;">🌙</div><div style="flex:1;"><div style="font-weight:700;font-size:14px;">'
    + _i18n_t('wellbeing.bedtimeTitle',"It's getting late: consider wrapping up soon.")
    + '</div><div style="font-size:12px;color:var(--text-dim);margin-top:2px;">'
    + _i18n_t('wellbeing.bedtimeDesc','A good wind-down helps you rest.')
    + '</div></div><button id="bedtime-dismiss" class="btn btn-secondary btn-sm" style="margin-top:0;width:auto;flex-shrink:0;">'
    + _i18n_t('wellbeing.dismiss','Dismiss') + '</button>';
 (container.querySelector("#wellbeing-root")||container).prepend(banner);
 banner.querySelector("#bedtime-dismiss").addEventListener("click",()=>{banner.remove(); localStorage.setItem("stuvo_bedtime_dismiss_"+ds,"1");});
}
function ensureWBStyles(){
 if(document.getElementById("wellbeing-styles")) return;
 const s=document.createElement("style"); s.id="wellbeing-styles";
  s.textContent=".mood-btn{flex:1;padding:12px;border-radius:14px;border:1px solid var(--glass-border);background:var(--glass);cursor:pointer;text-align:center;font-family:var(--font-ui);transition:transform var(--dur-press) var(--ease-out),border-color 160ms ease,background-color 160ms ease} @media(hover:hover) and (pointer:fine){.mood-btn:hover{border-color:rgba(124,92,252,0.35);background:rgba(124,92,252,0.08)}} .mood-btn:active{transform:scale(var(--press-scale))} .mood-btn.active{background:linear-gradient(135deg,rgba(124,92,252,0.2),rgba(79,140,255,0.15));border-color:rgba(124,92,252,0.4)} .quick-support-btn{flex:1;min-width:140px;padding:14px 12px;border-radius:14px;background:var(--glass);border:1px solid var(--glass-border);cursor:pointer;text-align:center;font-family:var(--font-ui);color:var(--text);transition:transform var(--dur-press) var(--ease-out),border-color 160ms ease,background-color 160ms ease} @media(hover:hover) and (pointer:fine){.quick-support-btn:hover{border-color:rgba(124,92,252,0.35);background:rgba(124,92,252,0.1)}} .quick-support-btn:active{transform:scale(var(--press-scale))} .wellness-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px} @media(max-width:860px){.wellness-tool-grid{grid-template-columns:1fr}} .breath-circle{width:140px;height:140px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(124,92,252,0.8),rgba(79,140,255,0.5));margin:16px auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:var(--font-display);color:var(--text-bright);box-shadow:0 0 40px rgba(124,92,252,0.5)} .break-suggest{padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:10px;font-size:13px;display:flex;gap:8px;align-items:center}";
 document.head.appendChild(s);
}
async function renderStudentWellbeing(container, params={}) {
 const uid=appState.user?.uid;
 // Perf: kill orphaned breath/reset timers from a previous visit —
 // route change leaves the closure intervals ticking against detached DOM.
 try { if (window._wbIntervals) { window._wbIntervals.forEach(id=>{ try{clearInterval(id);}catch{} }); window._wbIntervals = null; } } catch {}
 ensureWBStyles(); initScreenTimeTracker(uid); initBreakReminder();
 container.innerHTML=`
    <div class="flex-col" id="wellbeing-root">
      ${createPageHeader(_i18n_t('nav.wellbeing','Wellbeing'),_i18n_t('wellbeing.subtitle','A calm space to check in, reset, and find balance: supportive, never graded'))}
      <div id="bedtime-slot"></div>
      <div class="glass-card">
        <div class="card-label">${_i18n_t('wellbeing.howAreYouToday','How are you doing today?')}</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">${_i18n_t('wellbeing.howAreYouDesc','Your mood is private.')}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="mood-btn" data-mood="good"><div style="font-size:22px;">😊</div><div style="font-weight:700;font-size:13px;">${_i18n_t('wellbeing.moodGood','Good')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.moodGoodDesc','Feeling positive')}</div></button>
          <button class="mood-btn" data-mood="okay"><div style="font-size:22px;">😐</div><div style="font-weight:700;font-size:13px;">${_i18n_t('wellbeing.moodOkay','Okay')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.moodOkayDesc2','Some ups & downs')}</div></button>
          <button class="mood-btn" data-mood="not_great"><div style="font-size:22px;">😔</div><div style="font-weight:700;font-size:13px;">${_i18n_t('wellbeing.moodNotGreat','Not great')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.moodNotGreatDesc2','Could use support')}</div></button>
        </div>
        <div id="mood-feedback" style="margin-top:12px;font-size:13px;color:var(--text-dim);min-height:18px;"></div>
      </div>
       <div class="glass-card" id="balance-card"><div class="card-label">${_i18n_t('wellbeing.yourBalance','Your Balance')}</div><div id="balance-content">${createSkeleton(3)}</div></div>
       <div class="glass-card" id="weekly-summary"><div class="card-label">${_i18n_t('wellbeing.weeklySummary','Weekly Summary')}</div><div id="weekly-content">${createSkeleton(2)}</div></div>
        <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.quickSupport','Quick Support')}</div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="quick-support-btn" id="qs-reset"><div style="font-size:20px;">🌿</div><div style="font-weight:700;font-size:13px;margin-top:4px;">${_i18n_t('wellbeing.takeReset','Take a 2-minute reset')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.takeResetDesc','Calm focus reset')}</div></button><button class="quick-support-btn" id="qs-assistant"><div style="font-size:20px;">💬</div><div style="font-weight:700;font-size:13px;margin-top:4px;">${_i18n_t('wellbeing.talkToAssistant','Talk to Wellbeing Assistant')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.talkToAssistantDesc','Private reflective chat')}</div></button><button class="quick-support-btn" id="qs-report"><div style="font-size:20px;">🛡️</div><div style="font-weight:700;font-size:13px;margin-top:4px;">${_i18n_t('wellbeing.reportConcern','Report a concern')}</div><div style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.reportConcernDesc','Private & safe')}</div></button></div><button class="btn" id="btn-need-break" style="margin-top:14px;">🤲 ${_i18n_t('wellbeing.needBreak','I need a break')}</button></div>
      <div class="wellness-tool-grid">
        <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.moodCheckIn','Mood Check-in')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.moodCheckInDesc','Tap an emoji to note how you feel right now.')}</p><div style="display:flex;gap:8px;justify-content:space-between;"><button class="mood-btn" data-mood5="great" style="padding:10px 6px;"><div style="font-size:20px;">😄</div><div style="font-size:11px;font-weight:600;">${_i18n_t('wellbeing.moodGreat','Great')}</div></button><button class="mood-btn" data-mood5="good" style="padding:10px 6px;"><div style="font-size:20px;">🙂</div><div style="font-size:11px;font-weight:600;">${_i18n_t('wellbeing.moodGood','Good')}</div></button><button class="mood-btn" data-mood5="okay" style="padding:10px 6px;"><div style="font-size:20px;">😐</div><div style="font-size:11px;font-weight:600;">${_i18n_t('wellbeing.moodOkay','Okay')}</div></button><button class="mood-btn" data-mood5="low" style="padding:10px 6px;"><div style="font-size:20px;">😔</div><div style="font-size:11px;font-weight:600;">${_i18n_t('wellbeing.moodLow','Low')}</div></button><button class="mood-btn" data-mood5="struggling" style="padding:10px 6px;"><div style="font-size:20px;">😢</div><div style="font-size:11px;font-weight:600;">${_i18n_t('wellbeing.moodStruggling','Struggling')}</div></button></div><div id="mood5-feedback" style="font-size:12px;color:var(--text-dim);margin-top:10px;min-height:16px;"></div></div>
        <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.breathingExercise','Breathing Exercise')}</div><p style="font-size:12px;color:var(--text-dim);">${_i18n_t('wellbeing.breathingDesc','Breathing exercise.')}</p><div id="breath-circle" class="breath-circle">${_i18n_t('studyHub.ready','Ready')}</div><div id="breath-phase" style="text-align:center;font-size:13px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.breathPressStart','Press Start to begin')}</div><div style="display:flex;gap:8px;justify-content:center;"><button class="btn btn-sm" id="breath-start" style="margin-top:0;width:auto;">▶ ${_i18n_t('wellbeing.breathStart','Start')}</button><button class="btn btn-sm btn-secondary" id="breath-stop" style="margin-top:0;width:auto;">⏹ ${_i18n_t('wellbeing.breathStop','Stop')}</button><select class="form-control" id="breath-duration" style="width:auto;max-width:120px;"><option value="60">${_i18n_t('wellbeing.min1','1 min')}</option><option value="120" selected>${_i18n_t('wellbeing.min2','2 min')}</option></select></div></div>
        <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.focusReset','Focus Reset')}</div><p style="font-size:12px;color:var(--text-dim);">${_i18n_t('wellbeing.focusResetDesc','A short calming pause.')}</p><div style="text-align:center;padding:14px;"><div id="reset-timer" style="font-family:'Sora',sans-serif;font-size:36px;font-weight:800;">02:00</div><div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;margin-top:10px;"><div id="reset-bar" class="progress-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#7C5CFC,#4F8CFF);--progress:0;"></div></div><div style="margin-top:12px;font-size:28px;opacity:0.8;" id="reset-visual">🌊</div></div><div style="display:flex;gap:8px;justify-content:center;"><button class="btn btn-sm" id="reset-start" style="margin-top:0;width:auto;">▶ ${_i18n_t('wellbeing.resetStartBtn','Start 2-min reset')}</button><button class="btn btn-sm btn-secondary" id="reset-stop" style="margin-top:0;width:auto;">${_i18n_t('wellbeing.resetBtn','Reset')}</button></div></div>
        <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.studyBreakSuggestions','Study-Break Suggestions')}</div><div style="display:flex;flex-direction:column;gap:8px;"><div class="break-suggest">💧 ${_i18n_t('wellbeing.breakSugg1','Drink a glass of water')}</div><div class="break-suggest">🧘 ${_i18n_t('wellbeing.breakSugg2','Stretch')}</div><div class="break-suggest">🌳 ${_i18n_t('wellbeing.breakSugg3','Step outside')}</div><div class="break-suggest">🎵 ${_i18n_t('wellbeing.breakSugg4','Listen to one calm song')}</div><div class="break-suggest">✍️ ${_i18n_t('wellbeing.breakSugg5','Jot down one thing')}</div><div class="break-suggest">🤸 ${_i18n_t('wellbeing.breakSugg6','Do 10 jumping jacks')}</div></div></div>
      </div>
      <div class="grid-cols-2">
        <div class="glass-card"><div class="card-label">📓 ${_i18n_t('wellbeing.journaling','Journaling')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.journalingDesc','Write a private note.')}</p><textarea class="form-control" id="journal-text" rows="3" placeholder="${_i18n_t('wellbeing.journalPlaceholder',"What's on your mind today?")}"></textarea><button class="btn btn-secondary btn-sm" id="btn-save-journal" style="margin-top:10px;width:auto;">${_i18n_t('wellbeing.saveJournal','Save Journal Entry')}</button><div id="journal-list" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:180px;overflow-y:auto;"></div></div>
        <div class="glass-card"><div class="card-label">🙏 ${_i18n_t('wellbeing.gratitude','Gratitude')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.gratitudeDesc','Note one good thing.')}</p><textarea class="form-control" id="gratitude-text" rows="3" placeholder="${_i18n_t('wellbeing.gratitudePlaceholder',"Today I'm grateful for...")}"></textarea><button class="btn btn-secondary btn-sm" id="btn-save-gratitude" style="margin-top:10px;width:auto;">${_i18n_t('wellbeing.saveGratitude','Save Gratitude')}</button><div id="gratitude-list" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:180px;overflow-y:auto;"></div></div>
      </div>
       <div class="glass-card status-tab is-brand"><div class="card-label">🌙 ${_i18n_t('wellbeing.sleepWindDown','Sleep & Wind-down')}</div><p style="font-size:13px;color:var(--text-dim);line-height:1.6;">${_i18n_t('wellbeing.sleepDesc','Good sleep helps learning.')}</p><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" id="btn-wind-breath" style="margin-top:0;width:auto;">${_i18n_t('wellbeing.windBreath','Box breathing')}</button><button class="btn btn-secondary btn-sm" id="btn-wind-journal" style="margin-top:0;width:auto;">${_i18n_t('wellbeing.windJournal','Quick journal')}</button></div></div>
       <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.wellnessResources','Wellness Resources')}</div><div style="display:flex;flex-direction:column;gap:10px;"><div style="padding:10px;background:rgba(255,255,255,0.04);border-radius:10px;"><div style="font-weight:700;font-size:13px;">🧑‍🏫 ${_i18n_t('wellbeing.talkToTrustedAdult','Talk to a trusted adult')}</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${_i18n_t('wellbeing.talkToTrustedAdultDesc','Reach out to someone you trust.')}</div></div><div style="padding:10px;background:rgba(255,255,255,0.04);border-radius:10px;"><div style="font-weight:700;font-size:13px;">📞 ${_i18n_t('wellbeing.needUrgentHelp','If you need urgent help')}</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${_i18n_t('wellbeing.needUrgentHelpDesc','Contact a counselor or helpline.')}</div></div><div style="padding:10px;background:rgba(255,255,255,0.04);border-radius:10px;"><div style="font-weight:700;font-size:13px;">🌿 ${_i18n_t('wellbeing.selfCareIdeas','Self-care ideas')}</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${_i18n_t('wellbeing.selfCareIdeasDesc','Sleep, breaks, movement help.')}</div></div><div id="counselor-contact" style="padding:10px;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.15);border-radius:10px;display:none;"><div style="font-weight:700;font-size:13px;">🏫 ${_i18n_t('wellbeing.counselorContactTitle','Your school counselor')}</div><div id="counselor-details" style="font-size:12px;color:var(--text-dim);margin-top:4px;"></div></div></div></div>
       <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.contactTrustedAdult','Contact a Trusted Adult')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.contactTrustedAdultDesc','Send a private request.')}</p><div class="form-group"><label>${_i18n_t('wellbeing.msgLabel','Message')}</label><textarea class="form-control" id="trusted-msg" rows="2" placeholder="${_i18n_t('wellbeing.trustedMsgPlaceholder',"I'd like to talk about...")}"></textarea></div><div class="form-group"><label>${_i18n_t('wellbeing.trustedContactLabel','Preferred contact (optional)')}</label><input type="text" class="form-control" id="trusted-contact" placeholder="${_i18n_t('wellbeing.trustedContactPlaceholder','e.g. email or phone, or leave blank')}"></div><button class="btn btn-secondary" id="btn-trusted" style="margin-top:0;">${_i18n_t('wellbeing.sendSupport','Send Support Request')}</button></div>
       <div class="glass-card status-tab is-success"><div class="card-label">📅 ${_i18n_t('wellbeing.counselorAppointment','Counselor Appointment Request')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${_i18n_t('wellbeing.counselorAppointmentDesc','Request a meeting.')}</p><div class="form-row"><div class="form-group"><label>${_i18n_t('wellbeing.prefDate','Preferred date')}</label><input type="date" class="form-control" id="counselor-date"></div><div class="form-group"><label>${_i18n_t('wellbeing.prefTime','Preferred time')}</label><input type="time" class="form-control" id="counselor-time"></div></div><div class="form-group"><label>${_i18n_t('wellbeing.reasonLabel2','Reason')} <span style="color:var(--text-dim);font-weight:400;">${_i18n_t('report.optionalTag','(optional)')}</span></label><textarea class="form-control" id="counselor-reason" rows="2" placeholder="${_i18n_t('wellbeing.reasonPlaceholder','What would you like to discuss?')}"></textarea></div><button class="btn" id="btn-counselor" style="margin-top:0;">${_i18n_t('wellbeing.requestAppt','Request Appointment')}</button><div id="my-support-requests" style="margin-top:16px;"></div></div>
       <div class="glass-card"><div class="card-label">${_i18n_t('wellbeing.notificationPreferences','Notification Preferences')}</div><p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">${_i18n_t('wellbeing.notifPrefsDesc','Stored privately with your account.')}</p><div style="display:flex;flex-direction:column;gap:12px;"><label style="display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;"><span><strong style="font-size:13px;">${_i18n_t('wellbeing.breakReminders','Break reminders')}</strong><br><span style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.breakRemindersDesc','Break nudge.')}</span></span><input type="checkbox" id="pref-break" style="width:18px;height:18px;"></label><label style="display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;"><span><strong style="font-size:13px;">${_i18n_t('wellbeing.bedtimeWinddown','Bedtime wind-down')}</strong><br><span style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.bedtimeWinddownDesc','Wrap-up banner.')}</span></span><input type="checkbox" id="pref-bedtime" style="width:18px;height:18px;"></label><label style="display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;"><span><strong style="font-size:13px;">${_i18n_t('wellbeing.weeklySummaryOpt','Weekly summary')}</strong><br><span style="font-size:11px;color:var(--text-dim);">${_i18n_t('wellbeing.weeklySummaryDesc','Weekly recap.')}</span></span><input type="checkbox" id="pref-weekly" style="width:18px;height:18px;"></label></div><button class="btn btn-secondary btn-sm" id="btn-save-notif" style="margin-top:14px;width:auto;">${_i18n_t('wellbeing.savePrefs','Save Preferences')}</button></div>
    </div>
  `;
  maybeBedtime(container);
  try{enhanceInputsWithSTT(container);}catch{}
   container.querySelector("#qs-reset")?.addEventListener("click",()=>{document.querySelector("#reset-start")?.scrollIntoView(); setTimeout(()=>document.querySelector("#reset-start")?.click(),400);});
   container.querySelector("#qs-assistant")?.addEventListener("click",()=> window.location.hash="#/student/wellbeingAssistant");
   container.querySelector("#qs-report")?.addEventListener("click",()=> window.location.hash="#/student/report");
  container.querySelector("#btn-need-break")?.addEventListener("click",()=>{document.querySelector("#breath-circle")?.scrollIntoView(); showToast(_i18n_t('wellbeing.takeBreathPause','Take a breath: you deserve a pause')+" 🌿","info");});
  container.querySelector("#btn-wind-breath")?.addEventListener("click",()=> document.querySelector("#breath-start")?.click());
  container.querySelector("#btn-wind-journal")?.addEventListener("click",()=> document.querySelector("#journal-text")?.focus());
  // Breath exercise (Box 4-4-4-4) and Focus Reset countdown. Both tick once
  // per second with instant text updates and no transitions, per the
  // performance contract for high-frequency UI. Intervals register in
  // window._wbIntervals so a route revisit kills orphans (see render top).
  let breathTimer = null, breathRemaining = 0, breathPhaseIdx = 0, breathPhaseLeft = 0;
  const BREATH_PHASES = [['breathInhale', 'Inhale', 4], ['breathHold', 'Hold', 4], ['breathExhale', 'Exhale', 4], ['breathHold', 'Hold', 4]];
  function paintBreath(){
    const circle = container.querySelector("#breath-circle"), phase = container.querySelector("#breath-phase");
    if (!circle || !phase) return false;
    circle.textContent = _i18n_t('wellbeing.' + BREATH_PHASES[breathPhaseIdx][0], BREATH_PHASES[breathPhaseIdx][1]);
    phase.textContent = Math.floor(Math.max(0, breathRemaining) / 60) + ':' + String(Math.max(0, breathRemaining) % 60).padStart(2, '0');
    return true;
  }
  container.querySelector("#breath-start")?.addEventListener("click",()=>{
    if (breathTimer) return;
    const durSel = container.querySelector("#breath-duration");
    breathRemaining = Math.max(30, Math.min(600, parseInt(durSel?.value || '120', 10) || 120));
    breathPhaseIdx = 0; breathPhaseLeft = BREATH_PHASES[0][2];
    if (!paintBreath()) return;
    breathTimer = setInterval(()=>{
      const circle = container.querySelector("#breath-circle");
      if (!circle || !circle.isConnected) { clearInterval(breathTimer); breathTimer = null; return; }
      breathRemaining -= 1; breathPhaseLeft -= 1;
      if (breathRemaining <= 0) {
        clearInterval(breathTimer); breathTimer = null;
        circle.textContent = _i18n_t('wellbeing.breathComplete','Complete: well done');
        container.querySelector("#breath-phase").textContent = '0:00';
        return;
      }
      if (breathPhaseLeft <= 0) { breathPhaseIdx = (breathPhaseIdx + 1) % BREATH_PHASES.length; breathPhaseLeft = BREATH_PHASES[breathPhaseIdx][2]; }
      paintBreath();
    }, 1000);
    try { window._wbIntervals = window._wbIntervals || []; window._wbIntervals.push(breathTimer); } catch {}
  });
  container.querySelector("#breath-stop")?.addEventListener("click",()=>{
    if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
    const phase = container.querySelector("#breath-phase");
    if (phase) phase.textContent = _i18n_t('wellbeing.breathPaused','Paused: press Start to begin again');
  });
  let resetTimer = null; const RESET_TOTAL = 120; let resetLeft = RESET_TOTAL;
  function paintReset(){
    const t = container.querySelector("#reset-timer"), bar = container.querySelector("#reset-bar");
    if (!t) return false;
    t.textContent = String(Math.floor(resetLeft / 60)).padStart(2, '0') + ':' + String(resetLeft % 60).padStart(2, '0');
    if (bar) bar.style.setProperty('--progress', ((RESET_TOTAL - resetLeft) / RESET_TOTAL).toFixed(3));
    return true;
  }
  container.querySelector("#reset-start")?.addEventListener("click",()=>{
    if (resetTimer) return;
    resetLeft = RESET_TOTAL;
    if (!paintReset()) return;
    resetTimer = setInterval(()=>{
      const t = container.querySelector("#reset-timer");
      if (!t || !t.isConnected) { clearInterval(resetTimer); resetTimer = null; return; }
      resetLeft -= 1;
      if (resetLeft <= 0) {
        clearInterval(resetTimer); resetTimer = null; resetLeft = 0; paintReset();
        t.textContent = _i18n_t('wellbeing.resetDone','Done');
        showToast(_i18n_t('wellbeing.niceReset','Nice reset: take a slow breath before you continue'),"success");
        return;
      }
      paintReset();
    }, 1000);
    try { window._wbIntervals = window._wbIntervals || []; window._wbIntervals.push(resetTimer); } catch {}
  });
  container.querySelector("#reset-stop")?.addEventListener("click",()=>{
    if (resetTimer) { clearInterval(resetTimer); resetTimer = null; }
    resetLeft = RESET_TOTAL; paintReset();
  });
  const todayStr=getWellnessDateString(); let todayWellness=null;
  try{ const snap=await getDoc(doc(db,"users",uid,"wellness",todayStr)); if(snap.exists){ todayWellness=snap.data(); const m=todayWellness.mood; if(m){ container.querySelectorAll("[data-mood]").forEach(b=> b.classList.toggle("active", b.dataset.mood===m)); const fb=container.querySelector("#mood-feedback"); if(fb) fb.textContent=m==="good"?(_i18n_t('wellbeing.moodFeedbackGood','Thanks for sharing: glad you are feeling good!')+" 🌟"): m==="okay"?_i18n_t('wellbeing.moodFeedbackOkay','Thanks: noticing ups and downs is a kind step.'):_i18n_t('wellbeing.moodFeedbackNotGreat','Thank you for sharing.'); } } }catch(e){}
  container.querySelectorAll("[data-mood]").forEach(btn=>{
    btn.addEventListener("click", async()=>{
      const mood=btn.dataset.mood;
      const fb=container.querySelector("#mood-feedback");
      const msgs={good:(_i18n_t('wellbeing.moodFeedbackGood','Thanks for sharing: glad you are feeling good!')+" 🌟"), okay:_i18n_t('wellbeing.moodFeedbackOkay','Thanks: noticing ups and downs is a kind step.'), not_great:_i18n_t('wellbeing.moodFeedbackNotGreat','Thank you for sharing.')};
      if(fb) fb.textContent=msgs[mood]||_i18n_t('wellbeing.savedFallback','Saved');
      container.querySelectorAll("[data-mood]").forEach(b=> b.classList.toggle("active", b===btn));
      try{await setDoc(doc(db,"users",uid,"wellness",todayStr),{mood,updatedAt:serverTimestamp()},{merge:true}); showToast(_i18n_t('wellbeing.moodSaved','Mood saved: thank you for checking in'),"success");}catch(e){showToast(_i18n_t('wellbeing.moodOffline','Could not save mood locally: will retry when online'),"info"); try{localStorage.setItem("stuvo_mood_"+todayStr,mood);}catch{}}
    });
  });
  container.querySelectorAll("[data-mood5]").forEach(btn=>{
    btn.addEventListener("click", async()=>{
      const v=btn.dataset.mood5;
      const labels={great:_i18n_t('wellbeing.moodGreat','Great'),good:_i18n_t('wellbeing.moodGood','Good'),okay:_i18n_t('wellbeing.moodOkay','Okay'),low:_i18n_t('wellbeing.moodLow','Low'),struggling:_i18n_t('wellbeing.moodStruggling','Struggling')};
      const fb=container.querySelector("#mood5-feedback");
      if(fb) fb.textContent=_i18n_t('wellbeing.notedFeedback', {label: labels[v], extra: ((v==="struggling"||v==="low") ? _i18n_t('wellbeing.strugglingExtra','If you want, try breathing.') : _i18n_t('wellbeing.keepNoticing','Keep noticing gentle moments.'))});
      container.querySelectorAll("[data-mood5]").forEach(b=> b.classList.toggle("active", b===btn));
      try{await setDoc(doc(db,"users",uid,"wellness",todayStr),{mood5:v,mood5At:serverTimestamp()},{merge:true});}catch(e){}
    });
  });
  async function loadBalance(){
    const el=container.querySelector("#balance-content"); if(!el) return;
    try{
      let screenMin=0; try{const s=await getDoc(doc(db,"users",uid,"wellness",todayStr)); if(s.exists) screenMin=s.data().screenTimeMinutes||0;}catch{}
      let focusSessions=0,focusTime=0; try{const d=typeof getData==="function"?getData():null; if(d&&d.focusHistory){const t=d.focusHistory.filter(h=>h.date===todayStr); focusSessions=t.length; focusTime=t.reduce((s,h)=>s+h.duration,0);}}catch{}
      let breaksTaken=0; try{const s=await getDoc(doc(db,"users",uid,"wellness",todayStr)); if(s.exists) breaksTaken=s.data().breaksTaken||0;}catch{}
      const classIds=appState.userData?.classIds||[]; let upcomingCount=0,nextDue=null;
      for(const cid of classIds){ try{const snap=await getDocs(collection(db,"classes",cid,"homework")); for(const d of snap.docs){const hw=d.data(); if(!hw.deadline) continue; let sub=false; try{const sh=await getDoc(doc(db,"classes",cid,"homework",d.id,"submissions",uid)); if(sh.exists) sub=true;}catch{} if(!sub){const dl=new Date(hw.deadline); if(dl>=new Date()){upcomingCount++; if(!nextDue||dl<new Date(nextDue.deadline)) nextDue={title:hw.title,deadline:hw.deadline};}}}}catch{}}
      let studyMin=0,commMin=0; try{const s=await getDoc(doc(db,"users",uid,"wellness",todayStr)); if(s.exists){studyMin=s.data().studyMinutes||0; commMin=s.data().communityMinutes||0;}}catch{}
      const total=studyMin+commMin; const pct=total?Math.round(studyMin/total*100):0;
      el.innerHTML=`
        <div class="grid-cols-3" style="gap:12px;">
          <div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;">⏱</div><div style="font-weight:800;font-family:'Sora',sans-serif;font-size:16px;margin-top:6px;">`+focusSessions+`</div><div style="font-size:11px;color:var(--text-dim);">`+_i18n_t('wellbeing.balanceFocusSessions','Focus sessions today')+`<br>`+_i18n_t('wellbeing.focusTimeLine',{count:focusTime})+`</div></div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;">☕</div><div style="font-weight:800;font-family:'Sora',sans-serif;font-size:16px;margin-top:6px;">`+breaksTaken+`</div><div style="font-size:11px;color:var(--text-dim);">`+_i18n_t('wellbeing.balanceBreaksTaken','Breaks taken today')+`</div><button class="btn btn-secondary btn-sm" id="btn-take-break" style="margin-top:8px;width:auto;font-size:11px;">`+_i18n_t('wellbeing.logBreak','Log a break')+`</button></div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:14px;padding:14px;text-align:center;"><div style="font-size:22px;">📚</div><div style="font-weight:800;font-family:'Sora',sans-serif;font-size:16px;margin-top:6px;">`+upcomingCount+`</div><div style="font-size:11px;color:var(--text-dim);">`+_i18n_t('wellbeing.balanceUpcoming','Upcoming assignments')+``+(nextDue?`<br>`+_i18n_t('wellbeing.nextDueLine',{title:nextDue.title,date:nextDue.deadline}):``)+`</div></div>
        </div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;"><div style="background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.15);border-radius:12px;padding:12px;"><div style="font-size:12px;font-weight:700;color:#C4B5FD;text-transform:uppercase;letter-spacing:0.06em;">`+_i18n_t('wellbeing.balanceTimeInStuvo','Time spent in Stuvo today')+`</div><div style="font-size:14px;margin-top:6px;">`+(screenMin?(screenMin+` `+_i18n_t('wellbeing.minutesUnit','minutes')):`+_i18n_t('wellbeing.balanceJustStarted','Just started')+`)+`</div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">`+_i18n_t('wellbeing.balanceTrackedOnly','Tracked only while active.')+`</div></div><div style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:12px;padding:12px;"><div style="font-size:12px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;">`+_i18n_t('wellbeing.balanceStudyVsCommunity','Study vs Community balance')+`</div><div style="display:flex;gap:8px;align-items:center;margin-top:10px;"><div style="flex:`+(studyMin||1)+`;height:10px;background:linear-gradient(90deg,#7C5CFC,#4F8CFF);border-radius:6px;"></div><div style="flex:`+(commMin||1)+`;height:10px;background:rgba(245,158,11,0.5);border-radius:6px;"></div></div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:6px;"><span>`+_i18n_t('wellbeing.balanceStudy','Study')+`: `+studyMin+`m (`+pct+`%)</span><span>`+_i18n_t('wellbeing.balanceCommunity','Community')+`: `+commMin+`m (`+(100-pct)+`%)</span></div><div style="font-size:11px;color:var(--text-dim);margin-top:4px;">`+_i18n_t('wellbeing.balanceCountsTime','Counts in-app time.')+`</div></div></div>
      `;
       el.querySelector("#btn-take-break")?.addEventListener("click", async()=>{ try{await setDoc(doc(db,"users",uid,"wellness",todayStr),{breaksTaken:breaksTaken+1,updatedAt:serverTimestamp()},{merge:true}); showToast(_i18n_t('wellbeing.breakLogged','Break logged')+" 🌿","success"); loadBalance(); loadWeekly();}catch(e){showToast(_i18n_t('wellbeing.breakLocal','Break noted locally'),"info");}});
    }catch(e){el.innerHTML=`<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('wellbeing.balanceFailed','Could not load balance.')}</div>`;}
  }
  loadBalance();
  async function loadWeekly(){
    const el=container.querySelector("#weekly-content"); if(!el) return;
    let show=true; try{const s=await getDoc(doc(db,"users",uid)); if(s.exists){const p=s.data().notificationPrefs||s.data().accessibilityPrefs||{}; if(p.weeklySummary===false) show=false; window._notificationPrefs=p;}}catch{}
    if(!show){el.innerHTML=`<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('wellbeing.weeklyPaused','Weekly summary is paused.')}</div>`; return;}
    try{
      const now=new Date(); const days=[]; for(let i=6;i>=0;i--){const d=new Date(now); d.setDate(now.getDate()-i); days.push(getWellnessDateString(d));}
      let totalFocus=0,moodVals=[],totalBreaks=0; const mMap={great:5,good:4,okay:3,low:2,struggling:1,not_great:1}; const mMap2={good:3,okay:2,not_great:1};
      for(const ds of days){ try{const s=await getDoc(doc(db,"users",uid,"wellness",ds)); if(s.exists){const data=s.data(); totalBreaks+=data.breaksTaken||0; if(data.mood){const v=mMap2[data.mood]||0; if(v) moodVals.push(v);} else if(data.mood5){const v=mMap[data.mood5]||0; if(v) moodVals.push(v);}}}catch{}}
      try{const d=typeof getData==="function"?getData():null; if(d&&d.focusHistory){const ws=new Date(now); ws.setDate(now.getDate()-6); ws.setHours(0,0,0,0); totalFocus=d.focusHistory.filter(h=> new Date(h.date)>=ws ).length;}}catch{}
      let moodText=_i18n_t('wellbeing.noMoodWeek','No mood notes this week.');
      if(moodVals.length){const avg=moodVals.reduce((a,b)=>a+b,0)/moodVals.length; if(avg>=2.7) moodText=_i18n_t('wellbeing.positiveWeek','Your recent check-ins lean gently positive.'); else if(avg>=1.8) moodText=_i18n_t('wellbeing.mixedWeek','Your week had mixed moments.'); else moodText=_i18n_t('wellbeing.toughWeek','Seems like a tough week.');}
      el.innerHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;"><div style="flex:1;min-width:140px;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px;border:1px solid var(--glass-border);text-align:center;"><div style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">`+_i18n_t('wellbeing.focusSessionsW','Focus sessions')+`</div><div style="font-size:20px;font-weight:800;font-family:'Sora',sans-serif;margin-top:6px;">`+totalFocus+`</div><div style="font-size:11px;color:var(--text-dim);">`+_i18n_t('wellbeing.thisWeek','This week')+`</div></div><div style="flex:1;min-width:140px;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px;border:1px solid var(--glass-border);text-align:center;"><div style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">`+_i18n_t('wellbeing.breaksTakenW','Breaks taken')+`</div><div style="font-size:20px;font-weight:800;font-family:'Sora',sans-serif;margin-top:6px;">`+totalBreaks+`</div><div style="font-size:11px;color:var(--text-dim);">`+_i18n_t('wellbeing.gentlePauses','Gentle pauses matter')+`</div></div><div style="flex:1;min-width:180px;background:rgba(124,92,252,0.06);border-radius:12px;padding:12px;border:1px solid rgba(124,92,252,0.12);"><div style="font-size:12px;color:#C4B5FD;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">`+_i18n_t('wellbeing.feelingTitle','How you have been feeling')+`</div><div style="font-size:12px;color:var(--text-dim);margin-top:6px;line-height:1.6;">`+moodText+`</div><div style="font-size:11px;color:var(--text-dim);margin-top:8px;">`+_i18n_t('wellbeing.reflectiveNote','This is reflective, not a score or grade.')+`</div></div></div>`;
    }catch(e){el.innerHTML=`<div style="font-size:13px;color:var(--text-dim);">${_i18n_t('wellbeing.weeklyFailed','Could not load weekly summary.')}</div>`;}
  }
  loadWeekly();
  
  async function loadJournals(){
    const jc=container.querySelector("#journal-list"); const gc=container.querySelector("#gratitude-list"); if(!jc||!gc) return;
    const escJ = (typeof _escapeHtml === 'function') ? _escapeHtml : (s => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    const jLocale = () => ((typeof stuvoBcp47 === 'function' ? stuvoBcp47(window.currentUserLanguage || 'en') : 'en-IN'));
    const jDate = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString(jLocale()) : _i18n_t('common.timeRecently','recently'));
    try{ const snap=await getDocs(query(collection(db,"users",uid,"journal"),orderBy("createdAt","desc"),limit(10))); const js=[], gs=[]; snap.forEach(d=>{const data=d.data(); if(data.type==="gratitude") gs.push({id:d.id,...data}); else js.push({id:d.id,...data});}); jc.innerHTML=js.length?js.map(j=>`<div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:10px;padding:10px;"><div style="font-size:12px;color:var(--text-dim);">`+jDate(j.createdAt)+`</div><div style="font-size:13px;margin-top:4px;line-height:1.6;">`+escJ((j.text||"").slice(0,120))+`</div></div>`).join(""):`<div style="font-size:12px;color:var(--text-dim);text-align:center;">${_i18n_t('wellbeing.noJournal','No journal entries yet.')}</div>`; gc.innerHTML=gs.length?gs.map(j=>`<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:10px;"><div style="font-size:12px;color:var(--text-dim);">`+jDate(j.createdAt)+`</div><div style="font-size:13px;margin-top:4px;">`+escJ((j.text||"").slice(0,120))+`</div></div>`).join(""):`<div style="font-size:12px;color:var(--text-dim);text-align:center;">${_i18n_t('wellbeing.noGratitude','No gratitude notes yet.')}</div>`; }catch(e){ jc.innerHTML=`<div style="font-size:12px;color:var(--text-dim);">${_i18n_t('wellbeing.loadFailedShort','Could not load.')}</div>`; gc.innerHTML=`<div style="font-size:12px;color:var(--text-dim);">${_i18n_t('wellbeing.loadFailedShort','Could not load.')}</div>`;}
  }
  loadJournals();
  container.querySelector("#btn-save-journal")?.addEventListener("click", async()=>{ const t=container.querySelector("#journal-text").value.trim(); if(!t){showToast(_i18n_t('wellbeing.writeFirst','Write something first'),"error"); return;} try{await addDoc(collection(db,"users",uid,"journal"),{type:"journal",text:t,private:true,createdAt:serverTimestamp()}); container.querySelector("#journal-text").value=""; showToast(_i18n_t('wellbeing.journalSaved','Journal saved'),"success"); loadJournals();}catch(e){showToast(_i18n_t('wellbeing.journalFailed','Failed to save journal'),"error");}});
  container.querySelector("#btn-save-gratitude")?.addEventListener("click", async()=>{ const t=container.querySelector("#gratitude-text").value.trim(); if(!t){showToast(_i18n_t('wellbeing.writeFirst','Write something first'),"error"); return;} try{await addDoc(collection(db,"users",uid,"journal"),{type:"gratitude",text:t,private:true,createdAt:serverTimestamp()}); container.querySelector("#gratitude-text").value=""; showToast(_i18n_t('wellbeing.gratitudeSaved','Gratitude saved'),"success"); loadJournals();}catch(e){showToast(_i18n_t('wellbeing.saveFailedWB','Failed to save'),"error");}});
  container.querySelector("#btn-trusted")?.addEventListener("click", async()=>{ const m=container.querySelector("#trusted-msg").value.trim(); const c=container.querySelector("#trusted-contact").value.trim(); if(!m){showToast(_i18n_t('wellbeing.writeMessage','Please write a message'),"error"); return;} try{await addDoc(collection(db,"users",uid,"supportRequests"),{type:"trusted_adult",message:m,contact:c||"",status:"open",createdAt:serverTimestamp()}); showToast(_i18n_t('wellbeing.supportSent','Support request sent'),"success"); container.querySelector("#trusted-msg").value=""; container.querySelector("#trusted-contact").value=""; loadSupport();}catch(e){showToast(_i18n_t('wellbeing.sendFailedWB','Failed to send'),"error");}});
  container.querySelector("#btn-counselor")?.addEventListener("click", async()=>{ const d=container.querySelector("#counselor-date").value; const t=container.querySelector("#counselor-time").value; const r=container.querySelector("#counselor-reason").value.trim(); if(!d){showToast(_i18n_t('wellbeing.pickDate','Pick a preferred date'),"error"); return;} try{await addDoc(collection(db,"users",uid,"supportRequests"),{type:"counselor_appointment",preferredDate:d,preferredTime:t||"",reason:r||"",status:"open",createdAt:serverTimestamp()}); showToast(_i18n_t('wellbeing.appointmentSent','Appointment request sent'),"success"); container.querySelector("#counselor-date").value=""; container.querySelector("#counselor-time").value=""; container.querySelector("#counselor-reason").value=""; loadSupport();}catch(e){showToast(_i18n_t('wellbeing.appointmentFailed','Failed to request appointment'),"error");}});
  async function loadSupport(){
    const el=container.querySelector("#my-support-requests"); if(!el) return;
    try{ const snap=await getDocs(query(collection(db,"users",uid,"supportRequests"),orderBy("createdAt","desc"),limit(5))); const rows=[]; snap.forEach(d=> rows.push({id:d.id,...d.data()})); if(!rows.length){el.innerHTML=`<div style="font-size:12px;color:var(--text-dim);margin-top:10px;">${_i18n_t('wellbeing.noAppointments','No appointment requests yet.')}</div>`; return;} el.innerHTML=`<div style="font-size:12px;font-weight:600;margin-bottom:8px;">${_i18n_t('wellbeing.recentRequests','Recent requests')}</div>`+rows.map(r=>`<div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:12px;font-weight:700;">`+(r.type==="counselor_appointment"?_i18n_t('admin.counselorAppt','Counselor Appointment'): r.type==="trusted_adult"?_i18n_t('admin.trustedAdult','Trusted Adult'):_i18n_t('wellbeing.supportTitle','Support'))+` · `+(r.status||_i18n_t('admin.statusOpen','open'))+`</div><div style="font-size:11px;color:var(--text-dim);">`+(r.preferredDate||"")+` `+(r.preferredTime||"")+` `+(r.reason?" · "+r.reason.slice(0,40):"")+`</div></div><span class="badge `+(r.status==="open"?"badge-yellow": r.status==="resolved"?"badge-green":"badge-gray")+`">`+(r.status||_i18n_t('admin.statusOpen','open'))+`</span></div>`).join(""); }catch(e){el.innerHTML=`<div style="font-size:12px;color:var(--text-dim);">${_i18n_t('wellbeing.requestsFailed','Could not load requests.')}</div>`;}
  }
  loadSupport();
  (async()=>{ try{const s=await getDoc(doc(db,"config","wellness")); if(s.exists && s.data().counselorContact){ const c=container.querySelector("#counselor-contact"); const d=container.querySelector("#counselor-details"); if(c&&d){c.style.display="block"; d.textContent=s.data().counselorContact;}}}catch{}})();
  async function loadNotif(){
    try{ const s=await getDoc(doc(db,"users",uid)); if(s.exists){const data=s.data(); const p=data.notificationPrefs||data.accessibilityPrefs||{}; window._notificationPrefs=p; const b=container.querySelector("#pref-break"), be=container.querySelector("#pref-bedtime"), w=container.querySelector("#pref-weekly"); if(b) b.checked=p.breakReminders!==false; if(be) be.checked=p.bedtimeNudge!==false; if(w) w.checked=p.weeklySummary!==false;} else {const b=container.querySelector("#pref-break"), be=container.querySelector("#pref-bedtime"), w=container.querySelector("#pref-weekly"); if(b) b.checked=true; if(be) be.checked=true; if(w) w.checked=true;}}catch{}
  }
  loadNotif();
  container.querySelector("#btn-save-notif")?.addEventListener("click", async()=>{
    const p={breakReminders:container.querySelector("#pref-break").checked, bedtimeNudge:container.querySelector("#pref-bedtime").checked, weeklySummary:container.querySelector("#pref-weekly").checked};
    try{await setDoc(doc(db,"users",uid),{notificationPrefs:p},{merge:true}); await setDoc(doc(db,"users",uid),{accessibilityPrefs:{...(window._accessPrefsCache||{}),...p}},{merge:true}); window._notificationPrefs=p; showToast(_i18n_t('wellbeing.notifSaved',"Notification preferences saved"),"success"); loadWeekly();}catch(e){showToast(_i18n_t('accessibility.failedToSave','Failed to save preferences'),"error");}
  });
}