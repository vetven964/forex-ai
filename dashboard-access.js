/* V TRADE AI — Main Dashboard navigation + package access gate */
(() => {
  'use strict';
  if (window.__VTRADE_DASHBOARD_ACCESS__) return;
  window.__VTRADE_DASHBOARD_ACCESS__ = true;

  const path = String(location.pathname.split('/').pop() || '').toLowerCase();
  if (path !== 'dashboard.html') return;

  const API = String(window.VTRADE?.API || 'https://forexai-6xw6.onrender.com').replace(/\/$/, '');
  const token = () => window.VTRADE?.token?.() || localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') || sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') || '';
  const paidPlan = plan => {
    const p = String(plan || '').trim().toLowerCase();
    return !!p && p !== 'trial' && p !== 'free' && !p.includes('demo');
  };

  function addCss() {
    if (document.getElementById('vtrade-dashboard-access-css')) return;
    const s = document.createElement('style');
    s.id = 'vtrade-dashboard-access-css';
    s.textContent = `
      #vtradeDashNav{position:sticky;top:68px;z-index:18;display:flex;gap:6px;overflow:auto;padding:8px;border:1px solid #233552;border-radius:14px;background:#07101df5;backdrop-filter:blur(14px);margin:0 0 12px;scrollbar-width:none}
      #vtradeDashNav::-webkit-scrollbar{display:none}
      #vtradeDashNav a{flex:0 0 auto;color:#b8c5d8;text-decoration:none;border:1px solid #233552;background:#09111e;padding:8px 11px;border-radius:9px;font:800 11px Segoe UI,Arial,sans-serif}
      #vtradeDashNav a:hover{border-color:#8050ff;color:#fff}
      #vtradeDashNav a.active{background:#5421cf;border-color:#8050ff;color:#fff}
      #vtradeAccessGate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:#03060cf2;backdrop-filter:blur(10px)}
      #vtradeAccessGate .box{width:min(520px,100%);padding:28px;border:1px solid #2b3e60;border-radius:22px;background:#09111ff7;box-shadow:0 30px 90px #000b;text-align:center}
      #vtradeAccessGate .logo{width:58px;height:58px;margin:0 auto 14px;border-radius:17px;display:grid;place-items:center;font-size:28px;font-weight:950;background:linear-gradient(135deg,#5120ff,#aa72ff)}
      #vtradeAccessGate h1{margin:8px 0;font-size:25px}
      #vtradeAccessGate p{color:#91a5c8;line-height:1.7;margin:8px auto;max-width:440px}
      #vtradeAccessGate .pill{display:inline-block;margin:8px 0;padding:7px 11px;border:1px solid #7c5cff;border-radius:99px;background:#1b103e;color:#d9ccff;font:900 11px Segoe UI,Arial,sans-serif}
      #vtradeAccessGate .actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}
      #vtradeAccessGate a{color:#fff;text-decoration:none;padding:11px 15px;border-radius:10px;border:1px solid #233552;background:#0b1423;font-weight:900}
      #vtradeAccessGate a.primary{background:#5421cf;border-color:#8050ff}
      .vtrade-demo-locked{filter:blur(5px);pointer-events:none;user-select:none}
      @media(max-width:850px){#vtradeDashNav{top:0}.vtrade-dashboard-sidebar-hide{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function mountSectionNav() {
    if (document.getElementById('vtradeDashNav')) return;
    const main = document.querySelector('main.wrap');
    if (!main) return;
    const items = [
      ['overview','Overview'],['mtf','MTF Direction'],['ict','ICT Gates'],['execution','Execution'],
      ['quality','Data Quality'],['news','News Intelligence'],['ai','AI Intelligence'],
      ['telegram','Telegram'],['risk','Risk Calculator'],['history','Trade History'],['settings','Settings']
    ];
    const nav = document.createElement('nav');
    nav.id = 'vtradeDashNav';
    nav.setAttribute('aria-label','Dashboard modules');
    nav.innerHTML = items.map(([id,label],i)=>`<a href="#${id}"${i===0?' class="active"':''}>${label}</a>`).join('');
    main.insertBefore(nav, main.firstElementChild);
    nav.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      nav.querySelectorAll('a').forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
    });
  }

  function gate(reason, plan) {
    if (document.getElementById('vtradeAccessGate')) return;
    document.body.classList.add('vtrade-dashboard-sidebar-hide');
    const gate = document.createElement('div');
    gate.id = 'vtradeAccessGate';
    gate.innerHTML = `<div class="box"><div class="logo">V</div><div class="pill">DEMO ACCESS · ${String(plan || 'Trial').toUpperCase()}</div><h1>Main Dashboard — Demo Mode</h1><p>${reason || 'Your account is registered for demo access. Live Dashboard data and premium modules stay locked until a paid package is confirmed.'}</p><p><b>Demo:</b> view the Dashboard layout and module structure.<br><b>Paid:</b> unlock live MTF, ICT, signals, AI, news, Telegram, risk and history according to the purchased package.</p><div class="actions"><a class="primary" href="pricing.html">View Packages</a><a href="login.html">Sign in</a><a href="register.html">Register</a></div></div>`;
    document.body.appendChild(gate);
  }

  async function check() {
    addCss();
    const t = token();
    if (!t) {
      location.replace('login.html?reason=dashboard-login');
      return;
    }
    try {
      const r = await fetch(API + '/api/auth/session', { method:'GET', mode:'cors', credentials:'omit', cache:'no-store', headers:{Accept:'application/json','x-vtrade-auth':t} });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.user) throw new Error('Authentication required');
      const u = d.user;
      localStorage.setItem('vtrade_user', JSON.stringify(u));
      sessionStorage.setItem('vtrade_user', JSON.stringify(u));
      mountSectionNav();
      if (!paidPlan(u.plan) && String(u.role).toLowerCase() !== 'admin') gate('This account is active for Demo only. Purchase and confirm a paid package to unlock the live Main Dashboard.', u.plan);
    } catch (_) {
      location.replace('login.html?reason=session_expired');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, {once:true});
  else check();
})();
