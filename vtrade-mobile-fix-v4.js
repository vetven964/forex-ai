/* V TRADE AI — PHONE TERMINAL V6
   Phone-only shell. PC/Desktop is intentionally untouched. */
(() => {
  'use strict';
  if (!window.matchMedia || !matchMedia('(max-width:900px)').matches || window.__VTRADE_PHONE_V6__) return;
  window.__VTRADE_PHONE_V6__ = true;

  const style = document.createElement('style');
  style.id = 'vtrade-phone-v6-style';
  style.textContent = `
@media (max-width:900px){
  html,body{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;background:#04070d!important}
  body{padding:0!important}

  /* Keep the real desktop grid structure on phone: sidebar + main rail. */
  .app{display:grid!important;grid-template-columns:215px minmax(0,1fr)!important;width:100%!important;min-width:0!important;min-height:100vh!important}
  .main{grid-column:2!important;grid-row:1!important;min-width:0!important;width:100%!important;overflow:hidden!important}

  /* Phone header belongs only to the main rail; no floating account card. */
  .top{position:relative!important;display:grid!important;width:100%!important;min-width:0!important;height:183px!important;min-height:183px!important;padding:20px 12px 8px!important;grid-template-columns:54px minmax(0,1fr) auto!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:4px 7px!important;overflow:hidden!important;z-index:20!important;background:#04070d!important}
  .top>.mobile{grid-area:menu!important;display:grid!important;place-items:center!important;width:54px!important;height:54px!important;position:relative!important;z-index:30!important;margin:0!important}
  .top>.pair{grid-area:pair!important;min-width:0!important;overflow:hidden!important;align-self:start!important;padding-top:1px!important}
  .top>.pair b{font-size:17px!important;line-height:1.1!important;white-space:nowrap!important}
  .top>.pair .sub{font-size:11px!important;max-width:115px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.price{grid-area:price!important;justify-self:end!important;align-self:start!important;font-size:27px!important;line-height:1!important;white-space:nowrap!important}
  .top>.live,.top>.backend{grid-area:status!important;justify-self:end!important;align-self:start!important;font-size:9px!important;padding:6px 9px!important;max-width:112px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .top>.tfs{grid-area:tfs!important;width:100%!important;min-width:0!important;margin:7px 0 0!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important}
  .top>.tfs::-webkit-scrollbar{display:none!important}
  .top>.tfs button{flex:0 0 72px!important;min-width:72px!important;height:52px!important;padding:8px!important}

  /* Remove every account/profile copy from the header. */
  .top #profileAdminLink,.top #vtradeAccountMenu,.top #vtradeProfileLink,.top #vtradeAdminLink,.top #vtradeUserLink,
  .top .profile,.top .vtrade-phone-profile,.top [class*="profile" i],.top [id*="profile" i],
  .top [class*="account" i],.top [id*="account" i]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}

  /* Persistent PC-style left menu: never overlays the content rail. */
  .side{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;grid-column:1!important;grid-row:1!important;width:215px!important;min-width:215px!important;max-width:215px!important;height:100vh!important;max-height:100vh!important;transform:none!important;transition:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:18px 8px 100px!important;background:#11141b!important;border-right:1px solid #242936!important;z-index:40!important;display:flex!important;flex-direction:column!important}
  .side.open,.side.vtrade-open{transform:none!important}
  .side .brand{margin:3px 8px 24px!important;flex:0 0 auto!important}
  .side .nav{display:grid!important;gap:6px!important;flex:0 0 auto!important}
  .side .nav button{width:100%!important;min-height:52px!important;padding:12px 10px!important;border-radius:12px!important;white-space:nowrap!important}
  .side-foot{margin-top:auto!important;flex:0 0 auto!important}

  /* Profile belongs at bottom of sidebar only. */
  .side .vtrade-phone-profile{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;min-height:68px!important;margin:12px 0 0!important;padding:10px!important;border:1px solid #303746!important;border-radius:14px!important;background:#10151d!important;color:#fff!important;text-align:left!important;flex:0 0 auto!important}
  .side .vtrade-phone-profile .avatar{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:50%!important;background:linear-gradient(135deg,#5120ff,#aa72ff)!important;font-weight:900!important;flex:0 0 40px!important}
  .side .vtrade-phone-profile b{display:block!important;font-size:13px!important}
  .side .vtrade-phone-profile small{display:block!important;color:#9aa9bf!important;margin-top:2px!important}
  .side .vtrade-phone-profile i{display:block!important;color:#22e58a!important;font-size:10px!important;font-style:normal!important;margin-top:3px!important}

  /* Main content is offset by the real sidebar because it is grid column 2. */
  .wrap{width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:12px 10px 92px!important;overflow:hidden!important}
  .toolbar,.grid,.cards,.radar,.gategrid,.mainrow,.news-top,.news-grid{min-width:0!important;max-width:100%!important}
  .card,.chart,#vtradePreMarket{min-width:0!important;max-width:100%!important;overflow:hidden!important}
  #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}
  #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}

  /* Bottom bar is a real phone navigation, independent of the sidebar. */
  #vtradeMobileBar{position:fixed!important;left:8px!important;right:8px!important;bottom:8px!important;z-index:5000!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border:1px solid #303441!important;border-radius:22px!important;background:rgba(8,10,16,.97)!important;backdrop-filter:blur(14px)!important;box-shadow:0 10px 35px rgba(0,0,0,.45)!important}
  #vtradeMobileBar a,#vtradeMobileBar button{display:flex!important;align-items:center!important;justify-content:center!important;height:54px!important;min-width:0!important;margin:0!important;padding:4px!important;border:0!important;border-radius:15px!important;background:transparent!important;color:#d7deeb!important;text-decoration:none!important;font-size:9px!important;line-height:1.1!important;overflow:hidden!important}
  #vtradeMobileBar a.active,#vtradeMobileBar button.active{background:#5827d2!important;color:#fff!important}
  #vtradeMobileBar a *{pointer-events:none!important}

  /* Never let the old mobile drawer/scrim cover the interface. */
  #scrim,.scrim{display:none!important;opacity:0!important;pointer-events:none!important}
  body.vtrade-phone-menu-open{overflow:hidden!important}
}
@media (min-width:901px){#vtradeMobileBar,.vtrade-phone-profile{display:none!important}}
`;
  document.head.appendChild(style);

  const original = document.getElementById('profileAdminLink');
  const side = document.getElementById('side');

  if (side && !side.querySelector('.vtrade-phone-profile')) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vtrade-phone-profile';
    card.innerHTML = '<span class="avatar">VV</span><span><b>VET VEN</b><small>Administrator</small><i>● Online</i></span>';
    card.onclick = () => original?.click();
    side.appendChild(card);
  }
  if (original) original.style.setProperty('display','none','important');

  /* If another script recreates the old header account, remove it again. */
  const clean = () => {
    document.querySelectorAll('.top *').forEach(el => {
      const id = String(el.id || '').toLowerCase();
      const cls = String(el.className || '').toLowerCase();
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (/profile|account/.test(id + ' ' + cls) || (text.length < 100 && /vet ven/i.test(text) && /administrator/i.test(text))) {
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('pointer-events','none','important');
      }
    });
  };
  clean();
  new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
})();
