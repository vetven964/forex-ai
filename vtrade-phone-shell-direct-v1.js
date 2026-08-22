/* V TRADE AI — DIRECT PHONE SHELL V1
   Applied directly by premium-dashboard-live.html.
   Desktop untouched. Phone gets one full-width column and no desktop-width reservation.
*/
(()=>{
'use strict';
if(!matchMedia('(max-width:900px)').matches||window.__VTRADE_DIRECT_PHONE_SHELL_V1__)return;
window.__VTRADE_DIRECT_PHONE_SHELL_V1__=true;
const css=document.createElement('style');css.id='vtrade-direct-phone-shell-v1';css.textContent=`
@media(max-width:900px){
html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;margin:0!important;background:#04070d!important}
.app{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important}
.main{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important;overflow:visible!important}
.top{display:grid!important;position:relative!important;width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important;min-height:178px!important;padding:14px 12px 10px!important;grid-template-columns:50px minmax(0,1fr) auto!important;grid-template-rows:58px 42px 52px!important;grid-template-areas:"menu pair price" "menu pair status" "tfs tfs tfs"!important;gap:5px 8px!important;overflow:hidden!important}
.top>.mobile{grid-area:menu!important;display:grid!important;place-items:center!important;width:50px!important;height:50px!important;margin:0!important}
.top>.pair{grid-area:pair!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;align-self:center!important}
.top>.price{grid-area:price!important;justify-self:end!important;align-self:center!important;margin:0!important;font-size:28px!important;line-height:1!important;max-width:150px!important;white-space:nowrap!important;overflow:hidden!important}
.top>.backend{grid-area:status!important;justify-self:end!important;align-self:start!important;margin:0!important;max-width:135px!important;white-space:nowrap!important;overflow:hidden!important}
.top>.tfs{grid-area:tfs!important;width:100%!important;min-width:0!important;display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;margin:0!important}
.top>.tfs::-webkit-scrollbar{display:none!important}
.top>.tfs button{flex:0 0 70px!important;min-width:70px!important;height:48px!important}
.top>.lang-row{display:none!important}
.side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(290px,82vw)!important;height:100dvh!important;max-height:100dvh!important;z-index:6000!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important}
.side.open,.side.vtrade-open{transform:translateX(0)!important}
.scrim{position:fixed!important;inset:0!important;z-index:5990!important;display:block!important;opacity:0!important;pointer-events:none!important;background:rgba(0,0,0,.58)!important}
.scrim.show{opacity:1!important;pointer-events:auto!important}
.wrap{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:12px 10px 125px!important;overflow:visible!important}
.wrap>*{width:100%!important;min-width:0!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;transform:none!important}
#vtradePreMarket{width:100%!important;min-width:0!important;max-width:100%!important;margin:4px 0 12px!important;overflow:hidden!important}
#vtradePreMarket .v91{width:100%!important;max-width:100%!important;box-sizing:border-box!important}
#vtradePreMarket .v91a{width:100%!important;max-width:100%!important;display:flex!important;overflow-x:auto!important;scrollbar-width:none!important}
#vtradePreMarket .v91a::-webkit-scrollbar{display:none!important}
#vtradePreMarket .v91b{flex:0 0 auto!important}
#vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;z-index:5000!important}
}
@media(max-width:520px){.top>.price{font-size:25px!important;max-width:140px!important}.wrap{padding-left:8px!important;padding-right:8px!important}}
`;
document.head.appendChild(css);
const side=document.getElementById('side'),menu=document.querySelector('.top>.mobile'),scrim=document.getElementById('scrim');
const close=()=>{side?.classList.remove('open','vtrade-open');scrim?.classList.remove('show')};
const open=()=>{side?.classList.add('open');scrim?.classList.add('show')};
menu?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();side?.classList.contains('open')?close():open()},true);
scrim?.addEventListener('click',close,true);
side?.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>setTimeout(close,80),true));
})();
