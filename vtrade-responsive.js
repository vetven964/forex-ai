/* V TRADE AI — Mobile App shell / navigation V12 */
(() => {
  'use strict';
  if (window.__VTRADE_RESPONSIVE_V12__) return;
  window.__VTRADE_RESPONSIVE_V12__ = true;
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  const path=location.pathname.split('/').pop().toLowerCase();
  function injectStyle(){
    if(document.getElementById('vtradeResponsiveRuntimeStyleV12'))return;
    const s=document.createElement('style');s.id='vtradeResponsiveRuntimeStyleV12';
    s.textContent=`
      @media(max-width:900px){
        html,body{width:100%;max-width:100%;overflow-x:hidden!important}
        body.vtrade-mobile{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}
        #vtradeMobileBar{z-index:5000!important}
        body.vtrade-admin-mobile .side{z-index:3000!important}
        body.vtrade-admin-mobile #vtradeAdminMobileBar{z-index:5000!important}
        body:not(.vtrade-admin-mobile) #vtradeMobileBar{
          position:fixed!important;left:10px!important;right:10px!important;
          bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;
          height:64px!important;display:grid!important;
          grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;
          padding:6px!important;margin:0!important;box-sizing:border-box!important;
          border:1px solid #263957!important;border-radius:20px!important;
          background:rgba(5,10,18,.96)!important;backdrop-filter:blur(18px)!important;
          -webkit-backdrop-filter:blur(18px)!important;overflow:hidden!important;
        }
        body:not(.vtrade-admin-mobile) #vtradeMobileBar a{
          min-width:0!important;max-width:none!important;height:50px!important;
          display:flex!important;flex-direction:column!important;align-items:center!important;
          justify-content:center!important;gap:3px!important;padding:4px 2px!important;margin:0!important;
          border:1px solid transparent!important;border-radius:14px!important;background:transparent!important;
          color:#8ea0b8!important;font:600 10px/1.1 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif!important;
          text-decoration:none!important;white-space:nowrap!important;overflow:hidden!important;
          -webkit-tap-highlight-color:transparent!important;
        }
        body:not(.vtrade-admin-mobile) #vtradeMobileBar a.active,
        body:not(.vtrade-admin-mobile) #vtradeMobileBar a[aria-current="page"]{
          color:#f5f8ff!important;background:rgba(91,45,214,.28)!important;
          border-color:rgba(128,80,255,.7)!important;outline:none!important;
        }
        body:not(.vtrade-admin-mobile) #vtradeMobileBar .mi{
          display:grid!important;place-items:center!important;width:28px!important;height:25px!important;
          font-size:20px!important;line-height:1!important;color:inherit!important;text-decoration:none!important;
        }
        body:not(.vtrade-admin-mobile) #vtradeMobileBar a span:last-child{
          display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;
        }
        body:not(.vtrade-admin-mobile) #vtradeMobileBar,
        body:not(.vtrade-admin-mobile) #vtradeMobileBar *{text-decoration:none!important}
      }
      @media(max-width:380px){
        body:not(.vtrade-admin-mobile) #vtradeMobileBar{left:7px!important;right:7px!important;height:60px!important;border-radius:18px!important}
        body:not(.vtrade-admin-mobile) #vtradeMobileBar a{height:48px!important;font-size:9px!important}
        body:not(.vtrade-admin-mobile) #vtradeMobileBar .mi{font-size:18px!important}
      }
      @media(min-width:901px){#vtradeMobileBar,#vtradeAdminMobileBar,#vtradeAdminScrim,.vtrade-phone-profile{display:none!important}}
    `;
    document.head.appendChild(s);
  }
  function loadScript(id,src){
    if(document.getElementById(id))return;
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }
  function loadDirectPhoneShell(){
    if(!isMobile()||window.__VTRADE_DIRECT_PHONE_SHELL_V1__||document.getElementById('vtradeDirectPhoneShellScript'))return;
    const s=document.createElement('script');s.id='vtradeDirectPhoneShellScript';s.src='vtrade-phone-shell-direct-v1.js?v=20260822-direct5';document.head.appendChild(s);
  }
  function loadPhoneControls(){
    if(!isMobile()||!['premium-dashboard-live.html','dashboard.html'].includes(path))return;
    loadScript('vtradePhoneControlsScript','vtrade-phone-controls-v1.js?v=20260822-tf-dropdown');
  }
  function setActive(bar){
    const current=(location.hash||'#dashboard').toLowerCase();
    bar.querySelectorAll('a').forEach(a=>{
      const active=a.getAttribute('href')?.toLowerCase()===current;
      a.classList.toggle('active',active);
      if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
  }
  function addMobileNav(){
    if(!isMobile()||document.getElementById('vtradeMobileBar'))return;
    const bar=document.createElement('nav');bar.id='vtradeMobileBar';bar.setAttribute('aria-label','V TRADE AI mobile navigation');
    const items=[['#dashboard','⌂','Home'],['#ai','▣','Analyzer'],['#terminal','⌁','Chart'],['#signals','◈','Signals'],['#news','◉','News']];
    bar.innerHTML=items.map(([href,icon,label])=>`<a href="${href}"><span class="mi" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('');
    document.body.appendChild(bar);document.body.classList.add('vtrade-mobile');
    setActive(bar);
    bar.addEventListener('click',()=>setTimeout(()=>setActive(bar),0));
    window.addEventListener('hashchange',()=>setActive(bar),{passive:true});
  }
  function addAdminShell(){
    if(path!=='admin-dashboard.html'||!isMobile()||document.getElementById('vtradeAdminMobileBar'))return;
    const scrim=document.createElement('div');scrim.id='vtradeAdminScrim';document.body.appendChild(scrim);
    const bar=document.createElement('div');bar.id='vtradeAdminMobileBar';bar.innerHTML=`<button id="vtradeAdminMenu" aria-label="Open menu">☰</button><div class="title"><b>Admin Dashboard</b><small>V TRADE AI · Administrator</small></div><a href="profile.html" aria-label="Profile">♙</a><button id="vtradeAdminLogout" aria-label="Logout">↪</button>`;document.body.appendChild(bar);document.body.classList.add('vtrade-admin-mobile');
    const side=document.querySelector('.side');const openMenu=()=>{side?.classList.add('vtrade-open');scrim.classList.add('show')};const closeMenu=()=>{side?.classList.remove('vtrade-open');scrim.classList.remove('show')};
    document.getElementById('vtradeAdminMenu').onclick=openMenu;scrim.onclick=closeMenu;side?.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',closeMenu));document.getElementById('vtradeAdminLogout').onclick=()=>document.getElementById('sideLogout')?.click();
  }
  function init(){
    injectStyle();
    if(path==='admin-dashboard.html')addAdminShell();
    else if(['premium-dashboard-live.html','dashboard.html','profile.html','pricing.html'].includes(path)){
      loadDirectPhoneShell();
      loadPhoneControls();
      addMobileNav();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();