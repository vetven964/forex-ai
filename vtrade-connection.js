/* V TRADE AI — Single Backend Connection Layer
 * All browser pages use one Render API origin and one auth/session transport.
 */
(() => {
  if (window.VTRADE_CONNECTION) return;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const AUTH_KEY = 'vtrade_auth_token';
  const LEGACY_AUTH_KEY = 'vtrade_auth';

  const normalize = (value) => {
    if (!value) return value;
    try {
      const u = new URL(String(value), location.href);
      if (u.origin === BACKEND) return u.toString();
      return u.toString();
    } catch {
      return value;
    }
  };

  const authToken = () =>
    sessionStorage.getItem(AUTH_KEY) ||
    sessionStorage.getItem(LEGACY_AUTH_KEY) ||
    localStorage.getItem(AUTH_KEY) ||
    localStorage.getItem(LEGACY_AUTH_KEY) ||
    '';

  const headers = (input) => {
    const h = new Headers(input || {});
    const token = authToken();
    if (token) h.set('x-vtrade-auth', token);
    h.set('x-vtrade-client', 'web-single-connection');
    return h;
  };

  const originalFetch = window.fetch.bind(window);
  const vfetch = (input, init = {}) => {
    let target = input;
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}

    // Keep every API call on the single official backend origin.
    if (url && url.startsWith('/api/')) target = BACKEND + url;
    else if (url && url.startsWith(BACKEND)) target = url;

    const options = {
      ...init,
      credentials: init.credentials || 'include',
      cache: init.cache || 'no-store',
      headers: headers(init.headers)
    };

    if (target instanceof Request) {
      target = new Request(normalize(target.url), { ...target, headers: options.headers });
      delete options.headers;
    }

    return originalFetch(target, options).then((response) => {
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('vtrade:session-expired'));
      }
      return response;
    });
  };

  window.fetch = vfetch;

  // Same-origin relative API calls are rewritten to the same backend.
  window.VTRADE_CONNECTION = Object.freeze({
    backend: BACKEND,
    api: (path = '') => `${BACKEND}${String(path).startsWith('/') ? path : `/${path}`}`,
    token: authToken,
    headers,
    fetch: vfetch,
    clearSession: () => {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
      sessionStorage.removeItem('vtrade_user');
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(LEGACY_AUTH_KEY);
    },
    status: async () => {
      try {
        const r = await vfetch(BACKEND + '/api/health');
        return { ok: r.ok, status: r.status };
      } catch (error) {
        return { ok: false, status: 0, error: String(error?.message || error) };
      }
    }
  });

  // Compatibility aliases for existing pages. New code should use VTRADE_CONNECTION.
  window.VTRADE_API = BACKEND;
  window.VTRADE_BACKEND = BACKEND;
})();
