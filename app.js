const BANK = window.QUESTION_BANK || [];
const CHANGED_BANK = BANK.filter(q=>q.previousAnswer);
let changedSettings = null;

function renderChanged(){
  stopTimer();setTitle("答案变更专项","按最新文档练习 · 2026-10-12");setActive("changed");
  viewRoot.innerHTML=`<div class="chart-card"><h2>${CHANGED_BANK.length} 道答案变更题</h2><p>判断 ${CHANGED_BANK.filter(q=>q.type==="tf").length} 道 · 单选 ${CHANGED_BANK.filter(q=>q.type==="single").length} 道 · 多选 ${CHANGED_BANK.filter(q=>q.type==="multi").length} 道。答题后显示最新答案、旧答案及文档解析。</p><div class="type-picker">${Object.entries(TYPE_NAME).map(([key,label])=>`<label><input type="checkbox" name="changedType" value="${key}" checked><span><b>${label}</b></span></label>`).join("")}</div><label>每轮题量 <input id="changedCount" type="number" min="1" max="227" value="20" style="width:90px"></label><p>超过所选题型的题数时，按全部可用题目练习。</p><label><input id="changedLoop" type="checkbox" checked> 循环练习（每轮重新乱序，先覆盖全部题目再重复）</label><p><button class="primary" data-action="start-changed">开始乱序练习 →</button></p></div>`;
}
function takeChangedRound(){
  const s=changedSettings, qs=[];
  while(qs.length<s.count){
    if(!s.remaining.length)s.remaining=shuffle(s.pool);
    const index=s.remaining.findIndex(q=>!qs.some(x=>x.id===q.id));
    if(index<0)break;
    qs.push(s.remaining.splice(index,1)[0]);
  }
  return qs;
}
function startChanged(){
  const types=[...document.querySelectorAll('input[name="changedType"]:checked')].map(x=>x.value);
  const pool=CHANGED_BANK.filter(q=>types.includes(q.type));
  if(!pool.length){toast("请至少选择一种题型");return;}
  const count=Number(document.querySelector("#changedCount").value);
  if(!Number.isInteger(count)||count<1){toast("题量请输入大于零的整数");return;}
  changedSettings={pool,count:Math.min(count,pool.length),remaining:shuffle(pool),loop:document.querySelector("#changedLoop").checked,round:1};
  startChangedRound();
}
function startChangedRound(){startPractice("changed",takeChangedRound());setTitle("答案变更专项",`第 ${changedSettings.round} 轮 · 最新答案 · 每轮乱序`);}
const STORE_KEY = "ai-trainer-level3-progress-v1";
const TYPE_NAME = { tf: "判断题", single: "单选题", multi: "多选题" };
const state = loadState();
let session = null;
let examTimer = null;
let syncTimer = null;
let currentUser = null;
let pendingPractice = { mode: "random", continueAt: false };
let pomoTimer = null;
let pomoState = loadPomodoro();

function emptyProgress() { return { attempts: 0, correct: 0, wrong: 0, wrongStreak: 0, recoveryStreak: 0, favorite: false, lastAnswer: null, lastAt: null }; }
function loadState() {
  try { return Object.assign({ questions: {}, days: {}, lastSequence: 0, exams: [] }, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); }
  catch { return { questions: {}, days: {}, lastSequence: 0, exams: [] }; }
}
function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); refreshChrome(); scheduleCloudSync(); }
function progress(id) { return state.questions[id] || (state.questions[id] = emptyProgress()); }
function today() { return new Date().toISOString().slice(0,10); }
function shuffle(items) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function drawRandom(items,count){return shuffle(items).slice(0,Math.min(count,items.length));}
function answerEqual(a,b){ return [...a].sort().join("") === [...b].sort().join(""); }
function practiced(){ return BANK.filter(q => progress(q.id).attempts > 0); }
function activeWrongs(){ return BANK.filter(q => { const p=progress(q.id); return p.wrong>0 && p.recoveryStreak<2; }); }
function mastery(){ const p=practiced(); return p.length ? Math.round(p.reduce((s,q)=>s+(progress(q.id).correct/progress(q.id).attempts),0)/p.length*100) : 0; }
function streakDays(){ let n=0,d=new Date(); while(state.days[d.toISOString().slice(0,10)]){n++;d.setDate(d.getDate()-1);} return n; }
function esc(s){ const e=document.createElement("div");e.textContent=s;return e.innerHTML; }
function toast(msg,ms){ const t=document.querySelector("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),ms||Math.min(8000,Math.max(1800,String(msg).length*70))); }
function loadPomodoro(){try{return Object.assign({focus:25,rest:5,phase:"focus",running:false,paused:false,endAt:null,remaining:25*60000},JSON.parse(localStorage.getItem("ai-trainer-pomodoro-v1")||"{}"));}catch{return {focus:25,rest:5,phase:"focus",running:false,paused:false,endAt:null,remaining:25*60000};}}
function savePomodoro(){localStorage.setItem("ai-trainer-pomodoro-v1",JSON.stringify(pomoState));}
function formatPomo(ms){const sec=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}
function pomoRemaining(){return pomoState.running&&!pomoState.paused&&pomoState.endAt?Math.max(0,pomoState.endAt-Date.now()):pomoState.remaining;}
function updatePomoUI(){const remaining=pomoRemaining(),label=pomoState.phase==="focus"?"专注":"休息";document.querySelector("#pomoTime").textContent=formatPomo(remaining);document.querySelector("#pomoPhase").textContent=pomoState.running?(pomoState.paused?`${label}已暂停`:label):"准备专注";document.querySelector("#pomoFloatTime").textContent=formatPomo(remaining);document.querySelector("#pomoFloatPhase").textContent=label;document.querySelector("#pomoFloat").hidden=!pomoState.running;document.querySelector("#pomoPause").hidden=!pomoState.running;document.querySelector("#pomoPause").textContent=pomoState.paused?"继续":"暂停";document.querySelector("#pomoStart").hidden=pomoState.running;const top=document.querySelector("#pomodoroBtn");top.classList.toggle("running",pomoState.running);document.querySelector("#pomodoroTopText").textContent=pomoState.running?formatPomo(remaining):"番茄钟";}
function ringPomo(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();[0,.22,.44].forEach(delay=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=880;gain.gain.setValueAtTime(.13,ctx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.16);osc.connect(gain).connect(ctx.destination);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+.17);});}catch{} if(navigator.vibrate)navigator.vibrate([180,100,180]);}
function pomoTick(){if(pomoState.running&&!pomoState.paused&&pomoRemaining()<=0){ringPomo();const wasFocus=pomoState.phase==="focus";pomoState.phase=wasFocus?"break":"focus";pomoState.remaining=(wasFocus?pomoState.rest:pomoState.focus)*60000;pomoState.endAt=Date.now()+pomoState.remaining;savePomodoro();toast(wasFocus?"专注完成，休息一下吧":"休息结束，开始下一轮专注");}updatePomoUI();}
function startPomo(){const focus=Math.min(180,Math.max(1,+document.querySelector("#focusMinutes").value||25)),rest=Math.min(60,Math.max(1,+document.querySelector("#breakMinutes").value||5));pomoState={focus,rest,phase:"focus",running:true,paused:false,remaining:focus*60000,endAt:Date.now()+focus*60000};savePomodoro();if(!pomoTimer)pomoTimer=setInterval(pomoTick,1000);updatePomoUI();pomodoroDialog.close();toast(`开始 ${focus} 分钟专注`);}
function pausePomo(){if(!pomoState.running)return;if(pomoState.paused){pomoState.paused=false;pomoState.endAt=Date.now()+pomoState.remaining;}else{pomoState.remaining=pomoRemaining();pomoState.paused=true;pomoState.endAt=null;}savePomodoro();updatePomoUI();}
function resetPomo(){pomoState={focus:+focusMinutes.value||25,rest:+breakMinutes.value||5,phase:"focus",running:false,paused:false,endAt:null,remaining:(+focusMinutes.value||25)*60000};savePomodoro();updatePomoUI();}
function openPomodoro(){focusMinutes.value=pomoState.focus;breakMinutes.value=pomoState.rest;updatePomoUI();pomodoroDialog.showModal();}
function openPracticePicker(mode,continueAt=false){pendingPractice={mode,continueAt};practiceDialogTitle.textContent=mode==="random"?"随机练习设置":"顺序练习设置";practiceCountWrap.hidden=mode!=="random";practiceDialog.showModal();}
function confirmPracticeStart(){const types=[...document.querySelectorAll('input[name="practiceType"]:checked')].map(x=>x.value);if(!types.length){toast("请至少选择一种题型");return;}let qs=BANK.filter(q=>types.includes(q.type));if(pendingPractice.mode==="random")qs=drawRandom(qs,+practiceCount.value);let start=0;if(pendingPractice.mode==="sequence"&&pendingPractice.continueAt){const lastId=BANK[Math.min(state.lastSequence,BANK.length-1)]?.id;const found=qs.findIndex(q=>q.id===lastId);start=found>=0?found:0;}practiceDialog.close();startPractice(pendingPractice.mode,qs,start);}

function mergeStates(local, remote) {
  if (!remote || typeof remote !== "object") return local;
  const merged = { questions: {}, days: {}, lastSequence: Math.max(local.lastSequence||0,remote.lastSequence||0), exams: [] };
  const ids = new Set([...Object.keys(local.questions||{}),...Object.keys(remote.questions||{})]);
  ids.forEach(id=>{
    const a=local.questions?.[id]||emptyProgress(),b=remote.questions?.[id]||emptyProgress();
    const newer=(a.lastAt||0)>=(b.lastAt||0)?a:b;
    merged.questions[id]={attempts:Math.max(a.attempts||0,b.attempts||0),correct:Math.max(a.correct||0,b.correct||0),wrong:Math.max(a.wrong||0,b.wrong||0),wrongStreak:newer.wrongStreak||0,recoveryStreak:newer.recoveryStreak||0,favorite:Boolean(newer.favorite),lastAnswer:newer.lastAnswer||null,lastAt:Math.max(a.lastAt||0,b.lastAt||0)||null};
  });
  for(const day of new Set([...Object.keys(local.days||{}),...Object.keys(remote.days||{})])){const a=local.days?.[day]||{},b=remote.days?.[day]||{};merged.days[day]={attempts:Math.max(a.attempts||0,b.attempts||0),correct:Math.max(a.correct||0,b.correct||0)};}
  const exams=[...(local.exams||[]),...(remote.exams||[])];merged.exams=exams.filter((x,i,arr)=>arr.findIndex(y=>y.date===x.date)===i).sort((a,b)=>b.date-a.date).slice(0,20);
  return merged;
}
function replaceState(next){Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,next);localStorage.setItem(STORE_KEY,JSON.stringify(state));refreshChrome();}
function scheduleCloudSync(){if(!window.CloudSync?.isSignedIn())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCloud(false),900);}
async function syncCloud(show=true){if(!navigator.onLine){if(show)toast("当前离线，联网后会自动同步");return;}try{const remote=await CloudSync.pull(),merged=mergeStates(state,remote);replaceState(merged);await CloudSync.push(merged);document.querySelector("#syncStatusText").textContent=`最近同步：${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;if(show)toast("学习记录已同步");}catch(e){if(show)toast(`同步失败：${authErrorMessage(e)}`);}}
async function checkCloudStatus(){const el=document.querySelector("#cloudStatus");if(!el||!window.CloudSync?.ping)return;el.hidden=false;el.textContent="正在检测云同步服务…";const result=await CloudSync.ping();if(result.ok){el.textContent="云同步服务可用。";el.classList.remove("is-down");}else{el.textContent=`云同步服务不可用（${result.host} 无法访问）。开 VPN 也连不上，需要到 Supabase 控制台查看项目是否暂停或删除。`;el.classList.add("is-down");}}
async function refreshAccount(){if(!window.CloudSync?.enabled)return;currentUser=await CloudSync.getUser();const btn=document.querySelector("#accountBtn");btn.classList.toggle("online",!!currentUser);document.querySelector("#accountText").textContent=currentUser?"已同步":"登录同步";document.querySelector("#authLoggedOut").hidden=!!currentUser;document.querySelector("#authLoggedIn").hidden=!currentUser;if(currentUser){document.querySelector("#signedEmail").textContent=currentUser.email||"已登录";await syncCloud(false);}}
function openAccount(){if(!window.CloudSync?.enabled){toast("当前是纯本地模式，记录只保存在本机。想跨设备同步，请在 config.js 填入自己的 Supabase 项目。");return;}authDialog.showModal();refreshAccount();checkCloudStatus();}
async function sendLoginCode(){const email=authEmail.value.trim();if(!email||!email.includes("@")){toast("请填写正确的邮箱");return;}sendCodeBtn.disabled=true;sendCodeBtn.textContent="正在发送…";try{await CloudSync.sendLoginLink(email);mailSentTip.hidden=false;sendCodeBtn.textContent="重新发送登录邮件";toast("登录邮件已经发送");}catch(e){toast(`发送失败：${authErrorMessage(e)}`);sendCodeBtn.textContent="发送登录邮件";}finally{sendCodeBtn.disabled=false;}}
function authErrorMessage(error){const message=String(error?.message||error||"");if(/invalid login credentials/i.test(message))return "邮箱或同步密码不正确";if(/rate limit|too many/i.test(message))return "操作太频繁，请稍后再试";if(/password.*at least|weak password/i.test(message))return "同步密码强度不足，请至少使用 8 位";if(/CLOUD_UNREACHABLE|failed to fetch|load failed|networkerror|network/i.test(message))return "云同步服务连不上。刷题网页本身是通的，但登录服务器已经失效（不是 VPN 没开）。各设备本地记录还在，跨设备同步需要先恢复 Supabase 项目。";return message||"未知错误";}
async function signInByPassword(){const email=document.querySelector("#authEmail").value.trim(),password=document.querySelector("#authPassword").value;if(!email||!email.includes("@")){toast("请填写正确的邮箱");return;}if(password.length<8){toast("同步密码至少 8 位");return;}const button=document.querySelector("#passwordLoginBtn");button.disabled=true;button.textContent="正在登录…";try{await CloudSync.signInWithPassword(email,password);document.querySelector("#authPassword").value="";await refreshAccount();if(!currentUser)throw new Error("登录状态确认失败，请检查网络后重试");toast("登录成功，学习记录已同步");}catch(e){toast(`登录失败：${authErrorMessage(e)}`);}finally{button.disabled=false;button.textContent="直接登录并同步";}}
async function saveSyncPassword(){const password=document.querySelector("#newSyncPassword").value,confirmation=document.querySelector("#confirmSyncPassword").value;if(password.length<8){toast("同步密码至少 8 位");return;}if(password!==confirmation){toast("两次输入的同步密码不一致");return;}const button=document.querySelector("#setPasswordBtn");button.disabled=true;button.textContent="正在设置…";try{await CloudSync.setPassword(password);document.querySelector("#newSyncPassword").value="";document.querySelector("#confirmSyncPassword").value="";toast("同步密码已设置，现在可以在主屏幕版直接登录");}catch(e){toast(`设置失败：${authErrorMessage(e)}`);}finally{button.disabled=false;button.textContent="设置 / 修改同步密码";}}
function signOutCloud(){CloudSync.signOut();currentUser=null;authDialog.close();refreshAccount();toast("已退出登录，本机记录仍会保留");}

function refreshChrome(){
  const m=mastery(), wrong=activeWrongs().length;
  const wrongBadge=document.querySelector("#navWrong");
  wrongBadge.textContent=wrong||"";
  wrongBadge.hidden=wrong===0;
  document.querySelector("#streakDays").textContent=streakDays();
  document.querySelector("#miniPercent").textContent=m+"%";
  document.querySelector("#miniRing").style.background=`conic-gradient(var(--lime) ${m}%,rgba(255,255,255,.15) 0)`;
}
function setTitle(title,eyebrow="人工智能训练师 · 三级"){
  document.querySelector("#pageTitle").textContent=title;document.querySelector("#pageEyebrow").textContent=eyebrow;
}
function setActive(view){ document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===view)); }

function renderHome(){
  stopTimer(); setTitle("今日学习");setActive("home");
  const done=practiced().length, correct=BANK.reduce((s,q)=>s+progress(q.id).correct,0), attempts=BANK.reduce((s,q)=>s+progress(q.id).attempts,0), m=mastery();
  const topics=[...new Set(BANK.map(q=>q.topic))];
  viewRoot.innerHTML=`
  <div class="hero"><article class="hero-main"><span class="tag">✦ 今日建议 · 20题</span><h2>${done ? "趁热打铁，把薄弱知识再练一遍" : "从第一道题开始，建立你的通关节奏"}</h2><p>${activeWrongs().length ? `还有 ${activeWrongs().length} 道错题等待巩固` : `${BANK.length}道三级理论题已准备好`}</p><button class="primary" data-action="continue">${done ? "继续上次练习 →" : "开始顺序练习 →"}</button></article>
  <aside class="hero-side"><h3>学习进度</h3><div class="progress-ring" style="background:conic-gradient(var(--green) ${m}%,#e8e8e0 0)"><div><strong>${m}%</strong><small>综合正确率</small></div></div><div class="metric-row"><div><strong>${done}</strong><small>已练题目</small></div><div><strong>${attempts}</strong><small>累计作答</small></div><div><strong>${activeWrongs().length}</strong><small>待巩固</small></div></div></aside></div>
  <div class="section-head"><div><h2>选择练习方式</h2><p>小步快跑，比一次刷很多更容易坚持</p></div></div>
  <button class="mode-card" data-view="changed" style="width:100%;margin-bottom:16px"><span class="mode-icon">↔</span><h3>答案变更专项 · ${CHANGED_BANK.length}题</h3><p>只练最新答案与旧版不同的题目，选题型、选数量、乱序循环</p></button><div class="mode-grid"><button class="mode-card" data-action="start-sequence"><span class="mode-icon">▤</span><h3>顺序练习</h3><p>从上次位置继续，完整覆盖全部${BANK.length}题</p></button><button class="mode-card" data-action="start-random"><span class="mode-icon">⌁</span><h3>随机20题</h3><p>打乱题型和章节，检查真实掌握程度</p></button><button class="mode-card" data-view="wrong"><span class="mode-icon">↻</span><h3>错题巩固</h3><p>${activeWrongs().length}道待巩固，连续答对2次后移出</p></button><button class="mode-card" data-action="start-exam"><span class="mode-icon">◷</span><h3>模拟考试</h3><p>限时作答，交卷后统一查看成绩</p></button></div>
  <div class="section-head"><div><h2>专项练习</h2><p>按知识模块查漏补缺</p></div></div><div class="topic-grid">${topics.map(topic=>{const qs=BANK.filter(q=>q.topic===topic),d=qs.filter(q=>progress(q.id).attempts).length,pc=Math.round(d/qs.length*100);return `<button class="topic-card" data-topic="${esc(topic)}"><span class="mode-icon">${topic.slice(0,1)}</span><span><strong>${esc(topic)}</strong><small>已练 ${d}/${qs.length}</small><span class="topic-bar"><i style="width:${pc}%"></i></span></span><span class="topic-number">${pc}%</span></button>`}).join("")}</div>`;
}

function startPractice(mode, customQuestions=null, startIndex=0, typeFilter="all"){
  stopTimer(); let qs;
  if(customQuestions) qs=customQuestions;
  else if(mode==="sequence") qs=BANK;
  else if(mode==="random") qs=drawRandom(BANK,20);
  else if(mode==="wrong") qs=shuffle(activeWrongs().filter(q=>typeFilter==="all"||q.type===typeFilter));
  else if(mode==="favorite") qs=BANK.filter(q=>progress(q.id).favorite && (typeFilter==="all"||q.type===typeFilter));
  if(!qs.length){toast(mode==="wrong"?"目前没有待巩固错题":"这里还没有题目");return;}
  session={mode,questions:qs,index:Math.min(startIndex,qs.length-1),selected:[],submitted:false,answers:{},startedAt:Date.now(),exam:false};
  setTitle(mode==="wrong"?"错题巩固":mode==="random"?"随机练习":mode==="favorite"?"收藏练习":"顺序练习","专注模式");setActive("");renderQuestion();
}
function startExam(count,minutes){
  const qs=drawRandom(BANK,count);
  session={mode:"exam",questions:qs,index:0,selected:[],submitted:false,answers:{},startedAt:Date.now(),exam:true,endAt:Date.now()+minutes*60000};
  setTitle("模拟考试","限时作答 · 交卷后公布答案");setActive("");renderQuestion();examTimer=setInterval(updateTimer,1000);updateTimer();
}
function renderQuestion(){
  const q=session.questions[session.index], p=progress(q.id), saved=session.answers[q.id];if(saved)session.selected=[...saved];session.submitted=!session.exam&&!!saved;
  const pct=Math.round((session.index+1)/session.questions.length*100);
  viewRoot.innerHTML=`<div class="practice-wrap"><div class="practice-head"><button class="back-button" data-action="exit-practice">←</button><div class="practice-progress"><small><span>${session.index+1} / ${session.questions.length}</span><span>${session.exam?'<b class="timer" id="timer">--:--</b>':TYPE_NAME[q.type]}</span></small><div><i style="width:${pct}%"></i></div></div></div>
  <article class="question-card"><div class="question-meta"><span class="pill">${TYPE_NAME[q.type]}</span><span>${esc(q.topic)}</span><span>原题第 ${q.number} 题</span><button class="favorite-btn ${p.favorite?'on':''}" data-action="favorite">${p.favorite?'★':'☆'}</button></div><div class="question-stem">${esc(q.stem)}</div><div class="options">${q.options.map(o=>`<button class="option ${optionClass(q,o.key)}" data-option="${o.key}" ${session.submitted?'disabled':''}><span class="option-key">${o.key}</span><span>${esc(o.text)}</span></button>`).join("")}</div>
  <div class="feedback ${session.submitted?'show':''} ${session.submitted&&!answerEqual(saved,q.answer)?'wrong':''}">${session.submitted?feedbackHtml(q,saved):''}</div><div class="question-actions"><button class="ghost" data-action="grid">题目列表</button>${actionButton(q)}</div></article></div>`;
  if(session.exam) updateTimer();
}
function optionClass(q,key){const chosen=session.selected.includes(key);if(!session.submitted)return chosen?"selected":"";if(q.answer.includes(key))return "correct";if(chosen)return "wrong";return "";}
function feedbackHtml(q,ans){const ok=answerEqual(ans||[],q.answer);return `<strong>${ok?'回答正确':'回答错误'}</strong><p>正确答案：${q.answer.join("、")} ${!ok?` · 你的答案：${(ans||[]).join("、")||"未作答"}`:""}</p>${q.previousAnswer?`<p>旧版答案：${q.previousAnswer.join("、")} → 最新答案：${q.answer.join("、")}</p>`:""}${q.explanation?`<p>${esc(q.explanation)}</p>`:""}`;}
function actionButton(q){if(session.exam)return session.index===session.questions.length-1?`<button class="primary" data-action="submit-exam">交卷</button>`:`<button class="primary" data-action="next">下一题 →</button>`;if(q.type==="multi"&&!session.submitted)return `<button class="primary" data-action="submit-answer" ${session.selected.length?'':'disabled'}>确认答案</button>`;if(session.submitted)return `<button class="primary" data-action="next">${session.index===session.questions.length-1?'完成练习':'下一题 →'}</button>`;return `<span></span>`;}
function selectOption(key){
  const q=session.questions[session.index]; if(session.submitted)return;
  if(q.type==="multi"){session.selected=session.selected.includes(key)?session.selected.filter(x=>x!==key):[...session.selected,key];renderQuestion();}
  else{session.selected=[key]; if(session.exam){session.answers[q.id]=[key];renderQuestion();}else submitAnswer();}
}
function submitAnswer(){
  const q=session.questions[session.index];if(!session.selected.length)return;
  session.answers[q.id]=[...session.selected];session.submitted=true;
  const ok=answerEqual(session.selected,q.answer),p=progress(q.id);p.attempts++;p.lastAnswer=[...session.selected];p.lastAt=Date.now();
  if(ok){p.correct++;p.wrongStreak=0;if(p.wrong>0)p.recoveryStreak++;}else{p.wrong++;p.wrongStreak++;p.recoveryStreak=0;}
  const day=state.days[today()]||(state.days[today()]={attempts:0,correct:0});day.attempts++;if(ok)day.correct++;
  if(session.mode==="sequence")state.lastSequence=session.index;saveState();renderQuestion();
}
function nextQuestion(){
  const q=session.questions[session.index];
  if(session.exam&&session.selected.length)session.answers[q.id]=[...session.selected];
  if(session.index>=session.questions.length-1){if(session.exam)submitExam();else if(session.mode==="changed"&&changedSettings?.loop){changedSettings.round++;startChangedRound();toast("本轮完成，开始下一轮乱序练习");}else{toast("本组练习完成");if(session.mode==="changed")renderChanged();else renderHome();}return;}
  session.index++;session.selected=[];session.submitted=false;renderQuestion();
}
function submitExam(){
  if(!confirm(`还有 ${session.questions.length-Object.keys(session.answers).length} 道题未作答，确定交卷吗？`))return;
  stopTimer();let correct=0;
  session.questions.forEach(q=>{const ans=session.answers[q.id]||[],ok=answerEqual(ans,q.answer),p=progress(q.id);p.attempts++;p.lastAnswer=ans;p.lastAt=Date.now();if(ok){correct++;p.correct++;p.wrongStreak=0;if(p.wrong>0)p.recoveryStreak++;}else{p.wrong++;p.wrongStreak++;p.recoveryStreak=0;}const day=state.days[today()]||(state.days[today()]={attempts:0,correct:0});day.attempts++;if(ok)day.correct++;});
  const result={date:Date.now(),total:session.questions.length,correct,ids:session.questions.map(q=>q.id)};state.exams.unshift(result);state.exams=state.exams.slice(0,20);saveState();
  const score=Math.round(correct/session.questions.length*100);setTitle("考试结果","本次模拟已完成");viewRoot.innerHTML=`<div class="exam-result"><p class="eyebrow">模拟考试成绩</p><div class="score">${score}<small>分</small></div><h2>${score>=80?'状态不错，继续保持':score>=60?'基础合格，重点回看错题':'先巩固错题，再进行下一次模拟'}</h2><div class="result-grid"><div><strong>${correct}</strong><small>答对</small></div><div><strong>${session.questions.length-correct}</strong><small>答错/未答</small></div><div><strong>${Math.round((Date.now()-session.startedAt)/60000)}分钟</strong><small>用时</small></div></div><button class="primary" data-view="wrong">进入错题巩固</button> <button class="secondary" data-view="home">返回首页</button></div>`;
}
function updateTimer(){if(!session?.exam)return;const left=Math.max(0,session.endAt-Date.now()),el=document.querySelector("#timer");if(el)el.textContent=`${String(Math.floor(left/60000)).padStart(2,"0")}:${String(Math.floor(left/1000)%60).padStart(2,"0")}`;if(left<=0){stopTimer();submitExam();}}
function stopTimer(){if(examTimer){clearInterval(examTimer);examTimer=null;}}

function renderList(kind,filter="all"){
  stopTimer(); const base=kind==="wrong"?activeWrongs():BANK.filter(q=>progress(q.id).favorite);let qs=filter==="all"?base:base.filter(q=>q.type===filter);
  setTitle(kind==="wrong"?"错题巩固":"我的收藏",kind==="wrong"?"连续答对两次后标记为已巩固":"随时回看重点题目");setActive(kind);
  viewRoot.innerHTML=`<div class="section-head"><div><h2>${kind==="wrong"?`${base.length} 道待巩固错题`:`${base.length} 道收藏题`}</h2><p>${kind==="wrong"?'重复错误会持续累计，优先显示高频错题':'你主动标记的重点内容'}</p></div>${base.length?`<button class="primary" data-action="practice-list" data-kind="${kind}" data-filter="${filter}">开始练习</button>`:''}</div><div class="list-toolbar">${[["all","全部"],["tf","判断题"],["single","单选题"],["multi","多选题"]].map(([v,n])=>`<button class="filter-btn ${filter===v?'active':''}" data-filter="${v}" data-kind="${kind}">${n}</button>`).join("")}</div>${qs.length?`<div class="question-list">${qs.sort((a,b)=>progress(b.id).wrong-progress(a.id).wrong).map(q=>`<div class="list-row" data-open-question="${q.id}" data-kind="${kind}"><span class="list-index">${TYPE_NAME[q.type]}</span><p>${esc(q.stem)}</p><span class="wrong-badge">${kind==="wrong"?`错 ${progress(q.id).wrong} 次`:'已收藏'}</span></div>`).join("")}</div>`:`<div class="empty"><span>${kind==="wrong"?'✓':'☆'}</span><h3>${kind==="wrong"?'暂时没有待巩固错题':'还没有收藏题目'}</h3><p>${kind==="wrong"?'继续刷题，答错的题会自动出现在这里':'刷题时点击右上角星标即可收藏'}</p></div>`}`;
}
function renderStats(){
  stopTimer();setTitle("学习统计","看见积累，也看清薄弱点");setActive("stats");const attempts=BANK.reduce((s,q)=>s+progress(q.id).attempts,0),correct=BANK.reduce((s,q)=>s+progress(q.id).correct,0),wrong=BANK.reduce((s,q)=>s+progress(q.id).wrong,0),topics=[...new Set(BANK.map(q=>q.topic))];
  viewRoot.innerHTML=`<div class="stats-grid"><div class="stat-card"><small>已覆盖题目</small><strong>${practiced().length}<small> / ${BANK.length}</small></strong></div><div class="stat-card"><small>累计作答</small><strong>${attempts}</strong></div><div class="stat-card"><small>整体正确率</small><strong>${attempts?Math.round(correct/attempts*100):0}%</strong></div><div class="stat-card"><small>累计错误</small><strong>${wrong}</strong></div></div><div class="chart-card"><div class="section-head"><div><h2>知识模块掌握度</h2><p>按所有历史作答计算</p></div></div>${topics.map(t=>{const qs=BANK.filter(q=>q.topic===t),a=qs.reduce((s,q)=>s+progress(q.id).attempts,0),c=qs.reduce((s,q)=>s+progress(q.id).correct,0),pc=a?Math.round(c/a*100):0;return `<div class="topic-stat"><span>${esc(t)}</span><span class="bar"><i style="width:${pc}%"></i></span><b>${pc}%</b></div>`}).join("")}</div><div class="chart-card"><h3>学习数据备份</h3><p style="color:var(--muted);font-size:12px">在电脑和 iPad 之间迁移进度时，可导出后在另一台设备导入。</p><button class="secondary" data-action="export">导出进度</button> <label class="secondary" style="display:inline-block;cursor:pointer">导入进度<input type="file" id="importFile" accept="application/json" hidden></label><div class="danger-zone"><button class="danger" data-action="reset">清空全部学习记录</button></div></div>`;
}
function exportProgress(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`AI训练师三级学习进度-${today()}.json`;a.click();URL.revokeObjectURL(a.href);}
function importProgress(file){const r=new FileReader();r.onload=()=>{try{const v=JSON.parse(r.result);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,v);saveState();renderStats();toast("进度导入成功");}catch{toast("文件格式不正确");}};r.readAsText(file);}
function showSearch(){searchDialog.showModal();searchInput.value="";searchResults.innerHTML=`<div class="empty"><p>输入关键词搜索${BANK.length}道题</p></div>`;setTimeout(()=>searchInput.focus(),100);}
function doSearch(term){term=term.trim().toLowerCase();const hits=term?BANK.filter(q=>(q.stem+q.options.map(o=>o.text).join(" ")).toLowerCase().includes(term)).slice(0,100):[];searchResults.innerHTML=hits.length?hits.map(q=>`<div class="search-hit" data-search-id="${q.id}"><small>${TYPE_NAME[q.type]} · ${esc(q.topic)}</small><p>${esc(q.stem)}</p></div>`).join(""):'<div class="empty"><p>没有找到相关题目</p></div>';}

document.addEventListener("click",e=>{
  const target=e.target.closest("button,[data-topic],[data-open-question],[data-search-id]");if(!target)return;
  if(target.dataset.view){if(target.dataset.view==="home")renderHome();else if(target.dataset.view==="wrong"||target.dataset.view==="favorite")renderList(target.dataset.view);else if(target.dataset.view==="stats")renderStats();else if(target.dataset.view==="changed")renderChanged();return;}
  const a=target.dataset.action;
  if(a==="start-changed"){startChanged();return;}
  if(a==="start-sequence"||a==="continue")openPracticePicker("sequence",a==="continue");
  else if(a==="start-random")openPracticePicker("random");else if(a==="start-exam")examDialog.showModal();
  else if(a==="exit-practice"){if(session?.exam&&!confirm("确定退出本次模拟考试吗？"))return;renderHome();}
  else if(a==="favorite"){const q=session.questions[session.index],p=progress(q.id);p.favorite=!p.favorite;p.lastAt=Date.now();saveState();renderQuestion();toast(p.favorite?"已加入收藏":"已取消收藏");}
  else if(a==="submit-answer")submitAnswer();else if(a==="next")nextQuestion();else if(a==="submit-exam")submitExam();
  else if(a==="practice-list"){startPractice(target.dataset.kind,null,0,target.dataset.filter||"all");}
  else if(a==="export")exportProgress();else if(a==="reset"&&confirm("确定清空全部作答、错题和收藏记录吗？此操作无法撤销。")){localStorage.removeItem(STORE_KEY);location.reload();}
  else if(target.dataset.option)selectOption(target.dataset.option);
  else if(target.dataset.topic){const qs=BANK.filter(q=>q.topic===target.dataset.topic);startPractice("topic",qs);setTitle(target.dataset.topic,"专项练习");}
  else if(target.dataset.filter)renderList(target.dataset.kind,target.dataset.filter);
  else if(target.dataset.openQuestion){const q=BANK.find(x=>x.id===target.dataset.openQuestion);startPractice(target.dataset.kind,[q]);}
  else if(target.dataset.searchId){searchDialog.close();const q=BANK.find(x=>x.id===target.dataset.searchId);startPractice("search",[q]);}
});
document.querySelector("#searchBtn").addEventListener("click",showSearch);
document.querySelector("#pomodoroBtn").addEventListener("click",openPomodoro);
document.querySelector("#pomoFloat").addEventListener("click",openPomodoro);
document.querySelector("#confirmPractice").addEventListener("click",confirmPracticeStart);
document.querySelector("#pomoStart").addEventListener("click",startPomo);
document.querySelector("#pomoPause").addEventListener("click",pausePomo);
document.querySelector("#pomoReset").addEventListener("click",resetPomo);
document.querySelectorAll("[data-preset]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-preset]").forEach(x=>x.classList.remove("active"));button.classList.add("active");const [focus,rest]=button.dataset.preset.split(",");focusMinutes.value=focus;breakMinutes.value=rest;if(!pomoState.running){pomoState.focus=+focus;pomoState.rest=+rest;pomoState.remaining=+focus*60000;updatePomoUI();}}));
document.querySelector("#accountBtn").addEventListener("click",openAccount);
document.querySelector("#sendCodeBtn").addEventListener("click",sendLoginCode);
document.querySelector("#passwordLoginBtn").addEventListener("click",signInByPassword);
document.querySelector("#setPasswordBtn").addEventListener("click",saveSyncPassword);
document.querySelector("#authPassword").addEventListener("keydown",e=>{if(e.key==="Enter")signInByPassword();});
document.querySelector("#syncNowBtn").addEventListener("click",()=>syncCloud(true));
document.querySelector("#signOutBtn").addEventListener("click",signOutCloud);
document.querySelector("#searchInput").addEventListener("input",e=>doSearch(e.target.value));
document.querySelector("#confirmExam").addEventListener("click",()=>{examDialog.close();startExam(+examCount.value,+examMinutes.value);});
document.addEventListener("change",e=>{if(e.target.id==="importFile"&&e.target.files[0])importProgress(e.target.files[0]);});
window.addEventListener("beforeunload",e=>{if(session?.exam){e.preventDefault();e.returnValue="";}});
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./service-worker.js");
window.addEventListener("online",()=>syncCloud(false));
if(pomoState.running)pomoTimer=setInterval(pomoTick,1000);
if(!window.CloudSync?.enabled){const b=document.querySelector("#accountBtn");if(b){b.style.display="none";b.title="纯本地模式";}}
refreshChrome();renderHome();refreshAccount();updatePomoUI();
