/* V TRADE AI — unified website connection/auth layer */
(function(){
  const API = (window.VTRADE_API_BASE || 'https://forexai-6xw6.onrender.com').replace(/\/$/,'');
  const TOKEN_KEY = 'vtrade_auth_token';
  const LEGACY_KEY = 'vtrade_auth';
  const token = () => sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_KEY) || '';
  const publicPaths = ['/api/auth/login','/api/auth/2fa/verify','/api/auth/forgot-password','/api/auth/health','/api/pricing','/health','/api/health'];
  const isApi = (u) => String(u||'').startsWith(API+'/');
  const isPublic = (u) => publicPaths.some(p => String(u||'').includes(API+p));

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const opts = Object.assign({}, init || {});
    opts.credentials = opts.credentials || 'include';
    opts.cache = opts.cache || 'no-store';
    const headers = new Headers(opts.headers || {});
    const t = token();
    if (t && isApi(url)) headers.set('x-vtrade-auth', t);
    opts.headers = headers;
    const response = await nativeFetch(input, opts);
    if (response.status === 401 && isApi(url) && !isPublic(url) && !/\/api\/auth\/logout/.test(url)) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(LEGACY_KEY);
      sessionStorage.removeItem('vtrade_user');
      if (!/login\.html(?:$|[?#])/.test(location.href)) location.href='login.html?reason=session_expired';
    }
    return response;
  };

  window.VTRADE = {
    API,
    token,
    async session(){
      const t=token();
      if(!t) return null;
      const r=await nativeFetch(API+'/api/auth/session',{headers:{'x-vtrade-auth':t},credentials:'include',cache:'no-store'});
      if(!r.ok) return null;
      const j=await r.json().catch(()=>null);
      return j && j.user ? j : null;
    },
    async logout(){
      const t=token();
      try { await nativeFetch(API+'/api/auth/logout',{method:'POST',headers:t?{'x-vtrade-auth':t}:{},credentials:'include',cache:'no-store'}); } catch(_){}
      sessionStorage.clear();
      location.href='login.html';
    },
    clearSession(){ sessionStorage.clear(); },
    hasToken(){ return !!token(); }
  };

  function mountStatus(){
    if(document.getElementById('vtrade-connection')) return;
    const el=document.createElement('div');
    el.id='vtrade-connection';
    el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:9999;padding:7px 10px;border:1px solid #233552;border-radius:999px;background:#07101cf2;color:#9aa9bf;font:11px Segoe UI,Arial,sans-serif;box-shadow:0 8px 25px #0008;backdrop-filter:blur(8px)';
    el.textContent='● V TRADE connecting…';
    document.body.appendChild(el);
    nativeFetch(API+'/health',{cache:'no-store'}).then(r=>{
      el.textContent=r.ok?'● V TRADE backend live':'● V TRADE backend offline';
      el.style.color=r.ok?'#22e58a':'#ff5968';
    }).catch(()=>{
      el.textContent='● V TRADE backend offline';
      el.style.color='#ff5968';
    });
  }

  function loadDashboardWatchdog(){
    const file=String(location.pathname.split('/').pop()||'').toLowerCase();
    if(file!=='premium-dashboard-live.html') return;
    if(document.getElementById('vtrade-terminal-watchdog')) return;
    const s=document.createElement('script');
    s.id='vtrade-terminal-watchdog';
    s.src='terminal-watchdog.js?v=20260821-live';
    s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{mountStatus();loadDashboardWatchdog();},{once:true});
  else { mountStatus(); loadDashboardWatchdog(); }
})();
