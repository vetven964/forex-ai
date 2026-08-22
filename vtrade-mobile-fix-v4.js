/* V TRADE AI — PHONE TERMINAL V8
   Target: phone layout with permanent left navigation, full-width header,
   right-side terminal content, and bottom navigation. Desktop untouched. */
(() => {
  'use strict';
  if (!window.matchMedia || !matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V8__) return;
  window.__VTRADE_PHONE_V8__ = true;

  const style = document.createElement('style');
  style.id = 'vtrade-phone-v8-style';
  style.textContent = `
@media(max-width:900px){
  :root{--phone-nav-w:216px;--phone-header-h:184px}
  html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;background:#04070d!important}

  /* The phone reference is a two-column app below a full-width header. */
  .app{display:grid!important;grid-template-columns:var(--phone-nav-w) minmax(0,1fr)!important;grid-template-rows:auto!important;width:100%!important;min-width:0!important;min-height:100vh!important}
  .main{grid-column:2!important;display:block!important;width:100%!important;min-width:0!important;overflow:hidden!important}

  /* Full-width market header. */
  .top{position:relative!important;display:grid!important;width:100vw!important;height:var(--phone-header-h)!important;min-height:var(--phone-header-h)!important;margin-left:calc(-1 * var(--phone-nav-w))!important;padding:18px 20px 10px!important;grid-template-columns:58px minmax(0,1fr) auto!important;grid-template-rows:62px 46px 54px!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:4px 9px!important;overflow:hidden!important;z-index:30!important;background:#04070d!important;border-bottom:1px solid #17253a!important}
  .top>.mobile{grid-area:menu!important;width:56px!important;height:56px!important;display:grid!important;place-items:center!important;margin:0!important;border:1px solid #283449!important;border-radius:12px!important;background:#0b1018!important}
  .top>.pair{grid-area:pair!important;min-width:0!important;overflow:hidden!important;align-self:center!important;padding:0!important}
  .top>.pair b{display:block!important;font-size:18px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:170px!important}
  .top>.pair .sub{display:block!important;font-size:11px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:170px!important}
  .top>.price{grid-area:price!important;justify-self:end!important;align-self:center!important;margin:0!important;font-size:30px!important;line-height:1!important;white-space:nowrap!important;max-width:300px!important;overflow:hidden!important}
  .top>.live{grid-area:status!important;justify-self:end!important;align-self:start!important;color:#22e58a!important;font-size:10px!important;font-weight:900!important;display:none!important}
  .top>.backend{grid-area:status!important;justify-self:end!important;align-self:start!important;margin:0!important;max-width:105px!important;padding:7px 10px!important;font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.tfs{grid-area:tfs!important;width:100%!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;margin:0!important;align-self:end!important}
  .top>.tfs::-webkit-scrollbar{display:none!important}
  .top>.tfs button{flex:0 0 74px!important;min-width:74px!important;height:50px!important;margin:0!important}
  .top>.lang-row{position:absolute!important;right:20px!important;bottom:8px!important;display:none!important}

  /* Permanent phone sidebar — exactly like the reference image. */
  .side{position:sticky!important;left:auto!important;top:var(--phone-header-h)!important;grid-column:1!important;grid-row:1!important;align-self:start!important;width:var(--phone-nav-w)!important;height:calc(100vh - var(--phone-header-h))!important;max-height:calc(100vh - var(--phone-header-h))!important;margin-top:var(--phone-header-h)!important;padding:14px 4px 96px!important;transform:none!important;transition:none!important;overflow-y:auto!important;overflow-x:hidden!important;background:#11141b!important;border-right:1px solid #2a3140!important;box-shadow:none!important;z-index:100!important;display:flex!important;flex-direction:column!important}
  .side.open,.side.vtrade-open{transform:none!important}
  .side .brand{margin:0 8px 16px!important;gap:9px!important}
  .side .brand .logo{width:45px!important;height:45px!important;font-size:23px!important;flex:0 0 45px!important}
  .side .brand b{font-size:15px!important;white-space:nowrap!important}
  .side .brand small{font-size:10px!important;white-space:nowrap!important}
  .side .nav{display:grid!important;gap:3px!important;width:100%!important}
  .side .nav button,.side .nav a{width:100%!important;min-height:54px!important;padding:10px 9px!important;border-radius:0 10px 10px 0!important;gap:9px!important;white-space:nowrap!important;font-size:12px!important}
  .side .nav button.active,.side .nav a.active{background:linear-gradient(90deg,#3a2d12,#1b1a17)!important;border-left:3px solid #f2c94c!important;border-top:0!important;border-right:0!important;border-bottom:0!important;color:#f2c94c!important}
  .side .nav-icon,.side .ico{width:24px!important;flex:0 0 24px!important;font-size:16px!important;text-align:center!important}
  .side-foot{display:none!important}
  .side .vtrade-phone-profile{display:flex!important;align-items:center!important;gap:8px!important;width:calc(100% - 8px)!important;min-height:70px!important;margin:12px 4px 0!important;padding:8px!important;border:1px solid #303746!important;border-radius:13px!important;background:#10151d!important;color:#fff!important;text-align:left!important}
  .side .vtrade-phone-profile .avatar{display:grid!important;place-items:center!important;width:38px!important;height:38px!important;border-radius:50%!important;background:linear-gradient(135deg,#5120ff,#aa72ff)!important;font-weight:900!important;flex:0 0 38px!important;font-size:12px!important}
  .side .vtrade-phone-profile b{display:block!important;font-size:11px!important;white-space:nowrap!important}
  .side .vtrade-phone-profile small{display:block!important;color:#9aa9bf!important;font-size:9px!important;margin-top:2px!important;white-space:nowrap!important}
  .side .vtrade-phone-profile i{display:block!important;color:#22e58a!important;font-size:9px!important;font-style:normal!important;margin-top:3px!important}

  /* Main content lives only in the right column. */
  .wrap{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:12px 10px 122px!important;overflow:hidden!important}
  .wrap>*{min-width:0!important;max-width:100%!important}
  .toolbar{min-width:0!important;max-width:100%!important;overflow:hidden!important}
  .card,.chart,#vtradePreMarket{min-width:0!important;max-width:100%!important;overflow:hidden!important}
  #vtradePreMarket{margin-top:4px!important;border-radius:14px!important}
  #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important;gap:6px!important}
  #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}
  #vtradePreMarket .v91a>*{flex:0 0 auto!important}

  /* Bottom app navigation. */
  #vtradeMobileBar{position:fixed!important;left:14px!important;right:14px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:2px!important;padding:5px!important;border:1px solid #303441!important;border-radius:24px!important;background:rgba(8,10,16,.97)!important;backdrop-filter:blur(14px)!important;box-shadow:0 10px 30px rgba(0,0,0,.45)!important}
  #vtradeMobileBar a,#vtradeMobileBar button{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;height:54px!important;min-width:0!important;margin:0!important;padding:3px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#d7deeb!important;text-decoration:none!important;font-size:9px!important;line-height:1.1!important;overflow:hidden!important}
  #vtradeMobileBar a.active{background:#5827d2!important;color:#fff!important}

  /* No overlay/scrim on the reference terminal layout. */
  #scrim,.scrim{display:none!important;opacity:0!important;pointer-events:none!important}
}
@media(max-width:520px){
  :root{--phone-nav-w:216px;--phone-header-h:184px}
  .top{padding-left:20px!important;padding-right:20px!important}
  .top>.price{font-size:29px!important;max-width:300px!important}
  .wrap{padding-left:10px!important;padding-right:10px!important}
}
@media(max-width:380px){
  :root{--phone-nav-w:200px}
  .top>.price{font-size:26px!important}
  .side .nav button,.side .nav a{font-size:11px!important}
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

  /* Keep the sidebar visible; the header menu remains harmless on this phone shell. */
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
