/* V TRADE AI — PHONE TERMINAL SHELL V3
   Phone only. Desktop/PC is intentionally untouched. */
(() => {
  'use strict';
  const mobile = () => window.matchMedia('(max-width:900px)').matches;

  function install() {
    if (!mobile()) return;
    document.documentElement.classList.add('vtrade-phone-v3');
    document.body.classList.add('vtrade-phone-v3');

    const style = document.createElement('style');
    style.id = 'vtrade-phone-v3-style';
    style.textContent = `
      @media(max-width:900px){
        html.vtrade-phone-v3,body.vtrade-phone-v3{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
        body.vtrade-phone-v3 .app{display:block!important;width:100%!important;min-width:0!important}
        body.vtrade-phone-v3 .main{width:100%!important;min-width:0!important;overflow:hidden!important}

        /* Header: compact terminal row, then timeframe rail. */
        body.vtrade-phone-v3 .top{
          position:relative!important;display:grid!important;width:100%!important;min-height:145px!important;height:auto!important;
          padding:10px 14px 9px!important;grid-template-columns:42px minmax(0,1fr) auto!important;
          grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;
          gap:3px 7px!important;align-items:center!important;overflow:hidden!important;z-index:70!important;
        }
        body.vtrade-phone-v3 .top>.mobile{grid-area:menu!important;width:42px!important;height:42px!important;margin:0!important;align-self:start!important}
        body.vtrade-phone-v3 .top>.pair{grid-area:pair!important;min-width:0!important;align-self:start!important;padding-top:3px!important;overflow:hidden!important}
        body.vtrade-phone-v3 .top>.pair b{font-size:15px!important;white-space:nowrap!important}
        body.vtrade-phone-v3 .top>.pair .sub{font-size:10px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:145px!important}
        body.vtrade-phone-v3 .top>.price{grid-area:price!important;font-size:25px!important;line-height:1!important;justify-self:end!important;align-self:start!important;white-space:nowrap!important}
        body.vtrade-phone-v3 .top>.live{grid-area:status!important;justify-self:end!important;font-size:9px!important}
        body.vtrade-phone-v3 .top>.backend{grid-area:status!important;justify-self:end!important;font-size:8px!important;padding:5px 8px!important;max-width:120px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        body.vtrade-phone-v3 .top>.tfs{grid-area:tfs!important;width:100%!important;margin:5px 0 0!important;display:flex!important;gap:7px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
        body.vtrade-phone-v3 .top>.tfs::-webkit-scrollbar{display:none}
        body.vtrade-phone-v3 .top>.tfs button{flex:0 0 64px!important;min-width:64px!important;height:43px!important;padding:8px!important}

        /* Sidebar is the only place for the account card on phone. */
        body.vtrade-phone-v3 .side{position:fixed!important;inset:0 auto 0 0!important;width:min(286px,84vw)!important;height:100dvh!important;
          z-index:2000!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;
          display:flex!important;flex-direction:column!important;overflow-y:auto!important;padding:18px 12px calc(20px + env(safe-area-inset-bottom))!important}
        body.vtrade-phone-v3 .side.open{transform:translateX(0)!important}
        body.vtrade-phone-v3 #profileAdminLink{display:none!important}
        body.vtrade-phone-v3 .vtrade-phone-profile{display:flex!important;align-items:center!important;gap:10px!important;margin-top:auto!important;padding:12px!important;
          min-height:70px!important;border:1px solid #263650!important;border-radius:14px!important;background:#09111e!important;color:#fff!important}
        body.vtrade-phone-v3 .vtrade-phone-profile .avatar{width:42px!important;height:42px!important;border-radius:50%!important;display:grid!important;place-items:center!important;
          flex:0 0 42px!important;background:linear-gradient(135deg,#5120ff,#aa72ff)!important;font-weight:900!important;font-size:16px!important}
        body.vtrade-phone-v3 .vtrade-phone-profile b{font-size:14px!important}.vtrade-phone-profile small{display:block!important;color:#8493ab!important;margin-top:3px!important;font-size:11px!important}
        body.vtrade-phone-v3 .scrim{z-index:1900!important}

        /* Content spacing / no clipping. */
        body.vtrade-phone-v3 .wrap{width:100%!important;max-width:none!important;margin:0!important;padding:12px 9px 104px!important;overflow:hidden!important}
        body.vtrade-phone-v3 #vtradePreMarket{width:100%!important;max-width:100%!important;overflow:hidden!important}
        body.vtrade-phone-v3 #vtradePreMarket .v91a{display:flex!important;flex-wrap:nowrap!important;width:100%!important;overflow-x:auto!important;scrollbar-width:none!important}
        body.vtrade-phone-v3 #vtradePreMarket .v91a::-webkit-scrollbar{display:none}
        body.vtrade-phone-v3 #vtradePreMarket .v91b{flex:0 0 auto!important}
        body.vtrade-phone-v3 .chart{width:100%!important;max-width:100%!important;overflow:hidden!important}
        body.vtrade-phone-v3 .card{min-width:0!important;max-width:100%!important;overflow:hidden!important}

        /* Fixed 5-tab phone navigation. */
        body.vtrade-phone-v3 #vtradeMobileBar{left:8px!important;right:8px!important;bottom:8px!important;z-index:2100!important;
          grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:6px!important;border-radius:22px!important}
        body.vtrade-phone-v3 #vtradeMobileBar a{height:54px!important;border-radius:15px!important;font-size:9px!important}
      }
      @media(max-width:520px){
        body.vtrade-phone-v3 .top{min-height:142px!important;padding-left:10px!important;padding-right:10px!important}
        body.vtrade-phone-v3 .top>.price{font-size:23px!important}
        body.vtrade-phone-v3 .wrap{padding-left:7px!important;padding-right:7px!important}
      }
      @media(min-width:901px){#vtradeMobileBar,.vtrade-phone-profile{display:none!important}}
    `;
    document.head.appendChild(style);

    const original = document.getElementById('profileAdminLink');
    const side = document.getElementById('side');
    if (side && !side.querySelector('.vtrade-phone-profile')) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vtrade-phone-profile';
      card.innerHTML = '<span class="avatar">VV</span><span><b>VET VEN</b><small>Administrator</small></span>';
      card.addEventListener('click', () => {
        if (original) original.click();
        else location.href = 'profile.html';
      });
      side.appendChild(card);
    }

    // Prevent the old account control from floating over the phone content.
    if (original) original.setAttribute('aria-hidden','true');

    // Re-apply after RBAC/auth scripts finish modifying the DOM.
    setTimeout(() => {
      document.documentElement.classList.add('vtrade-phone-v3');
      document.body.classList.add('vtrade-phone-v3');
      if (original) original.style.setProperty('display','none','important');
    }, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
