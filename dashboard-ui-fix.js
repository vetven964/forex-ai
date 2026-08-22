/* V TRADE AI — role-specific Home / Dashboard navigation + live price mapping V4 */
(() => {
  'use strict';
  if (window.__VTRADE_DASHBOARD_UI_FIX__) return;
  window.__VTRADE_DASHBOARD_UI_FIX__ = true;
  const file=()=>String(location.pathname.split('/').pop()||'').toLowerCase();
  const isTerminal=()=>file()==='premium-dashboard-live.html';
  const isAdmin=()=>file()==='admin-dashboard.html';
  const isPhone=()=>window.matchMedia?.('(max-width:900px)').matches;
  const km=()=>localStorage.getItem('vtrade_lang')==='km';
  const readUser=()=>{try{return JSON.parse(sessionStorage.getItem('vtrade_user')||localStorage.getItem('vtrade_user')||'{}')}catch{return{}}};
  const admin=()=>['admin','administrator'].includes(String(readUser()?.role||'').toLowerCase());
  const ADMIN_HOME='admin-dashboard.html?v=20260821-admin-home',USER_HOME='premium-dashboard-live.html?v=20260821-user-home',TERMINAL='premium-dashboard-live.html?v=20260821-live-terminal';
  function relabelSidebar(){if(!isTerminal())return;const side=document.querySelector('.side');if(!side)return;const links=[...side.querySelectorAll('a')];const dashboard=links.find(a=>/dashboard/i.test(a.textContent||'')||/premium-dashboard-live\.html/i.test(a.getAttribute('href')||''));if(dashboard){dashboard.href=admin()?ADMIN_HOME:USER_HOME;const text=dashboard.querySelector('span:last-child')||dashboard;if(text)text.textContent=admin()?(km()?'ផ្ទាំង Admin':'Admin Home'):(km()?'ទំព័រដើម':'Home')}const terminal=links.find(a=>/terminal/i.test(a.textContent||''));if(terminal)terminal.href=TERMINAL}
  function addProfileToTerminal(){if(!isTerminal())return;const menu=document.getElementById('vtradeAccountMenu');if(!menu||menu.dataset.uiFixed==='1')return;menu.dataset.uiFixed='1';const userLink=document.getElementById('vtradeUserLink');if(userLink){userLink.href=admin()?ADMIN_HOME:USER_HOME;const s=userLink.querySelector('span');if(s)s.textContent=admin()?(km()?'ផ្ទាំង Admin':'Admin Home'):(km()?'ទំព័រដើម':'Home')}const adminLink=document.getElementById('vtradeAdminLink');if(adminLink){adminLink.href=ADMIN_HOME;adminLink.style.display=admin()?'':'none'}const profile=document.createElement('a');profile.id='vtradeProfileLink';profile.href='profile.html?v=20260821-profile';profile.innerHTML='♙ <span>'+(km()?'គណនី / Profile':'Profile')+'</span>';profile.style.borderTop='1px solid #1b2a41';const head=menu.querySelector('.vtrade-menu-head');if(head&&head.nextSibling)menu.insertBefore(profile,head.nextSibling);else menu.appendChild(profile);const settings=document.createElement('a');settings.href='profile.html?v=20260821-profile-security';settings.innerHTML='⚙ <span>'+(km()?'សុវត្ថិភាពគណនី':'Account Security')+'</span>';menu.insertBefore(settings,userLink||null);const live=document.createElement('a');live.href=TERMINAL;live.innerHTML='▣ <span>'+(km()?'Terminal ផ្ទាល់':'Live Terminal')+'</span>';menu.insertBefore(live,adminLink||menu.querySelector('.logout'))}
  function hidePhoneAdminIdentity(){
    if(!isTerminal()||!isPhone())return;
    const hide=el=>{if(!el||el===document.body||el.id==='side'||el.closest('.side'))return;el.setAttribute('data-vtrade-phone-admin-hidden','1');el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important')};
    const hidden=[...document.querySelectorAll('[data-vtrade-phone-admin-hidden]')];hidden.forEach(hide);
    const vw=window.innerWidth,vh=window.innerHeight;
    const candidates=[];
    for(const el of document.querySelectorAll('body *')){
      if(el===document.body||el.id==='side'||el.closest('.side')||el.hasAttribute('data-vtrade-phone-admin-hidden'))continue;
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!/\bVET\s+VEN\b/i.test(text)||!/\bAdministrator\b/i.test(text))continue;
      const r=el.getBoundingClientRect();
      if(r.width<220||r.width>vw*0.95||r.height<60||r.height>220)continue;
      const cs=getComputedStyle(el);
      const floating=['fixed','absolute','sticky'].includes(cs.position);
      const rightSide=r.left>vw*0.40;
      const lower=r.top>Math.max(300,vh*0.20);
      const score=(floating?100:0)+(rightSide?40:0)+(lower?25:0)+(r.width>=250?20:0);
      candidates.push({el,r,score});
    }
    if(candidates.length){candidates.sort((a,b)=>b.score-a.score);hide(candidates[0].el);return}
    const matches=[...document.querySelectorAll('body *')].filter(el=>{const t=(el.textContent||'').replace(/\s+/g,' ').trim();return /\bVET\s+VEN\b/i.test(t)||/\bAdministrator\b/i.test(t)});
    for(const start of matches){
      let p=start;
      for(let i=0;i<8&&p&&p!==document.body;i++,p=p.parentElement){
        if(p.id==='side'||p.closest('.side'))break;
        const t=(p.textContent||'').replace(/\s+/g,' ').trim();
        if(!/\bVET\s+VEN\b/i.test(t)||!/\bAdministrator\b/i.test(t))continue;
        const r=p.getBoundingClientRect();
        if(r.width>=220&&r.width<=vw*0.95&&r.height>=60&&r.height<=220&&r.left>vw*0.30){hide(p);return}
      }
    }
  }
  function fixAdminRoutes(){if(!isAdmin())return;document.querySelectorAll('a[href*="premium-dashboard-live.html"]').forEach(a=>a.setAttribute('href',TERMINAL));const menu=document.getElementById('profileMenu');if(menu&&!menu.querySelector('[data-live-terminal]')){const a=document.createElement('a');a.dataset.liveTerminal='1';a.href=TERMINAL;a.textContent='▣  Live Terminal';const profile=menu.querySelector('a[href^="profile.html"]');menu.insertBefore(a,profile||menu.firstChild)}document.querySelectorAll('a').forEach(a=>{const t=(a.textContent||'').trim().toLowerCase();if((t==='dashboard'||t==='home'||t.includes('admin home'))&&!/profile|logout/i.test(t))a.href=ADMIN_HOME})}
  function readHeaderLivePrice(){if(!isTerminal())return null;const el=document.querySelector('.top .price')||document.querySelector('.top .price-value');if(!el)return null;const m=String(el.textContent||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);const v=Number(m?.[0]);return Number.isFinite(v)?v:null}
  function paintLivePrice(live){if(!Number.isFinite(live))return;const formatted=live.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});const section=[...document.querySelectorAll('.section')].find(el=>/CANDLE-OPEN MTF PROCESSING/i.test(el.textContent||''))||document.body;const nodes=[...section.querySelectorAll('*')].filter(el=>{const t=(el.textContent||'').trim();return /^(?:Price|Live Price)\s+[\d,]+(?:\.\d+)?\s*[·•]\s*Score\s+\d+/i.test(t)&&el.children.length===0});nodes.forEach(el=>{const m=el.textContent.match(/[·•]\s*Score\s+\d+/i);el.textContent=`Live Price ${formatted} ${m?m[0]:''}`.trim()});const labels=[...document.querySelectorAll('*')].filter(el=>(el.textContent||'').trim()==='Current Price');labels.forEach(label=>{const row=label.parentElement;const value=row?.querySelector('b,strong,[class*="value"]');if(value)value.textContent=formatted})}
  async function syncLiveMtfPrices(){if(!isTerminal())return;try{let live=readHeaderLivePrice();if(!Number.isFinite(live)){const c=window.VTRADE_CONNECTION;if(!c?.fetch||!c?.api)return;const r=await c.fetch(c.api('/api/pre-market/mt5-authoritative'),{credentials:'omit',cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d?.success===false)return;const root=d?.analysis||d?.data||d?.result||d||{};live=Number(d?.price??d?.currentPrice??d?.livePrice??root?.price??root?.currentPrice??root?.livePrice??d?.quote?.price??d?.mt5?.price)}paintLivePrice(live)}catch(e){console.warn('[V-TRADE LIVE PRICE SYNC V4]',e?.message||e)}}
  function startLivePriceSync(){if(!isTerminal()||window.__VTRADE_LIVE_PRICE_SYNC__)return;window.__VTRADE_LIVE_PRICE_SYNC__=true;const run=()=>syncLiveMtfPrices();run();setTimeout(run,300);setTimeout(run,900);setInterval(run,2000)}
  function init(){fixAdminRoutes();relabelSidebar();addProfileToTerminal();hidePhoneAdminIdentity();startLivePriceSync();if(isTerminal()){setTimeout(()=>{relabelSidebar();addProfileToTerminal();hidePhoneAdminIdentity();syncLiveMtfPrices()},150);setTimeout(()=>{relabelSidebar();hidePhoneAdminIdentity();syncLiveMtfPrices()},700)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.addEventListener('vtrade:rbac-ready',init);
  new MutationObserver(()=>{if(isTerminal()&&isPhone())hidePhoneAdminIdentity()}).observe(document.documentElement,{childList:true,subtree:true});
})();
