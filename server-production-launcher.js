// V-TRADE AI production launcher — deterministic logic fixes
// Keeps server.js as the source of truth and applies only safe runtime patches.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchMtfAndContext(source) {
  // RANGE structure is valid context, but it must not erase a real directional
  // EMA/MACD bias from the MTF dashboard. Priority: structure > EMA > MACD.
  const oldTrend = "  const trend=e20&&e50 ? (e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL') : 'UNKNOWN';";
  const newTrend = oldTrend + "\n  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const resolvedBias=structureBias||trendBias||momentumBias||'NEUTRAL';\n  const directionScore=Math.max(0,Math.min(100,Math.round(50+(resolvedBias==='BULLISH'?12:resolvedBias==='BEARISH'?-12:0)+(trendBias===resolvedBias?(resolvedBias==='BULLISH'?10:-10):0)+(momentumBias===resolvedBias?(resolvedBias==='BULLISH'?8:-8):0)+(r!=null?(resolvedBias==='BULLISH'?(r>=50?6:-3):resolvedBias==='BEARISH'?(r<=50?-6:3):0):0)+(dx?.value>=18?(resolvedBias==='BULLISH'?4:resolvedBias==='BEARISH'?-4:0):0))));";
  if (source.includes(oldTrend) && !source.includes('const resolvedBias=')) source=source.replace(oldTrend,newTrend);

  const oldReturn = "  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,rsi:r==null?null:Math.round(r*100)/100,";
  const newReturn = "  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,directionScore,rsi:r==null?null:Math.round(r*100)/100,";
  if (source.includes(oldReturn)) source=source.replace(oldReturn,newReturn);

  // Neutral has no premium/discount execution side. Do not show a false
  // "wait for premium" message while bias is NEUTRAL.
  const oldPd = "  const premiumDiscount=live.price>mid?'PREMIUM':'DISCOUNT';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  const newPd = "  const premiumDiscount=(side==='BULLISH'||side==='BEARISH')?(live.price>mid?'PREMIUM':'DISCOUNT'):'NEUTRAL';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  if (source.includes(oldPd)) source=source.replace(oldPd,newPd);
  source=source.replace("  if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "  if(side!=='NEUTRAL'&&!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");

  // Strict authorization: a signal is actionable only after the canonical ICT
  // gates pass. Limit-zone readiness is allowed for a valid directional zone,
  // but it never bypasses liquidity/MSS/BOS/displacement/MTF/RR gates.
  const oldSetup = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const newSetup = "  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;\n  const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (source.includes(oldSetup) && !source.includes('const executionLocationOk=')) source=source.replace(oldSetup,newSetup);
  source=source.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}", "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  source=source.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');", "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  source=source.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  source=source.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/, '$1executionLocationOk');

  // Never promote a loose horizon opportunity when the canonical M5 gate is WAIT.
  source=source.replace("const selectedOpportunity = safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null;", "const selectedOpportunity = setupReady ? (safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null) : null;");
  source=source.replace(/\s*if \(selectedOpportunity && !setupReady && !newsBlocked\) \{[\s\S]*?\n  \}\n  if \(newsBlocked\)/, "\n  if (newsBlocked)");

  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) {
    source=source.replace(/(const\s+setupReady\s*=.*?;)/, "$1\n  const tradeAuthorized=setupReady===true;");
  }
  if (!/tradeAuthorized\s*,/.test(source)) source=source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, "$1\n    tradeAuthorized,");
  return source;
}

function patchMt5StartupReadiness(source) {
  // Do not let the first browser request during a Render restart become a
  // 503/error. The server must stay online so the MT5 bridge can connect, while
  // ICT analysis remains fail-closed until QUOTE + M5/M15/H1/H4 are ready.
  const old = "    const detail = `VT Markets MT5 feed not ready: missing=${readinessMissing.join(',')} ageSec=${age===null?'null':age} maxAgeMs=${MT5_MAX_AGE_MS}`;\n    throw new Error(detail);";
  const replacement = "    const detail = `VT Markets MT5 feed not ready: missing=${readinessMissing.join(',')} ageSec=${age===null?'null':age} maxAgeMs=${MT5_MAX_AGE_MS}`;\n    return {\n      feedReady:false,\n      signal:'WAIT',\n      status:'WAIT',\n      bias:'NEUTRAL',\n      directionBand:'NEUTRAL',\n      directionScore:0,\n      confidence:0,\n      setupReady:false,\n      tradeAuthorized:false,\n      entry:null,\n      stopLoss:null,\n      tp1:null,\n      tp2:null,\n      tp3:null,\n      confirmations:{allGatesPassed:false,feedReady:false},\n      score:{blockedReasons:[detail],confidence:0},\n      mt5:{ready:false,missing:readinessMissing,ageSec,maxAgeMs:MT5_MAX_AGE_MS}\n    };";
  if (source.includes(old)) source=source.replace(old,replacement);
  return source;
}

function patchFrontend(source) {
  source=source.replace("font:14px Segoe UI,Arial,sans-serif", "font:14px 'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  source=source.replace("font-family:Segoe UI,Arial,sans-serif", "font-family:'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  return source;
}

Module._extensions['.js']=function vtradeServerLoader(mod,filename){
  if(path.resolve(filename)!==SERVER_FILE) return originalLoader(mod,filename);
  let source=fs.readFileSync(filename,'utf8');
  source=patchMt5StartupReadiness(source);
  source=patchMtfAndContext(source);
  console.log('[V-TRADE LAUNCHER] MT5 startup readiness gate active');
  console.log('[V-TRADE LAUNCHER] resolved MTF bias + neutral P/D logic active');
  console.log('[V-TRADE LAUNCHER] strict ICT execution gates active');
  mod._compile(source,filename);
};

try {
  if(fs.existsSync(FRONTEND_FILE)){
    const before=fs.readFileSync(FRONTEND_FILE,'utf8');
    const after=patchFrontend(before);
    if(after!==before){fs.writeFileSync(FRONTEND_FILE,after,'utf8');console.log('[V-TRADE LAUNCHER] Khmer frontend font compatibility applied');}
  }
}catch(e){console.warn('[V-TRADE LAUNCHER] frontend patch skipped:',e.message);}

require('./server.js');
