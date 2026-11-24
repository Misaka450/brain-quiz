(function(r){'use strict';r.BrainLab=r.BrainLab||{};
const SF='"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC","SimSun",Georgia,serif',SN='"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",-apple-system,sans-serif',MN='ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace';
const C={bg:'#FAF8F5',pan:'#F2EFE9',ink:'#1A1A1A',sub:'#4A4742',mut:'#6E6A63',rule:'#DCD6CC',blue:'#002FA7',red:'#C83228'};
const tx=(c,s,x,y,f,col,al='left',mw)=>{c.fillStyle=col;c.font=f;c.textAlign=al;mw?c.fillText(s,x,y,mw):c.fillText(s,x,y);};
const ln=(c,x1,y1,x2,y2,col,w=1)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
function wrap(c,t,x,y,mw,lh,ml){
  const ls=[];let cur='';
  for(const ch of Array.from(String(t||''))){if(c.measureText(cur+ch).width>mw&&cur){ls.push(cur);cur=ch;if(ls.length===ml)break;}else cur+=ch;}
  if(ls.length<ml&&cur)ls.push(cur);else if(ls.length===ml&&cur){let l=ls[ml-1];while(l.length>1&&c.measureText(l+'…').width>mw)l=l.slice(0,-1);ls[ml-1]=l+'…';}
  ls.forEach((s,i)=>c.fillText(s,x,y+i*lh));
}
function rr(c,x,y,w,h,R){c.beginPath();c.moveTo(x+R,y);c.lineTo(x+w-R,y);c.quadraticCurveTo(x+w,y,x+w,y+R);c.lineTo(x+w,y+h-R);c.quadraticCurveTo(x+w,y+h,x+w-R,y+h);c.lineTo(x+R,y+h);c.quadraticCurveTo(x,y+h,x,y+h-R);c.lineTo(x,y+R);c.quadraticCurveTo(x,y,x+R,y);c.closePath();}
function renderPosterDataUrl(rep,no){
  const cfg=r.BrainLab.CONFIG,{width:W,height:H,maxDpr}=cfg.POSTER_SPEC,dpr=Math.min((typeof window!=='undefined'&&devicePixelRatio)||2,maxDpr);
  const cv=document.createElement('canvas');cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  const c=cv.getContext('2d');c.scale(dpr,dpr);
  c.fillStyle=C.bg;c.fillRect(0,0,W,H);
  let sd=20261124;c.fillStyle='rgba(26,26,26,.025)';
  for(let i=0;i<1200;i++){sd=(Math.imul(sd,1664525)+1013904223)>>>0;const x=(sd/4294967296)*W;sd=(Math.imul(sd,1664525)+1013904223)>>>0;c.fillRect(x|0,((sd/4294967296)*H)|0,1,1);}
  c.strokeStyle=C.ink;c.lineWidth=2;c.strokeRect(18,18,W-36,H-36);c.lineWidth=.75;c.strokeRect(23,23,W-46,H-46);
  c.textBaseline='alphabetic';
  tx(c,'BRAIN FACTORY SETTING // LAB ARCHIVE',42,48,'600 12px '+MN,C.mut);
  tx(c,no||'NO.202611-LAB0',708,48,'600 12px '+MN,C.ink,'right');
  tx(c,'《大脑出厂设置测评 · 隐藏认知天赋档案》',42,74,'600 16px '+SF,C.ink);
  ln(c,42,86,708,86,C.ink,1.6);ln(c,42,90,708,90,C.ink,.7);
  const a=rep.primaryArchetype,s=rep.secondaryArchetype,bc=rep.isSsrVariant?C.red:C.blue;
  c.font='600 13px '+SN;rr(c,42,108,Math.min(520,c.measureText(rep.displayRarityBadge).width+24),26,3);
  c.strokeStyle=bc;c.lineWidth=1.4;c.stroke();c.textBaseline='middle';tx(c,rep.displayRarityBadge,54,121,'600 13px '+SN,bc);
  c.textBaseline='alphabetic';tx(c,a.title,42,190,'700 44px '+SF,C.ink,'left',520);
  const sub=`隐藏副核：${s.title}  ·  处世底色：【${rep.metaPersona.badge}】`;
  c.font='500 18px '+SN;tx(c,sub,42,226,(c.measureText(sub).width>520?'500 16px ':'500 18px ')+SN,C.sub,'left',520);
  const ch=Array.from(a.sealShort);c.save();c.translate(636,158);c.rotate(-6*Math.PI/180);
  c.strokeStyle=C.red;c.lineWidth=3;c.strokeRect(-44,-44,88,88);c.lineWidth=1;c.strokeRect(-38,-38,76,76);
  c.fillStyle=C.bg;[[-46,-10,5,4],[41,14,5,4],[8,-46,4,5]].forEach(b=>c.fillRect(...b));
  c.textBaseline='middle';[[-17,-17],[17,-17],[-17,17],[17,17]].forEach(([x,y],i)=>tx(c,ch[i]||'',x,y,'700 28px '+SF,C.red,'center'));c.restore();
  c.fillStyle=C.pan;c.fillRect(42,250,666,82);c.fillStyle=C.red;c.fillRect(42,250,4,82);
  c.fillStyle=C.ink;c.font='600 21px '+SF;c.textAlign='left';c.textBaseline='alphabetic';wrap(c,`“${a.quote}”`,62,284,626,32,2);
  ln(c,42,344,708,344,C.rule);
  const cx=205,cy=478,R=96,vs=[rep.scoresNorm.V,rep.scoresNorm.L,rep.scoresNorm.Q,rep.scoresNorm.D],ag=[-Math.PI/2,0,Math.PI/2,Math.PI];
  const pt=(g,k)=>[cx+R*k*Math.cos(g),cy+R*k*Math.sin(g)];
  [.25,.5,.75,1].forEach((lv,l)=>{c.beginPath();ag.forEach((g,i)=>{const p=pt(g,lv);i?c.lineTo(...p):c.moveTo(...p);});c.closePath();c.strokeStyle=l===3?'#B9B2A6':'#DFD9CE';c.lineWidth=1;c.stroke();});
  ag.forEach(g=>ln(c,cx,cy,...pt(g,1),'#D6CFC3'));
  const dp=vs.map((v,i)=>pt(ag[i],Math.max(.08,Math.min(1,v/100))));
  c.beginPath();dp.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle='rgba(0,47,167,.18)';c.fill();c.strokeStyle=C.blue;c.lineWidth=2.5;c.stroke();
  dp.forEach(p=>{c.beginPath();c.arc(p[0],p[1],4.5,0,Math.PI*2);c.fillStyle=C.blue;c.fill();c.strokeStyle=C.bg;c.lineWidth=1.5;c.stroke();});
  c.textBaseline='middle';
  tx(c,`V 言语 (${Math.round(vs[0])})`,cx,cy-R-18,'600 15px '+SN,C.ink,'center');
  tx(c,`Q 数资 (${Math.round(vs[2])})`,cx,cy+R+20,'600 15px '+SN,C.ink,'center');
  tx(c,`L (${Math.round(vs[1])})`,cx+R+10,cy,'600 15px '+SN,C.ink,'left');
  tx(c,`D (${Math.round(vs[3])})`,cx-R-10,cy,'600 15px '+SN,C.ink,'right');
  const rx=392,rw=316,pr=cfg.OFFLINE_COHORT_PARAMS,tp=rep.percentiles[rep.topDim];
  c.textBaseline='alphabetic';
  tx(c,'主导天赋离线常模击败率',rx,374,'600 13px '+SN,C.mut);
  tx(c,tp.toFixed(1)+'%',rx,418,'700 38px '+MN,C.blue);
  tx(c,`你的${pr.dimActionLabels[rep.topDim]}超越同比例参与者`,rx,442,'500 14px '+SN,C.sub,'left',rw);
  [['V','V 言语洞察'],['L','L 逻辑推演'],['Q','Q 数资直觉'],['D','D 高压决断']].forEach(([k,lb],i)=>{
    const pc=rep.percentiles[k],ry=478+i*34;
    tx(c,lb,rx,ry,'500 14px '+SN,C.ink);tx(c,pc.toFixed(1)+'%',rx+rw,ry,'600 14px '+MN,k===rep.topDim?C.blue:C.sub,'right');
    c.fillStyle='#E5DFD5';rr(c,rx,ry+7,rw,6,3);c.fill();c.fillStyle=k===rep.topDim?C.blue:C.ink;rr(c,rx,ry+7,Math.max(8,pc/100*rw),6,3);c.fill();
  });
  ln(c,42,616,708,616,C.rule);
  [['· 核心长板',a.deepAnalysis.strength,640],['· 潜在盲区',a.deepAnalysis.blindspot,692]].forEach(([k,t,y])=>{tx(c,k,42,y,'700 14px '+SN,C.ink);c.fillStyle=C.sub;c.font='400 14px '+SN;wrap(c,t,122,y,586,21,2);});
  tx(c,'· 天选赛道',42,744,'700 14px '+SN,C.ink);tx(c,a.quadrantFit.slice(0,2).map(f=>`${f.role} (${f.fitPct}%)`).join('   /   '),122,744,'600 14px '+SN,C.blue,'left',586);
  tx(c,'· 处世底色',42,770,'700 14px '+SN,C.ink);tx(c,`${rep.metaPersona.badge} — ${rep.metaPersona.desc}`,122,770,'400 14px '+SN,C.sub,'left',586);
  [[42,'最佳上岸 / 搞钱搭子',C.blue,rep.bestPartner.title],[384,'磁场相斥职场天敌',C.red,rep.nemesis.title]].forEach(([x,tg,cl,nm])=>{
    c.fillStyle=C.pan;c.fillRect(x,790,324,66);c.strokeStyle=C.ink;c.lineWidth=1;c.strokeRect(x,790,324,66);
    tx(c,tg,x+14,814,'600 12px '+SN,cl);tx(c,nm,x+14,842,'700 19px '+SF,C.ink);
  });
  c.save();c.setLineDash([6,4]);ln(c,42,876,708,876,'#BDB6AA',1.2);c.restore();
  tx(c,'小红书搜【大脑出厂设置测评】解锁同款档案',W/2,910,'700 18px '+SN,C.ink,'center');
  tx(c,'本测评仅供日常趣味娱乐与自我认知探索参考，不构成任何医疗诊断、',W/2,940,'400 12px '+SN,C.mut,'center');
  tx(c,'心理咨询或专业职业评估依据。',W/2,958,'400 12px '+SN,C.mut,'center');
  return cv.toDataURL('image/png');
}
function openPosterModal(rep,no){
  const u=renderPosterDataUrl(rep,no),m=document.getElementById('modal-poster'),im=document.getElementById('poster-preview-img'),dl=document.getElementById('btn-download-poster');
  if(im)im.src=u;
  if(dl){dl.hidden=!(window.matchMedia&&matchMedia('(pointer: fine)').matches);dl.onclick=()=>{const a=document.createElement('a');a.href=u;a.download=`大脑出厂设置_${rep.primaryArchetype.title}.png`;a.click();};}
  if(m){m.hidden=false;m.setAttribute('aria-hidden','false');}
  return u;
}
const closePosterModal=()=>{const m=document.getElementById('modal-poster');if(m){m.hidden=true;m.setAttribute('aria-hidden','true');}};
r.BrainLab.Poster={renderPosterDataUrl,openPosterModal,closePosterModal};
})(typeof window!=='undefined'?window:globalThis);
