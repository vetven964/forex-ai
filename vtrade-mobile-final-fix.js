/* V TRADE AI — PHONE FINAL SHELL FIX V9 */
(()=>{
'use strict';
if(!matchMedia('(max-width:900px)').matches||window.__VTRADE_PHONE_FINAL_V9__)return;
window.__VTRADE_PHONE_FINAL_V9__=true;
const s=document.createElement('style');
s.id='vtrade-phone-final-v9-style';
s.textContent=`
@media(max-width:900px){
 html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important;background:#04070d!important}
 .app{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important}
 .main{display:block!important;position:relative!important;left:0!important;right:auto!important;top:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:0!important;transform:none!important;overflow:visible!important}
 .top{position:relative!important;left:0!important;right:auto!important;width:100%!important;max-width:100%!important;margin:0!important;transform:none!important;overflow:hidden!important}
 .wrap{position:relative!important;left:0!important;right:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;padding:12px 10px 122px!important;transform:none!important;overflow:visible!important}
 .wrap>*{position:relative!important;left:0!important;right:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;transform:none!important}
 #vtradePreMarket{position:relative!important;left:0!important;right:auto!important;width:100%!important;max-width:100%!important;margin:4px 0 0!important;transform:none!important}
 #vtradePreMarket .v91{width:100%!important;max-width:100%!important}
 /* Phone sidebar is a drawer only; it never reserves layout space. */
 .side{display:flex!important;position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(290px,82vw)!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;padding:18px 10px 100px!important;z-index:6000!important;background:#11141b!important;border-right:1px solid #2a3140!important;transform:translateX(-110%)!important;transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important}
 .side.open,.side.vtrade-open{transform:translateX(0)!important}
 #scrim,.scrim{display:block!important;position:fixed!important;inset:0!important;z-index:5990!important;background:rgba(0,0,0,.58)!important;opacity:0!important;pointer-events:none!important}
 #scrim.show,.scrim.show{opacity:1!important;pointer-events:auto!important}
 .top>.mobile{position:relative!important;z-index:7000!important;display:grid!important;place-items:center!important}
 .top>.pair,.top>.price,.top>.backend,.top>.tfs{position:relative!important;z-index:20!important}
 #vtradeMobileBar{position:fixed!important;left:10px!important;right:10px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;z-index:5000!important}
 /* Never show the desktop/admin profile card inside the terminal header. */
 .top #profileAdminLink,.top [id*=profile],.top [class*=profile],.top [class*=account]{display:none!important;visibility:hidden!important;pointer-events:none!important}
}
`;
document.head.appendChild(s);
const side=document.getElementById('side');
const menu=document.querySelector('.top>.mobile');
const scrim=document.getElementById('scrim');
const close=()=>{side?.classList.remove('open','vtrade-open');scrim?.classList.remove('show');};
const open=()=>{side?.classList.add('open');scrim?.classList.add('show');};
if(menu){menu.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();side?.classList.contains('open')?close():open();},true)}
scrim?.addEventListener('click',close,true);
side?.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>setTimeout(close,50),true));
})();
