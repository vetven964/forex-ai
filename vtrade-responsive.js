/* V TRADE AI — Mobile App shell / navigation V3 */
(() => {
  'use strict';
  if (window.__VTRADE_RESPONSIVE_V3__) return;
  window.__VTRADE_RESPONSIVE_V3__ = true;
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  const path=location.pathname.split('/').pop().toLowerCase();

  function injectStyle(){
    if(document.getElementById('vtradeResponsiveRuntimeStyleV3'))return;
    const s=document.createElement('style');
    s.id='vtradeResponsiveRuntimeStyleV3';
    s.textContent=`
@media(max-width:900px){
  html,body{width:100%;max-width:100%;overflow-x:hidden!important}
  body.vtrade-mobile{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}
  .scrim,#scrim{z-index:2990!important}
  body.vtrade-mobile .side{z-index:3000!important}
  #vtradeMobileBar{z-index:5000!important}
  body.vtrade-phone-menu-open #vtradeMobileBar,body:has(.side.open) #vtradeMobileBar,body:has(.side.vtrade-open) #vtradeMobileBar{display:none!important}

  /* TERMINAL: clean four-row phone header, no overlap */
  body.vtrade-mobile .top{
    position:relative!important;display:grid!important;width:100%!important;
    height:224px!important;min-height:224px!important;padding:18px 12px 10px!important;
    grid-template-columns:52px minmax(0,1fr)!important;
    grid-template-rows:52px 52px 54px 42px!important;
    grid-template-areas:"menu pair" "menu price" "tfs tfs" "lang lang"!important;
    gap:4px 9px!important;overflow:hidden!important;z-index:30!important;
    background:#04070d!important;border-bottom:1px solid #17253a!important;
  }
  body.vtrade-mobile .top>.mobile{grid-area:menu!important;width:50px!important;height:50px!important;display:grid!important;place-items:center!important}
  body.vtrade-mobile .top>.pair{grid-area:pair!important;min-width:0!important;overflow:hidden!important;align-self:center!important;padding:0!important}
  body.vtrade-mobile .top>.pair b{display:block!important;font-size:17px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:170px!important}
  body.vtrade-mobile .top>.pair .sub{display:block!important;font-size:10px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:170px!important}
  body.vtrade-mobile .top>.price{grid-area:price!important;justify-self:start!important;align-self:center!important;margin:0 0 0 4px!important;font-size:30px!important;line-height:1!important;white-space:nowrap!important;max-width:calc(100vw - 82px)!important;overflow:hidden!important}
  body.vtrade-mobile .top>.live{display:none!important}
  body.vtrade-mobile .top>.backend{grid-area:price!important;justify-self:end!important;align-self:end!important;margin:0 4px 2px 0!important;max-width:128px!important;padding:6px 10px!important;font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  body.vtrade-mobile .top>.tfs{grid-area:tfs!important;width:100%!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;margin:0!important;align-self:center!important}
  body.vtrade-mobile .top>.tfs::-webkit-scrollbar{display:none!important}
  body.vtrade-mobile .top>.tfs button{flex:0 0 72px!important;min-width:72px!important;height:52px!important;margin:0!important}
  body.vtrade-mobile .top>.lang-row{grid-area:lang!important;display:flex!important;justify-content:flex-end!important;align-items:center!important;gap:7px!important;min-width:0!important;overflow:hidden!important}
  body.vtrade-mobile .top>.lang-row .lang-btn{flex:0 0 72px!important;min-width:72px!important;height:40px!important;padding:7px 10px!important}
  body.vtrade-mobile .top #profileAdminLink,body.vtrade-mobile .top #vtradeAccountMenu,body.vtrade-mobile .top #vtradeProfileLink,body.vtrade-mobile .top #vtradeAdminLink,body.vtrade-mobile .top #vtradeUserLink,body.vtrade-mobile .top .profile,body.vtrade-mobile .top .vtrade-phone-profile,body.vtrade-mobile .top [class*="profile" i],body.vtrade-mobile .top [id*="profile" i],body.vtrade-mobile .top [class*="account" i],body.vtrade-mobile .top [id*="account" i]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}

  /* TERMINAL: drawer and content */
  body.vtrade-mobile .side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(310px,82vw)!important;height:100dvh!important;max-height:100dvh!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important;padding:18px 10px 110px!important;background:#11141b!important;border-right:1px solid #2a3140!important;box-shadow:22px 0 60px rgba(0,0,0,.55)!important;display:flex!important;flex-direction:column!important}
  body.vtrade-mobile .side.open,body.vtrade-mobile .side.vtrade-open{transform:translateX(0)!important}
  body.vtrade-mobile .wrap{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:12px 12px 128px!important;overflow:hidden!important}
  body.vtrade-mobile .wrap>*{min-width:0!important;max-width:100%!important}
  body.vtrade-mobile .card,body.vtrade-mobile .chart,body.vtrade-mobile #vtradePreMarket{min-width:0!important;max-width:100%!important;overflow:hidden!important}
  body.vtrade-mobile #vtradePreMarket{margin-top:2px!important;border-radius:18px!important}
  body.vtrade-mobile #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important;gap:7px!important}
  body.vtrade-mobile #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}
  body.vtrade-mobile #vtradePreMarket .v91a>*{flex:0 0 auto!important}

  /* Bottom navigation stays below content, never over cards */
  body.vtrade-mobile #vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border:1px solid #303441!important;border-radius:22px!important;background:rgba(8,10,16,.97)!important;backdrop-filter:blur(14px)!important;box-shadow:0 10px 30px rgba(0,0,0,.35)!important}
  body.vtrade-mobile #vtradeMobileBar a{display:flex!important;align-items:center!important;justify-content:center!important;height:54px!important;min-width:0!important;margin:0!important;padding:4px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#d7deeb!important;text-decoration:none!important;font-size:10px!important;line-height:1.1!important;overflow:hidden!important}
  body.vtrade-mobile #vtradeMobileBar a.active{background:#5827d2!important;color:#fff!important}

  /* ADMIN: top bar + content are separate layers */
  body.vtrade-admin-mobile{padding-bottom:calc(24px + env(safe-area-inset-bottom))!important}
  body.vtrade-admin-mobile .content{width:100%!important;max-width:100%!important;padding:88px 10px 28px!important;margin:0!important;overflow:hidden!important}
  body.vtrade-admin-mobile .page-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;margin:0 0 14px!important}
  body.vtrade-admin-mobile .page-head h1{font-size:23px!important;line-height:1.15!important;margin:0!important}
  body.vtrade-admin-mobile .page-head p{font-size:10px!important;line-height:1.45!important;margin-top:5px!important}
  body.vtrade-admin-mobile .page-head .btn{min-height:42px!important;padding:8px 10px!important;flex:0 0 auto!important}
  body.vtrade-admin-mobile .stats{grid-template-columns:1fr!important;gap:10px!important}
  body.vtrade-admin-mobile .stat{min-height:76px!important;padding:13px!important}
  body.vtrade-admin-mobile .section{padding:12px!important;margin-top:10px!important;border-radius:16px!important}
  body.vtrade-admin-mobile .section-head{align-items:flex-start!important;flex-direction:column!important}
  body.vtrade-admin-mobile .tools{display:grid!important;grid-template-columns:1fr!important;width:100%!important;gap:7px!important}
  body.vtrade-admin-mobile .search,body.vtrade-admin-mobile .select{width:100%!important;min-width:0!important}
  body.vtrade-admin-mobile .table-wrap{max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
  body.vtrade-admin-mobile .table{min-width:850px!important}
  body.vtrade-admin-mobile .lower{grid-template-columns:1fr!important;gap:0!important}
  body.vtrade-admin-mobile .packages{grid-template-columns:1fr!important}

  /* ADMIN drawer: it is hidden until menu is tapped */
  body.vtrade-admin-mobile .side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(310px,82vw)!important;height:100dvh!important;max-height:100dvh!important;padding:18px 10px 105px!important;transform:translateX(-110%)!important;z-index:3000!important;overflow-y:auto!important;overflow-x:hidden!important}
  body.vtrade-admin-mobile .side.vtrade-open{transform:translateX(0)!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar{position:fixed!important;left:8px!important;right:8px!important;top:max(8px,env(safe-area-inset-top))!important;height:66px!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px 48px!important;gap:6px!important;align-items:center!important;padding:7px!important;border:1px solid #263957!important;border-radius:18px!important;background:rgba(6,10,17,.97)!important;backdrop-filter:blur(16px)!important;box-shadow:0 12px 40px rgba(0,0,0,.35)!important;z-index:5000!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar .title{min-width:0!important;overflow:hidden!important;padding:0 5px!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar .title b{display:block!important;font-size:15px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar .title small{display:block!important;color:#8ea0b8!important;font-size:10px!important;margin-top:2px!important;white-space:nowrap!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar button,body.vtrade-admin-mobile #vtradeAdminMobileBar a{width:48px!important;height:50px!important;display:grid!important;place-items:center!important;border:1px solid #263957!important;border-radius:13px!important;background:#091321!important;color:#f5f8ff!important;text-decoration:none!important;font-size:20px!important}
  body.vtrade-admin-mobile #vtradeAdminMobileBar #vtradeAdminMenu{background:#5827d2!important;border-color:#8050ff!important}
  body.vtrade-admin-mobile #vtradeAdminScrim{display:block!important;position:fixed!important;inset:0!important;background:rgba(0,0,0,.58)!important;opacity:0!important;pointer-events:none!important;z-index:2990!important}
  body.vtrade-admin-mobile #vtradeAdminScrim.show{opacity:1!important;pointer-events:auto!important}
}
@media(max-width:480px){
  body.vtrade-mobile .top{height:218px!important;min-height:218px!important;grid-template-rows:50px 50px 52px 42px!important;padding-top:15px!important}
  body.vtrade-mobile .top>.price{font-size:28px!important}
  body.vtrade-mobile .wrap{padding-left:10px!important;padding-right:10px!important}
  body.vtrade-admin-mobile .content{padding-left:9px!important;padding-right:9px!important}
  body.vtrade-admin-mobile .page-head h1{font-size:21px!important}
}
@media(min-width:901px){#vtradeMobileBar,#vtradeAdminMobileBar,#vtradeAdminScrim,.vtrade-phone-profile{display:none!important}}
`;
    document.head.appendChild(s);
  }

  function addMobileNav(){
    if(!isMobile()||document.getElementById('vtradeMobileBar'))return;
    const bar=document.createElement('nav');
    bar.id='vtradeMobileBar';
    bar.setAttribute('aria-label','V TRADE AI mobile navigation');
    const items=[['dashboard.html','⌂','Home'],['premium-dashboard-live.html#ai','▣','Analyzer'],['premium-dashboard-live.html#terminal','⌁','Chart'],['premium-dashboard-live.html#signals','◈','Signals'],['premium-dashboard-live.html#stats','▥','Stats']];
    bar.innerHTML=items.map(([href,icon,label])=>{
      const active=(path==='dashboard.html'&&label==='Home')||(path==='premium-dashboard-live.html'&&((location.hash==='#ai'&&label==='Analyzer')||(location.hash==='#terminal'&&label==='Chart')||(location.hash==='#signals'&&label==='Signals')||(location.hash==='#stats'&&label==='Stats')||(!location.hash&&label==='Chart')));
      return `<a class="${active?'active':''}" href="${href}"><span class="mi">${icon}</span><span>${label}</span></a>`;
    }).join('');
    document.body.appendChild(bar);
    document.body.classList.add('vtrade-mobile');
  }

  function addAdminShell(){
    if(path!=='admin-dashboard.html'||!isMobile()||document.getElementById('vtradeAdminMobileBar'))return;
    const scrim=document.createElement('div');
    scrim.id='vtradeAdminScrim';
    document.body.appendChild(scrim);
    const bar=document.createElement('div');
    bar.id='vtradeAdminMobileBar';
    bar.innerHTML=`<button id="vtradeAdminMenu" aria-label="Open menu">☰</button><div class="title"><b>Admin Dashboard</b><small>V TRADE AI · Administrator</small></div><a href="profile.html" aria-label="Profile">♙</a><button id="vtradeAdminLogout" aria-label="Logout">↪</button>`;
    document.body.appendChild(bar);
    document.body.classList.add('vtrade-admin-mobile');
    const side=document.querySelector('.side');
    const openMenu=()=>{side?.classList.add('vtrade-open');scrim.classList.add('show');};
    const closeMenu=()=>{side?.classList.remove('vtrade-open');scrim.classList.remove('show');};
    document.getElementById('vtradeAdminMenu').onclick=openMenu;
    scrim.onclick=closeMenu;
    side?.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',closeMenu));
    document.getElementById('vtradeAdminLogout').onclick=()=>document.getElementById('sideLogout')?.click();
  }

  function loadPhoneV4(){
    if(!isMobile()||window.__VTRADE_PHONE_V4_LOADED__)return;
    window.__VTRADE_PHONE_V4_LOADED__=true;
    const s=document.createElement('script');
    s.src='vtrade-mobile-fix-v4.js?v=20260822-v42';
    s.async=false;
    s.onload=()=>setTimeout(()=>{},0);
    document.head.appendChild(s);
  }

  function init(){
    injectStyle();
    if(path==='admin-dashboard.html')addAdminShell();
    else if(['premium-dashboard-live.html','dashboard.html','profile.html','pricing.html'].includes(path))addMobileNav();
    loadPhoneV4();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
