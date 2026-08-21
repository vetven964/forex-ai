/* V-TRADE AI — Backend Truth Status Sync V1
 * The terminal's green/error badge follows a successful authoritative
 * MT5 pre-market response, not a separate health probe that may be blocked.
 */
(()=>{
'use strict';
if(window.__VTRADE_BACKEND_STATUS_SYNC__)return;
window.__VTRADE_BACKEND_STATUS_SYNC__=true;
const $=s=>document.querySelector(s);
const conn=()=>window.VTRADE_CONNECTION;
const set=(ok,msg='')=>{
  const el=$('.backend'); if(!el)return;
  el.textContent=ok?'BACKEND LIVE':'BACKEND ERROR';
  el.style.color=ok?'#22e58a':'#ff5968';
  el.style.background=ok?'#062d20':'#2b0c13';
  el.style.borderColor=ok?'#147850':'#7c2532';
  el.title=msg|| (ok?'Authoritative MT5 pre-market route reachable':'Authoritative backend route unavailable');
};
async function check(){
  const c=conn();
  if(!c?.fetch||!c?.api){set(false,'Connection layer unavailable');return;}
  try{
    const r=await c.fetch(c.api('/api/pre-market/mt5-authoritative'),{credentials:'omit',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d?.success===false)throw Error(d?.error||`HTTP ${r.status}`);
    const root=d?.analysis||d?.data||d?.result||d||{};
    const available=Number(root?.available??d?.available??0);
    const complete=root?.complete===true||d?.complete===true;
    const mapped=Object.keys(root?.timeframes||d?.timeframes||{}).filter(k=>['M5','M15','H1','H4','D1'].includes(k)).length;
    const ready=complete||available>=4||mapped>=4;
    set(ready,`MT5 authoritative route OK · ${mapped||available}/5 mapped`);
  }catch(e){set(false,String(e?.message||e));}
}
function boot(){check();setInterval(check,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
