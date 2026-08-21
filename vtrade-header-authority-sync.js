/* V-TRADE AI — Header Truth Sync V1
 * Keeps the global XAUUSD header bias/price aligned with the same MT5-authoritative route
 * used by Pre-Market. UI never creates an entry signal.
 */
(()=>{
'use strict';
if(window.__VTRADE_HEADER_AUTH_SYNC__)return;window.__VTRADE_HEADER_AUTH_SYNC__=true;
const API=()=>window.VTRADE_CONNECTION?.api?.('/api/pre-market/mt5-authoritative');
const fetcher=()=>window.VTRADE_CONNECTION?.fetch;
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>num(v)==null?null:Math.max(0,Math.min(100,Math.round(Number(v))));
const bias=v=>{const s=String(v??'').toUpperCase();return /BULL|BUY/.test(s)?'BULLISH':/BEAR|SELL/.test(s)?'BEARISH':'NEUTRAL'};
function root(d){return d?.analysis||d?.data||d?.result||d||{}}
function get(){const f=fetcher(),u=API();if(!f||!u)return Promise.reject(Error('connection unavailable'));return f(u,{credentials:'omit',cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||d?.success===false)throw Error(d?.error||`HTTP ${r.status}`);return d})}
function apply(d){const r=root(d),top=document.querySelector('.top');if(!top)return;const price=num(d?.price??d?.currentPrice??d?.livePrice??r?.price??r?.currentPrice??r?.livePrice??d?.quote?.price??d?.mt5?.price);let buy=pct(d?.buyStrengthPct??d?.buyScore??r?.buyStrengthPct??r?.buyScore),sell=pct(d?.sellStrengthPct??d?.sellScore??r?.sellStrengthPct??r?.sellScore);if(buy==null&&sell==null&&r?.timeframes){const a=['M5','M15','H1','H4','D1'].map(tf=>r.timeframes?.[tf]||d.timeframes?.[tf]).filter(Boolean);const b=a.map(x=>pct(x.buyPct??x.buyScore??x.buyStrengthPct)).filter(x=>x!=null),s=a.map(x=>pct(x.sellPct??x.sellScore??x.sellStrengthPct)).filter(x=>x!=null);if(b.length)buy=Math.round(b.reduce((x,y)=>x+y,0)/b.length);if(s.length)sell=Math.round(s.reduce((x,y)=>x+y,0)/s.length)}if(buy==null&&sell!=null)buy=100-sell;if(sell==null&&buy!=null)sell=100-buy;const side=bias(d?.bias??r?.bias??r?.direction??(buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL'));const pe=top.querySelector('.price'),le=top.querySelector('.live');if(pe&&price!=null)pe.textContent=price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});if(le){le.textContent=side==='BULLISH'?'• BULLISH':side==='BEARISH'?'• BEARISH':'• NEUTRAL';le.style.color=side==='BULLISH'?'#22e58a':side==='BEARISH'?'#ff5968':'#f2c94c';le.title=`MT5 authoritative · BUY ${buy??'—'}% · SELL ${sell??'—'}%`}}
async function sync(){try{apply(await get())}catch(e){console.warn('[V-TRADE HEADER AUTH SYNC]',e?.message||e)}}
function boot(){sync();setInterval(sync,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();