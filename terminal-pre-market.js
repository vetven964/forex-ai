/* V TRADE AI — Terminal-only Pre-Market Zone Engine
 * Separate from Telegram. UI analysis only; no alerts, orders or Telegram calls.
 */
(() => {
  if (window.__VTRADE_PREMARKET__) return;
  window.__VTRADE_PREMARKET__ = true;

  const TFS = ['M5','M15','H1','H4','D1'];
  const state = { tf: 'M15', data: null, busy: false };
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const num = n => Number.isFinite(Number(n)) ? Number(n) : null;
  const fmt = n => num(n) == null ? '—' : Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct = n => num(n) == null ? '—' : Math.max(0,Math.min(100,Math.round(Number(n))));

  function score(v) {
    if (typeof v === 'number') return Math.round(v);
    if (!v || typeof v !== 'object') return null;
    return num(v.score ?? v.value ?? v.confidence ?? v.strength);
  }
  function direction(v) {
    const s = String(v?.bias ?? v?.direction ?? v?.side ?? v ?? '').toUpperCase();
    return s.includes('BULL') || s === 'BUY' ? 'BULLISH' : s.includes('BEAR') || s === 'SELL' ? 'BEARISH' : 'NEUTRAL';
  }
  function first(...xs) { return xs.find(x => x !== undefined && x !== null && x !== ''); }

  function extract(raw) {
    const a = raw?.analysis || raw?.data || raw || {};
    const mtf = a.mtf || a.multiTimeframe || a.timeframes || {};
    const node = mtf[state.tf] || mtf[state.tf.toLowerCase()] || a[state.tf] || a[state.tf.toLowerCase()] || {};
    const price = num(first(a.price,a.livePrice,a.mt5?.price,a.quote?.price,a.mt5Quote?.price));
    const bias = direction(first(node.bias,node.direction,a.bias,a.direction));
    const buy = score(first(node.buyScore,node.buyProbability,node.buy?.score,node.longScore));
    const sell = score(first(node.sellScore,node.sellProbability,node.sell?.score,node.shortScore));
    const setup = score(first(node.setupScore,node.score,node.confidence));
    const liquidity = first(node.liquidity,a.liquidity) || {};
    const fvg = first(node.fvg,node.fairValueGap,a.fvg) || {};
    const ob = first(node.orderBlock,node.ob,a.orderBlock,a.ob) || {};
    const zones = first(node.zones,node.executionZones,a.zones,a.executionZones) || {};
    const buyZone = first(zones.buy,zones.buyZone,node.buyZone,a.buyZone);
    const sellZone = first(zones.sell,zones.sellZone,node.sellZone,a.sellZone);
    const sweep = first(node.liquiditySweep,node.sweep,a.liquiditySweep,a.sweep);
    const mss = first(node.mss,node.marketStructureShift,a.mss,a.marketStructureShift);
    const bos = first(node.bos,node.breakOfStructure,a.bos,a.breakOfStructure);
    return {price,bias,buy,sell,setup,liquidity,fvg,ob,buyZone,sellZone,sweep,mss,bos};
  }

  function zoneText(z) {
    if (!z) return 'Waiting for engine zone';
    if (Array.isArray(z) && z.length >= 2) return `${fmt(Math.min(...z))} — ${fmt(Math.max(...z))}`;
    if (typeof z === 'object') {
      const lo = first(z.low,z.min,z.from,z.bottom);
      const hi = first(z.high,z.max,z.to,z.top);
      if (num(lo)!=null && num(hi)!=null) return `${fmt(Math.min(lo,hi))} — ${fmt(Math.max(lo,hi))}`;
    }
    return 'Waiting for engine zone';
  }

  function pass(v) {
    const s = String(v?.status ?? v?.state ?? v ?? '').toUpperCase();
    return s === 'PASS' || s === 'TRUE' || s === 'CONFIRMED' || s === 'OK' || v === true;
  }

  function renderShell() {
    if (document.getElementById('vtradePreMarket')) return document.getElementById('vtradePreMarket');
    const style = document.createElement('style');
    style.id='vtradePreMarketCss';
    style.textContent=`
      #vtradePreMarket{margin-top:12px}.vpm-card{background:linear-gradient(145deg,#0b1423f5,#070c15f5);border:1px solid #1d2c44;border-radius:16px;padding:16px;box-shadow:0 20px 60px #0008}.vpm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.vpm-title{font-size:18px;font-weight:900}.vpm-sub{color:#8493ab;font-size:10px;margin-top:3px}.vpm-actions{display:flex;gap:7px;align-items:center}.vpm-btn{border:1px solid #1d2c44;background:#09111e;border-radius:10px;padding:9px 12px;min-height:40px;color:#cbd5e5;cursor:pointer;font-weight:800}.vpm-btn.active{background:#5827d2;border-color:#8050ff;color:#fff}.vpm-analyze{background:#5523c9;border-color:#8050ff}.vpm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vpm-box{border:1px solid #1d2c44;border-radius:12px;background:#080f1b;padding:13px}.vpm-label{font-size:9px;color:#8493ab;text-transform:uppercase;letter-spacing:.1em}.vpm-score{font-size:28px;font-weight:950;margin-top:6px}.vpm-row{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:11px}.vpm-bar{height:7px;background:#18253b;border-radius:99px;overflow:hidden;margin-top:7px}.vpm-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#6570ff,#35d8ff,#22e58a)}.vpm-zone{font-size:16px;font-weight:900;margin-top:7px}.vpm-buy{color:#22e58a}.vpm-sell{color:#ff5968}.vpm-neutral{color:#f2c94c}.vpm-gates{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:10px}.vpm-gate{border:1px solid #1d2c44;border-radius:10px;padding:9px;background:#080f1b;font-size:10px}.vpm-gate b{display:block;margin-top:5px}.vpm-pass{color:#22e58a}.vpm-wait{color:#f2c94c}.vpm-note{margin-top:10px;color:#8493ab;font-size:10px;line-height:1.5}.vpm-loading{color:#35d8ff}.vpm-error{color:#ff5968}@media(max-width:900px){.vpm-grid{grid-template-columns:1fr}.vpm-gates{grid-template-columns:repeat(2,1fr)}.vpm-head{align-items:flex-start;flex-direction:column}.vpm-actions{width:100%;overflow:auto}}`;
    document.head.appendChild(style);
    const host=document.createElement('section'); host.id='vtradePreMarket';
    host.innerHTML=`<div class="vpm-card"><div class="vpm-head"><div><div class="vpm-title">Pre-Market Zone Analysis</div><div class="vpm-sub">Terminal only · Setup score, zones & structure · Telegram independent</div></div><div class="vpm-actions"><button class="vpm-btn" data-pm-tf="M5">M5</button><button class="vpm-btn active" data-pm-tf="M15">M15</button><button class="vpm-btn" data-pm-tf="H1">H1</button><button class="vpm-btn" data-pm-tf="H4">H4</button><button class="vpm-btn" data-pm-tf="D1">D1</button><button class="vpm-btn vpm-analyze" id="vpmAnalyze">Analyze</button></div></div><div id="vpmBody"></div></div>`;
    const wrap=document.querySelector('.wrap') || document.querySelector('.main');
    if (wrap) wrap.prepend(host); else document.body.prepend(host);
    host.querySelectorAll('[data-pm-tf]').forEach(b=>b.addEventListener('click',()=>{state.tf=b.dataset.pmTf;host.querySelectorAll('[data-pm-tf]').forEach(x=>x.classList.toggle('active',x===b)); load(true);}));
    host.querySelector('#vpmAnalyze').addEventListener('click',()=>load(false));
    return host;
  }

  function render(data, message='') {
    const body=document.querySelector('#vpmBody'); if(!body)return;
    const d=data||{};
    const buy=d.buy ?? (d.bias==='BULLISH'?d.setup:null);
    const sell=d.sell ?? (d.bias==='BEARISH'?d.setup:null);
    const directionScore=d.setup ?? (d.bias==='BULLISH'?buy:d.bias==='BEARISH'?sell:null);
    const gates=[['Liquidity Sweep',pass(d.sweep)],['MSS',pass(d.mss)],['BOS',pass(d.bos)],['FVG',pass(d.fvg)],['Order Block',pass(d.ob)]];
    body.innerHTML=`<div class="vpm-grid"><div class="vpm-box"><div class="vpm-label">${esc(state.tf)} Buy Setup Score</div><div class="vpm-score vpm-buy">${pct(buy)}${buy==null?'':'/100'}</div><div class="vpm-bar"><i style="width:${pct(buy)==='—'?0:pct(buy)}%"></i></div><div class="vpm-row"><span>Buy Zone</span><b class="vpm-buy">${zoneText(d.buyZone)}</b></div><div class="vpm-row"><span>Bias</span><b class="vpm-buy">${esc(d.bias)}</b></div></div><div class="vpm-box"><div class="vpm-label">${esc(state.tf)} Sell Setup Score</div><div class="vpm-score vpm-sell">${pct(sell)}${sell==null?'':'/100'}</div><div class="vpm-bar"><i style="width:${pct(sell)==='—'?0:pct(sell)}%"></i></div><div class="vpm-row"><span>Sell Zone</span><b class="vpm-sell">${zoneText(d.sellZone)}</b></div><div class="vpm-row"><span>Current Price</span><b>${fmt(d.price)}</b></div></div></div><div class="vpm-box" style="margin-top:10px"><div class="vpm-row"><span>Selected timeframe</span><b>${esc(state.tf)}</b></div><div class="vpm-row"><span>Overall setup score</span><b class="${d.bias==='BULLISH'?'vpm-buy':d.bias==='BEARISH'?'vpm-sell':'vpm-neutral'}">${pct(directionScore)}/100</b></div><div class="vpm-row"><span>Execution</span><b class="vpm-wait">WAIT · Pre-market analysis only</b></div></div><div class="vpm-gates">${gates.map(([n,p])=>`<div class="vpm-gate">${esc(n)}<b class="${p?'vpm-pass':'vpm-wait'}">${p?'PASS':'WAIT'}</b></div>`).join('')}</div><div class="vpm-note">${message ? `<span class="${message.startsWith('Backend')?'vpm-error':'vpm-loading'}">${esc(message)}</span><br>`:''}Scores are setup scores, not guaranteed win probabilities. This module does not send Telegram alerts and does not authorize orders.</div>`;
  }

  async function load(force) {
    const host=renderShell(); if(!host)return;
    if(state.busy)return;
    state.busy=true; render(state.data,`Analyzing ${state.tf}…`);
    try{
      const api=window.VTRADE_CONNECTION;
      if(!api?.fetch) throw new Error('Backend connection layer unavailable');
      const r=await api.fetch(api.api('/api/analysis/xauusd'),{credentials:'include',cache:'no-store'});
      if(!r.ok) throw new Error(`Backend analysis HTTP ${r.status}`);
      state.data=extract(await r.json());
      render(state.data,'Live analysis loaded.');
    }catch(e){
      render(state.data,`Backend analysis unavailable: ${String(e?.message||e)}`);
    }finally{state.busy=false;}
  }

  function boot(){
    if(!/premium-dashboard-live\.html$/i.test(location.pathname))return;
    renderShell();
    setTimeout(()=>load(false),350);
    document.addEventListener('click',e=>{
      const b=e.target.closest('.tfs button');
      if(!b)return;
      const tf=String(b.textContent||'').trim().toUpperCase();
      if(TFS.includes(tf)){state.tf=tf;const pm=document.querySelector(`[data-pm-tf="${tf}"]`);if(pm){document.querySelectorAll('[data-pm-tf]').forEach(x=>x.classList.toggle('active',x===pm));}setTimeout(()=>load(true),50);}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();