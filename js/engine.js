/* 分位百分比基于 50 题池正交权重矩阵极值与 OFFLINE_COHORT_MODEL_V1_5 固定常模分布参数本地确定性推算，无远程统计请求 */
(function(r){'use strict';r.BrainLab=r.BrainLab||{};
const cfg=()=>r.BrainLab.CONFIG||require('./config.js'),archs=()=>r.BrainLab.ARCHETYPES||require('./archetypes.js');
const DI={V:0,L:1,Q:2,D:3},M0=1300/24;
const PAIRS=[{tag:'VL',a:0,b:1},{tag:'VQ',a:0,b:2},{tag:'VD',a:0,b:3},{tag:'LQ',a:1,b:2},{tag:'LD',a:1,b:3},{tag:'QD',a:2,b:3}];
function fnv1a32(s){let h=0x811c9dc5;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
function mulberry32(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),a|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function seededShuffle(arr,seed){const o=arr.slice(),g=mulberry32(seed);for(let i=o.length-1;i>0;i--){const j=Math.floor(g()*(i+1));[o[i],o[j]]=[o[j],o[i]];}return o;}
function computeNormalizedScores(ans){
  const raw=[0,0,0,0],sc=[0,0,0,0];
  for(const x of ans){const w=x.item.options[x.selectedIndex].weights;for(let d=0;d<4;d++){raw[d]+=w[d];sc[d]+=x.item.scales[d];}}
  return[0,1,2,3].map(d=>sc[d]>0?((raw[d]+2*sc[d])/(6*sc[d]))*100:M0);
}
const toUnitVec=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
function rankArchetypesWithTieBreak(u,list){
  const c=cfg(),un=Math.hypot(...u)||1,ord=c.TIE_BREAK_AXIS_ORDER;
  return(list||archs()).map(a=>{const uv=toUnitVec(a.vector);return{id:a.id,archetype:a,vector:a.vector,unitVec:uv,primaryAxis:a.primaryAxis,sim:(u[0]*uv[0]+u[1]*uv[1]+u[2]*uv[2]+u[3]*uv[3])/un};})
  .sort((a,b)=>{
    if(Math.abs(a.sim-b.sim)>=1e-9)return b.sim-a.sim;
    const pa=u[DI[a.primaryAxis]],pb=u[DI[b.primaryAxis]];if(Math.abs(pa-pb)>=1e-9)return pb-pa;
    for(const ax of ord){const i=DI[ax];if(a.vector[i]!==b.vector[i])return u[i]>=M0-1e-6?b.vector[i]-a.vector[i]:a.vector[i]-b.vector[i];}
    return a.id<b.id?-1:1;
  });
}
function passesWorstCasePerturbation(orth,t1,t2){
  const raw=[0,0,0,0],sc=[0,0,0,0];
  for(const x of orth){const w=x.item.options[x.selectedIndex].weights;for(let d=0;d<4;d++){raw[d]+=w[d];sc[d]+=x.item.scales[d];}}
  const dl=[0,1,2,3].map(d=>({d,v:t2.unitVec[d]-t1.unitVec[d]})).sort((a,b)=>Math.abs(b.v-a.v)>=1e-12?b.v-a.v:a.d-b.d);
  const ww=[0,0,0,0];[4,2,1,-2].forEach((v,i)=>{ww[dl[i].d]=v;});
  const uP=[0,1,2,3].map(d=>((raw[d]+ww[d]+2*(sc[d]+1))/(6*(sc[d]+1)))*100);
  return rankArchetypesWithTieBreak(uP,archs())[0].id===t1.id;
}
function buildStage1Queue(bank,anchor,att,rec){
  const c=cfg(),rs=rec||new Set(),sd=fnv1a32(`${anchor}#${att}`);
  const blks=[0,1,2,3,4,5].map(b=>{const it=bank.filter(q=>q.tier==='core'&&q.blockId===b);return{b,ov:it.reduce((s,q)=>s+(rs.has(q.id)?1:0),0),it};});
  const sh=seededShuffle(blks,(sd^0xa5a5a5a5)>>>0).sort((a,b)=>a.ov-b.ov),q=[];
  for(const x of sh.slice(0,c.STAGE1_CORE_BLOCKS))q.push(...seededShuffle(x.it,(sd^Math.imul(x.b+1,0x9e3779b1))>>>0));
  return q;
}
function selectNextOrStop(ans,s1,bank,anchor,att,rec){
  const c=cfg(),rs=rec||new Set();
  if(ans.some(x=>x.item.tier==='special'))return{stop:true,stage:4};
  const orth=ans.filter(x=>x.item.tier!=='special'),n=orth.length;
  if(n<c.STAGE1_CORE_COUNT)return{stop:false,stage:1,nextItem:s1[n],nOrth:n};
  const u=computeNormalizedScores(orth),[t1,t2]=rankArchetypesWithTieBreak(u,archs());
  let conv=n>=c.MAX_ORTH_COUNT;
  if(!conv&&n>=c.MIN_ORTH_COUNT){
    const th=c.STOP_COSINE_GAP_BASE-c.STOP_COSINE_DECAY*(n-c.MIN_ORTH_COUNT);
    if(t1.sim-t2.sim>=th&&passesWorstCasePerturbation(orth,t1,t2))conv=true;
  }
  if(conv){
    const sp=bank.filter(q=>q.tier==='special'),fb=mulberry32(fnv1a32(anchor))()>=.5?1:0,L=sp.length;
    const od=[sp[(((fb+att-1)%L)+L)%L],sp[(((fb+att)%L)+L)%L]].sort((a,b)=>(rs.has(a.id)?1:0)-(rs.has(b.id)?1:0));
    return{stop:false,stage:4,nextItem:od[0],nOrth:n};
  }
  const sd=fnv1a32(`${anchor}#${att}`),aid=new Set(orth.map(x=>x.item.id)),up={VL:0,VQ:0,VD:0,LQ:0,LD:0,QD:0};
  const rAcc=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],sc=[0,0,0,0];
  for(const{item}of orth){
    if(item.tier==='pair')up[item.pairTag]++;
    for(let d=0;d<4;d++)sc[d]+=item.scales[d];
    for(let i=0;i<4;i++)for(let d=0;d<4;d++)rAcc[i][d]+=item.options[i].weights[d];
  }
  const p1=t1.unitVec,p2=t2.unitVec,cs=[];
  PAIRS.forEach((pd,ix)=>{
    const bk=seededShuffle(bank.filter(q=>q.pairTag===pd.tag&&!aid.has(q.id)),(sd^Math.imul(ix+11,0x85ebca6b))>>>0);
    if(!bk.length)return;
    let pr=Math.abs(p1[pd.a]-p2[pd.a])+Math.abs(p1[pd.b]-p2[pd.b])-c.PAIR_DIFF_TIE_PENALTY*Math.abs(u[pd.a]-u[pd.b]);
    if(up[pd.tag]===2)pr*=c.PAIR_SATURATION_DECAY.after2;else if(up[pd.tag]>=3)pr*=c.PAIR_SATURATION_DECAY.after3;
    const un=bk.filter(q=>!rs.has(q.id));if(rs.size>0&&un.length>0)pr+=c.RETEST_UNSEEN_BONUS;
    cs.push({pr,pool:un.length?un:bk});
  });
  cs.sort((a,b)=>b.pr-a.pr);
  let best=cs[0].pool[0],minI=Infinity;
  for(const q of cs[0].pool){
    let imb=0;
    for(let i=0;i<4;i++)for(let d=0;d<4;d++){const s=sc[d]+q.scales[d];imb+=(((rAcc[i][d]+q.options[i].weights[d]+2*s)/(6*s))*100-M0)**2;}
    if(imb<minI-1e-9){minI=imb;best=q;}
  }
  return{stop:false,stage:n<c.MIN_ORTH_COUNT?2:3,nextItem:best,nOrth:n};
}
function erf(x){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a));}
function computePercentiles(u){
  const p=cfg().OFFLINE_COHORT_PARAMS,o={};
  ['V','L','Q','D'].forEach((k,i)=>{const z=(u[i]-p.mu[k])/p.sigma[k],za=z-(p.skewness/6)*(z*z-1);o[k]=Math.round(Math.min(p.clampMax,Math.max(p.clampMin,50*(1+erf(za/Math.SQRT2))))*10)/10;});
  return o;
}
function getLeadAndWeakDims(u){
  const o=cfg().TIE_BREAK_AXIS_ORDER;let td=o[0],wd=o[3];
  for(const k of o)if(u[DI[k]]>u[DI[td]]+1e-9)td=k;
  for(let i=3;i>=0;i--)if(u[DI[o[i]]]<u[DI[wd]]-1e-9)wd=o[i];
  return{topDim:td,weakDim:wd};
}
function evaluateQuiz(ans){
  const c=cfg(),al=archs(),u=computeNormalizedScores(ans),[r1,r2]=rankArchetypesWithTieBreak(u,al);
  const p=r1.archetype,s=r2.archetype,pct=computePercentiles(u),ext=getLeadAndWeakDims(u);
  let mc='SHIELD',oc=0;
  for(const x of ans){if(x.item.tier==='special')mc=x.item.options[x.selectedIndex].metaCode||mc;else oc++;}
  const mp=c.META_PERSONAS[mc]||c.META_PERSONAS.SHIELD,su=u.slice().sort((a,b)=>b-a),sr=c.SSR_VARIANT_RULE;
  const ssr=p.rarity==='SSR'||(su[0]-su[3]>=sr.minSpread&&su[1]>=sr.minTop2Score&&sr.triggerMetaCodes.includes(mc));
  const byId=Object.fromEntries(al.map(a=>[a.id,a]));
  return{
    scoresVec:u,scoresNorm:{V:u[0],L:u[1],Q:u[2],D:u[3]},scoresDisplay:{V:Math.round(u[0]),L:Math.round(u[1]),Q:Math.round(u[2]),D:Math.round(u[3])},
    percentiles:pct,topDim:ext.topDim,weakDim:ext.weakDim,primaryArchetype:p,secondaryArchetype:s,primarySim:r1.sim,secondarySim:r2.sim,
    bestPartner:byId[p.bestPartnerId]||s,nemesis:byId[p.nemesisId]||s,metaCode:mc,metaPersona:mp,isSsrVariant:ssr,
    displayRarityBadge:(ssr&&p.id!=='P12')?sr.ssrBadgeText:p.rarityBadge,answeredCount:ans.length,orthCount:oc,stoppedEarly:oc<c.MAX_ORTH_COUNT
  };
}
function renderRadarSvg(s){
  const cx=160,cy=148,R=92,vs=[s.V,s.L,s.Q,s.D],ag=[-Math.PI/2,0,Math.PI/2,Math.PI];
  const pt=(a,k)=>[+(cx+R*k*Math.cos(a)).toFixed(1),+(cy+R*k*Math.sin(a)).toFixed(1)];
  const g=[.25,.5,.75,1].map((l,i)=>`<polygon points="${ag.map(a=>pt(a,l)).join(' ')}" fill="none" stroke="${i===3?'#BDB6AA':'#DFD9CE'}" stroke-width="1"${i<3?' stroke-dasharray="3 3"':''}/>`).join('');
  const ax=ag.map(a=>{const e=pt(a,1);return`<line x1="${cx}" y1="${cy}" x2="${e[0]}" y2="${e[1]}" stroke="#D7D0C4" stroke-width="1"/>`;}).join('');
  const ps=vs.map((v,i)=>pt(ag[i],Math.max(.08,Math.min(1,v/100))));
  const dt=ps.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4.2" fill="#002FA7" stroke="#FAF8F5" stroke-width="1.6"/>`).join('');
  const lb=[[`V 言语 ${Math.round(vs[0])}`,cx,26,'middle'],[`L 逻辑 ${Math.round(vs[1])}`,cx+R+12,cy+5,'start'],[`Q 数资 ${Math.round(vs[2])}`,cx,cy+R+28,'middle'],[`D 决断 ${Math.round(vs[3])}`,cx-R-12,cy+5,'end']]
    .map(([t,x,y,a])=>`<text x="${x}" y="${y}" text-anchor="${a}" fill="#1A1A1A" font-size="12" font-weight="600" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">${t}</text>`).join('');
  return`<svg viewBox="0 0 320 296" style="width:100%;height:auto;display:block" role="img" aria-label="四维认知雷达图" xmlns="http://www.w3.org/2000/svg">${g}${ax}<polygon points="${ps.join(' ')}" fill="rgba(0,47,167,0.16)" stroke="#002FA7" stroke-width="2.2" stroke-linejoin="round"/>${dt}${lb}</svg>`;
}
const E={fnv1a32,mulberry32,seededShuffle,computeNormalizedScores,toUnitVec,rankArchetypesWithTieBreak,passesWorstCasePerturbation,buildStage1Queue,selectNextOrStop,computePercentiles,getLeadAndWeakDims,evaluateQuiz,renderRadarSvg};
r.BrainLab.Engine=E;if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
