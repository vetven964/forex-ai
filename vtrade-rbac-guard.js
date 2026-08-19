/* V TRADE AI — Server-authoritative RBAC guard */
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
  const admin = () => location.replace('admin-dashboard.html?v=20260819-rbac');
  const user = () => location.replace('premium-dashboard-live.html?v=20260819-rbac');

  async function verify() {
    const t = token();
    if (!t) return login();
    try {
      const r = await fetch(BACKEND + '/api/auth/session', {
        credentials: 'include', cache: 'no-store',
        headers: {'x-vtrade-auth': t}
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.user) return login();

      const role = String(d.user.role || 'user').toLowerCase();
      sessionStorage.setItem('vtrade_user', JSON.stringify(d.user));
      localStorage.setItem('vtrade_lang', localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en');

      if (isAdminPage && role !== 'admin' && role !== 'administrator') return user();
      if (isUserPage && (role === 'admin' || role === 'administrator')) {
        // Admins may use the user terminal from an explicit link; do not force redirect.
      }
      window.dispatchEvent(new CustomEvent('vtrade:rbac-ready', {detail: {user: d.user}}));
    } catch (_) {
      login();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verify, {once:true});
  else verify();
})();
