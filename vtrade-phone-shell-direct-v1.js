/* V TRADE AI — DIRECT PHONE SHELL V5
   PHONE ONLY: compact, polished single-row market header.
   Desktop, trading logic, MT5 and data flow untouched.
*/
(()=>{
'use strict';
if(!matchMedia('(max-width:900px)').matches||window.__VTRADE_DIRECT_PHONE_SHELL_V5__)return;
window.__VTRADE_DIRECT_PHONE_SHELL_V5__=true;

const css=document.createElement('style');
css.id='vtrade-direct-phone-shell-v5';
css.textContent=`
@media(max-width:900px){
  html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;margin:0!important;background:#04070d!important}
  .app,.main{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important}

  /* PHONE HEADER — one authoritative horizontal row */
  .top{
    display:flex!important;
    flex-flow:row nowrap!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:66px!important;
    min-height:66px!important;
    padding:7px 8px!important;
    gap:6px!important;
    overflow:hidden!important;
  }
  .top>.mobile{
    display:grid!important;
    flex:0 0 42px!important;
    place-items:center!important;
    width:42px!important;
    height:42px!important;
    margin:0!important;
    border-radius:12px!important;
    box-sizing:border-box!important;
  }
  .top>.pair{
    flex:0 1 106px!important;
    min-width:78px!important;
    max-width:106px!important;
    overflow:hidden!important;
    display:flex!important;
    align-items:center!important;
    gap:5px!important;
    white-space:nowrap!important;
  }
  .top>.pair>*{
    min-width:0!important;
    max-width:100%!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
  }
  .top>.pair small,.top>.pair .subtitle,.top>.pair .sub,.top>.pair [class*="subtitle"]{
    display:none!important;
  }
  .top>.pair .star{flex:0 0 auto!important;font-size:20px!important}
  .top>.pair b,.top>.pair strong{font-size:16px!important;line-height:1!important}

  .top>.price{
    flex:0 0 auto!important;
    width:auto!important;
    max-width:100px!important;
    margin:0!important;
    padding:0!important;
    font-size:23px!important;
    line-height:1!important;
    font-weight:900!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .top>.live{
    flex:0 0 auto!important;
    max-width:46px!important;
    margin:0!important;
    font-size:8px!important;
    line-height:1!important;
    font-weight:900!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .top>.backend{
    flex:0 0 auto!important;
    width:auto!important;
    max-width:88px!important;
    min-width:0!important;
    margin:0!important;
    padding:6px 7px!important;
    box-sizing:border-box!important;
    border-radius:999px!important;
    font-size:8px!important;
    line-height:1!important;
    font-weight:900!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .top>.tfs,.top>.lang-row{display:none!important}

  /* Everything below the header stays fluid. */
  .side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(290px,82vw)!important;height:100dvh!important;max-height:100dvh!important;z-index:6000!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important}
  .side.open,.side.vtrade-open{transform:translateX(0)!important}
  .scrim{position:fixed!important;inset:0!important;z-index:5990!important;display:block!important;opacity:0!important;pointer-events:none!important;background:rgba(0,0,0,.58)!important}
  .scrim.show{opacity:1!important;pointer-events:auto!important}
  .wrap{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:10px 8px 125px!important;overflow:visible!important}
  .wrap>*{width:100%!important;min-width:0!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;transform:none!important}
  #vtradePreMarket{width:100%!important;min-width:0!important;max-width:100%!important;margin:4px 0 12px!important;overflow:hidden!important}
  #vtradePreMarket .v91{width:100%!important;max-width:100%!important;box-sizing:border-box!important}
  #vtradePreMarket .v91a{width:100%!important;max-width:100%!important;display:flex!important;overflow-x:auto!important;scrollbar-width:none!important}
  #vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}
  #vtradePreMarket .v91b{flex:0 0 auto!important}
  #vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;z-index:5000!important}
}
@media(max-width:390px){
  .top{height:64px!important;min-height:64px!important;padding:7px 7px!important;gap:5px!important}
  .top>.mobile{flex-basis:40px!important;width:40px!important;height:40px!important}
  .top>.pair{flex-basis:94px!important;min-width:70px!important;max-width:94px!important;gap:4px!important}
  .top>.pair .star{font-size:18px!important}
  .top>.pair b,.top>.pair strong{font-size:15px!important}
  .top>.price{font-size:21px!important;max-width:94px!important}
  .top>.live{max-width:43px!important;font-size:8px!important}
  .top>.backend{max-width:84px!important;padding:6px 6px!important;font-size:7px!important}
}
@media(max-width:360px){
  .top{gap:4px!important;padding-left:6px!important;padding-right:6px!important}
  .top>.mobile{flex-basis:38px!important;width:38px!important;height:38px!important}
  .top>.pair{flex-basis:82px!important;min-width:62px!important;max-width:82px!important}
  .top>.pair b,.top>.pair strong{font-size:14px!important}
  .top>.price{font-size:19px!important;max-width:88px!important}
  .top>.live{max-width:39px!important;font-size:7px!important}
  .top>.backend{max-width:78px!important;padding:5px 5px!important;font-size:7px!important}
}
`;
document.head.appendChild(css);

/* PHONE ONLY: one authoritative backend badge; remove duplicate fixed live pills. */
const removeDuplicateBackendPill=()=>{
  if(!matchMedia('(max-width:900px)').matches)return;
  document.querySelectorAll('body *').forEach(el=>{
    if(el.id==='vtradeMobileBar'||el.classList?.contains('backend')||el.closest?.('.top'))return;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(!text||text.length>80||!text.includes('v trade')||!text.includes('backend')||!text.includes('live'))return;
    const cs=getComputedStyle(el);
    if(cs.position==='fixed'||cs.position==='sticky'){
      el.style.setProperty('display','none','important');
      el.setAttribute('data-vtrade-duplicate-backend','1');
    }
  });
};

/* PHONE ONLY: hide a stray standalone BEARISH/ BULLISH label if it is floating
   outside the actual signal/analysis cards. The real signal value is untouched. */
const removeStrayBiasLabel=()=>{
  if(!matchMedia('(max-width:900px)').matches)return;
  document.querySelectorAll('body *').forEach(el=>{
    if(el.closest?.('.top,.card,.signal,.setup,.tf,.pill,.section,.section-title'))return;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
    if(!/^[•·\-]?\s*(BEARISH|BULLISH)$/.test(text))return;
    const cs=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    if((cs.position==='fixed'||cs.position==='sticky'||cs.position==='absolute')&&(r.right>innerWidth*.65||r.bottom>innerHeight*.65)){
      el.style.setProperty('display','none','important');
      el.setAttribute('data-vtrade-stray-bias','1');
    }
  });
};
removeDuplicateBackendPill();
removeStrayBiasLabel();
new MutationObserver(()=>{removeDuplicateBackendPill();removeStrayBiasLabel()}).observe(document.body,{childList:true,subtree:true});

const side=document.getElementById('side'),menu=document.querySelector('.top>.mobile'),scrim=document.getElementById('scrim');
const close=()=>{side?.classList.remove('open','vtrade-open');scrim?.classList.remove('show')};
const open=()=>{side?.classList.add('open');scrim?.classList.add('show')};
menu?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();side?.classList.contains('open')?close():open()},true);
scrim?.addEventListener('click',close,true);
side?.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>setTimeout(close,80),true));
})();
