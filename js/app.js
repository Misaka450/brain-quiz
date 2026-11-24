(function(r){'use strict';r.BrainLab=r.BrainLab||{};
const $=id=>document.getElementById(id),cfg=()=>r.BrainLab.CONFIG,bank=()=>r.BrainLab.QUESTIONS,eng=()=>r.BrainLab.Engine,auth=()=>r.BrainLab.Auth,trk=()=>r.BrainLab.Tracker,pst=()=>r.BrainLab.Poster;
const st={code:null,nonce:'LAB0',anchor:'',sid:'',att:1,rec:new Set(),s1:[],hist:[],rev:{},stage:1,lock:false,rep:null,no:''};
let qm;const gQM=()=>qm||(qm=Object.fromEntries(bank().map(q=>[q.id,q])));
const jGet=(k,fb)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?fb:v;}catch{return fb;}};
const jSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
const rRec=()=>{const p=jGet(cfg().STORAGE_KEYS.recentRuns,null);return!p?{attemptCount:0,runs:[]}:Array.isArray(p)?{attemptCount:p.length,runs:p}:{attemptCount:+p.attemptCount||0,runs:Array.isArray(p.runs)?p.runs:[]};};
function pRec(ids){const c=rRec();c.attemptCount++;c.runs.push(ids);while(c.runs.length>cfg().RECENT_RUN_WINDOW)c.runs.shift();jSet(cfg().STORAGE_KEYS.recentRuns,c);return c;}
const toSet=rs=>new Set((rs.runs||[]).flat());
const saveD=()=>jSet(cfg().STORAGE_KEYS.draft,{version:cfg().VERSION,unlockedCode:st.code,unlockedNonce:st.nonce,anchorKey:st.anchor,sessionId:st.sid,attemptIndex:st.att,history:st.hist});
const clrD=()=>{try{localStorage.removeItem(cfg().STORAGE_KEYS.draft);}catch{}};
function loadD(){const p=jGet(cfg().STORAGE_KEYS.draft,null);if(!p||p.version!==cfg().VERSION||!Array.isArray(p.history)){clrD();return null;}return p;}
const resA=h=>h.map(x=>({item:gQM()[x.qId],selectedIndex:x.selectedIndex})).filter(x=>x.item);
const mkNo=n=>{const d=new Date();return`NO.${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${n||'LAB0'}`;};
function show(id){
  ['view-cover','view-quiz','view-loading','view-result'].forEach(v=>{$(v).hidden=v!==id;});
  $('site-footer').hidden=(id==='view-quiz'||id==='view-loading');
  if(id!=='view-quiz'){const t=$('stage-toast');if(t){clearTimeout(t._t);t.hidden=true;}}
  window.scrollTo(0,0);
}
function toast(t){const e=$('stage-toast');e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true;},3200);}
const FS='a[href],button:not([disabled]),input:not([disabled]),[tabindex]';
const gateIsOpen=()=>Boolean($('modal-gate')&&!$('modal-gate').hidden);
const isUnlocked=()=>Boolean(st.code&&auth().verifyLocalHmac(st.code).valid);
const gateFoc=()=>Array.from($('modal-gate').querySelectorAll('input:not([disabled]),button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(e=>!e.closest('[hidden]'));
function setInert(on){
  const am=$('app-main');if(!am)return;
  am.inert=on;am.classList.toggle('is-inert',on);
  if(on){am.setAttribute('inert','');am.setAttribute('aria-hidden','true');am.querySelectorAll(FS).forEach(e=>{if(e.dataset.pt===undefined)e.dataset.pt=e.hasAttribute('tabindex')?e.getAttribute('tabindex'):'_';e.setAttribute('tabindex','-1');});}
  else{am.removeAttribute('inert');am.removeAttribute('aria-hidden');am.querySelectorAll('[data-pt]').forEach(e=>{const p=e.dataset.pt;p==='_'?e.removeAttribute('tabindex'):e.setAttribute('tabindex',p);delete e.dataset.pt;});}
}
function openGate(pre){
  const m=$('modal-gate'),hk=$('gate-dynamic-hook'),er=$('gate-error'),was=gateIsOpen();er.hidden=true;er.textContent='';
  if(pre)hk.textContent='本测评采用 50 题正交自适应题库。输入专属测评码，开启四维认知扫描与完整上岸剧本。';
  else if(!was){
    const u4=eng().computeNormalizedScores(resA(st.hist.slice(0,cfg().FREE_PREVIEW_COUNT))),ex=eng().getLeadAndWeakDims(u4),lb=cfg().OFFLINE_COHORT_PARAMS.dimActionLabels;
    hk.innerHTML=`阶段 I 初筛完成：已捕捉到突出的<strong>【${lb[ex.topDim]}】</strong>锋芒，但在<strong>【${lb[ex.weakDim]}】</strong>维度检出隐蔽内耗盲区（当前档案收敛度 28%）。输入专属测评码，开启靶向追问解锁完整上岸剧本。`;
    trk().track('preview_gate_reached',{freeCount:cfg().FREE_PREVIEW_COUNT,leadDim:ex.topDim,weakDim:ex.weakDim});
  }
  const ae=document.activeElement;if(ae&&!m.contains(ae)&&ae.blur)ae.blur();
  setInert(true);m.hidden=false;m.setAttribute('aria-hidden','false');
  const inp=$('input-code');inp.focus();setTimeout(()=>{if(gateIsOpen()&&!m.contains(document.activeElement))inp.focus();},60);
}
const closeGate=()=>{const m=$('modal-gate');m.hidden=true;m.setAttribute('aria-hidden','true');setInert(false);};
function renderCard(q,seqNum,step,selIdx){
  const [lbT,pct,al]=pMeta(step),lb=$('quiz-stage-label'),pf=$('quiz-progress-fill');
  lb.textContent=lbT;lb.classList.toggle('is-alert',al);
  $('quiz-convergence-pct').textContent=`档案收敛度 ${pct}%`;pf.style.width=pct+'%';pf.classList.toggle('is-alert',al);
  $('quiz-seq-tag').textContent='CASE '+String(seqNum).padStart(2,'0');
  $('quiz-scene-tag').textContent=q.sceneTag;$('quiz-stem').textContent=q.stem;$('btn-prev-q').disabled=!st.hist.length;
  const w=$('quiz-options');w.innerHTML='';
  q.options.forEach((o,i)=>{
    const b=document.createElement('button');b.type='button';b.className='option-btn'+(selIdx===i?' is-selected':(st.rev[q.id]===i?' is-revisit':''));b.dataset.idx=i;b.dataset.qid=q.id;
    b.innerHTML=`<span class="option-key">${o.key}</span><span class="option-text"></span>`;b.lastChild.textContent=o.text;
    b.onclick=()=>onPick(q,i,b);w.appendChild(b);
  });
  show('view-quiz');
}
function pMeta(s){
  const n=s.nOrth||0;
  if(s.stage===1)return['阶段 I · 全维基线扫描',Math.min(48,Math.max(10,Math.round(10+n/7*38))),false];
  if(s.stage===2)return['阶段 II · 双维修罗场追问',Math.min(85,Math.max(54,Math.round(54+(n-8)/6*31))),false];
  if(s.stage===3)return[`阶段 III · 双核高敏博弈决胜（至多剩 ${19-n+1} 题）`,Math.min(95,89+(n-15)*2),true];
  return['终局章 · 认知底牌校准（最后 1 题）',98,true];
}
function renderQ(){
  const ans=resA(st.hist),step=eng().selectNextOrStop(ans,st.s1,bank(),st.anchor,st.att,st.rec,{unlocked:isUnlocked(),enforceGate:true});
  if(step.blocked){const last=ans[ans.length-1];if(last)renderCard(last.item,ans.length,{stage:1,nOrth:ans.length-1},last.selectedIndex);openGate(ans.length===0);return;}
  if(step.stop){finish(ans);return;}
  if(step.stage>st.stage){
    st.stage=step.stage;trk().track('stage_transition',{stage:step.stage,answeredCount:ans.length});
    const m={2:'已锁定主导象限，切入阶段 II · 双维修罗场追问',3:'双核逼近边界，启动阶段 III 高敏博弈决胜',4:'四维已收敛，进入终局底牌校准（最后 1 题）'}[step.stage];
    if(m)toast(m);
  }
  renderCard(step.nextItem,st.hist.length+1,step,-1);
  if(gateIsOpen())setInert(true);
}
function onPick(q,i,b){
  if(st.lock||gateIsOpen())return;
  const sub=eng().submitAnswer(st.hist,{qId:q.id,selectedIndex:i},{unlocked:isUnlocked(),gateOpen:gateIsOpen()});
  if(!sub.accepted){openGate(st.hist.length===0);return;}
  st.lock=true;
  document.querySelectorAll('#quiz-options .option-btn').forEach(x=>x.classList.remove('is-selected','is-revisit'));b.classList.add('is-selected');
  st.hist=sub.history;delete st.rev[q.id];saveD();
  if(q.tier==='special'){$('quiz-convergence-pct').textContent='档案收敛度 100%';$('quiz-progress-fill').style.width='100%';}
  setTimeout(()=>{st.lock=false;if(sub.gateRequired){openGate(false);return;}renderQ();},220);
}
function onPrev(){
  if(st.lock||gateIsOpen()||!st.hist.length)return;const p=st.hist.pop();st.rev[p.qId]=p.selectedIndex;saveD();
  const n=st.hist.length;st.stage=n<cfg().STAGE1_CORE_COUNT?1:(n<cfg().MIN_ORTH_COUNT?2:3);renderQ();
}
function finish(ans){
  const un=isUnlocked();if(!un&&ans.length>cfg().FREE_PREVIEW_COUNT){openGate(false);return;}
  const rep=eng().evaluateQuiz(ans,{unlocked:un,enforceGate:true});st.rep=rep;st.no=mkNo(st.nonce);clrD();
  st.rec=toSet(pRec(ans.map(x=>x.item.id)));
  trk().track('quiz_complete',{answeredCount:rep.answeredCount,orthCount:rep.orthCount,stoppedEarly:rep.stoppedEarly,primaryId:rep.primaryArchetype.id,secondaryId:rep.secondaryArchetype.id,metaCode:rep.metaCode,isSsrVariant:rep.isSsrVariant});
  show('view-loading');const tx=$('loading-status-text'),ms=cfg().LOADING_RITUAL_MS;
  tx.textContent='正在校准四维正交权重矩阵…';
  setTimeout(()=>{tx.textContent='正在比对 12 原型球面余弦夹角…';},ms*.35);
  setTimeout(()=>{tx.textContent='正在封存处世底色钢印与离线分位档案…';},ms*.7);
  setTimeout(()=>{renderRes(rep);show('view-result');},ms);
}
function renderRes(rep){
  const a=rep.primaryArchetype,p=cfg().OFFLINE_COHORT_PARAMS,tp=rep.percentiles[rep.topDim];
  const rb=$('res-rarity-badge');rb.textContent=rep.displayRarityBadge;rb.classList.toggle('is-ssr',rep.isSsrVariant);
  [['res-archive-no',st.no],['res-ask-summary',`本次自适应实答 ${rep.answeredCount} 题（含终局底牌校准）`],['res-title',a.title],['res-subtitle',a.subtitle],
   ['res-secondary-title',rep.secondaryArchetype.title],['res-meta-badge',`【${rep.metaPersona.badge}】`],['res-meta-desc',rep.metaPersona.desc],
   ['res-quote',`“${a.quote}”`],['res-top-pct',tp.toFixed(1)+'%'],['res-top-desc',`你的${p.dimActionLabels[rep.topDim]}超越 ${tp.toFixed(1)}% 参与者`],
   ['res-strength',a.deepAnalysis.strength],['res-blindspot',a.deepAnalysis.blindspot],['res-career',a.deepAnalysis.careerTrack],
   ['res-partner-title',rep.bestPartner.title],['res-partner-sub',rep.bestPartner.subtitle],['res-nemesis-title',rep.nemesis.title],['res-nemesis-sub',rep.nemesis.subtitle]
  ].forEach(([id,v])=>{$(id).textContent=v;});
  $('res-seal-grid').innerHTML=Array.from(a.sealShort).map(c=>`<span>${c}</span>`).join('');
  $('res-radar-wrap').innerHTML=eng().renderRadarSvg(rep.scoresNorm);
  $('res-dim-bars').innerHTML=['V','L','Q','D'].map(k=>{const pc=rep.percentiles[k];return`<div class="metric-row${k===rep.topDim?' is-lead':''}"><div class="metric-head"><span class="metric-name">${k} · ${p.dimShortLabels[k]} <em>(${rep.scoresDisplay[k]}分)</em></span><span class="metric-pct">超越 ${pc.toFixed(1)}%</span></div><div class="metric-track"><div class="metric-fill" style="width:${pc.toFixed(1)}%"></div></div></div>`;}).join('');
  $('res-quadrant-list').innerHTML=a.quadrantFit.map(f=>`<div class="fit-row"><span class="fit-role">${f.role}</span><span class="fit-dots"></span><span class="fit-pct">${f.fitPct}% 适配</span></div>`).join('');
}
function startNew(o={}){
  const rs=rRec();st.rec=toSet(rs);st.att=rs.attemptCount+1;st.sid=trk().getSessionId();st.hist=[];st.rev={};st.stage=1;st.rep=null;
  if(!o.keepUnlock){st.code=null;st.nonce='LAB0';}
  st.anchor=st.code||('ANON-'+st.sid);st.s1=eng().buildStage1Queue(bank(),st.anchor,st.att,st.rec);saveD();
  trk().track('quiz_start',{attemptIndex:st.att,unlocked:Boolean(st.code),recentCount:st.rec.size});
  if(cfg().AUTH_MODE==='gate_first'&&!st.code){openGate(true);return;}renderQ();
}
function init(){
  $('btn-start-quiz').onclick=()=>startNew({keepUnlock:Boolean(st.code)});
  $('btn-prev-q').onclick=onPrev;
  $('btn-reset-draft').onclick=()=>{clrD();st.hist=[];show('view-cover');};
  $('btn-gate-back').onclick=()=>{closeGate();if(st.hist.length)onPrev();else show('view-cover');};
  document.addEventListener('keydown',e=>{
    if(!gateIsOpen())return;
    const m=$('modal-gate'),fs=gateFoc();
    if(e.key==='Tab'){e.preventDefault();if(!fs.length)return;const i=fs.indexOf(document.activeElement);fs[e.shiftKey?(i<=0?fs.length-1:i-1):(i<0||i>=fs.length-1?0:i+1)].focus();return;}
    if(!m.contains(e.target)){if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'||e.key.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation();}if(fs[0])fs[0].focus();}
  },true);
  document.addEventListener('focusin',e=>{if(gateIsOpen()&&!$('modal-gate').contains(e.target)){const fs=gateFoc();if(fs[0])fs[0].focus();}},true);
  $('gate-form').onsubmit=e=>{
    e.preventDefault();const raw=$('input-code').value||'',er=$('gate-error'),bt=$('btn-unlock-submit');bt.disabled=true;
    trk().track('code_submit',{length:raw.trim().length});
    auth().verifyCode(raw,{consume:true}).then(x=>{
      bt.disabled=false;
      if(!x.valid){trk().track('code_unlock_fail',{reason:x.reason});er.textContent=x.message;er.hidden=false;return;}
      st.code=x.code;st.nonce=x.nonce;saveD();trk().track('code_unlock_ok',{prefix:x.prefix,usedCount:x.usedCount});closeGate();renderQ();
    });
  };
  $('btn-open-poster').onclick=()=>{if(!st.rep)return;trk().track('poster_open',{primaryId:st.rep.primaryArchetype.id,metaCode:st.rep.metaCode,isSsrVariant:st.rep.isSsrVariant});pst().openPosterModal(st.rep,st.no);};
  $('btn-close-poster').onclick=pst().closePosterModal;
  $('modal-poster').onclick=e=>{if(e.target.id==='modal-poster')pst().closePosterModal();};
  $('btn-retest').onclick=()=>{clrD();if(st.code)auth().verifyCode(st.code,{consume:true}).then(x=>startNew({keepUnlock:x.valid}));else startNew();};
  document.querySelectorAll('[data-action="export-events"]').forEach(el=>{el.onclick=()=>{trk().exportEventsJson();toast('本地埋点日志 JSON 已导出');};});
  trk().track('page_view',{mode:cfg().AUTH_MODE});
  const rs=rRec();st.rec=toSet(rs);const d=loadD();
  auth().trySilentUnlockFromUrl(d&&d.unlockedCode).then(u=>{
    const bn=$('cover-unlock-banner');
    if(u.attempted&&u.valid){st.code=u.code;st.nonce=u.nonce;if(!u.reused)trk().track('code_unlock_ok',{prefix:u.prefix,source:'url_silent'});bn.textContent=`专属测评码 ${u.code} 已自动核销，全程免门禁直达完整档案`;bn.hidden=false;}
    else if(u.attempted&&!u.valid){trk().track('code_unlock_fail',{reason:u.reason,source:'url_silent'});bn.textContent='链接测评码未通过校验：'+u.message;bn.classList.add('is-warn');bn.hidden=false;}
    if(d&&d.history.length){
      st.code=st.code||d.unlockedCode||null;st.nonce=(st.code&&d.unlockedNonce)?d.unlockedNonce:(st.nonce||'LAB0');
      if(st.code&&!auth().verifyLocalHmac(st.code).valid){st.code=null;st.nonce='LAB0';}
      st.anchor=d.anchorKey||st.code||('ANON-'+trk().getSessionId());st.sid=d.sessionId||trk().getSessionId();st.att=d.attemptIndex||(rs.attemptCount+1);st.hist=d.history;
      st.s1=eng().buildStage1Queue(bank(),st.anchor,st.att,st.rec);
      if(cfg().AUTH_MODE==='free_preview_4'&&!isUnlocked()&&st.hist.length>=cfg().FREE_PREVIEW_COUNT){st.hist=st.hist.slice(0,cfg().FREE_PREVIEW_COUNT);saveD();renderQ();}
      else{renderQ();toast(`已自动恢复至第 ${st.hist.length+1} 题断点进度`);}
      return;
    }
    show('view-cover');
  });
}
r.BrainLab.App={init,getState:()=>st,startNewSession:startNew};
if(typeof document!=='undefined'){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();}
})(typeof window!=='undefined'?window:globalThis);
