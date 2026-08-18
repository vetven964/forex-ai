/* V TRADE AI — Single Backend Connection Layer */
(() => {
  if (window.VTRADE_CONNECTION) return;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const AUTH_KEY = 'vtrade_auth_token';
  const LEGACY_AUTH_KEY = 'vtrade_auth';

  const authToken = () =>
    sessionStorage.getItem(AUTH_KEY) ||
    sessionStorage.getItem(LEGACY_AUTH_KEY) ||
    localStorage.getItem(AUTH_KEY) ||
    localStorage.getItem(LEGACY_AUTH_KEY) || '';

  const backendRequest = (input) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('/api/')) return true;
      return new URL(url, location.href).origin === BACKEND;
    } catch {
      return false;
    }
  };

  const headers = (input, isBackend = true) => {
    const h = new Headers(input || {});
    if (isBackend) {
      const token = authToken();
      if (token) h.set('x-vtrade-auth', token);
      h.set('x-vtrade-client', 'web-single-connection');
    }
    return h;
  };

  const originalFetch = window.fetch.bind(window);
  const vfetch = (input, init = {}) => {
    let target = input;
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}

    const relativeApi = url.startsWith('/api/');
    const isBackend = relativeApi || backendRequest(input);
    if (relativeApi) target = BACKEND + url;

    const requestHeaders = headers(init.headers, isBackend);
    const options = {
      ...init,
      credentials: isBackend ? (init.credentials || 'include') : init.credentials,
      cache: isBackend ? (init.cache || 'no-store') : init.cache,
      headers: requestHeaders
    };

    if (target instanceof Request) {
      target = new Request(target, { headers: requestHeaders });
      delete options.headers;
    }

    return originalFetch(target, options).then((response) => {
      if (isBackend && response.status === 401) {
        window.dispatchEvent(new CustomEvent('vtrade:session-expired'));
      }
      return response;
    });
  };

  window.fetch = vfetch;

  window.VTRADE_CONNECTION = Object.freeze({
    backend: BACKEND,
    api: (path = '') => `${BACKEND}${String(path).startsWith('/') ? path : `/${path}`}`,
    token: authToken,
    headers: (input) => headers(input, true),
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

  window.VTRADE_API = BACKEND;
  window.VTRADE_BACKEND = BACKEND;
})();
