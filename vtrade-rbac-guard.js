/* V TRADE AI — Server-authoritative RBAC + Phone-only navigation guard V8 */
(() => {
  'use strict';
  if (window.__VTRADE_RBAC_GUARD__) return;
  window.__VTRADE_RBAC_GUARD__ = true;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const file = String(location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminPage = file === 'admin-dashboard.html';
  const isTerminalPage = file === 'premium-dashboard-live.html';
  if (!isAdminPage && !isTerminalPage) return;

  const token = () => window.VTRADE_CONNECTION?.token?.() ||
    localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') ||
    sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') || '';
  const isAdminRole = role => ['admin', 'administrator'].includes(String(role || '').trim().toLowerCase());
  const isMobile = () => {
    try { return window.matchMedia('(max-width:900px)').matches || /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); }
    catch { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); }
  };
  const login = reason => location.replace(`connection.html?required=login&reason=${encodeURIComponent(reason || 'login')}`);
  const admin = () => location.replace('admin-dashboard.html?v=20260820-phone-v8');
  const terminal = () => location.replace('premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function verifySession() {
    const t = token();
    if (!t) return {ok:false, reason:'missing-token'};
    let err = null;
    for (let i = 1; i <= 4; i++) {
      try {
        const r = await fetch(BACKEND + '/api/auth/session', {
          method:'GET', mode:'cors', credentials:'omit', cache:'no-store',
          headers:{Accept:'application/json','x-vtrade-auth':t}
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.user) return {ok:true, user:d.user};
        err = new Error(r.status === 401 ? 'Unauthorized' : `Session HTTP ${r.status}`);
      } catch (e) { err = e; }
      if (i < 4) await sleep(250 * i);
    }
    return {ok:false, reason:err?.message || 'session-failed'};
  }

  function persistUser(u) {
    if (!u) return;
    const raw = JSON.stringify(u);
    try { localStorage.setItem('vtrade_user', raw); } catch {}
    try { sessionStorage.setItem('vtrade_user', raw); } catch {}
  }

  function installPhoneUI() {
    if (!isMobile() || document.getElementById('vtradePhoneV8')) return;
    const km = localStorage.getItem('vtrade_lang') === 'km';
    const L = km ? {
      home:'ទំព័រដើម', terminal:'Terminal', signals:'Signals', ai:'AI', more:'ច្រើនទៀត',
      admin:'Admin Dashboard', live:'Live Terminal', profile:'គណនី', settings:'ការកំណត់',
      refresh:'ផ្ទុកឡើងវិញ', logout:'ចាកចេញ', menu:'ម៉ឺនុយ', tf:'Timeframe', lang:'ភាសា'
    } : {
      home:'Home', terminal:'Terminal', signals:'Signals', ai:'AI', more:'More',
      admin:'Admin Dashboard', live:'Live Terminal', profile:'Profile', settings:'Settings',
      refresh:'Refresh', logout:'Sign out', menu:'Menu', tf:'Timeframe', lang:'Language'
    };

    const style = document.createElement('style');
    style.id = 'vtradePhoneV8Style';
    style.textContent = `
      @media(max-width:900px){
        html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
        #vtradePhoneV8{display:block!important}
        .v8-tools{position:sticky;top:0;z-index:4800;display:grid;grid-template-columns:minmax(0,1fr) 76px 76px 42px;gap:5px;align-items:center;margin:0 0 8px;padding:6px;border:1px solid #233552;border-radius:13px;background:#07101df5;box-shadow:0 12px 35px #0009;backdrop-filter:blur(16px)}
        .v8-tools a,.v8-tools select,.v8-tools button{height:38px;min-width:0;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#e8eef8;display:flex;align-items:center;justify-content:center;text-decoration:none;font:800 10px Arial;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .v8-tools a.active,.v8-tools button.active{background:#5421cf;border-color:#8050ff;color:#fff}
        .v8-tools select{width:100%;outline:none}
        .v8-bottom{position:fixed;left:7px;right:7px;bottom:calc(7px + env(safe-area-inset-bottom));height:64px;z-index:4700;display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:5px;border:1px solid #233552;border-radius:17px;background:#07101df7;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
        .v8-bottom a,.v8-bottom button{border:0;background:transparent;color:#9eabc0;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;font:900 9px Arial}.v8-bottom .active{background:#24104f;color:#c6b4ff}
        .v8-dimmer{position:fixed;inset:0;z-index:4890;background:#000a;opacity:0;pointer-events:none;transition:.2s}.v8-dimmer.open{opacity:1;pointer-events:auto}
        .v8-drawer{position:fixed;left:0;top:0;bottom:0;width:min(330px,84vw);z-index:4900;padding:max(15px,env(safe-area-inset-top)) 15px max(15px,env(safe-area-inset-bottom));background:#050b15fa;border-right:1px solid #263650;box-shadow:20px 0 60px #000b;transform:translateX(-105%);transition:transform .22s ease;display:flex;flex-direction:column;overflow:auto}
        .v8-drawer.open{transform:none}.v8-head{display:flex;align-items:center;justify-content:space-between;padding:5px 0 14px;border-bottom:1px solid #17253a}.v8-brand{display:flex;align-items:center;gap:9px}.v8-logo{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:21px;font-weight:950;background:linear-gradient(135deg,#5120ff,#aa72ff)}.v8-title{font-weight:950;font-size:15px}.v8-sub{color:#8493ab;font-size:9px;margin-top:2px}.v8-close{width:40px;height:38px;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#fff;font-size:20px}.v8-links{display:grid;gap:7px;margin-top:14px}.v8-links a,.v8-links button{min-height:45px;padding:0 12px;border:1px solid #17253a;border-radius:11px;background:#09111e;color:#dbe4f3;text-decoration:none;display:flex;align-items:center;gap:10px;font:800 12px Arial}.v8-links .active{background:#24104f;border-color:#7041ee;color:#fff}.v8-live{margin-top:auto;padding-top:14px;border-top:1px solid #17253a;color:#22e58a;font:900 10px Arial}
        body{padding-bottom:calc(78px + env(safe-area-inset-bottom))!important}
      }
      @media(min-width:901px){#vtradePhoneV8{display:none!important}}
      @media(max-width:430px){.v8-tools{grid-template-columns:minmax(0,1fr) 68px 68px 40px}.v8-tools a,.v8-tools select,.v8-tools button{font-size:9px}.v8-bottom{left:5px;right:5px}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vtradePhoneV8';
    root.innerHTML = `
      <div class="v8-tools">
        <a class="${isAdminPage?'active':''}" href="admin-dashboard.html?v=20260820-phone-v8">${L.admin}</a>
        <select id="v8Tf" aria-label="${L.tf}"><option value="M5">M5</option><option value="M15">M15</option><option value="H1">1H</option><option value="H4">4H</option><option value="D1">1D</option></select>
        <select id="v8Lang" aria-label="${L.lang}"><option value="en">EN</option><option value="km">ខ្មែរ</option></select>
        <button id="v8Menu" aria-label="${L.menu}">☰</button>
      </div>
      <div class="v8-dimmer" id="v8Dimmer"></div>
      <aside class="v8-drawer" id="v8Drawer">
        <div class="v8-head"><div class="v8-brand"><div class="v8-logo">V</div><div><div class="v8-title">V TRADE AI</div><div class="v8-sub">${isAdminPage ? L.admin : 'ICT Smart Terminal'}</div></div></div><button class="v8-close" id="v8Close">×</button></div>
        <nav class="v8-links">
          <a class="${isAdminPage?'active':''}" href="admin-dashboard.html?v=20260820-phone-v8">⌂ &nbsp; ${L.admin}</a>
          <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8">▣ &nbsp; ${L.live}</a>
          <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8#signals">◈ &nbsp; ${L.signals}</a>
          <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8#ai">✦ &nbsp; ${L.ai}</a>
          <a href="profile.html">◉ &nbsp; ${L.profile}</a>
          <button id="v8Refresh">↻ &nbsp; ${L.refresh}</button>
          <button id="v8Logout">↪ &nbsp; ${L.logout}</button>
        </nav>
        <div class="v8-live">● BACKEND LIVE · MT5 / XAUUSD</div>
      </aside>
      <nav class="v8-bottom">
        <a class="${isAdminPage?'active':''}" href="admin-dashboard.html?v=20260820-phone-v8">⌂<span>${L.home}</span></a>
        <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8">▣<span>${L.terminal}</span></a>
        <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8#signals">◈<span>${L.signals}</span></a>
        <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v8#ai">✦<span>${L.ai}</span></a>
        <button id="v8More">☰<span>${L.more}</span></button>
      </nav>
    `;

    const first = document.body.firstElementChild;
    if (first) first.parentNode.insertBefore(root, first);
    else document.body.appendChild(root);

    const drawer = root.querySelector('#v8Drawer');
    const dimmer = root.querySelector('#v8Dimmer');
    const open = () => { drawer.classList.add('open'); dimmer.classList.add('open'); };
    const close = () => { drawer.classList.remove('open'); dimmer.classList.remove('open'); };
    root.querySelector('#v8Menu').onclick = open;
    root.querySelector('#v8More').onclick = open;
    root.querySelector('#v8Close').onclick = close;
    dimmer.onclick = close;
    root.querySelector('#v8Refresh').onclick = () => location.reload();
    root.querySelector('#v8Logout').onclick = async () => {
      try { await fetch(BACKEND + '/api/auth/logout',{method:'POST',mode:'cors',credentials:'omit',headers:{Accept:'application/json','x-vtrade-auth':token()}}); } catch {}
      try { sessionStorage.clear(); localStorage.removeItem('vtrade_auth_token'); localStorage.removeItem('vtrade_auth'); localStorage.removeItem('vtrade_user'); } catch {}
      location.replace('connection.html?logged_out=1');
    };

    const lang = root.querySelector('#v8Lang');
    lang.value = km ? 'km' : 'en';
    lang.onchange = () => { localStorage.setItem('vtrade_lang', lang.value); location.reload(); };

    const tf = root.querySelector('#v8Tf');
    const qtf = (new URLSearchParams(location.search).get('tf') || '').toUpperCase();
    if (['M5','M15','H1','H4','D1'].includes(qtf)) tf.value = qtf;
    tf.onchange = () => {
      const value = tf.value;
      const native = [...document.querySelectorAll('.tfs button')].find(b => {
        const x = String(b.textContent || '').trim().toUpperCase().replace('1H','H1').replace('4H','H4').replace('1D','D1');
        return x === value;
      });
      if (native) native.click();
      const url = new URL(location.href); url.searchParams.set('tf', value); url.searchParams.set('v','20260820-phone-v8');
      if (!native) history.replaceState({},'',url.href);
      window.dispatchEvent(new CustomEvent('vtrade:timeframe-change',{detail:{timeframe:value}}));
    };
  }

  async function verify() {
    const result = await verifySession();
    if (!result.ok) return login(result.reason);
    const u = result.user;
    const role = String(u?.role || 'user').trim().toLowerCase();
    persistUser(u);
    document.documentElement.lang = localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en';
    document.documentElement.dataset.role = role;

    if (isMobile()) {
      if (isTerminalPage && isAdminRole(role)) {
        const q = new URLSearchParams(location.search);
        const fromAdmin = q.get('from') === 'admin-terminal' || q.get('from') === 'admin' || /admin-dashboard\.html/i.test(document.referrer || '');
        if (!fromAdmin) return admin();
      }
      if (isAdminPage && !isAdminRole(role)) return terminal();
      installPhoneUI();
    }

    window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:u,role,mobile:isMobile()}}));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',verify,{once:true});
  else verify();
})();
