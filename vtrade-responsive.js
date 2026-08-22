/* V TRADE AI — Mobile App shell / navigation V9 */
(() => {
  'use strict';
  if (window.__VTRADE_RESPONSIVE_V9__) return;
  window.__VTRADE_RESPONSIVE_V9__ = true;
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  const path=location.pathname.split('/').pop().toLowerCase();
  function injectStyle(){
    if(document.getElementById('vtradeResponsiveRuntimeStyleV9'))return;
    const s=document.createElement('style');s.id='vtradeResponsiveRuntimeStyleV9';
    s.textContent=`@media(max-width:900px){html,body{width:100%;max-width:100%;overflow-x:hidden!important}body.vtrade-mobile{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}#vtradeMobileBar{z-index:5000!important}body.vtrade-admin-mobile .side{z-index:3000!important}body.vtrade-admin-mobile #vtradeAdminMobileBar{z-index:5000!important}}@media(min-width:901px){#vtradeMobileBar,#vtradeAdminMobileBar,#vtradeAdminScrim,.vtrade-phone-profile{display:none!important}}`;
    document.head.appendChild(s);
  }
  function loadDirectPhoneShell(){
    if(!isMobile()||window.__VTRADE_DIRECT_PHONE_SHELL_V1__||document.getElementById('vtradeDirectPhoneShellScript'))return;
    const s=document.createElement('script');s.id='vtradeDirectPhoneShellScript';s.src='vtrade-phone-shell-direct-v1.js?v=20260822-direct3';document.head.appendChild(s);
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
  function init(){injectStyle();if(path==='admin-dashboard.html')addAdminShell();else if(['premium-dashboard-live.html','dashboard.html','profile.html','pricing.html'].includes(path)){loadDirectPhoneShell();addMobileNav();}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();