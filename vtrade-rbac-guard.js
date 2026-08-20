/* V TRADE AI — Server-authoritative RBAC + mobile-first session guard V4 */
(() => {
  if (window.__VTRADE_RBAC_GUARD__) return;
  window.__VTRADE_RBAC_GUARD__ = true;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const file = String(location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminPage = file === 'admin-dashboard.html';
  const isUserPage = file === 'premium-dashboard-live.html';
  if (!isAdminPage && !isUserPage) return;

  const token = () => window.VTRADE_CONNECTION?.token?.() ||
    localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') ||
    sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') || '';
  const login = (reason='login') => location.replace(`connection.html?required=login&reason=${encodeURIComponent(reason)}`);
  const admin = () => location.replace('admin-dashboard.html?v=20260820-mobile-rbac-v4');
  const user = () => location.replace('premium-dashboard-live.html?v=20260820-mobile-rbac-v4');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const isAdminRole = role => ['admin','administrator'].includes(String(role || '').trim().toLowerCase());
  const isMobileDevice = () => {
    try { return window.matchMedia('(max-width: 900px)').matches || /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); }
    catch { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); }
  };

  async function verifySession() {
    const t = token();
    if (!t) return {ok:false, reason:'missing-token'};
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const r = await fetch(BACKEND + '/api/auth/session', {
          method:'GET', mode:'cors', credentials:'omit', cache:'no-store',
          headers:{Accept:'application/json','x-vtrade-auth':t}
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.user) return {ok:true,user:d.user};
        if (r.status === 401) lastError = new Error('Unauthorized');
        else lastError = new Error(`Session HTTP ${r.status}`);
      } catch (e) { lastError = e; }
      if (attempt < 4) await sleep(250 * attempt);
    }
    return {ok:false, reason:lastError?.message || 'session-failed'};
  }

  function persistUser(u) {
    if (!u) return;
    const raw = JSON.stringify(u);
    try { localStorage.setItem('vtrade_user', raw); } catch {}
    try { sessionStorage.setItem('vtrade_user', raw); } catch {}
  }

  function installAdminMobileUI() {
    if (!isAdminPage || document.getElementById('vtradeAdminMobileUI')) return;
    const style = document.createElement('style');
    style.id = 'vtradeAdminMobileUIStyle';
    style.textContent = `
      #vtradeAdminMobileUI{display:none}
      @media(max-width:700px){
        body{padding:7px 7px 88px!important;overflow-x:hidden!important}
        .shell{width:100%!important;max-width:100%!important}
        .top{position:relative!important;display:flex!important;flex-direction:row!important;align-items:center!important;min-height:62px!important;padding:9px 10px!important;gap:8px!important;overflow:visible!important}
        .top .brand{min-width:0!important;flex:1!important}.top .brand h1{font-size:16px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.top .brand small{font-size:9px!important}
        .top .actions{display:none!important}
        .vta-menu-btn{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:1px solid #233552;border-radius:11px;background:#0b1423;color:#fff;font-size:20px}
        .vta-drawer{position:fixed;inset:0 0 0 auto;width:min(86vw,330px);z-index:5000;background:#07101df9;border-left:1px solid #233552;box-shadow:-20px 0 60px #000b;padding:16px;transform:translateX(105%);transition:transform .2s ease;display:flex;flex-direction:column}
        .vta-drawer.open{transform:none}.vta-overlay{position:fixed;inset:0;z-index:4999;background:#0009;opacity:0;pointer-events:none;transition:.2s}.vta-overlay.open{opacity:1;pointer-events:auto}
        .vta-drawer-head{display:flex;justify-content:space-between;align-items:center;padding:4px 0 14px;border-bottom:1px solid #17253a}.vta-drawer-title{font-weight:900;font-size:16px}.vta-close{width:40px;height:38px;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#fff;font-size:20px}
        .vta-links{display:grid;gap:7px;margin-top:14px}.vta-links a,.vta-links button{display:flex;align-items:center;gap:10px;min-height:46px;padding:0 12px;border:1px solid #17253a;border-radius:11px;background:#09111e;color:#dbe4f3;text-decoration:none;font-weight:800;font-size:12px}.vta-links .active{background:#24104f;border-color:#7041ee;color:#fff}.vta-links button{font:inherit;cursor:pointer;text-align:left}.vta-live{margin-top:auto;padding:13px 4px;border-top:1px solid #17253a;color:#22e58a;font-size:10px;font-weight:900}
        #vtradeAdminMobileUI{display:grid;position:fixed;left:7px;right:7px;bottom:7px;z-index:4900;height:68px;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px;background:#07101df5;border:1px solid #233552;border-radius:18px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
        #vtradeAdminMobileUI a,#vtradeAdminMobileUI button{border:0;background:transparent;color:#9eabc0;text-decoration:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9px;font-weight:900}.vta-active{background:#24104f!important;color:#c6b4ff!important}
        .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.card{min-width:0!important}.market{grid-template-columns:1fr!important}.table-wrap{max-width:100%;overflow-x:auto}.toolbar{grid-template-columns:1fr!important}.toolbar .btn{width:100%}.plan{grid-template-columns:1fr!important}.section-title{align-items:flex-start;flex-wrap:wrap}
      }
    `;
    document.head.appendChild(style);
    const ui = document.createElement('div');
    ui.id='vtradeAdminMobileUI';
    ui.innerHTML=`<a class="vta-active" href="admin-dashboard.html"><span>⌂</span><span>Home</span></a><a href="premium-dashboard-live.html"><span>▣</span><span>Terminal</span></a><a href="premium-dashboard-live.html#signals"><span>◈</span><span>Signals</span></a><a href="premium-dashboard-live.html#ai"><span>✦</span><span>AI</span></a><button id="vtaMore"><span>☰</span><span>More</span></button>`;
    document.body.appendChild(ui);
    const overlay=document.createElement('div');overlay.className='vta-overlay';document.body.appendChild(overlay);
    const drawer=document.createElement('aside');drawer.className='vta-drawer';drawer.innerHTML=`<div class="vta-drawer-head"><div><div class="vta-drawer-title">V TRADE AI</div><small style="color:#8d9bb0">Admin Control Center</small></div><button class="vta-close">×</button></div><nav class="vta-links"><a class="active" href="admin-dashboard.html">⌂ &nbsp; Admin Home</a><a href="premium-dashboard-live.html">▣ &nbsp; Live Terminal</a><a href="profile.html">♟ &nbsp; Profile</a><a href="login.html">↪ &nbsp; Sign in</a><button id="vtaRefresh">↻ &nbsp; Refresh</button><button id="vtaLogout">⇥ &nbsp; Sign out</button></nav><div class="vta-live">● MT5 BACKEND LIVE</div>`;document.body.appendChild(drawer);
    const open=()=>{drawer.classList.add('open');overlay.classList.add('open')};const close=()=>{drawer.classList.remove('open');overlay.classList.remove('open')};
    document.getElementById('vtaMore')?.addEventListener('click',open);overlay.addEventListener('click',close);drawer.querySelector('.vta-close').addEventListener('click',close);drawer.querySelector('#vtaRefresh').addEventListener('click',()=>{close();document.getElementById('refresh')?.click()});drawer.querySelector('#vtaLogout').addEventListener('click',()=>document.getElementById('logout')?.click());
    const top=document.querySelector('.top');if(top){const b=document.createElement('button');b.className='vta-menu-btn';b.textContent='☰';b.setAttribute('aria-label','Open menu');b.onclick=open;top.appendChild(b)}
  }

  async function verify() {
    const result = await verifySession();
    if (!result.ok) {
      console.warn('[V-TRADE RBAC V4] session verification failed after retry:', result.reason);
      return login(result.reason);
    }
    const u=result.user;
    const role=String(u?.role||'user').trim().toLowerCase();
    persistUser(u);
    const language=localStorage.getItem('vtrade_lang')==='km'?'km':'en';
    document.documentElement.lang=language;document.documentElement.dataset.role=role;

    // MOBILE ONLY: keep the requested Phone routing fix isolated from PC.
    // On PC, preserve the existing page flow exactly as it is.
    if (isMobileDevice()) {
      if (isUserPage && isAdminRole(role)) return admin();
      if (isAdminPage && !isAdminRole(role)) return user();
    }

    if(isAdminPage) installAdminMobileUI();
    window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:u,role,language,mobile:isMobileDevice()}}));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',verify,{once:true}); else verify();
})();