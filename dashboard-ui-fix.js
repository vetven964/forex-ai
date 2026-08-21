/* V TRADE AI — unified dashboard navigation UI fix */
(() => {
  'use strict';
  if (window.__VTRADE_DASHBOARD_UI_FIX__) return;
  window.__VTRADE_DASHBOARD_UI_FIX__ = true;

  const file = () => String(location.pathname.split('/').pop() || '').toLowerCase();
  const isTerminal = () => file() === 'premium-dashboard-live.html';
  const isAdmin = () => file() === 'admin-dashboard.html';
  const km = () => localStorage.getItem('vtrade_lang') === 'km';

  function addProfileToTerminal() {
    if (!isTerminal()) return;
    const menu = document.getElementById('vtradeAccountMenu');
    if (!menu || menu.dataset.uiFixed === '1') return;
    menu.dataset.uiFixed = '1';

    const userLink = document.getElementById('vtradeUserLink');
    if (userLink) userLink.href = 'premium-dashboard-live.html?v=20260821-main-dashboard';

    const adminLink = document.getElementById('vtradeAdminLink');
    if (adminLink) adminLink.href = 'admin-dashboard.html?v=20260821-admin-dashboard';

    const profile = document.createElement('a');
    profile.id = 'vtradeProfileLink';
    profile.href = 'profile.html?v=20260821-profile';
    profile.innerHTML = '♙ <span>' + (km() ? 'គណនី / Profile' : 'Profile') + '</span>';
    profile.style.borderTop = '1px solid #1b2a41';
    const head = menu.querySelector('.vtrade-menu-head');
    if (head && head.nextSibling) menu.insertBefore(profile, head.nextSibling);
    else menu.appendChild(profile);

    const settings = document.createElement('a');
    settings.href = 'profile.html?v=20260821-profile-security';
    settings.innerHTML = '⚙ <span>' + (km() ? 'សុវត្ថិភាពគណនី' : 'Account Security') + '</span>';
    menu.insertBefore(settings, userLink || null);

    const apply = () => {
      const p = document.getElementById('vtradeProfileLink');
      if (p) p.querySelector('span').textContent = km() ? 'គណនី / Profile' : 'Profile';
      const s = settings.querySelector('span');
      if (s) s.textContent = km() ? 'សុវត្ថិភាពគណនី' : 'Account Security';
    };
    window.addEventListener('storage', apply);
    document.addEventListener('vtrade:language-changed', apply);
  }

  function fixAdminRoutes() {
    if (!isAdmin()) return;
    document.querySelectorAll('a[href*="premium-dashboard-v5.html"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const suffix = href.split('premium-dashboard-v5.html')[1] || '';
      a.setAttribute('href', 'premium-dashboard-live.html' + suffix);
    });
    const menu = document.getElementById('profileMenu');
    if (menu && !menu.querySelector('[data-live-terminal]')) {
      const a = document.createElement('a');
      a.dataset.liveTerminal = '1';
      a.href = 'premium-dashboard-live.html?v=20260821-admin-terminal';
      a.textContent = '▣  Live Terminal';
      const profile = menu.querySelector('a[href="profile.html"]');
      menu.insertBefore(a, profile || menu.firstChild);
    }
  }

  function init() {
    fixAdminRoutes();
    addProfileToTerminal();
    if (isTerminal()) {
      setTimeout(addProfileToTerminal, 150);
      setTimeout(addProfileToTerminal, 600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
  window.addEventListener('vtrade:rbac-ready', init);
})();
