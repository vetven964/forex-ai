/* V TRADE AI — Server-authoritative RBAC + mobile-first session guard V7 */
(() => {
  'use strict';
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
  const isAdminRole = role => ['admin', 'administrator'].includes(String(role || '').trim().toLowerCase());
  const mobile = () => { try { return window.matchMedia('(max-width:900px)').matches || /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } catch { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } };
  const admin = () => location.replace('admin-dashboard.html?v=20260820-mobile-v7');
  const user = () => location.replace('premium-dashboard-live.html?v=20260820-mobile-v7');
  const login = r => location.replace(`connection.html?required=login&reason=${encodeURIComponent(r || 'login')}`);
  const adminIntent = () => { try { const q = new URLSearchParams(location.search); return q.get('from') === 'admin-terminal' || q.get('from') === 'admin' || /admin-dashboard\.html/i.test(document.referrer || ''); } catch { return false; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function verifySession() {
    const t = token();
    if (!t) return { ok:false, reason:'missing-token' };
    let err = null;
    for (let i=1; i<=4; i++) {
      try {
        const r = await fetch(BACKEND + '/api/auth/session', { method:'GET', mode:'cors', credentials:'omit', cache:'no-store', headers:{Accept:'application/json','x-vtrade-auth':t} });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.user) return {ok:true,user:d.user};
        err = new Error(r.status === 401 ? 'Unauthorized' : `Session HTTP ${r.status}`);
      } catch (e) { err = e; }
      if (i < 4) await sleep(250*i);
    }
    return {ok:false,reason:err?.message || 'session-failed'};
  }

  function persistUser(u) {
    if (!u) return;
    const raw = JSON.stringify(u);
    try { localStorage.setItem('vtrade_user', raw); } catch {}
    try { sessionStorage.setItem('vtrade_user', raw); } catch {}
  }

  function injectMobileMenu() {
    if (!mobile() || document.getElementById('vtradeMobileNavV7')) return;

    const km = localStorage.getItem('vtrade_lang') === 'km';
    const labels = km ? {
      admin:'Admin Dashboard', terminal:'Live Terminal', signals:'Signals', ai:'AI', menu:'ម៉ឺនុយ', timeframe:'TF', language:'ភាសា', home:'ទំព័រដើម'
    } : {
      admin:'Admin Dashboard', terminal:'Live Terminal', signals:'Signals', ai:'AI', menu:'Menu', timeframe:'TF', language:'Language', home:'Home'
    };

    const style = document.createElement('style');
    style.id = 'vtradeMobileNavV7Style';
    style.textContent = `
      #vtradeMobileNavV7{position:sticky;top:0;z-index:4800;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:6px;align-items:center;margin:0 0 8px;padding:7px;border:1px solid #233552;border-radius:14px;background:#07101df7;box-shadow:0 12px 35px #0009;backdrop-filter:blur(16px)}
      #vtradeMobileNavV7 .v7-link{min-width:0;height:40px;padding:0 10px;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#dbe4f3;text-decoration:none;display:flex;align-items:center;justify-content:center;font:800 11px Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #vtradeMobileNavV7 .v7-link.active{background:#5421cf;border-color:#8050ff;color:#fff}
      #vtradeMobileNavV7 select{height:40px;min-width:72px;border:1px solid #233552;border-radius:10px;background:#0b1423;color:#fff;padding:0 8px;font:800 11px Arial;outline:none}
      #vtradeMobileNavV7 .v7-tf{min-width:76px}
      @media(max-width:430px){#vtradeMobileNavV7{grid-template-columns:minmax(0,1fr) 72px 72px 42px}#vtradeMobileNavV7 .v7-link{padding:0 7px;font-size:10px}#vtradeMobileNavV7 .v7-tf,#vtradeMobileNavV7 .v7-lang{min-width:0;width:100%}}
      @media(min-width:701px){#vtradeMobileNavV7{display:none}}
    `;
    document.head.appendChild(style);

    const nav = document.createElement('nav');
    nav.id = 'vtradeMobileNavV7';
    nav.setAttribute('aria-label','V TRADE AI mobile navigation');
    nav.innerHTML = `
      <a class="v7-link ${isAdminPage?'active':''}" href="admin-dashboard.html?v=20260820-mobile-v7">${labels.admin}</a>
      <select class="v7-tf" id="v7Timeframe" aria-label="${labels.timeframe}">
        <option value="M5">M5</option><option value="M15">M15</option><option value="H1">1H</option><option value="D1">1D</option>
      </select>
      <select class="v7-lang" id="v7Language" aria-label="${labels.language}">
        <option value="en">EN</option><option value="km">ខ្មែរ</option>
      </select>
      <a class="v7-link ${isUserPage?'active':''}" href="${isAdminPage?'premium-dashboard-live.html?from=admin-terminal&v=20260820-mobile-v7':'admin-dashboard.html?v=20260820-mobile-v7'}">☰</a>
    `;

    const shell = document.querySelector('.shell') || document.body.firstElementChild;
    if (shell && shell.parentNode) shell.parentNode.insertBefore(nav, shell);
    else document.body.prepend(nav);

    const lang = document.getElementById('v7Language');
    if (lang) {
      lang.value = km ? 'km' : 'en';
      lang.addEventListener('change', () => { localStorage.setItem('vtrade_lang', lang.value); location.reload(); });
    }

    const tf = document.getElementById('v7Timeframe');
    if (tf) {
      const current = (new URLSearchParams(location.search).get('tf') || '').toUpperCase();
      if (['M5','M15','H1','D1'].includes(current)) tf.value = current;
      tf.addEventListener('change', () => {
        const value = tf.value;
        const map = {M5:['M5','5m'],M15:['M15','15m'],H1:['H1','1h'],D1:['D1','1d']}[value];
        let clicked = false;
        const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],select'));
        for (const n of nodes) {
          const text = String(n.textContent || '').trim().toUpperCase();
          const val = String(n.value || '').toUpperCase();
          if (text === value || text === (value==='H1'?'1H':value==='D1'?'1D':value) || val === value || (map && val === map[1].toUpperCase())) { if (n !== tf) { n.click(); clicked=true; break; } }
        }
        const url = new URL(location.href);
        url.searchParams.set('tf', value);
        url.searchParams.set('v','20260820-mobile-v7');
        if (!clicked && isUserPage) history.replaceState({},'',url.href);
        try { window.dispatchEvent(new CustomEvent('vtrade:timeframe-change',{detail:{timeframe:value}})); } catch {}
      });
    }
  }

  function installAdminMobileDrawer() {
    if (!mobile() || !isAdminPage || document.getElementById('vtradeAdminMobileUI')) return;
    const style = document.createElement('style');
    style.id='vtradeAdminMobileUIStyleV7';
    style.textContent=`
      #vtradeAdminMobileUI{display:grid;position:fixed;left:7px;right:7px;bottom:7px;z-index:4900;height:68px;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px;background:#07101df5;border:1px solid #233552;border-radius:18px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
      #vtradeAdminMobileUI a,#vtradeAdminMobileUI button{border:0;background:transparent;color:#9eabc0;text-decoration:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9px;font-weight:900}
      #vtradeAdminMobileUI .vta-active{background:#24104f!important;color:#c6b4ff!important}
      @media(min-width:701px){#vtradeAdminMobileUI{display:none!important}}
    `;
    document.head.appendChild(style);
    const ui=document.createElement('div');ui.id='vtradeAdminMobileUI';
    ui.innerHTML=`<a class="vta-active" href="admin-dashboard.html">⌂<span>${localStorage.getItem('vtrade_lang')==='km'?'ទំព័រដើម':'Home'}</span></a><a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-mobile-v7">▣<span>Terminal</span></a><a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-mobile-v7#signals">◈<span>Signals</span></a><a href="premium-dashboard-live.html?from=admin-terminal&v=20260820-mobile-v7#ai">✦<span>AI</span></a><button id="v7More">☰<span>${localStorage.getItem('vtrade_lang')==='km'?'ម៉ឺនុយ':'More'}</span></button>`;
    document.body.appendChild(ui);
    document.getElementById('v7More')?.addEventListener('click',()=>{ document.getElementById('vtradeMobileNavV7')?.scrollIntoView({behavior:'smooth',block:'start'}); });
  }

  async function verify() {
    const result = await verifySession();
    if (!result.ok) return login(result.reason);
    const u=result.user;
    const role=String(u?.role||'user').trim().toLowerCase();
    persistUser(u);
    document.documentElement.lang=localStorage.getItem('vtrade_lang')==='km'?'km':'en';
    document.documentElement.dataset.role=role;

    if (mobile()) {
      if (isUserPage && isAdminRole(role) && !adminIntent()) return admin();
      if (isAdminPage && !isAdminRole(role)) return user();
    }

    injectMobileMenu();
    installAdminMobileDrawer();
    window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:u,role,mobile:mobile(),adminTerminal:adminIntent()}}));
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',verify,{once:true}); else verify();
})();
