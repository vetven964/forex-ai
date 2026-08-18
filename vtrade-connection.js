/* V TRADE AI — Single Backend Connection Layer */
(() => {
  if (window.VTRADE_CONNECTION) return;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const AUTH_KEY = 'vtrade_auth_token';
  const LEGACY_AUTH_KEY = 'vtrade_auth';
  const USER_DASHBOARD = 'premium-dashboard-live.html?v=20260818-user-dashboard';
  const ADMIN_DASHBOARD = 'admin-dashboard.html?v=20260818-admin-dashboard';

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
      .vtrade-menu{position:absolute;right:0;top:52px;width:230px;padding:8px;border:1px solid #263650;border-radius:15px;background:#07101cf7;box-shadow:0 22px 70px #000b;backdrop-filter:blur(18px);display:none}
      .vtrade-menu.show{display:block;animation:vtradeMenuIn .16s ease}@keyframes vtradeMenuIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
      .vtrade-menu-head{padding:9px 10px 11px;border-bottom:1px solid #1b2a41;margin-bottom:5px}.vtrade-menu-head b{font-size:12px}.vtrade-menu-head small{display:block;color:#8493ab;margin-top:3px;font-size:10px}
      .vtrade-menu a,.vtrade-menu button{width:100%;display:flex;align-items:center;gap:9px;border:0;border-radius:9px;background:transparent;color:#cbd5e5;text-decoration:none;text-align:left;padding:10px;cursor:pointer;font:inherit;font-size:11px}
      .vtrade-menu a:hover,.vtrade-menu button:hover{background:#111d30;color:#fff}.vtrade-menu .logout{color:#ff7c89}.vtrade-menu .logout:hover{background:#2b0c13}.vtrade-menu .hidden{display:none!important}
      @media(max-width:900px){.vtrade-account{grid-column:2;grid-row:3;margin:2px 0 0}.vtrade-account-btn{width:100%;justify-content:flex-start}.vtrade-account-name{max-width:none}.vtrade-menu{position:absolute;left:0;right:auto;top:52px}}
    `; document.head.appendChild(css);

    const layer=document.createElement('div'); layer.id='vtradeAccountLayer'; layer.className='vtrade-account';
    layer.innerHTML=`<button class="vtrade-account-btn" type="button" aria-expanded="false" aria-label="Account menu"><span class="vtrade-avatar" id="vtradeAvatar">V</span><span class="vtrade-account-name"><span id="vtradeAccountName">Account</span><span class="vtrade-account-role" id="vtradeAccountRole">Session</span></span><span class="vtrade-chevron">⌄</span></button><div class="vtrade-menu" id="vtradeAccountMenu"><div class="vtrade-menu-head"><b id="vtradeMenuName">Account</b><small id="vtradeMenuEmail">Authenticated session</small></div><a id="vtradeUserLink" href="${USER_DASHBOARD}">▣ User Dashboard</a><a id="vtradeAdminLink" class="hidden" href="${ADMIN_DASHBOARD}">♛ Admin Dashboard</a><button class="logout" id="vtradeLogout" type="button">↪ Sign out</button></div>`;
    top.appendChild(layer);

    const btn=layer.querySelector('.vtrade-account-btn'),menu=layer.querySelector('#vtradeAccountMenu');
    btn.addEventListener('click',e=>{e.stopPropagation();const open=menu.classList.toggle('show');btn.setAttribute('aria-expanded',open?'true':'false')});
    document.addEventListener('click',()=>menu.classList.remove('show'));

    const applyUser=(user)=>{
      const name=String(user?.name||user?.email||'Account');
      const role=String(user?.role||'user').toLowerCase();
      const email=String(user?.email||'Authenticated session');
      const initials=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'V';
      layer.querySelector('#vtradeAvatar').textContent=initials;
      layer.querySelector('#vtradeAccountName').textContent=name;
      layer.querySelector('#vtradeAccountRole').textContent=role==='admin'?'Administrator':'Member';
      layer.querySelector('#vtradeMenuName').textContent=name;
      layer.querySelector('#vtradeMenuEmail').textContent=email;
      layer.querySelector('#vtradeAdminLink').classList.toggle('hidden',role!=='admin');
      layer.querySelector('#vtradeUserLink').setAttribute('href',USER_DASHBOARD);
    };

    try{applyUser(JSON.parse(sessionStorage.getItem('vtrade_user')||'{}'))}catch{}
    (async()=>{
      const token=authToken();
      if(!token){applyUser({name:'Guest',role:'guest'});return}
      try{
        const r=await vfetch(BACKEND+'/api/auth/session',{credentials:'include'});
        const d=await r.json().catch(()=>({}));
        if(r.ok&&d.user){sessionStorage.setItem('vtrade_user',JSON.stringify(d.user));applyUser(d.user)}
      }catch{}
    })();

    layer.querySelector('#vtradeUserLink').addEventListener('click',()=>{
      menu.classList.remove('show');
    });
    layer.querySelector('#vtradeAdminLink').addEventListener('click',()=>{
      menu.classList.remove('show');
    });
    layer.querySelector('#vtradeLogout').addEventListener('click',async()=>{
      const logout=layer.querySelector('#vtradeLogout');logout.disabled=true;logout.textContent='↪ Signing out…';
      try{await vfetch(BACKEND+'/api/auth/logout',{method:'POST',credentials:'include'})}catch{}
      window.VTRADE_CONNECTION.clearSession();location.href='index.html?logged_out=1';
    });
  }

  function installResponsiveLayer(){
    if(document.getElementById('vtradeResponsiveCss')) return;
    const style=document.createElement('style');
    style.id='vtradeResponsiveCss';
    style.textContent=`
      :root{--safe-top:env(safe-area-inset-top,0px);--safe-right:env(safe-area-inset-right,0px);--safe-bottom:env(safe-area-inset-bottom,0px);--safe-left:env(safe-area-inset-left,0px)}
      html{width:100%;min-width:0;overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}
      body{width:100%;min-width:0;min-height:100dvh;overflow-x:hidden;padding-left:var(--safe-left);padding-right:var(--safe-right);padding-bottom:var(--safe-bottom);-webkit-tap-highlight-color:transparent}
      .app,.main{width:100%;min-width:0;max-width:100%}.main{overflow:clip}.wrap{width:100%;max-width:1750px;min-width:0}
      .card,.section,.grid,.toolbar,.section-title,.signal,.align,.news-state,.news-item,.level,.kv{min-width:0;max-width:100%}
      .card,.notice,.setup,.gate,.news-item{overflow-wrap:anywhere}
      button,.btn,.tfs button,.lang-btn{touch-action:manipulation;-webkit-user-select:none;user-select:none}
      input,button{font-size:max(14px,1em)}
      @media(min-width:901px){
        .top{padding-top:max(12px,var(--safe-top));padding-right:max(22px,var(--safe-right));padding-left:max(22px,var(--safe-left))}
        .side{height:100dvh}
      }
      @media(max-width:1250px) and (min-width:901px){
        .app{grid-template-columns:220px minmax(0,1fr)}
        .wrap{padding-left:16px;padding-right:16px}
        .top{padding-left:16px;padding-right:16px}
        .cards{grid-template-columns:repeat(3,minmax(0,1fr))}
        .radar{grid-template-columns:repeat(3,minmax(0,1fr))}
        .gategrid{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(max-width:900px){
        .app{display:block;min-height:100dvh}
        .side{height:100dvh;max-height:100dvh;padding-top:max(18px,var(--safe-top));padding-bottom:max(18px,var(--safe-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
        .top{width:100%;min-height:0;padding:calc(9px + var(--safe-top)) 10px 9px;grid-template-columns:44px minmax(0,1fr);align-items:center;overflow:visible}
        .mobile{width:44px;height:44px;min-width:44px;min-height:44px;grid-row:1 / span 3}
        .pair{min-width:0;max-width:100%;gap:7px}.pair>div{min-width:0}.pair b,.pair .sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .price{font-size:clamp(24px,7vw,29px);line-height:1.05}.live{white-space:nowrap;font-size:10px}.backend{max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .tfs{grid-column:2;min-width:0;width:100%;margin:3px 0 0;display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;padding:1px 1px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
        .tfs::-webkit-scrollbar{display:none}.tfs button{flex:0 0 auto;min-width:48px;min-height:44px;padding:9px 11px;scroll-snap-align:start}
        .lang-row{grid-column:2;width:100%;display:flex;gap:5px;margin-top:1px}.lang-btn{min-width:48px;min-height:42px}
        .wrap{padding:10px 10px 28px;width:100%}.toolbar{grid-template-columns:minmax(0,1fr) auto;display:grid;gap:8px}.api{width:100%;min-width:0;min-height:46px}.btn{min-height:46px}
        .cards{grid-template-columns:repeat(2,minmax(0,1fr))}.radar{grid-template-columns:repeat(2,minmax(0,1fr))}.gategrid{grid-template-columns:repeat(2,minmax(0,1fr))}.mainrow{grid-template-columns:1fr}.news-top,.news-grid{grid-template-columns:1fr}
        .card{padding:14px;border-radius:14px}.section{margin-top:10px}.section-title{align-items:flex-start;gap:8px;flex-wrap:wrap}.section-title h2{font-size:16px;line-height:1.3}.section-title>span{margin-left:auto;text-align:right}
        .huge{font-size:30px}.big{font-size:22px}.signal-state{font-size:26px}.chart{height:min(48vw,230px);min-height:180px}
        .news-item{grid-template-columns:auto minmax(0,1fr);gap:9px}.news-actions{grid-column:2}.news-actions a{min-height:40px;display:inline-flex;align-items:center}
        .news-state{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}.news-badge{grid-column:1 / -1;width:max-content;max-width:100%}
        .vtrade-account{grid-column:2;grid-row:3;width:100%;margin:3px 0 0}.vtrade-account-btn{width:100%;min-height:44px}.vtrade-menu{max-width:calc(100vw - 24px)}
      }
      @media(max-width:600px){
        .cards,.radar,.gategrid{grid-template-columns:1fr}.toolbar{grid-template-columns:1fr}.toolbar .btn{width:100%}
        .kv{font-size:11px}.level{font-size:12px;gap:10px}.level b{font-size:12px;text-align:right;overflow-wrap:anywhere}
        .footerline,.news-foot{flex-wrap:wrap}.news-foot>*{min-width:0}.news-filter{width:100%}.news-filter button{min-height:40px}
        .chart{height:200px}.signal{display:block}.signal .huge{margin-top:8px}
      }
      @media(max-width:390px){
        .top{padding-left:8px;padding-right:8px}.wrap{padding-left:8px;padding-right:8px}.card{padding:12px}.price{font-size:23px}.pair{gap:5px}.star{font-size:17px}.backend{font-size:8px;padding:5px 7px}.tfs button{min-width:46px;padding-left:9px;padding-right:9px}.section-title h2{font-size:15px}.label{font-size:9px}.huge{font-size:27px}.big{font-size:20px}.signal-state{font-size:24px}
      }
      @media(orientation:landscape) and (max-width:900px){
        .cards{grid-template-columns:repeat(2,minmax(0,1fr))}.radar{grid-template-columns:repeat(3,minmax(0,1fr))}.gategrid{grid-template-columns:repeat(3,minmax(0,1fr))}.mainrow{grid-template-columns:1fr 1fr}.chart{height:240px}
      }
      @media(min-width:901px){
        .module-card .card{overflow:visible}.module-action{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      }
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installResponsiveLayer();installAccountLayer()});else{installResponsiveLayer();installAccountLayer()}
})();
