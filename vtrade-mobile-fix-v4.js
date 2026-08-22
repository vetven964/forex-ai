/* V TRADE AI — PHONE TERMINAL V7
   Phone-only responsive shell. Desktop/PC is untouched. */
(() => {
  'use strict';
  if (!window.matchMedia || !matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V7__) return;
  window.__VTRADE_PHONE_V7__ = true;

  const style = document.createElement('style');
  style.id = 'vtrade-phone-v7-style';
  style.textContent = `
@media (max-width:900px){
  html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;background:#04070d!important}
  .app{display:block!important;width:100%!important;min-width:0!important}
  .main{display:block!important;width:100%!important;min-width:0!important;overflow:hidden!important}
  .top{position:relative!important;display:grid!important;width:100%!important;height:183px!important;min-height:183px!important;padding:22px 16px 8px!important;grid-template-columns:52px minmax(0,1fr) auto!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:5px 8px!important;overflow:hidden!important;z-index:30!important;background:#04070d!important}
  .top>.mobile{grid-area:menu!important;display:grid!important;place-items:center!important;width:52px!important;height:52px!important;margin:0!important;z-index:40!important}
  .top>.pair{grid-area:pair!important;min-width:0!important;overflow:hidden!important;padding-top:1px!important}
  .top>.pair b{font-size:18px!important;white-space:nowrap!important}
  .top>.pair .sub{font-size:11px!important;max-width:140px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.price{grid-area:price!important;justify-self:end!important;font-size:29px!important;line-height:1!important;white-space:nowrap!important}
  .top>.live,.top>.backend{grid-area:status!important;justify-self:end!important;font-size:9px!important;padding:6px 10px!important;max-width:120px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.tfs{grid-area:tfs!important;width:100%!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;margin:7px 0 0!important}
  .top>.tfs::-webkit-scrollbar{display:none!important}
  .top>.tfs button{flex:0 0 72px!important;min-width:72px!important;height:52px!important}
  .top #profileAdminLink,.top #vtradeAccountMenu,.top #vtradeProfileLink,.top #vtradeAdminLink,.top #vtradeUserLink,.top .profile,.top .vtrade-phone-profile,.top [class*="profile" i],.top [id*="profile" i],.top [class*="account" i],.top [id*="account" i]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}

  /* Drawer: hidden by default. It must never occupy/cover Home content. */
  .side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(310px,82vw)!important;height:100vh!important;max-height:none!important;transform:translateX(-105%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important;padding:18px 10px 110px!important;background:#11141b!important;border-right:1px solid #2a3140!important;box-shadow:22px 0 60px rgba(0,0,0,.55)!important;z-index:3000!important;display:flex!important;flex-direction:column!important}
  .side.open,.side.vtrade-open{transform:translateX(0)!important}
  .side .brand{margin:3px 8px 24px!important}
  .side .nav{display:grid!important;gap:5px!important}
  .side .nav button{width:100%!important;min-height:54px!important;padding:12px!important;border-radius:13px!important;white-space:nowrap!important}
  .side-foot{margin-top:auto!important}
  .side .vtrade-phone-profile{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:68px!important;margin:12px 0 0!important;padding:10px!important;border:1px solid #303746!important;border-radius:14px!important;background:#10151d!important;color:#fff!important;text-align:left!important}
  .side .vtrade-phone-profile .avatar{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:50%!important;background:linear-gradient(135deg,#5120ff,#aa72ff)!important;font-weight:900!important;flex:0 0 40px!important}
  .side .vtrade-phone-profile b{display:block!important;font-size:13px!important}
  .side .vtrade-phone-profile small{display:block!important;color:#9aa9bf!important;margin-top:2px!important}
  .side .vtrade-phone-profile i{display:block!important;color:#22e58a!important;font-size:10px!important;font-style:normal!important;margin-top:3px!important}

  .wrap{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:12px 12px 96px!important;overflow:hidden!important}
  .wrap>*{min-width:0!important;max-width:100%!important}
  .card,.chart,#vtradePreMarket{min-width:0!important;max-width:100%!important;overflow:hidden!important}
  #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}
  #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}

  #vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:8px!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border:1px solid #303441!important;border-radius:22px!important;background:rgba(8,10,16,.97)!important;backdrop-filter:blur(14px)!important}
  #vtradeMobileBar a,#vtradeMobileBar button{display:flex!important;align-items:center!important;justify-content:center!important;height:54px!important;min-width:0!important;margin:0!important;padding:4px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#d7deeb!important;text-decoration:none!important;font-size:10px!important;line-height:1.1!important;overflow:hidden!important}
  #vtradeMobileBar a.active,#vtradeMobileBar button.active{background:#5827d2!important;color:#fff!important}
  #vtradeMobileBar a *{pointer-events:none!important}

  #scrim,.scrim{display:block!important;position:fixed!important;inset:0!important;background:rgba(0,0,0,.58)!important;z-index:2990!important;opacity:0!important;pointer-events:none!important}
  #scrim.show,.scrim.show{opacity:1!important;pointer-events:auto!important}
}
@media(min-width:901px){#vtradeMobileBar,.vtrade-phone-profile{display:none!important}}
`;
  document.head.appendChild(style);

  const original = document.getElementById('profileAdminLink');
  const side = document.getElementById('side');
  if(side && !side.querySelector('.vtrade-phone-profile')){
    const card=document.createElement('button');
    card.type='button';
    card.className='vtrade-phone-profile';
    card.innerHTML='<span class="avatar">VV</span><span><b>VET VEN</b><small>Administrator</small><i>● Online</i></span>';
    card.onclick=()=>original?.click();
    side.appendChild(card);
  }
  if(original) original.style.setProperty('display','none','important');

  const clean=()=>{
    document.querySelectorAll('.top *').forEach(el=>{
      const id=String(el.id||'').toLowerCase();
      const cls=String(el.className||'').toLowerCase();
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(/profile|account/.test(id+' '+cls) || (text.length<100 && /vet ven/i.test(text) && /administrator/i.test(text))){
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('pointer-events','none','important');
      }
    });
  };
  clean();
  new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
})();
