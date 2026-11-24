(function(r){'use strict';r.BrainLab=r.BrainLab||{};
const cfg=()=>r.BrainLab.CONFIG,sid='S'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
const utm=()=>{try{const p=new URLSearchParams(location.search);return(p.get('utm')||p.get('utm_source')||'').trim();}catch{return'';}};
const rL=()=>{try{const p=JSON.parse(localStorage.getItem(cfg().STORAGE_KEYS.events)||'[]');return Array.isArray(p)?p:[];}catch{return[];}};
const wL=l=>{try{localStorage.setItem(cfg().STORAGE_KEYS.events,JSON.stringify(l));}catch{}};
function track(event,props={}){
  const c=cfg(),rec={event:String(event),ts:new Date().toISOString(),sessionId:sid,version:c.VERSION,utm:utm(),viewport:typeof window!=='undefined'?`${innerWidth}x${innerHeight}`:'0x0',props};
  const l=rL();l.push(rec);wL(l.length>c.MAX_EVENT_LOGS?l.slice(-c.MAX_EVENT_LOGS):l);
  if(c.ENABLE_REMOTE_TRACKING&&navigator.sendBeacon)try{navigator.sendBeacon('/api/event',new Blob([JSON.stringify(rec)],{type:'application/json'}));}catch{}
  return rec;
}
function exportEventsJson(){
  const l=rL(),txt=JSON.stringify({exportedAt:new Date().toISOString(),version:cfg().VERSION,count:l.length,events:l},null,2);
  try{const u=URL.createObjectURL(new Blob([txt],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=`mxge_events_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1e3);}catch{}
  return txt;
}
r.BrainLab.Tracker={getSessionId:()=>sid,track,getEvents:rL,exportEventsJson};
})(typeof window!=='undefined'?window:globalThis);
