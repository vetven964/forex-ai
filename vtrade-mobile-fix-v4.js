/* V TRADE AI — PHONE TERMINAL SHELL V4.2
   Phone only. Desktop/PC untouched. */
(() => {
  'use strict';
  if (!matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V42__) return;
  window.__VTRADE_PHONE_V42__ = true;
  const style=document.createElement('style');
  style.id='vtrade-phone-v42-style';
  style.textContent=`
@media(max-width:900px){
html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
body .app{display:block!important;width:100%!important;min-width:0!important}.main{width:100%!important;min-width:0!important;overflow:hidden!important}
.top{position:relative!important;display:grid!important;width:100%!important;min-height:132px!important;height:auto!important;padding:9px 10px 8px!important;grid-template-columns:42px minmax(0,1fr) auto!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:3px 7px!important;overflow:hidden!important;z-index:70!important}
.top>.mobile{grid-area:menu!important;width:42px!important;height:42px!important;align-self:start!important;position:relative!important;z-index:100!important}.top>.pair{grid-area:pair!important;min-width:0!important;align-self:start!important;padding-top:2px!important;overflow:hidden!important}.top>.pair b{font-size:15px!important;white-space:nowrap!important}.top>.pair .sub{font-size:10px!important;max-width:135px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.top>.price{grid-area:price!important;font-size:23px!important;line-height:1!important;justify-self:end!important;align-self:start!important;white-space:nowrap!important}.top>.live,.top>.backend{grid-area:status!important;justify-self:end!important;font-size:8px!important;padding:5px 8px!important;max-width:122px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.top>.tfs{grid-area:tfs!important;width:100%!important;margin:4px 0 0!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important}.top>.tfs::-webkit-scrollbar{display:none}.top>.tfs button{flex:0 0 64px!important;min-width:64px!important;height:42px!important}
/* No account/profile card is allowed in the phone header. */
#vtradeAccountMenu,#vtradeProfileLink,#vtradeAdminLink,#vtradeUserLink,.vtrade-menu-head,[id*="AccountMenu"],[id*="accountMenu"],[class*="account-menu"],[class*="accountMenu"],[class*="profile-menu"],[class*="profileMenu"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
.side{position:fixed!important;inset:0 auto 0 0!important;width:min(286px,84vw)!important;height:100dvh!important;z-index:3000!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;display:flex!important;flex-direction:column!important;overflow-y:auto!important;padding:18px 12px calc(20px + env(safe-area-inset-bottom))!important}.side.open,.side.vtrade-open{transform:translateX(0)!important}.side-foot{margin-top:auto!important}
.vtrade-phone-profile{display:flex!important;align-items:center!important;gap:10px!important;margin-top:12px!important;padding:12px!important;min-height:70px!important;border:1px solid #263650!important;border-radius:14px!important;background:#09111e!important;color:#fff!important;flex:0 0 auto!important}.vtrade-phone-profile .avatar{width:42px!important;height:42px!important;border-radius:50%!important;display:grid!important;place-items:center!important;flex:0 0 42px!important;background:linear-gradient(135deg,#5120ff,#aa72ff)!important;font-weight:900!important}.vtrade-phone-profile b{font-size:14px!important}.vtrade-phone-profile small{display:block!important;color:#8493ab!important;margin-top:3px!important;font-size:11px!important}
.wrap{width:100%!important;max-width:none!important;margin:0!important;padding:12px 7px 104px!important;overflow:hidden!important}.card,.chart{min-width:0!important;max-width:100%!important;overflow:hidden!important}
#vtradePreMarket{width:100%!important;max-width:100%!important;overflow:hidden!important}#vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}#vtradePreMarket .v91a::-webkit-scrollbar{display:none}
#vtradeMobileBar{left:8px!important;right:8px!important;bottom:8px!important;z-index:1500!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border-radius:22px!important}#vtradeMobileBar a{height:54px!important;border-radius:15px!important;font-size:9px!important}
body.vtrade-phone-menu-open #vtradeMobileBar,body:has(.side.open) #vtradeMobileBar,body:has(.side.vtrade-open) #vtradeMobileBar{display:none!important}body.vtrade-phone-menu-open{overflow:hidden!important}
}
@media(min-width:901px){#vtradeMobileBar,.vtrade-phone-profile{display:none!important}}
`;
  document.head.appendChild(style);
  const original=document.getElementById('profileAdminLink');
  const side=document.getElementById('side');
  if(side&&!side.querySelector('.vtrade-phone-profile')){
    const card=document.createElement('button');card.type='button';card.className='vtrade-phone-profile';
    card.innerHTML='<span class="avatar">VV</span><span><b>VET VEN</b><small>Administrator</small></span>';
    card.onclick=()=>original?.click();side.appendChild(card);
  }
  if(original) original.style.setProperty('display','none','important');

  const hideFloating=()=>{
    document.querySelectorAll('body *').forEach(el=>{
      if(el.closest('.side')) return;
      const id=String(el.id||'').toLowerCase(), cls=String(el.className||'').toLowerCase();
      if(/accountmenu|account-menu|profilemenu|profile-menu/.test(id+' '+cls)) el.style.setProperty('display','none','important');
      const text=(el.textContent||'').trim();
      if(text.length<=80 && /vet ven/i.test(text) && /administrator/i.test(text)){
        const r=el.getBoundingClientRect();
        if(r.width>140 && r.height>45 && r.top<window.innerHeight*.7) el.style.setProperty('display','none','important');
      }
    });
  };
  hideFloating();
  new MutationObserver(hideFloating).observe(document.body,{childList:true,subtree:true});

  const syncMenu=()=>{
    const open=!!side?.classList.contains('open')||!!side?.classList.contains('vtrade-open');
    document.body.classList.toggle('vtrade-phone-menu-open',open);
    const bar=document.getElementById('vtradeMobileBar');
    if(bar) bar.style.setProperty('display',open?'none':'grid','important');
  };
  if(side)new MutationObserver(syncMenu).observe(side,{attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{if(e.target.closest('.mobile'))setTimeout(syncMenu,80)},true);
  syncMenu();
})();
