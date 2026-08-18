// V-TRADE AI — in-terminal account/session UI hotfix
// Adds a top-right account menu for both Admin and Member users.
// Logout clears the authenticated browser session and returns to login.
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const MARKER = 'VTRADE_ACCOUNT_SESSION_MENU_V2';

function patch(source) {
  if (!fs.existsSync(FILE) || source.includes(MARKER)) return source;

  const css = `
/* ${MARKER} */
.account-menu{position:relative;margin-left:8px;z-index:80}
.account-trigger{display:flex;align-items:center;gap:9px;min-height:44px;padding:6px 10px;border:1px solid #263650;border-radius:12px;background:#09111e;color:#fff;cursor:pointer}
.account-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#5120ff,#aa72ff);font-weight:900;font-size:13px}
.account-meta{display:grid;text-align:left;line-height:1.1}.account-meta b{font-size:11px}.account-meta small{font-size:9px;color:#8493ab;margin-top:3px}.account-chevron{color:#8493ab;font-size:12px}
.account-dropdown{position:absolute;right:0;top:52px;width:250px;padding:9px;border:1px solid #263650;border-radius:15px;background:#07101cf8;box-shadow:0 25px 70px #000b;backdrop-filter:blur(18px);display:none}
.account-dropdown.open{display:block;animation:accountDrop .16s ease}@keyframes accountDrop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
.account-head{padding:9px 10px 12px;border-bottom:1px solid #1d2c44;margin-bottom:6px}.account-head b{display:block}.account-head small{display:block;color:#8493ab;margin-top:4px}
.account-item{display:flex;align-items:center;gap:9px;width:100%;min-height:40px;padding:9px 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#c8d2e1;text-align:left;cursor:pointer}
.account-item:hover{background:#17102e;border-color:#6840cf;color:#fff}.account-item.admin{color:#9fdcff}.account-item.logout{color:#ff8c98;border-top:1px solid #1d2c44;margin-top:5px;padding-top:12px}.account-item.logout:hover{background:#2b0c13;border-color:#7c2532}
.account-role{display:inline-flex;margin-top:6px;padding:3px 7px;border-radius:99px;font-size:8px;font-weight:900;color:#22e58a;background:#062d20;border:1px solid #147850}.account-role.admin{color:#caa9ff;background:#1b1038;border-color:#6940c9}
.account-mobile-name{display:none}
@media(max-width:900px){.account-meta{display:none}.account-trigger{padding:6px}.account-dropdown{position:fixed;right:10px;top:62px;width:min(280px,calc(100vw - 20px))}}
@media(max-width:520px){.account-menu{margin-left:0}.account-trigger{min-width:44px;justify-content:center}}
`;

  const menu = `
  <div class="account-menu" id="vtradeAccountMenu">
    <button class="account-trigger" id="vtradeAccountTrigger" type="button" aria-haspopup="true" aria-expanded="false">
      <span class="account-avatar" id="vtradeAccountAvatar">V</span>
      <span class="account-meta"><b id="vtradeAccountName">Account</b><small id="vtradeAccountEmail">Signed in</small></span>
      <span class="account-chevron">⌄</span>
    </button>
    <div class="account-dropdown" id="vtradeAccountDropdown" role="menu">
      <div class="account-head"><b id="vtradeMenuName">Account</b><small id="vtradeMenuEmail">—</small><span class="account-role" id="vtradeMenuRole">MEMBER</span></div>
      <button class="account-item" type="button" data-account-action="profile">◉ <span>Profile</span></button>
      <button class="account-item" type="button" data-account-action="settings">⚙ <span>Account Settings</span></button>
      <button class="account-item" type="button" data-account-action="password">🔒 <span>Change Password</span></button>
      <button class="account-item admin" id="vtradeAdminItem" type="button" data-account-action="admin" style="display:none">♛ <span>Admin Dashboard</span></button>
      <button class="account-item logout" type="button" data-account-action="logout">↪ <span>Logout</span></button>
    </div>
  </div>`;

  const script = `
<script>
(function(){
  const VTRADE_ACCOUNT_SESSION_MENU_V2=true;
  const API=String(localStorage.getItem('vtrade_api')||'https://forexai-6xw6.onrender.com').replace(/\\/$/,'');
  const TOKEN_KEY='vtrade_auth_token';
  const getToken=()=>sessionStorage.getItem(TOKEN_KEY)||sessionStorage.getItem('vtrade_auth')||'';
  const clearLocal=()=>{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem('vtrade_auth');sessionStorage.removeItem('vtrade_user');};
  const goLogin=()=>{clearLocal();location.href='login.html';};
  const esc=v=>String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const byId=id=>document.getElementById(id);
  let user={};
  try{user=JSON.parse(sessionStorage.getItem('vtrade_user')||'{}')||{};}catch(_){user={};}
  function applyUser(u){
    user=u||user||{};
    const name=String(user.name||user.email||'Account');
    const email=String(user.email||'Signed in');
    const role=String(user.role||'member').toLowerCase();
    const admin=role==='admin';
    const initial=(name.trim()[0]||'V').toUpperCase();
    byId('vtradeAccountAvatar').textContent=initial;
    byId('vtradeAccountName').textContent=name;
    byId('vtradeAccountEmail').textContent=email;
    byId('vtradeMenuName').textContent=name;
    byId('vtradeMenuEmail').textContent=email;
    const badge=byId('vtradeMenuRole'); badge.textContent=admin?'ADMINISTRATOR':'MEMBER'; badge.classList.toggle('admin',admin);
    byId('vtradeAdminItem').style.display=admin?'flex':'none';
    sessionStorage.setItem('vtrade_user',JSON.stringify(user));
  }
  async function verifySession(){
    const t=getToken(); if(!t) return goLogin();
    try{
      const r=await fetch(API+'/api/auth/session',{headers:{'x-vtrade-auth':t},credentials:'include',cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) return goLogin();
      if(d.user) applyUser(d.user); else applyUser(user);
    }catch(_){
      // Keep the terminal usable during a temporary backend blip; API calls still enforce auth.
      applyUser(user);
    }
  }
  async function logout(){
    const t=getToken();
    try{
      // If a server logout endpoint exists, invalidate the server session too.
      await fetch(API+'/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','x-vtrade-auth':t},credentials:'include',cache:'no-store'});
    }catch(_){/* local logout remains authoritative for the browser */}
    goLogin();
  }
  function closeMenu(){const d=byId('vtradeAccountDropdown');const b=byId('vtradeAccountTrigger');if(d)d.classList.remove('open');if(b)b.setAttribute('aria-expanded','false');}
  const trigger=byId('vtradeAccountTrigger');
  trigger.addEventListener('click',e=>{e.stopPropagation();const d=byId('vtradeAccountDropdown');const open=d.classList.toggle('open');trigger.setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',e=>{if(!e.target.closest('#vtradeAccountMenu'))closeMenu();});
  document.querySelectorAll('[data-account-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const action=btn.getAttribute('data-account-action');
    closeMenu();
    if(action==='logout') return logout();
    if(action==='profile') return document.querySelector('[data-target="profile"]')?.click();
    if(action==='settings') return document.querySelector('[data-target="settings"]')?.click();
    if(action==='admin') return document.querySelector('[data-target="admin"]')?.click();
    if(action==='password') return document.querySelector('[data-target="settings"]')?.click();
  }));
  // Add a visible profile/logout entry to the sidebar as well, without replacing existing trading navigation.
  const nav=document.getElementById('nav');
  if(nav && !document.getElementById('vtradeSidebarAccount')){
    const box=document.createElement('div'); box.id='vtradeSidebarAccount'; box.style.cssText='display:grid;gap:6px;margin-top:4px;padding-top:6px;border-top:1px solid #1d2c44';
    box.innerHTML='<button class="nav button account-btn" type="button" style="display:flex;align-items:center;gap:10px;border:1px solid transparent;background:transparent;color:#9aa9bf;text-align:left;padding:12px 13px;min-height:46px;border-radius:12px" data-side-account="profile"><span class="nav-icon">◉</span><span>Profile</span></button><button class="nav button logout-danger" type="button" style="display:flex;align-items:center;gap:10px;border:1px solid #7c2532;background:#2b0c13;color:#ff8c98;text-align:left;padding:12px 13px;min-height:46px;border-radius:12px" data-side-account="logout"><span class="nav-icon">↪</span><span>Logout</span></button>';
    nav.appendChild(box);
    box.querySelector('[data-side-account="profile"]').addEventListener('click',()=>document.querySelector('[data-account-action="profile"]')?.click());
    box.querySelector('[data-side-account="logout"]').addEventListener('click',logout);
  }
  verifySession();
})();
</script>`;

  source=source.replace('</style>',css+'\\n</style>');
  source=source.replace('<div class="tfs">','<div class="tfs">');
  source=source.replace('</header>',menu+'\\n</header>');
  return source;
}

try{
  const before=fs.readFileSync(FILE,'utf8');
  const after=patch(before);
  if(after!==before){fs.writeFileSync(FILE,after,'utf8');console.log('[V-TRADE ACCOUNT FLOW] User Profile + Session + Logout menu added');}
  else console.log('[V-TRADE ACCOUNT FLOW] session menu already applied');
}catch(e){console.error('[V-TRADE ACCOUNT FLOW] patch failed:',e.message);process.exitCode=1;}
