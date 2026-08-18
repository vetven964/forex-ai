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
    } catch { return false; }
  };

  const headers = (input, isBackend = true) => {
    const h = new Headers(input || {});
    if (isBackend) {
      const token = authToken();
      if (token) h.set('x-vtrade-auth', token);
    }
    return h;
  };

  const originalFetch = window.fetch.bind(window);

  const vfetch = async (input, init = {}) => {
    let target = input, url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}
    const relativeApi = url.startsWith('/api/');
    const isBackend = relativeApi || backendRequest(input);
    if (relativeApi) target = BACKEND + url;
    const requestHeaders = headers(init.headers, isBackend);
    const tokenPresent = !!authToken();
    const options = {
      ...init,
      credentials: isBackend && tokenPresent ? (init.credentials || 'include') : (isBackend ? 'omit' : init.credentials),
      cache: isBackend ? 'no-store' : init.cache,
      headers: requestHeaders,
      mode: isBackend ? 'cors' : (init.mode || undefined)
    };
    if (target instanceof Request) {
      target = new Request(target, { headers: requestHeaders });
      delete options.headers;
    }
    try {
      const response = await originalFetch(target, options);
      if (isBackend && response.status === 401) window.dispatchEvent(new CustomEvent('vtrade:session-expired'));
      return response;
    } catch (error) {
      if (isBackend) {
        const e = new Error(`Backend connection failed: ${String(error?.message || error)}`);
        e.cause = error; e.backend = BACKEND; throw e;
      }
      throw error;
    }
  };

  window.fetch = vfetch;
  window.VTRADE_CONNECTION = Object.freeze({
    backend: BACKEND,
    api: (path = '') => `${BACKEND}${String(path).startsWith('/') ? path : `/${path}`}`,
    token: authToken,
    headers: (input) => headers(input, true),
    fetch: vfetch,
    clearSession: () => {
      sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(LEGACY_AUTH_KEY); sessionStorage.removeItem('vtrade_user');
      localStorage.removeItem(AUTH_KEY); localStorage.removeItem(LEGACY_AUTH_KEY);
    },
    status: async () => {
      try {
        const r = await vfetch(BACKEND + '/api/health', { credentials: 'omit' });
        if (!r.ok) return { ok:false, status:r.status, backend:BACKEND };
        return { ok:true, status:r.status, backend:BACKEND };
      } catch (error) { return { ok:false, status:0, backend:BACKEND, error:String(error?.message || error) }; }
    }
  });
  window.VTRADE_API = BACKEND;
  window.VTRADE_BACKEND = BACKEND;

  // Guard the private terminal. Direct access without a valid token
  // must go to Connection Center instead of showing a misleading Guest state.
  const currentFile = () => String(location.pathname.split('/').pop() || '').toLowerCase();
  if (currentFile() === 'premium-dashboard-live.html' && !authToken()) {
    location.replace('connection.html?required=login');
    return;
  }
  window.addEventListener('vtrade:session-expired', () => {
    if (currentFile() === 'premium-dashboard-live.html') {
      window.VTRADE_CONNECTION.clearSession();
      location.replace('connection.html?expired=1');
    }
  });

  function installAccountLayer() {
    const file = currentFile();
    if (file !== 'premium-dashboard-live.html') return;
    const top = document.querySelector('.top');
    if (!top || document.getElementById('vtradeAccountLayer')) return;

    const css = document.createElement('style'); css.id='vtradeAccountLayerCss'; css.textContent=`
      .vtrade-account{position:relative;display:flex;align-items:center;margin-left:8px;z-index:90}
      .vtrade-account-btn{display:flex;align-items:center;gap:8px;min-height:44px;padding:5px 10px 5px 6px;border:1px solid #263650;border-radius:12px;background:#09111e;color:#fff;cursor:pointer}
      .vtrade-avatar{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#5120ff,#aa72ff);font-weight:900;font-size:12px}
      .vtrade-account-name{max-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:11px;font-weight:800}
      .vtrade-account-role{display:block;color:#8493ab;font-size:9px;font-weight:500;margin-top:2px}.vtrade-chevron{color:#8493ab;font-size:10px}
      .vtrade-menu{position:absolute;right:0;top:52px;width:220px;padding:8px;border:1px solid #263650;border-radius:15px;background:#07101cf7;box-shadow:0 22px 70px #000b;backdrop-filter:blur(18px);display:none}
      .vtrade-menu.show{display:block;animation:vtradeMenuIn .16s ease}@keyframes vtradeMenuIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
      .vtrade-menu-head{padding:9px 10px 11px;border-bottom:1px solid #1b2a41;margin-bottom:5px}.vtrade-menu-head b{font-size:12px}.vtrade-menu-head small{display:block;color:#8493ab;margin-top:3px;font-size:10px}
      .vtrade-menu a,.vtrade-menu button{width:100%;display:flex;align-items:center;gap:9px;border:0;border-radius:9px;background:transparent;color:#cbd5e5;text-decoration:none;text-align:left;padding:10px;cursor:pointer;font:inherit;font-size:11px}
      .vtrade-menu a:hover,.vtrade-menu button:hover{background:#111d30;color:#fff}.vtrade-menu .logout{color:#ff7c89}.vtrade-menu .logout:hover{background:#2b0c13}.vtrade-menu .hidden{display:none}
      @media(max-width:900px){.vtrade-account{grid-column:2;grid-row:3;margin:2px 0 0}.vtrade-account-btn{width:100%;justify-content:flex-start}.vtrade-account-name{max-width:none}.vtrade-menu{position:absolute;left:0;right:auto;top:52px}}
    `; document.head.appendChild(css);

    const layer=document.createElement('div'); layer.id='vtradeAccountLayer'; layer.className='vtrade-account';
    layer.innerHTML=`<button class="vtrade-account-btn" type="button" aria-expanded="false" aria-label="Account menu"><span class="vtrade-avatar" id="vtradeAvatar">V</span><span class="vtrade-account-name"><span id="vtradeAccountName">Account</span><span class="vtrade-account-role" id="vtradeAccountRole">Session</span></span><span class="vtrade-chevron">⌄</span></button><div class="vtrade-menu" id="vtradeAccountMenu"><div class="vtrade-menu-head"><b id="vtradeMenuName">Account</b><small id="vtradeMenuEmail">Authenticated session</small></div><a href="premium-dashboard-v5.html">▣ User Dashboard</a><a id="vtradeAdminLink" class="hidden" href="admin-dashboard.html">♛ Admin Dashboard</a><button class="logout" id="vtradeLogout" type="button">↪ Sign out</button></div>`;
    top.appendChild(layer);
    const btn=layer.querySelector('.vtrade-account-btn'),menu=layer.querySelector('#vtradeAccountMenu');
    btn.addEventListener('click',e=>{e.stopPropagation();const open=menu.classList.toggle('show');btn.setAttribute('aria-expanded',open?'true':'false')});
    document.addEventListener('click',()=>menu.classList.remove('show'));
    const applyUser=(user)=>{const name=String(user?.name||user?.email||'Account'),role=String(user?.role||'user').toLowerCase(),email=String(user?.email||'Authenticated session');const initials=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'V';layer.querySelector('#vtradeAvatar').textContent=initials;layer.querySelector('#vtradeAccountName').textContent=name;layer.querySelector('#vtradeAccountRole').textContent=role==='admin'?'Administrator':'Member';layer.querySelector('#vtradeMenuName').textContent=name;layer.querySelector('#vtradeMenuEmail').textContent=email;layer.querySelector('#vtradeAdminLink').classList.toggle('hidden',role!=='admin')};
    try{applyUser(JSON.parse(sessionStorage.getItem('vtrade_user')||'{}'))}catch{}
    (async()=>{const token=authToken();if(!token){applyUser({name:'Guest',role:'guest'});return}try{const r=await vfetch(BACKEND+'/api/auth/session',{credentials:'include'});const d=await r.json().catch(()=>({}));if(r.ok&&d.user){sessionStorage.setItem('vtrade_user',JSON.stringify(d.user));applyUser(d.user)}}catch{}})();
    layer.querySelector('#vtradeLogout').addEventListener('click',async()=>{const logout=layer.querySelector('#vtradeLogout');logout.disabled=true;logout.textContent='↪ Signing out…';try{await vfetch(BACKEND+'/api/auth/logout',{method:'POST',credentials:'include'})}catch{}window.VTRADE_CONNECTION.clearSession();location.href='index.html?logged_out=1'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAccountLayer);else installAccountLayer();
})();
