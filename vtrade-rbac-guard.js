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
  const user = () => location.replace('premium-dashboard-live.html?v=20260819-rbac');

  function installAdminNavigation() {
    if (!isAdminPage || document.getElementById('vtradeAdminSidebar')) return;

    const style = document.createElement('style');
    style.id = 'vtradeAdminNavStyle';
    style.textContent = `
      body.vtrade-admin-nav{padding-left:268px}
      body.vtrade-admin-nav .shell{max-width:1600px;margin:0 auto}
      #vtradeAdminSidebar{position:fixed;left:12px;top:12px;bottom:12px;width:238px;z-index:1000;display:flex;flex-direction:column;padding:16px 12px;border:1px solid #233552;border-radius:18px;background:linear-gradient(180deg,#0a1322f7,#060b14f7);box-shadow:0 20px 60px #0009;backdrop-filter:blur(18px)}
      .vta-brand{display:flex;align-items:center;gap:10px;padding:4px 6px 16px;border-bottom:1px solid #17253a;margin-bottom:10px}
      .vta-logo{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:22px;font-weight:950;background:linear-gradient(135deg,#5120ff,#aa72ff);box-shadow:0 0 26px #693cff55}
      .vta-name{font-weight:900;font-size:14px}.vta-sub{display:block;color:#8d9bb0;font-size:10px;margin-top:3px}
      .vta-nav{display:grid;gap:5px;overflow:auto}.vta-nav a{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 11px;border:1px solid transparent;border-radius:11px;color:#b8c4d6;text-decoration:none;font-weight:700;font-size:12px}.vta-nav a:hover{background:#101b2d;border-color:#233552;color:#fff}.vta-nav a.active{background:#24104f;border-color:#7041ee;color:#fff;box-shadow:inset 3px 0 #8c63ff}.vta-icon{width:20px;text-align:center;font-size:15px}.vta-bottom{margin-top:auto;padding-top:10px;border-top:1px solid #17253a}.vta-live{display:flex;align-items:center;gap:8px;padding:10px 8px;color:#22e58a;font-size:10px;font-weight:800}.vta-dot{width:7px;height:7px;border-radius:50%;background:#22e58a;box-shadow:0 0 10px #22e58a}
      #vtradeAdminMenuBtn{display:none;border:1px solid #233552;background:#0b1423;color:#fff;border-radius:11px;width:46px;height:42px;font-size:21px;cursor:pointer}
      #vtradeAdminDrawer{display:none}
      #vtradeAdminBottomNav{display:none}
      body.vtrade-admin-nav .top>.actions{display:none}
      @media(max-width:700px){
        body.vtrade-admin-nav{padding:7px;padding-bottom:92px}
        body.vtrade-admin-nav .shell{width:100%;margin:0}
        .top{flex-direction:row!important;align-items:center!important;min-height:62px;padding:10px 11px!important}
        .brand{min-width:0;flex:1}.brand h1{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .top .brand .logo{display:none}
        .logo{width:40px;height:40px}.top #vtradeAdminMenuBtn{display:block;flex:0 0 auto}.top>.actions{display:none!important}
        #vtradeAdminSidebar{display:none}
        .vta-overlay{position:fixed;inset:0;background:#0008;z-index:1090;opacity:0;pointer-events:none;transition:.18s}.vta-overlay.open{opacity:1;pointer-events:auto}
        #vtradeAdminDrawer{position:fixed;top:0;right:0;bottom:0;width:min(84vw,330px);z-index:1100;display:flex;flex-direction:column;padding:18px 14px;background:#07101df9;border-left:1px solid #233552;box-shadow:-18px 0 55px #000b;transform:translateX(105%);transition:transform .2s ease;backdrop-filter:blur(18px)}
        #vtradeAdminDrawer.open{transform:translateX(0)}.vtd-head{display:flex;align-items:center;justify-content:space-between;padding:4px 5px 14px;border-bottom:1px solid #17253a}.vtd-title{font-weight:900}.vtd-close{border:1px solid #233552;background:#0b1423;color:#fff;border-radius:10px;width:40px;height:38px;font-size:20px}.vtd-nav{display:grid;gap:6px;margin-top:12px;overflow:auto}.vtd-nav a{display:flex;align-items:center;gap:11px;min-height:46px;padding:0 12px;border:1px solid #17253a;border-radius:11px;background:#09111e;color:#dbe4f3;text-decoration:none;font-weight:700}.vtd-nav a:active{background:#24104f;border-color:#7041ee}.vtd-live{margin-top:auto;padding:12px;color:#22e58a;border-top:1px solid #17253a;font-size:11px;font-weight:800}
        #vtradeAdminBottomNav{position:fixed;left:7px;right:7px;bottom:7px;height:68px;z-index:1050;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px;background:#07101df5;border:1px solid #233552;border-radius:18px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
        #vtradeAdminBottomNav a,#vtradeAdminBottomNav button{appearance:none;border:0;background:transparent;color:#9eabc0;text-decoration:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;font-weight:800;cursor:pointer}
        #vtradeAdminBottomNav .bn-icon{font-size:18px;line-height:20px}.bn-active{background:#24104f!important;color:#c6b4ff!important}.bn-brand{position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:1045;display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #233552;border-radius:13px;background:#07101df2;box-shadow:0 10px 35px #0009;white-space:nowrap}.bn-brand .vta-logo{width:32px;height:32px;border-radius:10px;font-size:17px}.bn-brand .vta-name{font-size:11px}.bn-brand .vta-sub{font-size:8px}
        .stats{grid-template-columns:1fr 1fr}.card{padding:13px}.market{grid-template-columns:1fr}.toolbar{display:grid;grid-template-columns:1fr 1fr}.input{min-width:0;width:100%}.plan{grid-template-columns:1fr}.section-title{align-items:flex-start}.section-title h2{font-size:15px}.table th,.table td{font-size:10px;padding:8px}.num{font-size:23px}
      }
    `;
    document.head.appendChild(style);

    const nav = [
      ['⌂','Home','admin-dashboard.html'],
      ['▣','Terminal','premium-dashboard-live.html'],
      ['◈','Signals','premium-dashboard-live.html#signals'],
      ['✦','AI','premium-dashboard-live.html#ai'],
      ['☰','More','javascript:void(0)']
    ];
    const links = nav.slice(0,4).map(([i,t,h]) => `<a href="${h}" class="${h === 'admin-dashboard.html' ? 'active' : ''}"><span class="vta-icon">${i}</span><span>${t}</span></a>`).join('');
    const sideNav = [
      ['⌂','Admin Home','admin-dashboard.html'],
      ['▣','Live Terminal','premium-dashboard-live.html'],
      ['◈','Account Terminal','account-terminal.html'],
      ['♟','Profile','profile.html']
    ];
    const sideLinks = sideNav.map(([i,t,h]) => `<a href="${h}" class="${h === 'admin-dashboard.html' ? 'active' : ''}"><span class="vta-icon">${i}</span><span>${t}</span></a>`).join('');
    const html = `<aside id="vtradeAdminSidebar" aria-label="Admin navigation"><div class="vta-brand"><div class="vta-logo">V</div><div><div class="vta-name">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div></div><nav class="vta-nav">${sideLinks}</nav><div class="vta-bottom"><div class="vta-live"><span class="vta-dot"></span> MT5 BACKEND LIVE</div></div></aside><div id="vtradeAdminOverlay" class="vta-overlay"></div><aside id="vtradeAdminDrawer" aria-label="Mobile admin navigation"><div class="vtd-head"><div><div class="vtd-title">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div><button id="vtradeAdminClose" class="vtd-close" type="button" aria-label="Close menu">×</button></div><nav class="vtd-nav">${sideLinks}<a href="javascript:void(0)" id="vtradeAdminRefresh"><span>↻</span><span>Refresh</span></a><a href="javascript:void(0)" id="vtradeAdminLogout"><span>⇥</span><span>Sign out</span></a></nav><div class="vtd-live">● MT5 BACKEND LIVE</div></aside><nav id="vtradeAdminBottomNav" aria-label="Mobile admin navigation">${links}<button id="vtradeBottomMore" type="button"><span class="bn-icon">☰</span><span>More</span></button></nav><div class="bn-brand"><div class="vta-logo">V</div><div><div class="vta-name">V TRADE AI</div><span class="vta-sub">ICT Smart Terminal</span></div></div>`;
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
      const r = await fetch(BACKEND + '/api/auth/session', {
        method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
        headers: { 'Accept': 'application/json', 'x-vtrade-auth': t }
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.user) return login();
      const role = String(d.user.role || 'user').toLowerCase();
      const language = localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en';
      sessionStorage.setItem('vtrade_user', JSON.stringify(d.user));
      localStorage.setItem('vtrade_lang', language);
      document.documentElement.lang = language;
      document.documentElement.dataset.role = role;
      if (isAdminPage && role !== 'admin' && role !== 'administrator') return user();
      if (isAdminPage) installAdminNavigation();
      window.dispatchEvent(new CustomEvent('vtrade:rbac-ready', { detail: { user: d.user, role, language } }));
    } catch (error) {
      console.error('[V-TRADE RBAC] session verification failed:', error);
      login();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verify, { once: true });
  else verify();
})();
