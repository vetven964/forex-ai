/* V TRADE AI — Mobile App shell / navigation V7 */
(() => {
  'use strict';
  if (window.__VTRADE_RESPONSIVE_V7__) return;
  window.__VTRADE_RESPONSIVE_V7__ = true;
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  const path=location.pathname.split('/').pop().toLowerCase();
  function injectStyle(){
    if(document.getElementById('vtradeResponsiveRuntimeStyleV7'))return;
    const s=document.createElement('style');s.id='vtradeResponsiveRuntimeStyleV7';
    s.textContent=`@media(max-width:900px){html,body{width:100%;max-width:100%;overflow-x:hidden!important}body.vtrade-mobile{padding-bottom:calc(88px + env(safe-area-inset-bottom))!important}#vtradeMobileBar{z-index:5000!important}body.vtrade-admin-mobile .side{z-index:3000!important}body.vtrade-admin-mobile #vtradeAdminMobileBar{z-index:5000!important}}@media(min-width:901px){#vtradeMobileBar,#vtradeAdminMobileBar,#vtradeAdminScrim,.vtrade-phone-profile{display:none!important}}`;
    document.head.appendChild(s);
  }
  function addMobileNav(){
    if(!isMobile()||document.getElementById('vtradeMobileBar'))return;
    const bar=document.createElement('nav');bar.id='vtradeMobileBar';bar.setAttribute('aria-label','V TRADE AI mobile navigation');
    const items=[['premium-dashboard-live.html#dashboard','⌂','Home'],['premium-dashboard-live.html#ai','▣','Analyzer'],['premium-dashboard-live.html#terminal','⌁','Chart'],['premium-dashboard-live.html#signals','◈','Signals'],['premium-dashboard-live.html#stats','▥','Stats']];
    bar.innerHTML=items.map(([href,icon,label])=>`<a href="${href}"><span class="mi">${icon}</span><span>${label}</span></a>`).join('');document.body.appendChild(bar);document.body.classList.add('vtrade-mobile');
  }
  function addAdminShell(){
    if(path!=='admin-dashboard.html'||!isMobile()||document.getElementById('vtradeAdminMobileBar'))return;
    const scrim=document.createElement('div');scrim.id='vtradeAdminScrim';document.body.appendChild(scrim);
    const bar=document.createElement('div');bar.id='vtradeAdminMobileBar';bar.innerHTML=`<button id="vtradeAdminMenu" aria-label="Open menu">☰</button><div class="title"><b>Admin Dashboard</b><small>V TRADE AI · Administrator</small></div><a href="profile.html" aria-label="Profile">♙</a><button id="vtradeAdminLogout" aria-label="Logout">↪</button>`;document.body.appendChild(bar);document.body.classList.add('vtrade-admin-mobile');
    const side=document.querySelector('.side');const openMenu=()=>{side?.classList.add('vtrade-open');scrim.classList.add('show')};const closeMenu=()=>{side?.classList.remove('vtrade-open');scrim.classList.remove('show')};
    document.getElementById('vtradeAdminMenu').onclick=openMenu;scrim.onclick=closeMenu;side?.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',closeMenu));document.getElementById('vtradeAdminLogout').onclick=()=>document.getElementById('sideLogout')?.click();
  }
  function init(){injectStyle();if(path==='admin-dashboard.html')addAdminShell();else if(['premium-dashboard-live.html','dashboard.html','profile.html','pricing.html'].includes(path))addMobileNav();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();