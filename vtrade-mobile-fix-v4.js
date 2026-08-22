/* V TRADE AI — PHONE TERMINAL SHELL V5
   Phone target layout: persistent left navigation + content rail.
   Desktop/PC untouched. */
(() => {
  'use strict';
  if (!matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V5__) return;
  window.__VTRADE_PHONE_V5__ = true;
  const style=document.createElement('style');
  style.id='vtrade-phone-v5-style';
  style.textContent=`
@media(max-width:900px){
html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;background:#04070d!important}
body .app{display:block!important;width:100%!important;min-width:0!important}
.main{width:100%!important;min-width:0!important;overflow:hidden!important}

/* Header stays full-width exactly like the reference. */
.top{position:relative!important;display:grid!important;width:100%!important;min-height:183px!important;height:183px!important;padding:42px 20px 8px!important;grid-template-columns:58px minmax(0,1fr) auto!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:3px 9px!important;overflow:hidden!important;z-index:70!important;background:#04070d!important}
.top>.mobile{grid-area:menu!important;width:58px!important;height:54px!important;align-self:start!important;position:relative!important;z-index:100!important}
.top>.pair{grid-area:pair!important;min-width:0!important;align-self:start!important;padding-top:2px!important;overflow:hidden!important}
.top>.pair b{font-size:18px!important;white-space:nowrap!important}
.top>.pair .sub{font-size:12px!important;max-width:150px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.top>.price{grid-area:price!important;font-size:29px!important;line-height:1!important;justify-self:end!important;align-self:start!important;white-space:nowrap!important}
.top>.live,.top>.backend{grid-area:status!important;justify-self:end!important;font-size:10px!important;padding:7px 12px!important;max-width:100px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.top>.tfs{grid-area:tfs!important;width:100%!important;margin:9px 0 0!important;display:flex!important;gap:8px!important;overflow-x:auto!important;scrollbar-width:none!important}
.top>.tfs::-webkit-scrollbar{display:none}
.top>.tfs button{flex:0 0 72px!important;min-width:72px!important;height:50px!important}

/* Header account must never appear; profile belongs inside the persistent sidebar. */
#vtradeAccountMenu,#vtradeProfileLink,#vtradeAdminLink,#vtradeUserLink,.vtrade-menu-head,[id*="AccountMenu"],[id*="accountMenu"],[class*="account-menu"],[class*="accountMenu"],[class*="profile-menu"],[class*="profileMenu"],.top #profileAdminLink,.top .vtrade-phone-profile,.top .profile{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}

/* Persistent left rail: reference layout, not slide-out overlay. */
.side{position:fixed!important;left:0!important;top:183px!important;right:auto!important;bottom:0!important;width:30.5vw!important;min-width:205px!important;max-width:222px!important;height:auto!important;z-index:1200!important;transform:none!important;transition:none!important;display:flex!important;flex-direction:column!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0 4px calc(86px + env(safe-area-inset-bottom))!important;background:#11141b!important;border-right:1px solid #242936!important}
.side.open,.side.vtrade-open{transform:none!important}
.side-foot{margin-top:auto!important}
.side a,.side button{max-width:100%!important}

/* Main content occupies the right rail, while the header remains full width. */
.wrap{width:calc(100% - 30.5vw)!important;max-width:none!important;margin:0 0 0 30.5vw!important;padding:12px 8px 104px!important;overflow:hidden!important}
.card,.chart{min-width:0!important;max-width:100%!important;overflow:hidden!important}
#vtradePreMarket{width:100%!important;max-width:100%!important;overflow:hidden!important}
#vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}
#vtradePreMarket .v91a::-webkit-scrollbar{display:none}

/* Keep bottom navigation visible even though the left rail is permanently open. */
#vtradeMobileBar{display:grid!important;position:fixed!important;left:8px!important;right:8px!important;bottom:8px!important;z-index:5000!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border-radius:22px!important;background:rgba(8,10,16,.96)!important;border:1px solid #303441!important;backdrop-filter:blur(14px)!important}
#vtradeMobileBar a{height:54px!important;border-radius:15px!important;font-size:9px!important}
body.vtrade-phone-menu-open{overflow:hidden!important}
}
@media(min-width:901px){#vtradeMobileBar,.vtrade-phone-profile{display:none!important}}
`;
  document.head.appendChild(style);

  const original=document.getElementById('profileAdminLink');
  const side=document.getElementById('side');
  if(side&&!side.querySelector('.vtrade-phone-profile')){
    const card=document.createElement('button');
    card.type='button';
    card.className='vtrade-phone-profile';
    card.innerHTML='<span class="avatar">VV</span><span><b>VET VEN</b><small>Administrator</small><i>● Online</i></span>';
    card.style.cssText='display:flex!important;align-items:center!important;gap:10px!important;margin:12px 2px 0!important;padding:12px!important;min-height:70px!important;border:1px solid #303746!important;border-radius:14px!important;background:#10151d!important;color:#fff!important;flex:0 0 auto!important;text-align:left!important;';
    card.onclick=()=>original?.click();
    side.appendChild(card);
  }
  if(original) original.style.setProperty('display','none','important');

  const hideFloating=()=>{
    document.querySelectorAll('body *').forEach(el=>{
      if(el.closest('.side')) return;
      const id=String(el.id||'').toLowerCase(), cls=String(el.className||'').toLowerCase();
      if(/accountmenu|account-menu|profilemenu|profile-menu/.test(id+' '+cls)) el.style.setProperty('display','none','important');
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(text.length<=100 && /vet ven/i.test(text) && /administrator/i.test(text)){
        const r=el.getBoundingClientRect();
        if(r.width>140 && r.height>45 && r.top<window.innerHeight*.8) el.style.setProperty('display','none','important');
      }
    });
  };
  hideFloating();
  new MutationObserver(hideFloating).observe(document.body,{childList:true,subtree:true});
})();
