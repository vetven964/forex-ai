/* V TRADE AI — Server-authoritative RBAC + persistent session/language guard */
(() => {
  if (window.__VTRADE_RBAC_GUARD__) return;
  window.__VTRADE_RBAC_GUARD__ = true;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const file = String(location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminPage = file === 'admin-dashboard.html';
  const isUserPage = file === 'premium-dashboard-live.html';
  if (!isAdminPage && !isUserPage) return;

  /*
   * Mobile Admin UX
   * - Desktop keeps the existing header actions.
   * - Phone uses a clean right-side drawer instead of wrapping the actions
   *   over the dashboard header.
   * - Existing links/buttons are reused, so auth and navigation logic stay intact.
   */
  function installAdminMobileMenu() {
    if (!isAdminPage || document.getElementById('vt-admin-mobile-menu')) return;

    const install = () => {
      const top = document.querySelector('.top');
      const brand = top?.querySelector('.brand');
      const actions = top?.querySelector('.actions');
      if (!top || !brand || !actions) return false;

      const style = document.createElement('style');
      style.id = 'vt-admin-mobile-menu-style';
      style.textContent = `
        @media (min-width:701px){
          #vt-admin-menu-btn,#vt-admin-menu-backdrop{display:none!important}
        }
        @media (max-width:700px){
          body.vt-admin-menu-open{overflow:hidden!important}
          .top.vt-admin-mobile-top{
            flex-direction:row!important;
            align-items:center!important;
            min-height:64px!important;
            padding:10px 11px!important;
            gap:8px!important;
            position:sticky!important;
            top:7px!important;
            z-index:120!important;
          }
          .top.vt-admin-mobile-top .brand{
            min-width:0!important;
            flex:1 1 auto!important;
          }
          .top.vt-admin-mobile-top .brand h1{
            font-size:14px!important;
            line-height:1.2!important;
            white-space:nowrap!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
          }
          .top.vt-admin-mobile-top .brand small{
            display:block!important;
            white-space:nowrap!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
            max-width:190px!important;
          }
          #vt-admin-menu-btn{
            display:grid!important;
            place-items:center!important;
            flex:0 0 44px!important;
            width:44px!important;
            height:44px!important;
            padding:0!important;
            border:1px solid var(--line,#233552)!important;
            border-radius:13px!important;
            background:#0b1423!important;
            color:#fff!important;
            font-size:23px!important;
            line-height:1!important;
            box-shadow:0 8px 24px #0005!important;
          }
          #vt-admin-menu-btn.vt-open{
            background:#5421cf!important;
            border-color:#8050ff!important;
          }
          #vt-admin-mobile-menu{
            position:fixed!important;
            top:0!important;
            right:0!important;
            bottom:0!important;
            width:min(84vw,330px)!important;
            padding:calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom))!important;
            display:flex!important;
            flex-direction:column!important;
            gap:10px!important;
            background:linear-gradient(160deg,#0b1423 0%,#070c15 100%)!important;
            border-left:1px solid #2a3e60!important;
            box-shadow:-24px 0 70px #000b!important;
            transform:translateX(105%)!important;
            transition:transform .22s ease!important;
            z-index:140!important;
            overflow-y:auto!important;
            -webkit-overflow-scrolling:touch!important;
          }
          #vt-admin-mobile-menu.vt-open{transform:translateX(0)!important}
          #vt-admin-mobile-menu .vt-menu-title{
            display:flex!important;
            align-items:center!important;
            justify-content:space-between!important;
            gap:10px!important;
            padding:4px 4px 10px!important;
            color:#f5f8ff!important;
            font-weight:900!important;
            font-size:17px!important;
            border-bottom:1px solid #17253a!important;
          }
          #vt-admin-mobile-menu .vt-menu-sub{
            color:#8d9bb0!important;
            font-size:10px!important;
            font-weight:500!important;
          }
          #vt-admin-mobile-menu .actions-item{
            width:100%!important;
            min-height:48px!important;
            display:flex!important;
            align-items:center!important;
            justify-content:flex-start!important;
            gap:10px!important;
            flex:0 0 auto!important;
            padding:12px 13px!important;
            border-radius:12px!important;
            text-decoration:none!important;
            font-weight:750!important;
            border:1px solid #233552!important;
            background:#09111e!important;
            color:#fff!important;
            box-sizing:border-box!important;
          }
          #vt-admin-mobile-menu .actions-item.primary{background:#5421cf!important;border-color:#8050ff!important}
          #vt-admin-mobile-menu .actions-item.danger{background:#2b0c13!important;border-color:#7c2532!important;color:#ff9aa5!important}
          #vt-admin-mobile-menu .actions-item.lang{justify-content:center!important}
          #vt-admin-mobile-menu .vt-menu-close{
            width:40px!important;
            height:40px!important;
            padding:0!important;
            border-radius:11px!important;
            border:1px solid #233552!important;
            background:#0b1423!important;
            color:#fff!important;
            font-size:20px!important;
          }
          #vt-admin-menu-backdrop{
            position:fixed!important;
            inset:0!important;
            background:rgba(0,0,0,.58)!important;
            backdrop-filter:blur(3px)!important;
            -webkit-backdrop-filter:blur(3px)!important;
            opacity:0!important;
            pointer-events:none!important;
            transition:opacity .18s ease!important;
            z-index:130!important;
          }
          #vt-admin-menu-backdrop.vt-open{opacity:1!important;pointer-events:auto!important}
          .top.vt-admin-mobile-top>.actions{display:none!important}
        }
      `;
      document.head.appendChild(style);

      const menuBtn = document.createElement('button');
      menuBtn.id = 'vt-admin-menu-btn';
      menuBtn.type = 'button';
      menuBtn.setAttribute('aria-label', 'Open admin menu');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.textContent = '☰';

      const backdrop = document.createElement('div');
      backdrop.id = 'vt-admin-menu-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');

      const drawer = document.createElement('aside');
      drawer.id = 'vt-admin-mobile-menu';
      drawer.setAttribute('aria-label', 'Admin menu');

      const title = document.createElement('div');
      title.className = 'vt-menu-title';
      title.innerHTML = '<div>V TRADE AI<div class="vt-menu-sub">Admin controls</div></div>';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'vt-menu-close';
      close.setAttribute('aria-label', 'Close admin menu');
      close.textContent = '×';
      title.appendChild(close);
      drawer.appendChild(title);

      [...actions.children].forEach((node) => {
        const clone = node.cloneNode(true);
        clone.classList.add('actions-item');
        drawer.appendChild(clone);
      });

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);
      top.classList.add('vt-admin-mobile-top');
      top.insertBefore(menuBtn, top.querySelector('.actions'));

      const setOpen = (open) => {
        menuBtn.classList.toggle('vt-open', open);
        drawer.classList.toggle('vt-open', open);
        backdrop.classList.toggle('vt-open', open);
        document.body.classList.toggle('vt-admin-menu-open', open);
        menuBtn.textContent = open ? '×' : '☰';
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close admin menu' : 'Open admin menu');
      };

      menuBtn.addEventListener('click', () => setOpen(!drawer.classList.contains('vt-open')));
      close.addEventListener('click', () => setOpen(false));
      backdrop.addEventListener('click', () => setOpen(false));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOpen(false);
      });
      drawer.addEventListener('click', (event) => {
        const item = event.target.closest('.actions-item');
        if (!item) return;
        setOpen(false);
      });

      return true;
    };

    if (!install()) {
      const observer = new MutationObserver(() => {
        if (install()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList:true, subtree:true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAdminMobileMenu, { once: true });
  } else {
    installAdminMobileMenu();
  }

  const token = () => window.VTRADE_CONNECTION?.token?.() ||
    sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') ||
    localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') || '';

  const login = () => location.replace('connection.html?required=login');
  const user = () => location.replace('premium-dashboard-live.html?v=20260819-rbac');

  async function verify() {
    const t = token();
    if (!t) return login();
    try {
      // The token is sent explicitly in x-vtrade-auth. Do not depend on the
      // cross-origin HttpOnly cookie here; this keeps GitHub Pages -> Render
      // session verification deterministic even when third-party cookies are blocked.
      const r = await fetch(BACKEND + '/api/auth/session', {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'x-vtrade-auth': t
        }
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
      window.dispatchEvent(new CustomEvent('vtrade:rbac-ready', {
        detail: { user: d.user, role, language }
      }));
    } catch (error) {
      console.error('[V-TRADE RBAC] session verification failed:', error);
      login();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verify, { once: true });
  } else verify();
})();
