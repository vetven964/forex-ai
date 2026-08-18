// V-TRADE AI — frontend account/admin flow hotfix
// Adds Profile, Admin Dashboard and real Logout to the private terminal.
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const MARKER = 'VTRADE_ACCOUNT_ADMIN_FLOW_V1';

function patch(source) {
  if (!fs.existsSync(FILE) || source.includes(MARKER)) return source;

  const css = `
/* ${MARKER} */
.account-actions{display:grid;gap:9px;margin:12px 0 0;padding-top:12px;border-top:1px solid #1d2c44}
.nav button.account-btn{border-color:#263650;background:#08111d;color:#aebbd0}
.nav button.account-btn:hover{border-color:#8050ff;color:#fff;background:linear-gradient(90deg,#32117c,#17102e)}
.admin-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.admin-stat{padding:14px;border:1px solid #1d2c44;border-radius:13px;background:#080f1b}
.admin-stat small{display:block;color:#8493ab;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.admin-stat b{display:block;font-size:22px;margin-top:6px}
.admin-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}
.admin-table-wrap{margin-top:12px;overflow:auto;border:1px solid #1d2c44;border-radius:13px}
.admin-table{width:100%;border-collapse:collapse;min-width:620px}
.admin-table th,.admin-table td{padding:10px 12px;border-bottom:1px solid #17263b;text-align:left;font-size:11px;white-space:nowrap}
.admin-table th{color:#8493ab;font-size:10px;text-transform:uppercase;letter-spacing:.08em;background:#080f1b}
.admin-table td{color:#d9e2f0}
.status-pill{display:inline-block;padding:4px 7px;border-radius:99px;font-size:9px;font-weight:900}
.status-pill.ok{color:#22e58a;background:#062d20;border:1px solid #147850}
.status-pill.off{color:#ff8c98;background:#2b0c13;border:1px solid #7c2532}
.profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
.profile-item{padding:13px;border:1px solid #1d2c44;border-radius:12px;background:#080f1b}
.profile-item small{display:block;color:#8493ab;font-size:10px;margin-bottom:5px}
.profile-item b{font-size:13px;word-break:break-word}
.logout-danger{border-color:#7c2532!important;background:#2b0c13!important;color:#ffb2bf!important}
@media(max-width:900px){.admin-summary{grid-template-columns:1fr 1fr}.profile-grid{grid-template-columns:1fr}}
@media(max-width:520px){.admin-summary{grid-template-columns:1fr}.admin-toolbar .btn{width:100%}}
`;

  const nav = `
    <button class="account-btn" id="profileNav" data-target="profile"><span class="nav-icon">◉</span><span data-i18n="Profile">Profile</span></button>
    <button class="account-btn" id="adminNav" data-target="admin" style="display:none"><span class="nav-icon">♛</span><span data-i18n="Admin Dashboard">Admin Dashboard</span></button>
    <button class="account-btn logout-danger" id="logoutNav" data-target="logout"><span class="nav-icon">↪</span><span data-i18n="Sign out">Sign out</span></button>
`;

  const modules = `
  <section class="section module-card" id="profile">
    <div class="card">
      <div class="section-title"><h2>◉ <span data-i18n="Profile">Profile</span></h2><span id="profileRole">ACCOUNT</span></div>
      <div class="profile-grid">
        <div class="profile-item"><small>Name</small><b id="profileName">—</b></div>
        <div class="profile-item"><small>Email</small><b id="profileEmail">—</b></div>
        <div class="profile-item"><small>Role</small><b id="profileRoleValue">—</b></div>
        <div class="profile-item"><small>Plan</small><b id="profilePlan">—</b></div>
        <div class="profile-item"><small>2FA</small><b id="profile2fa">—</b></div>
        <div class="profile-item"><small>Session</small><b class="green">Protected</b></div>
      </div>
      <div class="admin-toolbar"><span class="sub">Server-side account security · RBAC · session protection</span><button class="btn logout-danger" id="profileLogout">↪ Sign out</button></div>
    </div>
  </section>

  <section class="section module-card" id="admin">
    <div class="card">
      <div class="section-title"><h2>♛ Admin Dashboard</h2><span id="adminStatus">ADMIN ONLY</span></div>
      <div class="notice success" id="adminNotice">Administrator session verified. Server-side RBAC is active.</div>
      <div class="admin-summary">
        <div class="admin-stat"><small>Members</small><b id="adminUsers">—</b></div>
        <div class="admin-stat"><small>Active Sessions</small><b id="adminSessions">—</b></div>
        <div class="admin-stat"><small>Your Plan</small><b id="adminPlan">Admin</b></div>
        <div class="admin-stat"><small>Security</small><b class="green">RBAC + 2FA</b></div>
      </div>
      <div class="admin-toolbar"><b>Member Accounts</b><button class="btn primary" id="adminRefresh">↻ Refresh Admin</button></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Status</th></tr></thead><tbody id="adminUserRows"><tr><td colspan="5">Loading…</td></tr></tbody></table></div>
      <div class="admin-toolbar"><b>Pricing</b><span class="sub" id="adminPricing">Loading plans…</span></div>
    </div>
  </section>
`;

  const script = `
<script>
(function(){
  const VTRADE_ACCOUNT_ADMIN_FLOW_V1=true;
  const api=()=>String(localStorage.getItem('vtrade_api')||'https://forexai-6xw6.onrender.com').replace(/\\/$/,'');
  const token=()=>sessionStorage.getItem('vtrade_auth_token')||sessionStorage.getItem('vtrade_auth')||'';
  const byId=id=>document.getElementById(id);
  const clearSession=()=>{sessionStorage.removeItem('vtrade_auth_token');sessionStorage.removeItem('vtrade_auth');sessionStorage.removeItem('vtrade_user');location.href='login.html';};
  async function request(path,opts={}){
    const t=token();
    const headers=new Headers(opts.headers||{});
    if(t) headers.set('x-vtrade-auth',t);
    headers.set('Content-Type','application/json');
    const r=await fetch(api()+path,{...opts,headers,credentials:'include',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(r.status===401){clearSession();throw new Error('Session expired');}
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }
  function setText(id,v){const e=byId(id);if(e)e.textContent=v==null||v===''?'—':String(v);}
  async function loadProfile(){
    try{
      const d=await request('/api/auth/profile');
      const u=d.user||{};
      setText('profileName',u.name);setText('profileEmail',u.email);setText('profileRoleValue',u.role);setText('profilePlan',u.plan);setText('profile2fa',u.twoFactorEnabled?'ENABLED':'READY');
      const admin=u.role==='admin';
      const n=byId('adminNav');if(n)n.style.display=admin?'flex':'none';
      if(admin) loadAdmin();
    }catch(e){console.warn('[V-TRADE ACCOUNT]',e.message);}
  }
  async function loadAdmin(){
    try{
      const [users,sessions,pricing]=await Promise.all([
        request('/api/admin/users'),request('/api/admin/session'),request('/api/pricing')
      ]);
      const list=Array.isArray(users.users)?users.users:[];
      setText('adminUsers',list.length);setText('adminSessions',sessions.sessionCount??0);setText('adminPlan',sessions.admin?.plan||'Admin');
      const rows=byId('adminUserRows');
      if(rows)rows.innerHTML=list.map(u=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.email)+'</td><td>'+esc(u.role)+'</td><td>'+esc(u.plan)+'</td><td><span class="status-pill '+(u.enabled?'ok':'off')+'">'+(u.enabled?'ACTIVE':'DISABLED')+'</span></td></tr>').join('')||'<tr><td colspan="5">No members found.</td></tr>';
      const plans=Array.isArray(pricing.plans)?pricing.plans:[];
      setText('adminPricing',plans.map(p=>String(p.name)+' $'+Number(p.price||0).toFixed(2)+'/'+String(p.period||'month')).join(' · ')||'No plans');
      setText('adminStatus','RBAC VERIFIED');
    }catch(e){setText('adminStatus','ADMIN API ERROR');const n=byId('adminNotice');if(n){n.className='notice';n.textContent=e.message;}}
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function logout(e){if(e)e.preventDefault();clearSession();}
  const logoutNav=byId('logoutNav');if(logoutNav)logoutNav.addEventListener('click',logout);
  const logoutBtn=byId('profileLogout');if(logoutBtn)logoutBtn.addEventListener('click',logout);
  const refresh=byId('adminRefresh');if(refresh)refresh.addEventListener('click',()=>loadAdmin());
  loadProfile();
})();
</script>
`;

  source = source.replace('</style>', css + '\n</style>');
  source = source.replace('</nav>', nav + '</nav>');
  source = source.replace('</section>\n</main></div>', modules + '</section>\n</main></div>');
  source = source.replace('</body>', script + '\n</body>');
  return source;
}

try {
  const before=fs.readFileSync(FILE,'utf8');
  const after=patch(before);
  if(after!==before){
    fs.writeFileSync(FILE,after,'utf8');
    console.log('[V-TRADE ACCOUNT FLOW] Profile + Admin Dashboard + Logout added');
  } else {
    console.log('[V-TRADE ACCOUNT FLOW] already applied');
  }
} catch(e) {
  console.error('[V-TRADE ACCOUNT FLOW] patch failed:',e.message);
  process.exitCode=1;
}
