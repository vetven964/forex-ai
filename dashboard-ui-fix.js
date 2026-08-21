/* V TRADE AI — role-specific Home / Dashboard navigation */
(() => {
  'use strict';
  if (window.__VTRADE_DASHBOARD_UI_FIX__) return;
  window.__VTRADE_DASHBOARD_UI_FIX__ = true;

  const file = () => String(location.pathname.split('/').pop() || '').toLowerCase();
  const isTerminal = () => file() === 'premium-dashboard-live.html';
  const isAdmin = () => file() === 'admin-dashboard.html';
  const km = () => localStorage.getItem('vtrade_lang') === 'km';
  const readUser = () => { try { return JSON.parse(sessionStorage.getItem('vtrade_user') || localStorage.getItem('vtrade_user') || '{}'); } catch { return {}; } };
  const admin = () => ['admin','administrator'].includes(String(readUser()?.role || '').toLowerCase());
  const ADMIN_HOME = 'admin-dashboard.html?v=20260821-admin-home';
  const USER_HOME = 'premium-dashboard-live.html?v=20260821-user-home';
  const TERMINAL = 'premium-dashboard-live.html?v=20260821-live-terminal';

  function relabelSidebar() {
    if (!isTerminal()) return;
    const side = document.querySelector('.side');
    if (!side) return;
    const links = [...side.querySelectorAll('a')];
    const dashboard = links.find(a => /dashboard/i.test(a.textContent || '') || /premium-dashboard-live\.html/i.test(a.getAttribute('href') || ''));
    if (dashboard) {
      dashboard.href = admin() ? ADMIN_HOME : USER_HOME;
      const text = dashboard.querySelector('span:last-child') || dashboard;
      if (text) text.textContent = admin() ? (km() ? 'ផ្ទាំង Admin' : 'Admin Home') : (km() ? 'ទំព័រដើម' : 'Home');
    }
    const terminal = links.find(a => /terminal/i.test(a.textContent || ''));
    if (terminal) terminal.href = TERMINAL;
  }

  function addProfileToTerminal() {
    if (!isTerminal()) return;
    const menu = document.getElementById('vtradeAccountMenu');
    if (!menu || menu.dataset.uiFixed === '1') return;
    menu.dataset.uiFixed = '1';

    const userLink = document.getElementById('vtradeUserLink');
    if (userLink) {
      userLink.href = admin() ? ADMIN_HOME : USER_HOME;
      const s = userLink.querySelector('span');
      if (s) s.textContent = admin() ? (km() ? 'ផ្ទាំង Admin' : 'Admin Home') : (km() ? 'ទំព័រដើម' : 'Home');
    }
    const adminLink = document.getElementById('vtradeAdminLink');
    if (adminLink) {
      adminLink.href = ADMIN_HOME;
      adminLink.style.display = admin() ? '' : 'none';
    }

    const profile = document.createElement('a');
    profile.id = 'vtradeProfileLink';
    profile.href = 'profile.html?v=20260821-profile';
    profile.innerHTML = '♙ <span>' + (km() ? 'គណនី / Profile' : 'Profile') + '</span>';
    profile.style.borderTop = '1px solid #1b2a41';
    const head = menu.querySelector('.vtrade-menu-head');
    if (head && head.nextSibling) menu.insertBefore(profile, head.nextSibling); else menu.appendChild(profile);

    const settings = document.createElement('a');
    settings.href = 'profile.html?v=20260821-profile-security';
    settings.innerHTML = '⚙ <span>' + (km() ? 'សុវត្ថិភាពគណនី' : 'Account Security') + '</span>';
    menu.insertBefore(settings, userLink || null);

    const live = document.createElement('a');
    live.href = TERMINAL;
    live.innerHTML = '▣ <span>' + (km() ? 'Terminal ផ្ទាល់' : 'Live Terminal') + '</span>';
    menu.insertBefore(live, adminLink || menu.querySelector('.logout'));
  }

  function fixAdminRoutes() {
    if (!isAdmin()) return;
    document.querySelectorAll('a[href*="premium-dashboard-live.html"]').forEach(a => a.setAttribute('href', TERMINAL));
    const menu = document.getElementById('profileMenu');
    if (menu && !menu.querySelector('[data-live-terminal]')) {
      const a = document.createElement('a');
      a.dataset.liveTerminal = '1'; a.href = TERMINAL; a.textContent = '▣  Live Terminal';
      const profile = menu.querySelector('a[href^="profile.html"]');
      menu.insertBefore(a, profile || menu.firstChild);
    }
    document.querySelectorAll('a').forEach(a => {
      const t = (a.textContent || '').trim().toLowerCase();
      if ((t === 'dashboard' || t === 'home' || t.includes('admin home')) && !/profile|logout/i.test(t)) a.href = ADMIN_HOME;
    });
  }

  function init() {
    fixAdminRoutes(); relabelSidebar(); addProfileToTerminal();
    if (isTerminal()) { setTimeout(() => { relabelSidebar(); addProfileToTerminal(); }, 150); setTimeout(relabelSidebar, 700); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
  window.addEventListener('vtrade:rbac-ready', init);
})();
