/* V TRADE AI — Server-authoritative RBAC + persistent session/language guard */
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
