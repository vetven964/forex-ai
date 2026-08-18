// V-TRADE AI — package/RBAC access hotfix
// Admin: all users + all active sessions + all features.
// User: only features included in the purchased plan.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_FILE = path.resolve(__dirname,'server.js');
const FRONTEND_FILE = path.resolve(__dirname,'premium-dashboard-live.html');
const originalReadFileSync = fs.readFileSync.bind(fs);
const MARKER = 'VTRADE_PACKAGE_RBAC_V1';

function patchServer(source){
  if(!source || source.includes(MARKER)) return source;
  let out=source;

  const helpers = `
/* ${MARKER} */
const VTRADE_PACKAGE_FEATURES = Object.freeze({
  'FREE 7-DAY TRIAL':['dashboard','profile','settings'],
  'TRIAL':['dashboard','profile','settings'],
  'BASIC':['dashboard','terminal','signals','risk','history','profile','settings'],
  'STANDARD':['dashboard','terminal','signals','ai','news','telegram','risk','history','profile','settings'],
  'VIP PRO':['dashboard','terminal','signals','ai','news','telegram','risk','history','profile','settings'],
  'PREMIUM':['dashboard','terminal','signals','ai','news','telegram','risk','history','profile','settings']
});
function vtradePlanKey(plan){return String(plan||'TRIAL').trim().toUpperCase().replace(/\\s+/g,' ');}
function vtradeFeaturesForUser(user){
  if(String(user?.role||'').toLowerCase()==='admin') return ['*'];
  const explicit=Array.isArray(user?.features)?user.features.map(x=>String(x).trim()).filter(Boolean):[];
  if(explicit.length) return explicit;
  return VTRADE_PACKAGE_FEATURES[vtradePlanKey(user?.plan)] || VTRADE_PACKAGE_FEATURES.TRIAL;
}
function vtradeHasFeature(user,feature){
  const list=vtradeFeaturesForUser(user);
  return list.includes('*') || list.some(x=>String(x).toLowerCase()===String(feature).toLowerCase());
}
function requireFeature(feature){
  return (req,res,next)=>{
    const u=req.vtradeUser || getAuthSession(req);
    if(!u) return res.status(401).json({success:false,error:'Authentication required',code:'AUTH_REQUIRED'});
    req.vtradeUser=u;
    if(String(u.role||'').toLowerCase()==='admin' || vtradeHasFeature(u,feature)) return next();
    return res.status(403).json({success:false,error:'Package access required',code:'PACKAGE_REQUIRED',feature,plan:u.plan||'Trial',requiredPackage:true});
  };
}
`;

  const insertAt="function normalizeOrigin(value) {";
  if(out.includes(insertAt)) out=out.replace(insertAt,helpers+"\n"+insertAt);

  const routeMarker="app.get('/api/analysis/xauusd',async(req,res)=>{";
  const routes=`
app.get('/api/auth/access', requireAuth, (req,res)=>{
  const u=req.vtradeUser;
  res.set('Cache-Control','no-store');
  res.json({
    success:true,
    user:{id:u.id,name:u.name,email:u.email,role:u.role,plan:u.plan||'Trial'},
    isAdmin:String(u.role||'').toLowerCase()==='admin',
    features:vtradeFeaturesForUser(u),
    allFeatures:['dashboard','terminal','signals','ai','news','telegram','risk','history','profile','settings']
  });
});

app.get('/api/admin/sessions', requireAuth, requireRole('admin'), (req,res)=>{
  const now=Date.now(), sessions=[];
  for(const [token,s] of authSessions.entries()){
    if(!s || !s.expiresAt || now>=s.expiresAt){authSessions.delete(token);continue;}
    sessions.push({
      id:s.id,name:s.name,email:s.email,role:s.role,plan:s.plan||'Trial',
      createdAt:s.createdAt,lastSeenAt:s.lastSeenAt,expiresAt:s.expiresAt,active:true,
      tokenFingerprint:crypto.createHash('sha256').update(token).digest('hex').slice(0,10)
    });
  }
  sessions.sort((a,b)=>Number(b.lastSeenAt||0)-Number(a.lastSeenAt||0));
  res.set('Cache-Control','no-store');
  res.json({success:true,count:sessions.length,sessions});
});

`;
  if(out.includes(routeMarker)) out=out.replace(routeMarker,routes+"\n"+routeMarker);

  out=out.replace("app.get('/api/analysis/xauusd',async(req,res)=>{","app.get('/api/analysis/xauusd',requireFeature('terminal'),async(req,res)=>{");
  out=out.replace("app.get('/api/ai/analysis/xauusd',async(req,res)=>{","app.get('/api/ai/analysis/xauusd',requireFeature('ai'),async(req,res)=>{");
  out=out.replace("app.get('/api/news/xauusd', async (_req,res)=>{","app.get('/api/news/xauusd', requireFeature('news'), async (_req,res)=>{");
  out=out.replace("app.get('/api/telegram/status',async(req,res)=>{","app.get('/api/telegram/status',requireFeature('telegram'),async(req,res)=>{");
  out=out.replace("app.post('/api/telegram/connect',telegramMutationLimit,async(req,res)=>{","app.post('/api/telegram/connect',requireFeature('telegram'),telegramMutationLimit,async(req,res)=>{");
  out=out.replace("app.post('/api/telegram/test',telegramMutationLimit,async(req,res)=>{","app.post('/api/telegram/test',requireFeature('telegram'),telegramMutationLimit,async(req,res)=>{");
  out=out.replace("app.post('/api/telegram/disconnect',telegramMutationLimit,(req,res)=>{","app.post('/api/telegram/disconnect',requireFeature('telegram'),telegramMutationLimit,(req,res)=>{");

  console.log('[V-TRADE PACKAGE] server RBAC + package feature gates active');
  console.log('[V-TRADE PACKAGE] ADMIN = all features + all active sessions');
  console.log('[V-TRADE PACKAGE] USER = purchased package features only');
  return out;
}

function patchFrontend(){
  try{
    if(!fs.existsSync(FRONTEND_FILE)) return;
    let html=fs.readFileSync(FRONTEND_FILE,'utf8');
    const uiMarker='VTRADE_PACKAGE_ACCESS_UI_V1';
    if(html.includes(uiMarker)) return;

    const css=`<style id="${uiMarker}">
.vtrade-locked{opacity:.42!important;filter:grayscale(.55);pointer-events:none!important;position:relative}
.vtrade-locked::after{content:'🔒 PACKAGE';font-size:8px;position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#f2c94c}
.vtrade-package-banner{margin:10px 0;padding:11px 13px;border:1px solid #6940c9;border-radius:12px;background:#17102e;color:#d8c8ff;font-size:11px}
.vtrade-session-table{width:100%;border-collapse:collapse;min-width:760px}.vtrade-session-table th,.vtrade-session-table td{padding:9px;border-bottom:1px solid #17263b;text-align:left;font-size:10px}.vtrade-session-table th{color:#8493ab;background:#080f1b}
</style>`;

    const js=`<script id="${uiMarker}">
(function(){
 const API=String(localStorage.getItem('vtrade_api')||'https://forexai-6xw6.onrender.com').replace(/\\/$/,'');
 const token=()=>sessionStorage.getItem('vtrade_auth_token')||sessionStorage.getItem('vtrade_auth')||'';
 const labels={dashboard:'Dashboard',terminal:'Terminal',signals:'Signals',ai:'AI Intelligence',news:'News Intelligence',telegram:'Telegram',risk:'Risk Calculator',history:'Trade History',profile:'Profile',settings:'Settings'};
 const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 function apply(d){
   const features=new Set((d.features||[]).map(x=>String(x).toLowerCase()));
   const admin=d.isAdmin===true;
   document.body.dataset.vtradePlan=d.user?.plan||'Trial';
   document.body.dataset.vtradeRole=d.user?.role||'user';
   document.querySelectorAll('.nav button,[data-target]').forEach(el=>{
     const text=norm(el.textContent); let feature=null;
     for(const [k,label] of Object.entries(labels)){if(text.includes(norm(label))){feature=k;break}}
     if(!feature)return;
     const ok=admin||features.has(feature);
     el.classList.toggle('vtrade-locked',!ok);
     if(!ok){el.title='🔒 Package required — '+(d.user?.plan||'Trial');el.dataset.packageLocked='true'}
     else {el.removeAttribute('title');delete el.dataset.packageLocked}
   });
   const host=document.querySelector('.wrap')||document.querySelector('.content')||document.querySelector('main');
   if(host&&!document.getElementById('vtradePackageBanner')){
     const b=document.createElement('div');b.id='vtradePackageBanner';b.className='vtrade-package-banner';
     b.textContent='Package: '+(d.user?.plan||'Trial')+' · Only purchased features are enabled.';
     host.prepend(b);
   }
   window.VTRADE_ACCESS=d; window.VTRADE_CAN=f=>admin||features.has(String(f).toLowerCase());
   if(admin)loadAdminSessions();
 }
 async function loadAdminSessions(){
   const panel=document.getElementById('accountAdminPanel');
   if(!panel)return;
   let box=document.getElementById('vtradeAllSessions');
   if(!box){
     box=document.createElement('div');box.id='vtradeAllSessions';box.className='admin-table-wrap';box.style.marginTop='12px';
     box.innerHTML='<div style="padding:11px 12px;border-bottom:1px solid #1d2c44"><b>All Active Sessions</b><span style="float:right;color:#8493ab;font-size:10px">ADMIN ONLY</span></div><div style="overflow:auto"><table class="vtrade-session-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Package</th><th>Login</th><th>Last Active</th><th>Status</th></tr></thead><tbody id="vtradeSessionRows"><tr><td colspan="7">Loading…</td></tr></tbody></table></div>';
     panel.querySelector('.card')?.appendChild(box);
   }
   try{
     const r=await fetch(API+'/api/admin/sessions',{headers:{'x-vtrade-auth':token()},credentials:'include',cache:'no-store'});
     const d=await r.json().catch(()=>({}));
     if(!r.ok)throw new Error(d.error||'Sessions unavailable');
     const rows=document.getElementById('vtradeSessionRows');
     const list=Array.isArray(d.sessions)?d.sessions:[];
     rows.innerHTML=list.map(s=>{
       const fmt=x=>x?new Date(x).toLocaleString():'—';
       return '<tr><td>'+String(s.name||'').replace(/[<>]/g,'')+'</td><td>'+String(s.email||'').replace(/[<>]/g,'')+'</td><td>'+String(s.role||'').replace(/[<>]/g,'')+'</td><td>'+String(s.plan||'').replace(/[<>]/g,'')+'</td><td>'+fmt(s.createdAt)+'</td><td>'+fmt(s.lastSeenAt)+'</td><td><span class="status-pill ok">ACTIVE</span></td></tr>';
     }).join('')||'<tr><td colspan="7">No active sessions.</td></tr>';
   }catch(e){
     const rows=document.getElementById('vtradeSessionRows');if(rows)rows.innerHTML='<tr><td colspan="7">'+String(e.message||'Sessions unavailable').replace(/[<>]/g,'')+'</td></tr>';
   }
 }
 async function load(){
   const t=token();if(!t)return;
   try{const r=await fetch(API+'/api/auth/access',{headers:{'x-vtrade-auth':t},credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.ok)apply(d)}catch(_){}
 }
 load();
})();
</script>`;
    html=html.replace('</head>',css+'\n</head>');
    html=html.replace('</body>',js+'\n</body>');
    fs.writeFileSync(FRONTEND_FILE,html,'utf8');
    console.log('[V-TRADE PACKAGE] package access UI applied');
  }catch(e){console.warn('[V-TRADE PACKAGE] frontend patch skipped:',e.message)}
}

const previousReadFileSync = fs.readFileSync.bind(fs);
fs.readFileSync=function(file,...args){
  const source=previousReadFileSync(file,...args);
  if(path.resolve(String(file))===SERVER_FILE && typeof source==='string') return patchServer(source);
  return source;
};

patchFrontend();
