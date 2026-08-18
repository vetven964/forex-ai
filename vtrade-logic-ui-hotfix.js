// V-TRADE AI — Logic + UI consistency hotfix V2
// 1) Align Pre-Market ICT gate display with the deterministic engine.
// 2) Stop pre-AI confidence from reaching 100/100 from raw candle distance alone.
// 3) Distinguish candle-open momentum from structural MTF bias.
// 4) Make the dashboard's WAIT / BEARISH presentation stable on desktop + phone.
const fs=require('fs');
const path=require('path');
const PRE=path.resolve(__dirname,'pre-market-launcher-hook.js');
const TERM=path.resolve(__dirname,'terminal-pre-market.js');
const DASH=path.resolve(__dirname,'premium-dashboard-live.html');
const MARK='VTRADE_LOGIC_UI_CONSISTENCY_V3';

function patch(file,fn){
  if(!fs.existsSync(file)) return;
  const old=fs.readFileSync(file,'utf8');
  const next=fn(old);
  if(next!==old) fs.writeFileSync(file,next,'utf8');
}

patch(PRE,s=>{
  if(s.includes(MARK)) return s;
  const old=`const preAiConfidence=!complete?0:Math.round(clamp(50+Math.abs(buy-sell)));\n  return{success:true,symbol:'XAUUSD',price,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,preAiConfidence,complete,missingTimeframes:frames.filter(tf=>!rows[tf].ready),timeframes:rows,mtf:{weights,ready,required:5,complete,buyPct:buy,sellPct:sell},workflow:{stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:['M5','M15','H1','H4','D1','MTF_WEIGHT','ICT','AI'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true},calculatedAt:new Date().toISOString()};`;
  const neu=`const coreTfs=['H4','H1','M15'];\n  const coreRows=coreTfs.map(tf=>a?.timeframes?.[tf]||a?.mtf?.[tf]||null).filter(Boolean);\n  const coreBiases=coreRows.map(x=>String(x?.structure?.bias||x?.resolvedBias||x?.trend||x?.bias||'').toUpperCase());\n  const coreBull=coreBiases.filter(x=>x.includes('BULL')||x==='BUY').length;\n  const coreBear=coreBiases.filter(x=>x.includes('BEAR')||x==='SELL').length;\n  const coreBias=coreBull>=2?'BULLISH':coreBear>=2?'BEARISH':'NEUTRAL';\n  const candleConfidence=!complete?0:Math.min(85,Math.round(50+Math.abs(buy-sell)*0.5));\n  const preAiConfidence=complete && coreBias!=='NEUTRAL' && bias!==coreBias ? Math.max(0,candleConfidence-15) : candleConfidence;\n  const c=a?.confirmations||{}, ict=a?.ict||{};\n  const valid=v=>{\n    if(v===true)return true;\n    if(v===false||v==null)return false;\n    if(typeof v==='string'){const z=v.trim().toUpperCase();return z!==''&&!['WAIT','NONE','NEUTRAL','UNAVAILABLE','NOT_FOUND','FALSE'].includes(z);}\n    if(typeof v==='object')return v.confirmed===true||valid(v.bias)||valid(v.direction)||valid(v.type)||valid(v.state);\n    return false;\n  };\n  const has=(...v)=>v.some(valid);\n  const gates={\n    liquiditySweep:has(c.sweepOk,c.liquiditySweepOk,ict.liquiditySweep?.confirmed,ict.liquiditySweep?.bias),\n    mss:has(c.mssOk,ict.mss?.confirmed,ict.mss?.bias,ict.mss),\n    bos:has(c.bosOk,ict.bos?.confirmed,ict.bos?.bias,ict.bos),\n    fvg:has(c.fvgOk,ict.fvg?.confirmed,ict.fvg?.type,ict.fvg?.bias),\n    orderBlock:has(c.orderBlockOk,ict.orderBlock?.confirmed,ict.orderBlock?.type,ict.orderBlock?.bias)\n  };\n  return{success:true,symbol:'XAUUSD',price,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,preAiConfidence,complete,missingTimeframes:frames.filter(tf=>!rows[tf].ready),timeframes:rows,coreStructure:{bias:coreBias,bull:coreBull,bear:coreBear,required:'2/3 H4/H1/M15'},gates,workflow:{stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:['M5','M15','H1','H4','D1','MTF_WEIGHT','ICT','AI'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true,note:'Candle-open momentum is separate from live structural bias. ICT gate values mirror the deterministic engine when available.'},calculatedAt:new Date().toISOString()};`;
  if(!s.includes(old)) throw new Error('pre-market calculate anchor not found');
  return s.replace(old,neu);
});

patch(TERM,s=>{
  if(s.includes(MARK)) return s;
  let out=s.replace('<span>Pre-AI confidence</span>','<span>Candle-open confidence</span>');
  out=out.replace('<div class="vpm-row"><span>MTF Bias</span><b class="${b===\'BULLISH\'?\'vpm-buy\':b===\'BEARISH\'?\'vpm-sell\':\'vpm-neutral\'}">${esc(b)}</b></div><div class="vpm-row"><span>Candle-open confidence</span><b>${num(d.preAiConfidence)==null?\'—\':d.preAiConfidence+\'/100\'}</b></div>', '<div class="vpm-row"><span>Candle-open Bias</span><b class="${b===\'BULLISH\'?\'vpm-buy\':b===\'BEARISH\'?\'vpm-sell\':\'vpm-neutral\'}">${esc(b)}</b></div><div class="vpm-row"><span>Core Structure</span><b class="${d.coreStructure?.bias===\'BULLISH\'?\'vpm-buy\':d.coreStructure?.bias===\'BEARISH\'?\'vpm-sell\':\'vpm-neutral\'}">${esc(d.coreStructure?.bias||\'—\')} · ${d.coreStructure?.bull??0}/${(d.coreStructure?.bull??0)+(d.coreStructure?.bear??0)||0}</b></div><div class="vpm-row"><span>Candle-open confidence</span><b>${num(d.preAiConfidence)==null?\'—\':d.preAiConfidence+\'/100\'}</b></div>');
  if(out===s) throw new Error('terminal pre-market label anchor not found');
  return out.replace('Candle-Open MTF processing · M5 → M15 → H1 → H4 → D1 · AI confirmation after processing · Telegram independent','Candle-Open momentum · Structure core H4/H1/M15 · AI confirmation after processing · Telegram independent')
    .replace('BUY/SELL percentages are directional evidence strength from MT5 candle-open MTF processing, not guaranteed win probabilities.','BUY/SELL percentages are candle-open directional evidence, not structural bias or guaranteed win probabilities. Core structure is shown separately from candle-open momentum.');
});

patch(DASH,s=>{
  if(s.includes(MARK)) return s;
  const css=`\n<style id="${MARK}">\n/* ${MARK} */\n.signal-state{white-space:nowrap;overflow-wrap:normal;word-break:normal;}\n@media(max-width:900px){.signal-state{font-size:28px!important;white-space:nowrap!important;line-height:1.05!important;}.signal{gap:10px!important;}.signal>div{min-width:0!important;}}\n@media(max-width:520px){.signal-state{font-size:25px!important;}.top .pair{min-width:0!important;}.top .pair>div{min-width:0!important;}.top .pair .price{font-size:26px!important;}.tfs{padding-right:3px!important;}.tfs button{flex:0 0 auto!important;}.backend{font-size:8px!important;}}\n</style>\n`;
  return s.replace('</head>',css+'</head>');
});

console.log('[VTRADE LOGIC/UI] consistency hotfix V3 installed');
