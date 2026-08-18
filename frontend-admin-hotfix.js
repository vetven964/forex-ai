// V-TRADE AI — account/profile/admin/session/package flow
// Runs before server.js is loaded by server-launcher.js.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const SERVER_FILE=path.resolve(__dirname,'server.js');
const FRONTEND_FILE=path.resolve(__dirname,'premium-dashboard-live.html');
const MARKER='VTRADE_ACCOUNT_SESSION_MENU_V4';

function patchServer(){
  if(!fs.existsSync(SERVER_FILE)) return;
  let s=fs.readFileSync(SERVER_FILE,'utf8');
  const before=s;

  if(!s.includes('VTRADE_PERSISTENT_MEMBER_ACCOUNTS_V1')){
    const needle='const USER_ACCOUNTS = loadUserAccounts();';
    const inject=`/* VTRADE_PERSISTENT_MEMBER_ACCOUNTS_V1 */
function loadPersistentMemberAccounts(){
  try{
    const file=path.resolve(__dirname,'data','vtrade-members.json');
    if(!fs.existsSync(file)) return [];
    const rows=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Array.isArray(rows)) return [];
    return rows.map(u=>({
      id:String(u.id||crypto.randomUUID()), email:String(u.email||'').trim().toLowerCase(),
      name:String(u.name||u.email||'User').slice(0,80), role:'user', plan:String(u.plan||'FREE').slice(0,40),
      passwordHash:String(u.passwordHash||'').trim(), enabled:u.status!=='DISABLED' && u.enabled!==false
    })).filter(u=>u.email&&u.passwordHash);
  }catch(e){ console.error('[AUTH] persistent member load failed:',e.message); return []; }
}
function vtradePlanPermissions(plan){
  const p=String(plan||'FREE').trim().toLowerCase();
  const base=['dashboard','profile:own','settings'], basic=['terminal','signals','risk','history'], pro=['ai','news','telegram:own'];
  if(p==='vip-pro'||p==='premium'||p==='enterprise'||p==='vip') return base.concat(basic,pro);
  if(p==='standard'||p==='pro'||p==='advanced') return base.concat(basic,pro);
  if(p==='basic') return base.concat(basic);
  return base;
}

const USER_ACCOUNTS = loadUserAccounts();
for(const member of loadPersistentMemberAccounts()) if(!USER_ACCOUNTS.some(u=>u.email===member.email)) USER_ACCOUNTS.push(member);`;
    if(s.includes(needle)) s=s.replace(needle,inject);
  }

  s=s.replace("const passwordHash=crypto.scryptSync(password,salt,64).toString('hex')+':'+salt;","const passwordHash=salt+':'+crypto.scryptSync(password,salt,64).toString('hex');");
  s=s.replace("permissions:found.role==='admin'?['*']:['terminal','pricing','telegram:own','profile:own']","permissions:found.role==='admin'?['*']:vtradePlanPermissions(found.plan)");

  const timeoutOld="app.use('/api/', (req,res,next)=>{ const timer=setTimeout(()=>{ if(!res.headersSent) res.status(504).json({success:false,error:'API request timed out'}); }, ANALYSIS_REQUEST_TIMEOUT_MS); res.on('finish',()=>clearTimeout(timer)); res.on('close',()=>clearTimeout(timer)); next(); });";
  const timeoutNew="app.use('/api/', (req,res,next)=>{ const timer=setTimeout(()=>{ if(!res.headersSent) console.warn('[API] slow request',req.method,req.originalUrl); }, ANALYSIS_REQUEST_TIMEOUT_MS); res.on('finish',()=>clearTimeout(timer)); res.on('close',()=>clearTimeout(timer)); next(); });";
  s=s.replace(timeoutOld,timeoutNew);

  if(!s.includes('VTRADE_PRIVATE_API_GATES_V1')){
    const gate=`/* VTRADE_PRIVATE_API_GATES_V1 */
app.use('/api/analysis/xauusd',requireAuth);
app.use('/api/telegram',requireAuth);
`;
    s=s.replace("app.get('/api/analysis/xauusd',async(req,res)=>{",gate+"\napp.get('/api/analysis/xauusd',async(req,res)=>{");
  }

  if(!s.includes("app.get('/api/auth/access'")){
    const accessRoute=`
app.get('/api/auth/access',requireAuth,(req,res)=>{
  const isAdmin=req.vtradeUser.role==='admin';
  const permissions=isAdmin?['*']:vtradePlanPermissions(req.vtradeUser.plan);
  res.set('Cache-Control','no-store');
  res.json({success:true,user:{id:req.vtradeUser.id,email:req.vtradeUser.email,name:req.vtradeUser.name,role:req.vtradeUser.role,plan:req.vtradeUser.plan},permissions,isAdmin});
});
`;
    s=s.replace("app.get('/api/pricing', requireAuth, (req,res) => {",accessRoute+"\napp.get('/api/pricing', requireAuth, (req,res) => {");
  }

  if(!s.includes("app.post('/api/admin/sessions/revoke'")){
    const adminRoutes=`
app.get('/api/admin/sessions',requireAuth,requireRole('admin'),(req,res)=>{
  const sessions=[...authSessions.entries()].map(([token,x])=>({token:token.slice(0,12)+'…',id:x.id,email:x.email,name:x.name,role:x.role,plan:x.plan,createdAt:x.createdAt,lastSeenAt:x.lastSeenAt,expiresAt:x.expiresAt,active:Date.now()<x.expiresAt})).filter(x=>x.active);
  res.set('Cache-Control','no-store'); res.json({success:true,sessions,sessionCount:sessions.length});
});
app.post('/api/admin/sessions/revoke',requireAuth,requireRole('admin'),(req,res)=>{
  const id=String(req.body?.id||'').trim(); if(!id) return res.status(400).json({success:false,error:'Session user id is required'});
  let count=0; for(const [token,x] of authSessions.entries()) if(x.id===id){authSessions.delete(token);revokedAuthTokens.set(token,Date.now()+AUTH_SESSION_TTL_MS);count++;}
  res.json({success:true,revoked:count});
});
`;
    s=s.replace("app.get('/api/admin/session', requireAuth, requireRole('admin'), (req,res) => {",adminRoutes+"\napp.get('/api/admin/session', requireAuth, requireRole('admin'), (req,res) => {");
  }

  if(s!==before){fs.writeFileSync(SERVER_FILE,s,'utf8');console.log('[V-TRADE ACCOUNT FLOW] server RBAC/package/session patch applied');}
}

function patchFrontend(source){
  if(source.includes(MARKER)) return source;
  const css=`/* ${MARKER} */
.account-menu{position:relative;margin-left:8px;z-index:80}.account-trigger{display:flex;align-items:center;gap:9px;min-height:44px;padding:6px 10px;border:1px solid #263650;border-radius:12px;background:#09111e;color:#fff;cursor:pointer}.account-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#5120ff,#aa72ff);font-weight:900}.account-meta{display:grid;text-align:left;line-height:1.1}.account-meta b{font-size:11px}.account-meta small{font-size:9px;color:#8493ab;margin-top:3px}.account-dropdown{position:absolute;right:0;top:52px;width:280px;padding:9px;border:1px solid #263650;border-radius:15px;background:#07101cf8;box-shadow:0 25px 70px #000b;backdrop-filter:blur(18px);display:none}.account-dropdown.open{display:block}.account-head{padding:9px 10px 12px;border-bottom:1px solid #1d2c44;margin-bottom:6px}.account-head small{display:block;color:#8493ab;margin-top:4px}.account-role{display:inline-flex;margin-top:6px;padding:3px 7px;border-radius:99px;font-size:8px;font-weight:900;color:#22e58a;background:#062d20;border:1px solid #147850}.account-role.admin{color:#caa9ff;background:#1b1038;border-color:#6940c9}.account-item{display:flex;align-items:center;gap:9px;width:100%;min-height:40px;padding:9px 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#c8d2e1;text-align:left;cursor:pointer}.account-item:hover{background:#17102e;border-color:#6840cf;color:#fff}.account-item.admin{color:#9fdcff}.account-item.logout{color:#ff8c98;border-top:1px solid #1d2c44;margin-top:5px}.account-item.logout:hover{background:#2b0c13;border-color:#7c2532}.account-panel{margin-top:12px}.profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.profile-item{padding:13px;border:1px solid #1d2c44;border-radius:12px;background:#080f1b}.profile-item small{display:block;color:#8493ab;font-size:10px;margin-bottom:5px}.profile-item b{font-size:13px;word-break:break-word}.admin-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.admin-stat{padding:14px;border:1px solid #1d2c44;border-radius:13px;background:#080f1b}.admin-stat small{display:block;color:#8493ab;font-size:10px;text-transform:uppercase}.admin-stat b{display:block;font-size:20px;margin-top:6px}.admin-table-wrap{margin-top:12px;overflow:auto;border:1px solid #1d2c44;border-radius:13px}.admin-table{width:100%;border-collapse:collapse;min-width:720px}.admin-table th,.admin-table td{padding:10px 12px;border-bottom:1px solid #17263b;text-align:left;font-size:11px}.admin-table th{color:#8493ab;font-size:10px;text-transform:uppercase;background:#080f1b}.status-pill{display:inline-block;padding:4px 7px;border-radius:99px;font-size:9px;font-weight:900}.status-pill.ok{color:#22e58a;background:#062d20;border:1px solid #147850}.status-pill.off{color:#ff8c98;background:#2b0c13;border:1px solid #7c2532}.access-box{margin-top:12px;padding:13px;border:1px solid #1d2c44;border-radius:12px;background:#080f1b}.access-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.access-chip{padding:5px 8px;border-radius:99px;border:1px solid #147850;background:#062d20;color:#9fffd0;font-size:9px;font-weight:900}.locked-chip{border-color:#7c2532;background:#2b0c13;color:#ff9eaa}@media(max-width:900px){.account-meta{display:none}.account-dropdown{position:fixed;right:10px;top:62px;width:min(290px,calc(100vw - 20px))}.profile-grid,.admin-summary{grid-template-columns:1fr 1fr}}@media(max-width:520px){.profile-grid,.admin-summary{grid-template-columns:1fr}}`;
  const menu=`<div class="account-menu" id="vtradeAccountMenu"><button class="account-trigger" id="vtradeAccountTrigger" type="button"><span class="account-avatar" id="vtradeAccountAvatar">V</span><span class="account-meta"><b id="vtradeAccountName">Account</b><small id="vtradeAccountEmail">Signed in</small></span><span>⌄</span></button><div class="account-dropdown" id="vtradeAccountDropdown"><div class="account-head"><b id="vtradeMenuName">Account</b><small id="vtradeMenuEmail">—</small><span class="account-role" id="vtradeMenuRole">MEMBER</span></div><button class="account-item" data-account-action="profile">◉ Profile</button><button class="account-item" data-account-action="settings">⚙ Account Settings</button><button class="account-item" data-account-action="password">🔒 Change Password</button><button class="account-item admin" id="vtradeAdminItem" data-account-action="admin" style="display:none">♛ Admin Dashboard</button><button class="account-item logout" data-account-action="logout">↪ Logout</button></div></div>`;
  const panels=`<section class="section account-panel" id="accountProfilePanel" style="display:none"><div class="card"><div class="section-title"><h2>◉ User Profile</h2><span id="profileRole">SESSION PROTECTED</span></div><div class="profile-grid"><div class="profile-item"><small>Name</small><b id="profileName">—</b></div><div class="profile-item"><small>Email</small><b id="profileEmail">—</b></div><div class="profile-item"><small>Role</small><b id="profileRoleValue">—</b></div><div class="profile-item"><small>Package</small><b id="profilePlan">—</b></div><div class="profile-item"><small>2FA</small><b id="profile2fa">—</b></div><div class="profile-item"><small>Session</small><b class="green">ACTIVE</b></div></div><div class="access-box"><b>Package Access</b><div class="access-list" id="accessList"></div></div><button class="btn account-danger" id="profileLogout" style="margin-top:12px">↪ Logout</button></div></section><section class="section account-panel" id="accountAdminPanel" style="display:none"><div class="card"><div class="section-title"><h2>♛ Admin Dashboard</h2><span id="adminStatus">ADMIN ONLY</span></div><div class="notice success">Administrator session verified. Admin can see all active sessions and all members. Users cannot access this panel.</div><div class="admin-summary"><div class="admin-stat"><small>Members</small><b id="adminUsers">—</b></div><div class="admin-stat"><small>Active Sessions</small><b id="adminSessions">—</b></div><div class="admin-stat"><small>Role</small><b class="green">ADMIN</b></div><div class="admin-stat"><small>Security</small><b class="green">RBAC</b></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Package</th><th>Last Active</th><th>Status</th><th>Action</th></tr></thead><tbody id="adminSessionRows"><tr><td colspan="7">Loading…</td></tr></tbody></table></div></div></section>`;
  const script=`<script>(function(){const API='https://forexai-6xw6.onrender.com',K='vtrade_auth_token',id=x=>document.getElementById(x),token=()=>sessionStorage.getItem(K)||sessionStorage.getItem('vtrade_auth')||'',clean=()=>{sessionStorage.removeItem(K);sessionStorage.removeItem('vtrade_auth');sessionStorage.removeItem('vtrade_user');},login=()=>{clean();location.href='login.html'};let u={};let access=[];try{u=JSON.parse(sessionStorage.getItem('vtrade_user')||'{}')||{}}catch(_){};const labels={dashboard:'Dashboard',terminal:'Terminal',signals:'Signals',ai:'AI Intelligence',news:'News Intelligence',telegram:'Telegram',risk:'Risk Calculator',history:'Trade History',settings:'Settings'};function applyNav(){document.querySelectorAll('#nav [data-target]').forEach(b=>{const f=b.dataset.target;if(String(u.role).toLowerCase()==='admin'||access.includes('*')||access.includes(f)||f==='dashboard'||f==='settings'){b.style.display='flex';}else{b.style.display='none';}})}function setUser(x){u=x||u;const name=u.name||u.email||'Account',email=u.email||'Signed in',admin=String(u.role||'').toLowerCase()==='admin';id('vtradeAccountAvatar').textContent=(String(name).trim()[0]||'V').toUpperCase();id('vtradeAccountName').textContent=name;id('vtradeAccountEmail').textContent=email;id('vtradeMenuName').textContent=name;id('vtradeMenuEmail').textContent=email;id('vtradeMenuRole').textContent=admin?'ADMINISTRATOR':'MEMBER';id('vtradeMenuRole').classList.toggle('admin',admin);id('vtradeAdminItem').style.display=admin?'flex':'none';id('profileName').textContent=name;id('profileEmail').textContent=email;id('profileRoleValue').textContent=admin?'ADMIN':'USER';id('profilePlan').textContent=u.plan||'FREE';id('profile2fa').textContent=u.twoFactorEnabled?'ENABLED':'READY';sessionStorage.setItem('vtrade_user',JSON.stringify(u));applyNav();}async function api(path,opts={}){const h=new Headers(opts.headers||{});const t=token();if(t)h.set('x-vtrade-auth',t);const r=await fetch(API+path,{...opts,headers:h,credentials:'include',cache:'no-store'});if(r.status===401){login();return null;}return r;}async function loadAccess(){const r=await api('/api/auth/access');if(!r||!r.ok)return;const d=await r.json().catch(()=>({}));if(d.user)setUser(d.user);access=Array.isArray(d.permissions)?d.permissions:[];const all=['dashboard','terminal','signals','ai','news','telegram','risk','history','settings'];id('accessList').innerHTML=all.map(x=>'<span class="access-chip '+((access.includes('*')||access.includes(x))?'':'locked-chip')+'">'+(labels[x]||x)+' '+((access.includes('*')||access.includes(x))?'✓':'LOCKED')+'</span>').join('');applyNav();}async function verify(){const t=token();if(!t)return login();try{const r=await api('/api/auth/session');if(!r||!r.ok)return login();const d=await r.json();setUser(d.user||u);await loadAccess();}catch(_){login();}}async function logout(){try{await api('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'}})}catch(_){}login()}async function loadAdmin(){if(String(u.role).toLowerCase()!=='admin')return;try{const [ur,sr]=await Promise.all([api('/api/admin/users'),api('/api/admin/sessions')]);const ud=await ur.json().catch(()=>({})),sd=await sr.json().catch(()=>({}));const users=Array.isArray(ud.users)?ud.users:[],sessions=Array.isArray(sd.sessions)?sd.sessions:[];id('adminUsers').textContent=users.length;id('adminSessions').textContent=sessions.length;id('adminSessionRows').innerHTML=sessions.map(x=>'<tr><td>'+safe(x.name)+'</td><td>'+safe(x.email)+'</td><td>'+safe(x.role)+'</td><td>'+safe(x.plan)+'</td><td>'+new Date(x.lastSeenAt).toLocaleString()+'</td><td><span class="status-pill ok">ACTIVE</span></td><td><button class="btn" data-revoke="'+safe(x.id)+'">Logout</button></td></tr>').join('')||'<tr><td colspan="7">No active sessions.</td></tr>';document.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Logout this user session?'))return;await api('/api/admin/sessions/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.revoke})});loadAdmin();});}catch(_){id('adminStatus').textContent='ADMIN API UNAVAILABLE'}}function safe(x){return String(x||'').replace(/[<>"']/g,'')}const trigger=id('vtradeAccountTrigger'),drop=id('vtradeAccountDropdown');trigger.onclick=e=>{e.stopPropagation();drop.classList.toggle('open')};document.addEventListener('click',()=>drop.classList.remove('open'));document.querySelectorAll('[data-account-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=b.dataset.accountAction;drop.classList.remove('open');if(a==='logout')return logout();if(a==='profile'){id('accountProfilePanel').style.display='block';id('accountAdminPanel').style.display='none';id('accountProfilePanel').scrollIntoView({behavior:'smooth',block:'start'});}if(a==='admin'&&String(u.role).toLowerCase()==='admin'){id('accountAdminPanel').style.display='block';id('accountProfilePanel').style.display='none';loadAdmin();id('accountAdminPanel').scrollIntoView({behavior:'smooth',block:'start'});}if(a==='settings'||a==='password'){document.querySelector('[data-target="settings"]')?.click()}});id('profileLogout').onclick=logout;verify()})();</script>`;
  source=source.replace('</style>',css+'\n</style>');
  source=source.replace('</header>',menu+'\n</header>');
  source=source.replace('</main>',panels+'\n</main>');
  return source;
}

try{patchServer();}catch(e){console.error('[V-TRADE ACCOUNT FLOW] server patch failed:',e.message);}
try{if(fs.existsSync(FRONTEND_FILE)){const b=fs.readFileSync(FRONTEND_FILE,'utf8'),a=patchFrontend(b);if(a!==b){fs.writeFileSync(FRONTEND_FILE,a,'utf8');console.log('[V-TRADE ACCOUNT FLOW] Profile + Package Access + Admin Sessions + Logout added');}else console.log('[V-TRADE ACCOUNT FLOW] account flow already applied');}}catch(e){console.error('[V-TRADE ACCOUNT FLOW] frontend patch failed:',e.message);}
