/* V TRADE AI — DIRECT PHONE SHELL V2
   PHONE ONLY: compact single-row header.
   Desktop untouched. Trading/data logic untouched.
*/
(()=>{
'use strict';
if(!matchMedia('(max-width:900px)').matches||window.__VTRADE_DIRECT_PHONE_SHELL_V2__)return;
window.__VTRADE_DIRECT_PHONE_SHELL_V2__=true;
const css=document.createElement('style');css.id='vtrade-direct-phone-shell-v2';css.textContent=`
@media(max-width:900px){
html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;margin:0!important;background:#04070d!important}
.app,.main{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important}

/* HEADER: exactly one compact row on phone */
.top{
 display:grid!important;
 position:relative!important;
 width:100%!important;
 min-width:0!important;
 max-width:100%!important;
 height:82px!important;
 min-height:82px!important;
 padding:12px 10px!important;
 box-sizing:border-box!important;
 grid-template-columns:44px minmax(72px,1fr) auto auto!important;
 grid-template-rows:58px!important;
 grid-template-areas:"menu pair price status"!important;
 align-items:center!important;
 gap:7px!important;
 overflow:hidden!important;
}
.top>.mobile{
 grid-area:menu!important;
 display:grid!important;
 place-items:center!important;
 width:44px!important;
 height:44px!important;
 margin:0!important;
}
.top>.pair{
 grid-area:pair!important;
 min-width:0!important;
 max-width:100%!important;
 overflow:hidden!important;
 align-self:center!important;
 white-space:nowrap!important;
}
.top>.pair>*{max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
/* Keep XAUUSD title; hide the secondary subtitle to preserve one row */
.top>.pair small,.top>.pair .subtitle,.top>.pair .sub,.top>.pair [class*="subtitle"]{display:none!important}
.top>.price{
 grid-area:price!important;
 justify-self:end!important;
 align-self:center!important;
 margin:0!important;
 padding:0!important;
 font-size:25px!important;
 line-height:1!important;
 max-width:112px!important;
 white-space:nowrap!important;
 overflow:hidden!important;
 text-overflow:ellipsis!important;
}
.top>.backend{
 grid-area:status!important;
 justify-self:end!important;
 align-self:center!important;
 margin:0!important;
 padding:7px 9px!important;
 max-width:104px!important;
 min-width:0!important;
 box-sizing:border-box!important;
 white-space:nowrap!important;
 overflow:hidden!important;
 text-overflow:ellipsis!important;
 font-size:10px!important;
 line-height:1.1!important;
 border-radius:999px!important;
}
.top>.tfs{display:none!important}
.top>.lang-row{display:none!important}

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
.top{grid-template-columns:42px minmax(62px,1fr) auto auto!important;gap:5px!important;padding-left:8px!important;padding-right:8px!important}
.top>.mobile{width:42px!important;height:42px!important}
.top>.price{font-size:22px!important;max-width:96px!important}
.top>.backend{max-width:88px!important;padding:6px 7px!important;font-size:9px!important}
}
`;
document.head.appendChild(css);

/* PHONE ONLY: keep one authoritative header backend badge; remove duplicate fixed live pills. */
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
removeDuplicateBackendPill();
new MutationObserver(removeDuplicateBackendPill).observe(document.body,{childList:true,subtree:true});

const side=document.getElementById('side'),menu=document.querySelector('.top>.mobile'),scrim=document.getElementById('scrim');
const close=()=>{side?.classList.remove('open','vtrade-open');scrim?.classList.remove('show')};
const open=()=>{side?.classList.add('open');scrim?.classList.add('show')};
menu?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();side?.classList.contains('open')?close():open()},true);
scrim?.addEventListener('click',close,true);
side?.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>setTimeout(close,80),true));
})();
