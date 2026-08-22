/* V TRADE AI — Server-authoritative RBAC guard V10 — phone navigation continuity */
(() => {
  'use strict';
  if (window.__VTRADE_RBAC_GUARD_V10__) return;
  window.__VTRADE_RBAC_GUARD_V10__ = true;
  const BACKEND='https://forexai-6xw6.onrender.com';
  const file=String(location.pathname.split('/').pop()||'').toLowerCase();
  const isAdminPage=file==='admin-dashboard.html';
  const isTerminalPage=file==='premium-dashboard-live.html';
  if(!isAdminPage&&!isTerminalPage)return;
  const token=()=>window.VTRADE_CONNECTION?.token?.()||localStorage.getItem('vtrade_auth_token')||localStorage.getItem('vtrade_auth')||sessionStorage.getItem('vtrade_auth_token')||sessionStorage.getItem('vtrade_auth')||'';
  const isAdminRole=r=>['admin','administrator'].includes(String(r||'').trim().toLowerCase());
  const login=r=>location.replace(`login.html?required=login&reason=${encodeURIComponent(r||'login')}`);
  const goTerminal=()=>location.replace('premium-dashboard-live.html?v=20260822-rbac-v10');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function verifySession(){
    const t=token();
    if(!t)return{ok:false,reason:'missing-token'};
    let err=null;
    for(let i=1;i<=4;i++){
      try{
        const r=await fetch(BACKEND+'/api/auth/session',{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json','x-vtrade-auth':t}});
        const d=await r.json().catch(()=>({}));
        if(r.ok&&d.user)return{ok:true,user:d.user};
        err=new Error(r.status===401?'Unauthorized':`Session HTTP ${r.status}`);
      }catch(e){err=e}
      if(i<4)await sleep(250*i);
    }
    return{ok:false,reason:err?.message||'session-failed'};
  }
  function persistUser(u){const raw=JSON.stringify(u||{});try{localStorage.setItem('vtrade_user',raw)}catch{}try{sessionStorage.setItem('vtrade_user',raw)}catch{}}
  function loadScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;(document.head||document.documentElement).appendChild(s)}
  async function verify(){
    const result=await verifySession();
    if(!result.ok)return login(result.reason);
    const u=result.user,role=String(u?.role||'user').trim().toLowerCase();
    persistUser(u);
    document.documentElement.lang=localStorage.getItem('vtrade_lang')==='km'?'km':'en';
    document.documentElement.dataset.role=role;
    if(isAdminPage&&!isAdminRole(role))return goTerminal();
    window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:u,role,mobile:matchMedia('(max-width:900px)').matches}}));
  }
  function loadDashboardUiFix(){
    if(!isAdminPage&&!isTerminalPage)return;
    loadScript('vtradeDashboardUiFixScript','dashboard-ui-fix.js?v=20260822-mobile-card-v4');
    if(isTerminalPage){
      loadScript('vtradeHeaderAuthoritySyncScript','vtrade-header-authority-sync.js?v=20260821-authority');
      loadScript('vtradeBackendStatusSyncScript','vtrade-backend-status-sync.js?v=20260821-backend-truth');
    }
  }
  loadDashboardUiFix();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',verify,{once:true});else verify();
})();
