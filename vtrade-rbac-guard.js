/* V TRADE AI — Server-authoritative RBAC + phone navigation guard V9 */
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
  const isMobile = () => { try { return matchMedia('(max-width:900px)').matches || /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } catch { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } };
  const login = reason => location.replace(`connection.html?required=login&reason=${encodeURIComponent(reason || 'login')}`);
  const goAdmin = () => location.replace('admin-dashboard.html?v=20260820-phone-v9');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function verifySession() {
    const t = token();
    if (!t) return { ok:false, reason:'missing-token' };
    let err = null;
    for (let i=1; i<=4; i++) {
      try {
        const r = await fetch(BACKEND + '/api/auth/session', { method:'GET', mode:'cors', credentials:'omit', cache:'no-store', headers:{Accept:'application/json','x-vtrade-auth':t} });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.user) return { ok:true, user:d.user };
        err = new Error(r.status === 401 ? 'Unauthorized' : `Session HTTP ${r.status}`);
      } catch (e) { err = e; }
      if (i < 4) await sleep(250*i);
    }
    return { ok:false, reason:err?.message || 'session-failed' };
  }

  function persistUser(u) {
    const raw = JSON.stringify(u || {});
    try { localStorage.setItem('vtrade_user', raw); } catch {}
    try { sessionStorage.setItem('vtrade_user', raw); } catch {}
  }

  function installAdminPhoneBar() {
    if (!isMobile() || !isAdminPage || document.getElementById('vtradePhoneBarV9')) return;
    const km = localStorage.getItem('vtrade_lang') === 'km';
    const css = document.createElement('style');
    css.id = 'vtradePhoneBarV9Style';
    css.textContent = `
      @media(max-width:900px){
        #vtradePhoneBarV9{position:sticky;top:0;z-index:100;display:grid;grid-template-columns:minmax(0,1fr) 72px 72px 42px;gap:6px;margin:0 0 8px;padding:6px;border:1px solid #233552;border-radius:13px;background:#07101df5;box-shadow:0 10px 30px #0009;backdrop-filter:blur(16px)}
        #vtradePhoneBarV9 a,#vtradePhoneBarV9 select,#vtradePhoneBarV9 button{height:40px;min-width:0;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#e8eef8;text-decoration:none;display:flex;align-items:center;justify-content:center;font:800 10px Arial;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;outline:none}
        #vtradePhoneBarV9 a.active{background:#5421cf;border-color:#8050ff;color:#fff}
        #vtradePhoneBarV9 select{width:100%}
        #vtradePhoneBarV9 .v9-menu{cursor:pointer}
        #vtradePhoneMenuV9{display:none;position:fixed;top:61px;right:9px;z-index:5000;width:220px;padding:8px;border:1px solid #233552;border-radius:14px;background:#07101dfd;box-shadow:0 18px 50px #000b}
        #vtradePhoneMenuV9.open{display:grid;gap:6px}
        #vtradePhoneMenuV9 a,#vtradePhoneMenuV9 button{min-height:42px;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#fff;text-decoration:none;display:flex;align-items:center;padding:0 12px;font:800 11px Arial}
        #vtradePhoneMenuV9 .danger{background:#2b0c13;border-color:#7c2532;color:#ff9aa5}
      }
      @media(min-width:901px){#vtradePhoneBarV9,#vtradePhoneMenuV9{display:none!important}}
    `;
    document.head.appendChild(css);

    const bar = document.createElement('nav');
    bar.id = 'vtradePhoneBarV9';
    bar.innerHTML = `
      <a class="active" href="admin-dashboard.html?v=20260820-phone-v9">Admin Dashboard</a>
      <select id="v9Tf" aria-label="Timeframe"><option value="M5">M5</option><option value="M15">M15</option><option value="H1">1H</option><option value="H4">4H</option><option value="D1">1D</option></select>
      <select id="v9Lang" aria-label="Language"><option value="en">EN</option><option value="km">ខ្មែរ</option></select>
      <button class="v9-menu" id="v9Menu" aria-label="Menu">☰</button>
    `;

    const shell = document.querySelector('.shell');
    if (shell && shell.parentNode) shell.parentNode.insertBefore(bar, shell);
    else document.body.prepend(bar);

    const menu = document.createElement('div');
    menu.id = 'vtradePhoneMenuV9';
    menu.innerHTML = `
      <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v9">▣ &nbsp; Live Terminal</a>
      <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v9#signals">◈ &nbsp; Signals</a>
      <a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-phone-v9#ai">✦ &nbsp; AI</a>
      <a href="profile.html">◉ &nbsp; ${km ? 'គណនី' : 'Profile'}</a>
      <button id="v9Refresh">↻ &nbsp; ${km ? 'ផ្ទុកឡើងវិញ' : 'Refresh'}</button>
      <button class="danger" id="v9Logout">↪ &nbsp; ${km ? 'ចាកចេញ' : 'Sign out'}</button>
    `;
    document.body.appendChild(menu);

    const toggle = () => menu.classList.toggle('open');
    bar.querySelector('#v9Menu').addEventListener('click', toggle);
    document.addEventListener('click', e => { if (!bar.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('open'); });
    menu.querySelector('#v9Refresh').onclick = () => location.reload();
    menu.querySelector('#v9Logout').onclick = async () => {
      try { await fetch(BACKEND + '/api/auth/logout',{method:'POST',mode:'cors',credentials:'omit',headers:{Accept:'application/json','x-vtrade-auth':token()}}); } catch {}
      try { localStorage.removeItem('vtrade_auth_token'); localStorage.removeItem('vtrade_auth'); localStorage.removeItem('vtrade_user'); sessionStorage.clear(); } catch {}
      location.replace('connection.html?logged_out=1');
    };

    const lang = bar.querySelector('#v9Lang');
    lang.value = km ? 'km' : 'en';
    lang.onchange = () => { localStorage.setItem('vtrade_lang', lang.value); location.reload(); };

    const tf = bar.querySelector('#v9Tf');
    tf.onchange = () => {
      const value = tf.value;
      location.href = `premium-dashboard-live.html?from=admin-terminal&tf=${encodeURIComponent(value)}&v=20260820-phone-v9`;
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
        if (!fromAdmin) return goAdmin();
      }
      if (isAdminPage && !isAdminRole(role)) return goAdmin();
      installAdminPhoneBar();
    }

    window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:u,role,mobile:isMobile()}}));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',verify,{once:true});
  else verify();
})();
