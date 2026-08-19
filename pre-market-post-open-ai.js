(() => {
  if (window.__VTRADE_POST_OPEN_AI__) return;
  window.__VTRADE_POST_OPEN_AI__=true;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  function css(){if(document.getElementById('vtradePostOpenCss'))return;const s=document.createElement('style');s.id='vtradePostOpenCss';s.textContent='#vtradePostOpen{margin-top:10px}.vpo-box{background:#080f1b;border:1px solid #5d3fc4;border-radius:12px;padding:12px}.vpo-title{font-weight:900;font-size:15px}.vpo-sub{color:#8493ab;font-size:10px;margin-top:4px}.vpo-row{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:11px}.vpo-wait{color:#f2c94c}.vpo-good{color:#22e58a}.vpo-bad{color:#ff5968}';document.head.appendChild(s)}
  async function api(path){const c=window.VTRADE_CONNECTION;if(!c?.fetch)throw new Error('Backend connection layer unavailable');const r=await c.fetch(c.api(path),{credentials:'include',cache:'no-store'});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j}
  async function getIntel(){return api('/api/pre-market/intelligence?tf=M15')}
  async function render(msg){let h=document.getElementById('vtradePostOpen');if(!h){h=document.createElement('section');h.id='vtradePostOpen';const pm=document.getElementById('vtradeIntelV2')||document.getElementById('vtradePreMarket');if(pm?.parentNode)pm.parentNode.insertBefore(h,pm.nextSibling);else return}h.innerHTML=`<div class="vpo-box"><div class="vpo-title">Post-Open AI Confirmation</div><div class="vpo-sub">Re-check only after the new candle opens. Forecast is never treated as an entry authorization.</div><div class="vpo-row"><span>Status</span><b class="vpo-wait">${esc(msg||'WAIT')}</b></div></div>`}
  let lastCandle=null,lastRun=0;
  async function run(){
    try {
      const d=await getIntel();
      const key=String(d?.timeframes?.M15?.candle?.candleTime||'');
      if(!key)return;
      if(lastCandle===null){lastCandle=key;await render('WAIT — pre-candle baseline loaded');return;}
      if(key===lastCandle)return;
      lastCandle=key;
      if(Date.now()-lastRun<60000)return;
      lastRun=Date.now();
      await render('CANDLE OPEN DETECTED — running AI confirmation…');
      try {
        const ai=await api('/api/pre-market/ai?tf=M15');
        const conf=n(ai?.ai?.confidence??ai?.confidence);
        const dec=String(ai?.ai?.decision??ai?.decision??'WAIT').toUpperCase();
        const ag=String(ai?.ai?.agreement??ai?.agreement??'NEUTRAL').toUpperCase();
        const cls=dec==='BUY'||dec==='BULLISH'?'vpo-good':dec==='SELL'||dec==='BEARISH'?'vpo-bad':'vpo-wait';
        const h=document.getElementById('vtradePostOpen');
        if(h)h.innerHTML=`<div class="vpo-box"><div class="vpo-title">Post-Open AI Confirmation</div><div class="vpo-sub">New candle detected · AI re-checked after candle open.</div><div class="vpo-row"><span>Decision</span><b class="${cls}">${esc(dec)}</b></div><div class="vpo-row"><span>Confidence</span><b>${conf==null?'—':Math.round(conf)}/100</b></div><div class="vpo-row"><span>Agreement</span><b>${esc(ag)}</b></div><div class="vpo-row"><span>Execution</span><b class="vpo-wait">WAIT — ICT/risk gates still required</b></div></div>`;
      } catch(e) { await render(`AI confirmation unavailable: ${String(e?.message||e)}`); }
    } catch(e) { await render(`Post-open monitor unavailable: ${String(e?.message||e)}`); }
  }
  function boot(){css();run();setInterval(run,5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
