/* V TRADE AI — PHONE TERMINAL V8
   Target: phone layout with permanent left navigation, full-width header,
   right-side terminal content, and bottom navigation. Desktop untouched.
*/
(() => {
  'use strict';
  if (!window.matchMedia || !matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V8__) return;
  window.__VTRADE_PHONE_V8__ = true;

  const style = document.createElement('style');
  style.id = 'vtrade-phone-v8-style';
  style.textContent = `
@media(max-width:900px){
  :root{--phone-header-h:184px}
  html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;background:#04070d!important}

  /* PHONE: single-column shell. Never reserve sidebar width. */
  .app{display:block!important;width:100%!important;min-width:0!important;min-height:100vh!important;margin:0!important;padding:0!important}
  .main{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important;overflow:visible!important}

  /* Header is always full phone width. */
  .top{position:relative!important;display:grid!important;width:100%!important;max-width:100%!important;height:var(--phone-header-h)!important;min-height:var(--phone-header-h)!important;margin:0!important;padding:18px 14px 10px!important;grid-template-columns:52px minmax(0,1fr) auto!important;grid-template-rows:62px 46px 54px!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:4px 8px!important;overflow:hidden!important;z-index:30!important;background:#04070d!important;border-bottom:1px solid #17253a!important}
  .top>.mobile{grid-area:menu!important;width:50px!important;height:50px!important;display:grid!important;place-items:center!important;margin:0!important;border:1px solid #283449!important;border-radius:12px!important;background:#0b1018!important}
  .top>.pair{grid-area:pair!important;min-width:0!important;overflow:hidden!important;align-self:center!important;padding:0!important}
  .top>.pair b{display:block!important;font-size:18px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:180px!important}
  .top>.pair .sub{display:block!important;font-size:11px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:180px!important}
  .top>.price{grid-area:price!important;justify-self:end!important;align-self:center!important;margin:0!important;font-size:28px!important;line-height:1!important;white-space:nowrap!important;max-width:150px!important;overflow:hidden!important;text-align:right!important}
  .top>.live{grid-area:status!important;justify-self:end!important;align-self:start!important;color:#22e58a!important;font-size:10px!important;font-weight:900!important;display:none!important}
  .top>.backend{grid-area:status!important;justify-self:end!important;align-self:start!important;margin:0!important;max-width:125px!important;padding:7px 9px!important;font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.tfs{grid-area:tfs!important;width:100%!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;margin:0!important;align-self:end!important}
  .top>.tfs::-webkit-scrollbar{display:none!important}
  .top>.tfs button{flex:0 0 74px!important;min-width:74px!important;height:50px!important;margin:0!important}
  .top>.lang-row{position:absolute!important;right:14px!important;bottom:8px!important;display:none!important}

  /* IMPORTANT: sidebar must not consume phone width. */
  .side{display:none!important;width:0!important;min-width:0!important;max-width:0!important;margin:0!important;padding:0!important;transform:none!important;position:absolute!important;left:-99999px!important;visibility:hidden!important;pointer-events:none!important}
  .side.open,.side.vtrade-open{display:none!important;transform:none!important}
  .vtrade-phone-profile{display:none!important}

  /* Main content fills the whole screen. */
  .wrap{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:12px 10px 122px!important;overflow:visible!important}
  .wrap>*{width:100%!important;min-width:0!important;max-width:100%!important}
  .toolbar{width:100%!important;min-width:0!important;max-width:100%!important;overflow:hidden!important}
  .card,.chart,#vtradePreMarket{width:100%!important;min-width:0!important;max-width:100%!important;overflow:hidden!important}
  #vtradePreMarket{margin-top:4px!important;border-radius:14px!important}
  #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important;gap:6px!important}
  #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}
  #vtradePreMarket .v91a>*{flex:0 0 auto!important}

  /* Bottom app navigation remains full width and above content. */
  #vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:2px!important;padding:5px!important;border:1px solid #303441!important;border-radius:24px!important;background:rgba(8,10,16,.97)!important;backdrop-filter:blur(14px)!important;box-shadow:0 10px 30px rgba(0,0,0,.45)!important}
  #vtradeMobileBar a,#vtradeMobileBar button{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;height:54px!important;min-width:0!important;margin:0!important;padding:3px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#d7deeb!important;text-decoration:none!important;font-size:9px!important;line-height:1.1!important;overflow:hidden!important}
  #vtradeMobileBar a.active{background:#5827d2!important;color:#fff!important}

  #scrim,.scrim{display:none!important;opacity:0!important;pointer-events:none!important}
}
@media(max-width:520px){
  .top{padding-left:12px!important;padding-right:12px!important}
  .top>.price{font-size:26px!important;max-width:135px!important}
  .wrap{padding-left:8px!important;padding-right:8px!important}
}
@media(max-width:380px){
  .top>.price{font-size:23px!important;max-width:120px!important}
  .top>.pair b{font-size:16px!important}
  .top>.pair .sub{font-size:10px!important}
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

  /* On phone, do not allow the old sidebar-opening handler to alter layout. */
  const menu=document.querySelector('.top>.mobile');
  if(menu){
    menu.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      side?.classList.remove('open','vtrade-open');
    },true);
  }

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
