/* V-TRADE AI — Pre-Market Analyze AI V10
 * Unified with terminal-pre-market.js V7 selectors.
 * Uses MT5-authoritative pre-market snapshot first, then optional AI confirmation.
 * Never fabricates market data and never authorizes an order.
 */
(() => {
  'use strict';
  if (window.__VTRADE_AI_BUTTON_HOTFIX_V10__) return;
  window.__VTRADE_AI_BUTTON_HOTFIX_V10__ = true;

  const esc = s => String(s ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const pct = v => num(v)==null ? null : Math.max(0,Math.min(100,Math.round(Number(v))));
  const fmt = v => num(v)==null ? '—' : Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const conn = () => window.VTRADE_CONNECTION;

  async function request(path){
    const c=conn();
    if(!c?.fetch||!c?.api) throw new Error('Backend connection layer unavailable');
    const r=await c.fetch(c.api(path),{credentials:'omit',cache:'no-store',mode:'cors'});
    let d={}; try{d=await r.json();}catch(_){}
    if(!r.ok||d?.success===false){const e=new Error(d?.error||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e;}
    return d;
  }

  function button(){return document.getElementById('v7Analyze');}
  function selectedTF(){
    const active=document.querySelector('#vtradePreMarket [data-v7-tf].active');
    return String(active?.dataset?.v7Tf||'M15').toUpperCase();
  }

  function box(){
    let el=document.getElementById('vtradeAiV10');
    const host=document.getElementById('vtradePreMarket');
    if(!host)return null;
    if(!el){
      el=document.createElement('div');el.id='vtradeAiV10';
      el.style.cssText='margin-top:10px;padding:13px;border:1px solid #263650;border-radius:12px;background:#080f1b;color:#cbd5e5;font-size:10px;line-height:1.55;';
      host.querySelector('.v7-card')?.appendChild(el);
    }
    return el;
  }

  function localDecision(s,tf){
    const rows=s?.timeframes||s?.frames||{};
    const keys=['M5','M15','H1','H4'];
    const scored=keys.map(k=>rows[k]).filter(x=>x&&num(x.buyPct)!=null&&num(x.sellPct)!=null);
    const buy=scored.length?Math.round(scored.reduce((a,x)=>a+Number(x.buyPct),0)/scored.length):pct(s?.buyStrengthPct);
    const sell=scored.length?Math.round(scored.reduce((a,x)=>a+Number(x.sellPct),0)/scored.length):pct(s?.sellStrengthPct);
    const bias=buy==null||sell==null?'NEUTRAL':buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const r=rows[tf]||{};const c=r.candle||{};const g=r.gates||s?.gates||{};
    const passes=['liquiditySweep','mss','bos','displacement','fvg','orderBlock','premiumDiscountOk','executionZone','technicalMomentumOk','spreadOk'].filter(k=>g[k]===true||String(g[k]).toUpperCase()==='PASS').length;
    const mandatory=['liquiditySweep','mss','bos','displacement','fvg','orderBlock','premiumDiscountOk','executionZone','technicalMomentumOk','spreadOk'];
    const missing=mandatory.filter(k=>!(g[k]===true||String(g[k]).toUpperCase()==='PASS'));
    const side=bias==='BULLISH'?'BUY':bias==='BEARISH'?'SELL':'WAIT';
    return {buy,sell,bias,side,score:Math.max(buy||0,sell||0),passes,missing,candle:c};
  }

  function render(snapshot,ai,tf){
    const r=localDecision(snapshot,tf);
    const c=r.candle||{};
    const aiDecision=String(ai?.decision||ai?.signal||r.side||'WAIT').toUpperCase();
    const confidence=pct(ai?.confidence) ?? Math.round(50+Math.min(45,Math.abs((r.buy??50)-(r.sell??50))/2));
    const color=aiDecision.includes('BUY')||r.bias==='BULLISH'?'#22e58a':aiDecision.includes('SELL')||r.bias==='BEARISH'?'#ff5968':'#f2c94c';
    const gates=snapshot?.gates||{};
    const gateNames=[['Liquidity Sweep','liquiditySweep'],['MSS','mss'],['BOS','bos'],['Displacement','displacement'],['FVG','fvg'],['Order Block','orderBlock'],['Premium / Discount','premiumDiscountOk'],['Execution Zone','executionZone'],['Momentum','technicalMomentumOk'],['Spread','spreadOk']];
    const gateHtml=gateNames.map(([label,key])=>{const v=gates[key]===true||String(gates[key]).toUpperCase()==='PASS';return `<span style="display:inline-block;margin:3px 4px 0 0;padding:4px 7px;border:1px solid #263650;border-radius:7px;color:${v?'#22e58a':'#f2c94c'}">${label}: ${v?'PASS':'WAIT'}</span>`;}).join('');
    const zone=snapshot?.zone||snapshot?.zones||{};
    const buyZone=zone.buyZone||snapshot?.buyZone;const sellZone=zone.sellZone||snapshot?.sellZone;
    const zoneText=r.bias==='BULLISH'?(buyZone?`${fmt(buyZone.low??buyZone[0])} — ${fmt(buyZone.high??buyZone[1])}`:'NO VALID BUY ZONE'):(r.bias==='BEARISH'?(sellZone?`${fmt(sellZone.low??sellZone[0])} — ${fmt(sellZone.high??sellZone[1])}`:'NO VALID SELL ZONE'):'WAIT');
    const reasons=Array.isArray(ai?.reasons)?ai.reasons:[];
    box().innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b style="font-size:14px;color:${color}">AI PRE-MARKET ANALYZE · ${esc(aiDecision)}</b><b>${confidence}/100</b></div>`+
      `<div style="margin-top:7px;color:#8493ab">Unified source: MT5 authoritative · ${esc(tf)} · ${snapshot?.complete?'5/5':'PARTIAL'} timeframe mapping</div>`+
      `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px">`+
      `<div><b>MTF Bias</b><br><span style="color:${color}">${r.bias}</span></div><div><b>Direction Score</b><br>${r.score}/100</div>`+
      `<div><b>BUY / SELL</b><br>${r.buy??'—'}% / ${r.sell??'—'}%</div><div><b>Execution Zone</b><br>${zoneText}</div>`+
      `</div>`+
      `<div style="margin-top:9px"><b>OPEN CANDLE · ${esc(tf)}</b><br>O ${fmt(c.open)} · H ${fmt(c.high)} · L ${fmt(c.low)} · C ${fmt(c.close)} · Body ${pct(c.bodyPct)??'—'}%</div>`+
      `<div style="margin-top:8px"><b>ICT EXECUTION GATES</b><br>${gateHtml}</div>`+
      `<div style="margin-top:8px;color:#8493ab">${r.passes}/10 gates passed. ${r.missing.length?`Waiting: ${r.missing.join(', ')}`:'All mandatory gates passed.'}</div>`+
      (reasons.length?`<div style="margin-top:7px">${reasons.slice(0,5).map(x=>`• ${esc(x)}`).join('<br>')}</div>`:'')+
      `<div style="margin-top:8px;color:#8493ab">AI confirmation only. This control never authorizes an order.</div>`;
  }

  async function run(btn){
    if(btn.dataset.v10Busy==='1')return;
    btn.dataset.v10Busy='1';const old=btn.textContent;btn.disabled=true;btn.textContent='Analyzing…';
    const tf=selectedTF();const el=box();if(el)el.innerHTML=`<b style="color:#35d8ff">ANALYZING ${esc(tf)} · MT5 OPEN-CANDLE FLOW…</b><br>Loading authoritative MTF snapshot, then AI confirmation.`;
    try{
      const snapshot=await request(`/api/pre-market/mt5-authoritative?_=${Date.now()}`);
      let ai=null;
      try{ai=await request(`/api/pre-market/ai?tf=${encodeURIComponent(tf)}&_=${Date.now()}`);}catch(e){console.warn('[VTRADE AI V10] AI confirmation unavailable:',e?.message||e);}
      render(snapshot,ai,tf);
    }catch(e){
      if(el)el.innerHTML=`<b style="color:#ff5968">AI ANALYSIS FAILED</b><br>${esc(e?.message||e)}<br><span style="color:#8493ab">No market data or trade signal was fabricated.</span>`;
      console.error('[VTRADE AI V10]',e);
    }finally{btn.dataset.v10Busy='0';btn.disabled=false;btn.textContent=old;}
  }

  function install(){
    const b=button();if(!b||b.dataset.v10Installed==='1')return;
    b.dataset.v10Installed='1';
    b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();run(b);},true);
  }
  const obs=new MutationObserver(install);obs.observe(document.documentElement,{childList:true,subtree:true});
  install();window.addEventListener('load',install);
})();