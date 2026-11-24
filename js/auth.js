(function(r){'use strict';r.BrainLab=r.BrainLab||{};
const cfg=()=>r.BrainLab.CONFIG||require('./config.js');
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
function sha256Bytes(bytes){
  let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l=bytes.length,pl=(l+72)&~63,buf=new Uint8Array(pl),dv=new DataView(buf.buffer),W=new Uint32Array(64);
  buf.set(bytes);buf[l]=0x80;dv.setUint32(pl-8,Math.floor(l*8/4294967296));dv.setUint32(pl-4,(l*8)>>>0);
  for(let o=0;o<pl;o+=64){
    for(let i=0;i<16;i++)W[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++)W[i]=(W[i-16]+(rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3))+W[i-7]+(rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10)))>>>0;
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+W[i])>>>0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H=H.map((v,i)=>(v+[a,b,c,d,e,f,g,h][i])>>>0);
  }
  const out=new Uint8Array(32),odv=new DataView(out.buffer);H.forEach((v,i)=>odv.setUint32(i*4,v));return out;
}
function hmacSha256(ks,ms){
  const enc=new TextEncoder();let k=enc.encode(ks);const m=enc.encode(ms);if(k.length>64)k=sha256Bytes(k);
  const ok=new Uint8Array(64),ik=new Uint8Array(64);for(let i=0;i<64;i++){const b=k[i]||0;ok[i]=b^0x5c;ik[i]=b^0x36;}
  const inn=new Uint8Array(64+m.length);inn.set(ik);inn.set(m,64);
  const out=new Uint8Array(96);out.set(ok);out.set(sha256Bytes(inn),64);return sha256Bytes(out);
}
function computeTag4(sec,pre,non){
  const a=cfg().CODE_ALPHABET,d=hmacSha256(sec,pre+':'+non),v=((d[0]<<12)|(d[1]<<4)|(d[2]>>4))&0xfffff;
  let t='';for(let i=0;i<4;i++)t+=a[(v>>(15-5*i))&31];return t;
}
const MSG={OK:'核销成功，正在解锁完整四维档案',FORMAT_ERROR:'测评码格式不正确，请输入 10 位专属码（如 DM-TEST-ZXZZ）',INVALID_PREFIX:'测评码批次前缀无效，请核对自动发货完整口令',INVALID_CHAR:'测评码含非法字符（已剔除 0/O/1/I），请核对后重试',BAD_MAC:'测评码校验未通过，请核对或前往小红书搜【大脑出厂设置测评】获取',MAX_USES_EXCEEDED:'该专属测评码体验次数（5次）已达上限，前往小红书搜【大脑出厂设置测评】领取个人专属档案码'};
function verifyLocalHmac(raw,sec){
  const c=cfg(),cl=String(raw||'').trim().toUpperCase().replace(/[\s-]+/g,'');
  if(cl.length!==10)return{valid:false,reason:'FORMAT_ERROR',message:MSG.FORMAT_ERROR};
  const prefix=cl.slice(0,2),nonce=cl.slice(2,6),tag=cl.slice(6,10);
  if(!c.VALID_PREFIXES.includes(prefix))return{valid:false,reason:'INVALID_PREFIX',message:MSG.INVALID_PREFIX};
  for(const ch of nonce+tag)if(!c.CODE_ALPHABET.includes(ch))return{valid:false,reason:'INVALID_CHAR',message:MSG.INVALID_CHAR};
  const exp=computeTag4(sec||c.HMAC_SECRET,prefix,nonce);let diff=0;for(let i=0;i<4;i++)diff|=tag.charCodeAt(i)^exp.charCodeAt(i);
  const reason=diff===0?'OK':'BAD_MAC';return{valid:diff===0,code:`${prefix}-${nonce}-${tag}`,prefix,nonce,reason,message:MSG[reason]};
}
const rS=()=>{try{return JSON.parse(localStorage.getItem(cfg().STORAGE_KEYS.usage)||'{}');}catch{return{};}};
const wS=s=>{try{localStorage.setItem(cfg().STORAGE_KEYS.usage,JSON.stringify(s));}catch{}};
const getCodeUsage=c=>rS()[c]||{usedCount:0,maxUses:cfg().MAX_CODE_USES,firstUsedAt:null};
function verifyQuota(raw,o={}){
  const c=cfg(),res=verifyLocalHmac(raw,o.secret);if(!res.valid)return res;
  const s=rS(),e=s[res.code]||{usedCount:0,maxUses:c.MAX_CODE_USES,firstUsedAt:null};
  if(o.consume!==false&&e.usedCount>=c.MAX_CODE_USES)return{...res,valid:false,reason:'MAX_USES_EXCEEDED',usedCount:e.usedCount,maxUses:c.MAX_CODE_USES,message:MSG.MAX_USES_EXCEEDED};
  const usedCount=o.consume===false?e.usedCount:e.usedCount+1;
  if(o.consume!==false){s[res.code]={usedCount,maxUses:c.MAX_CODE_USES,firstUsedAt:e.firstUsedAt||new Date().toISOString()};wS(s);}
  return{...res,usedCount,maxUses:c.MAX_CODE_USES};
}
function verifyCode(raw,o={}){
  if(!cfg().LOCAL_FALLBACK&&typeof fetch==='function')return fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:String(raw||'').trim()})}).then(x=>x.json()).catch(()=>verifyQuota(raw,o));
  return Promise.resolve(verifyQuota(raw,o));
}
function trySilentUnlockFromUrl(already){
  let code='',utm='';try{const p=new URLSearchParams(location.search);code=(p.get('code')||'').trim();utm=(p.get('utm')||p.get('utm_source')||'').trim();}catch{}
  if(!code)return Promise.resolve({attempted:false,valid:false,utm});
  const chk=verifyLocalHmac(code);
  if(chk.valid&&already&&chk.code===already)return Promise.resolve({attempted:true,valid:true,reused:true,code:chk.code,prefix:chk.prefix,nonce:chk.nonce,utm});
  return verifyCode(code,{consume:true}).then(x=>({...x,attempted:true,utm}));
}
const Auth={sha256Bytes,hmacSha256,computeTag4,verifyLocalHmac,verifyCode,getCodeUsage,trySilentUnlockFromUrl};
r.BrainLab.Auth=Auth;r.verifyCode=verifyCode;if(typeof module!=='undefined'&&module.exports)module.exports=Auth;
})(typeof window!=='undefined'?window:globalThis);
