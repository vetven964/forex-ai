/* V TRADE AI — Server-authoritative RBAC + responsive Admin navigation */
(() => {
  if (window.__VTRADE_RBAC_GUARD__) return;
  window.__VTRADE_RBAC_GUARD__ = true;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const file = String(location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminPage = file === 'admin-dashboard.html';
  const isUserPage = file === 'premium-dashboard-live.html';
  if (!isAdminPage && !isUserPage) return;

  const token = () => window.VTRADE_CONNECTION?.token?.() ||
    sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') ||
    localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') || '';
  const login = () => location.replace('connection.html?required=login');
  const user = () => location.replace('premium-dashboard-live.html?v=20260820-rbac');

  function installAdminNavigation() {
    if (!isAdminPage || document.getElementById('vtradeAdminSidebar')) return;

    const style = document.createElement('style');
    style.id = 'vtradeAdminNavStyle';
    style.textContent = `
      html,body{width:100%;max-width:100%;min-width:0;overflow-x:hidden}
      body.vtrade-admin-nav{padding-left:268px;padding-right:12px}
      body.vtrade-admin-nav .shell{width:100%;max-width:1600px;margin:0 auto;min-width:0}
      #vtradeAdminSidebar{position:fixed;left:12px;top:12px;bottom:12px;width:238px;z-index:1000;display:flex;flex-direction:column;padding:16px 12px;border:1px solid #233552;border-radius:18px;background:linear-gradient(180deg,#0a1322f7,#060b14f7);box-shadow:0 20px 60px #0009;backdrop-filter:blur(18px)}
      .vta-brand{display:flex;align-items:center;gap:10px;padding:4px 6px 16px;border-bottom:1px solid #17253a;margin-bottom:10px;min-width:0}
      .vta-logo{width:42px;height:42px;flex:0 0 42px;border-radius:13px;display:grid;place-items:center;font-size:22px;font-weight:950;background:linear-gradient(135deg,#5120ff,#aa72ff);box-shadow:0 0 26px #693cff55}
      .vta-name{font-weight:900;font-size:14px}.vta-sub{display:block;color:#8d9bb0;font-size:10px;margin-top:3px}
      .vta-nav{display:grid;gap:5px;overflow:auto;min-width:0}.vta-nav a{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 11px;border:1px solid transparent;border-radius:11px;color:#b8c4d6;text-decoration:none;font-weight:700;font-size:12px}.vta-nav a:hover{background:#101b2d;border-color:#233552;color:#fff}.vta-nav a.active{background:#24104f;border-color:#7041ee;color:#fff;box-shadow:inset 3px 0 #8c63ff}.vta-icon{width:20px;text-align:center;font-size:15px}.vta-bottom{margin-top:auto;padding-top:10px;border-top:1px solid #17253a}.vta-live{display:flex;align-items:center;gap:8px;padding:10px 8px;color:#22e58a;font-size:10px;font-weight:800}.vta-dot{width:7px;height:7px;border-radius:50%;background:#22e58a;box-shadow:0 0 10px #22e58a}
      #vtradeAdminMenuBtn{display:none;border:1px solid #233552;background:#0b1423;color:#fff;border-radius:11px;width:42px;height:42px;font-size:20px;cursor:pointer;flex:0 0 42px}
      #vtradeAdminDrawer{display:none}
      #vtradeAdminBottomNav{display:none}
      .bn-brand{display:none}
      body.vtrade-admin-nav .top>.actions{display:none}

      @media(max-width:700px){
        html,body{width:100%;min-width:0;overflow-x:hidden}
        body.vtrade-admin-nav{padding:7px 7px calc(88px + env(safe-area-inset-bottom));min-width:0}
        body.vtrade-admin-nav .shell{width:100%;max-width:none;margin:0;min-width:0}
        .top{width:100%;min-width:0;max-width:100%;height:auto;min-height:60px!important;padding:9px 10px!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:7px!important;overflow:hidden}
        .brand{min-width:0!important;flex:1 1 auto!important;overflow:hidden;gap:7px!important}
        .top .brand .logo{display:none!important}
        .brand h1{min-width:0!important;max-width:100%!important;font-size:13px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin:0!important}
        .brand small{display:block!important;max-width:100%!important;font-size:8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        .top #vtradeAdminMenuBtn{display:grid!important;place-items:center!important;margin-left:auto!important}
        .top>.actions{display:none!important}

        #vtradeAdminSidebar{display:none!important}
        #vtradeAdminBottomNav{position:fixed;left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom));height:64px;z-index:1050;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;padding:5px;background:#07101df7;border:1px solid #233552;border-radius:17px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);overflow:hidden}
        #vtradeAdminBottomNav a,#vtradeAdminBottomNav button{appearance:none;border:0;background:transparent;color:#9eabc0;text-decoration:none;border-radius:11px;min-width:0;min-height:52px;padding:3px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:9px;font-weight:800;cursor:pointer;overflow:hidden}
        #vtradeAdminBottomNav .bn-icon{font-size:17px;line-height:19px}.bn-active{background:#24104f!important;color:#c6b4ff!important}

        .vta-overlay{position:fixed;inset:0;background:#0008;z-index:1090;opacity:0;pointer-events:none;transition:.18s}.vta-overlay.open{opacity:1;pointer-events:auto}
        #vtradeAdminDrawer{position:fixed;top:0;right:0;bottom:0;width:min(86vw,330px);z-index:1100;display:flex;flex-direction:column;padding:18px 14px max(18px,env(safe-area-inset-bottom));background:#07101df9;border-left:1px solid #233552;box-shadow:-18px 0 55px #000b;transform:translateX(105%);transition:transform .2s ease;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        #vtradeAdminDrawer.open{transform:translateX(0)}.vtd-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 5px 14px;border-bottom:1px solid #17253a}.vtd-title{font-weight:900}.vtd-close{border:1px solid #233552;background:#0b1423;color:#fff;border-radius:10px;width:40px;height:38px;font-size:20px}.vtd-nav{display:grid;gap:6px;margin-top:12px;overflow:auto}.vtd-nav a{display:flex;align-items:center;gap:11px;min-height:46px;padding:0 12px;border:1px solid #17253a;border-radius:11px;background:#09111e;color:#dbe4f3;text-decoration:none;font-weight:700}.vtd-nav a:active{background:#24104f;border-color:#7041ee}.vtd-live{margin-top:auto;padding:12px;color:#22e58a;border-top:1px solid #17253a;font-size:11px;font-weight:800}

        .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.card{min-width:0;padding:11px!important;border-radius:15px!important;overflow:hidden}.market{grid-template-columns:1fr!important;gap:8px!important}.market-box{min-width:0;overflow:hidden}.section-title{min-width:0;align-items:flex-start}.section-title h2{font-size:15px!important;min-width:0}.toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}.input,.select{min-width:0!important;width:100%!important}.plan{grid-template-columns:1fr!important}.table-wrap{max-width:100%;overflow-x:auto!important;-webkit-overflow-scrolling:touch}.table{min-width:640px}.num{font-size:22px!important}.signal{font-size:23px!important}.metric-row{min-width:0;overflow:hidden}.metric-row span,.metric-row b{min-width:0;overflow-wrap:anywhere}.actions{min-width:0;max-width:100%}
      }
      @media(max-width:380px){
        body.vtrade-admin-nav{padding-left:5px;padding-right:5px;padding-bottom:86px}
        .top{padding:8px!important;min-height:56px!important}.brand h1{font-size:12px!important}.brand small{font-size:7.5px!important}.top #vtradeAdminMenuBtn{width:39px;height:39px;flex-basis:39px}
        #vtradeAdminBottomNav{left:4px;right:4px;height:62px;padding:4px;border-radius:15px}.vta-nav a,.vtd-nav a{min-height:44px}
        #vtradeAdminBottomNav a,#vtradeAdminBottomNav button{min-height:50px;font-size:8px}.vta-icon{width:17px}.bn-icon{font-size:16px!important}
        .stats{gap:6px!important}.card{padding:10px!important}.num{font-size:20px!important}.label{font-size:9px!important}.market-price{font-size:23px!important}.signal{font-size:21px!important}.metric-row{font-size:10px!important}
      }
      @media(max-width:700px) and (orientation:landscape){
        body.vtrade-admin-nav{padding-bottom:76px}.top{min-height:52px!important}.stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}.market{grid-template-columns:repeat(3,minmax(0,1fr))!important}#vtradeAdminBottomNav{height:58px}
      }
    `;
    document.head.appendChild(style);

    const bottom = [
      ['⌂','Home','admin-dashboard.html'],
      ['▣','Terminal','premium-dashboard-live.html'],
      ['◈','Signals','premium-dashboard-live.html#signals'],
      ['✦','AI','premium-dashboard-live.html#ai']
    ];
    const links = bottom.map(([i,t,h]) => `<a href="${h}" class="${h === 'admin-dashboard.html' ? 'bn-active' : ''}"><span class="bn-icon">${i}</span><span>${t}</span></a>`).join('');
    const sideNav = [
      ['⌂','Admin Home','admin-dashboard.html'],['▣','Live Terminal','premium-dashboard-live.html'],['◈','Account Terminal','account-terminal.html'],['♟','Profile','profile.html']
    ];
    const sideLinks = sideNav.map(([i,t,h]) => `<a href="${h}" class="${h === 'admin-dashboard.html' ? 'active' : ''}"><span class="vta-icon">${i}</span><span>${t}</span></a>`).join('');
    const html = `<aside id="vtradeAdminSidebar" aria-label="Admin navigation"><div class="vta-brand"><div class="vta-logo">V</div><div><div class="vta-name">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div></div><nav class="vta-nav">${sideLinks}</nav><div class="vta-bottom"><div class="vta-live"><span class="vta-dot"></span> MT5 BACKEND LIVE</div></div></aside><div id="vtradeAdminOverlay" class="vta-overlay"></div><aside id="vtradeAdminDrawer" aria-label="Mobile admin navigation"><div class="vtd-head"><div><div class="vtd-title">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div><button id="vtradeAdminClose" class="vtd-close" type="button" aria-label="Close menu">×</button></div><nav class="vtd-nav">${sideLinks}<a href="javascript:void(0)" id="vtradeAdminRefresh"><span>↻</span><span>Refresh</span></a><a href="javascript:void(0)" id="vtradeAdminLogout"><span>⇥</span><span>Sign out</span></a></nav><div class="vtd-live">● MT5 BACKEND LIVE</div></aside><nav id="vtradeAdminBottomNav" aria-label="Mobile admin navigation">${links}<button id="vtradeBottomMore" type="button"><span class="bn-icon">☰</span><span>More</span></button></nav>`;
    document.body.insertAdjacentHTML('afterbegin', html);

    const top = document.querySelector('.top');
    if (top) top.insertAdjacentHTML('beforeend', '<button id="vtradeAdminMenuBtn" type="button" aria-label="Open menu" aria-expanded="false">☰</button>');
    const drawer = document.getElementById('vtradeAdminDrawer');
    const overlay = document.getElementById('vtradeAdminOverlay');
    const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); document.getElementById('vtradeAdminMenuBtn')?.setAttribute('aria-expanded','true'); };
    const close = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); document.getElementById('vtradeAdminMenuBtn')?.setAttribute('aria-expanded','false'); };
    document.getElementById('vtradeAdminMenuBtn')?.addEventListener('click', open);
    document.getElementById('vtradeBottomMore')?.addEventListener('click', open);
    document.getElementById('vtradeAdminClose')?.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
    document.getElementById('vtradeAdminRefresh')?.addEventListener('click', () => { close(); document.getElementById('refresh')?.click(); });
    document.getElementById('vtradeAdminLogout')?.addEventListener('click', () => { close(); document.getElementById('logout')?.click(); });
  }

  async function verify() {
    const t = token();
    if (!t) return login();
    try {
      const r = await fetch(BACKEND + '/api/auth/session', {method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Accept':'application/json','x-vtrade-auth':t}});
      const d = await r.json().catch(()=>({}));
      if (!r.ok || !d.user) return login();
      const role = String(d.user.role || 'user').toLowerCase();
      const language = localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en';
      sessionStorage.setItem('vtrade_user', JSON.stringify(d.user));
      localStorage.setItem('vtrade_lang', language);
      document.documentElement.lang = language;
      document.documentElement.dataset.role = role;
      if (isAdminPage && role !== 'admin' && role !== 'administrator') return user();
      if (isAdminPage) installAdminNavigation();
      window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:d.user,role,language}}));
    } catch (error) { console.error('[V-TRADE RBAC] session verification failed:',error); login(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',verify,{once:true}); else verify();
})();
