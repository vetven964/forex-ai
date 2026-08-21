/* V-TRADE AI — Backend Truth Status Sync V2
 * Backend LIVE means the authoritative MT5 endpoint is reachable.
 * Data completeness is handled by Pre-Market itself; the header badge must
 * never report ERROR merely because optional shape fields are missing.
 */
(()=>{
'use strict';
if(window.__VTRADE_BACKEND_STATUS_SYNC_V2__)return;
window.__VTRADE_BACKEND_STATUS_SYNC_V2__=true;
const $=s=>document.querySelector(s);
const conn=()=>window.VTRADE_CONNECTION;
const set=(ok,msg='')=>{
  const el=$('.backend'); if(!el)return;
  el.textContent=ok?'BACKEND LIVE':'BACKEND ERROR';
  el.style.color=ok?'#22e58a':'#ff5968';
  el.style.background=ok?'#062d20':'#2b0c13';
  el.style.borderColor=ok?'#147850':'#7c2532';
  el.title=msg|| (ok?'Authoritative MT5 route reachable':'Authoritative backend route unavailable');
};
async function check(){
  const c=conn();
  if(!c?.fetch||!c?.api){set(false,'Connection layer unavailable');return;}
  try{
    const r=await c.fetch(c.api('/api/pre-market/mt5-authoritative'),{credentials:'omit',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d?.error||`HTTP ${r.status}`);
    if(d?.success===false)throw Error(d?.error||'Backend returned success=false');
    set(true,`MT5 authoritative route OK · HTTP ${r.status}`);
  }catch(e){
    set(false,String(e?.message||e));
  }
}
function boot(){check();setInterval(check,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
