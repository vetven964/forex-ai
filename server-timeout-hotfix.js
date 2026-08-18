// V-TRADE AI — runtime production hotfix
// IMPORTANT: Render should start with: node server-timeout-hotfix.js
// This wrapper patches server.js in memory, then hands control to the normal
// production launcher so the account/admin/frontend patches remain active.
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync.bind(fs);

function patchActiveEngine(source) {
  let out = source;
  let hits = 0;

  // package-access-hotfix injects a persistent member route that uses fs.
  // server.js historically did not import fs, so make the dependency explicit
  // in the in-memory production source before any injected route is evaluated.
  if (!/^const\s+fs\s*=\s*require\(['"]fs['"]\);/m.test(out)) {
    out = "const fs = require('fs');\n" + out;
    hits++;
  }

  const oldTimeout = "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(1500, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 7000));";
  const newTimeout = "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 15000));";
  if (out.includes(oldTimeout)) { out = out.replace(oldTimeout, newTimeout); hits++; }

  const oldSuccess = "res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});";
  const newSuccess = "if (!res.headersSent) res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});";
  if (out.includes(oldSuccess)) { out = out.replace(oldSuccess, newSuccess); hits++; }
  const oldError = "res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});";
  const newError = "if (!res.headersSent) res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});";
  if (out.includes(oldError)) { out = out.replace(oldError, newError); hits++; }

  const oldTrend = "  const trend=e20&&e50 ? (e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL') : 'UNKNOWN';";
  const consensusCode = "  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const bullVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BULLISH').length;\n  const bearVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BEARISH').length;\n  const resolvedBias=bullVotes>=2&&bullVotes>bearVotes?'BULLISH':bearVotes>=2&&bearVotes>bullVotes?'BEARISH':'NEUTRAL';\n  const resolvedScore=Math.max(0,Math.min(100,Math.round(50 + (resolvedBias==='BULLISH'?12:resolvedBias==='BEARISH'?-12:0) + (trendBias===resolvedBias?(resolvedBias==='BULLISH'?10:-10):0) + (momentumBias===resolvedBias?(resolvedBias==='BULLISH'?8:-8):0))));";
  if (out.includes(oldTrend) && !out.includes('const bullVotes=')) { out = out.replace(oldTrend, oldTrend + "\n" + consensusCode); hits++; }

  const oldReturn = "  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,";
  const newReturn = "  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:resolvedScore,components:{structure:structureBias,trend:trendBias,momentum:momentumBias,bullVotes,bearVotes}},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,directionScore:resolvedScore,";
  if (out.includes(oldReturn)) { out = out.replace(oldReturn, newReturn); hits++; }

  const coreOld = "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.structure?.bias || 'UNAVAILABLE');";
  const coreNew = "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE');";
  if (out.includes(coreOld)) { out = out.replace(coreOld, coreNew); hits++; }
  const fullOld = "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));";
  const fullNew = "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));";
  if (out.includes(fullOld)) { out = out.replace(fullOld, fullNew); hits++; }
  out = out.replace("higherBiases:[tfs.M15?.structure?.bias,tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]","higherBiases:[tfs.M15?.resolvedBias,tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]");
  out = out.replace("higherBiases:[tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]","higherBiases:[tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]");
  out = out.replace("higherBiases:[tfs.H4?.structure?.bias,tfs.D1?.structure?.bias]","higherBiases:[tfs.H4?.resolvedBias,tfs.D1?.resolvedBias]");

  const marker="  let signal='WAIT',status='WAIT — CONFIRMATION PENDING',entry=null,sl=null,tp=[],trigger=''; const reasons=[];";
  const zoneLogic="  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;\n";
  if (out.includes(marker) && !out.includes('const zoneMid=Number.isFinite(Number(candidateZone?.low))')) { out = out.replace(marker, zoneLogic + marker); hits++; }
  const oldSetup="const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const newSetup="const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (out.includes(oldSetup)) { out = out.replace(oldSetup,newSetup); hits++; }
  out = out.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');","if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  out = out.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);","if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  out = out.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}","{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  out = out.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/,'$1executionLocationOk');

  const band="const directionBand=directionScore>=80?'BULLISH':directionScore>=60?'BULLISH_BIAS':directionScore>=40?'NEUTRAL':directionScore>=20?'BEARISH_BIAS':'BEARISH';";
  if (out.includes(band) && !out.includes("if(side==='NEUTRAL') directionScore=50;")) { out=out.replace(band,"if(side==='NEUTRAL') directionScore=50;\n  "+band); hits++; }

  console.log(`[V-TRADE RUNTIME HOTFIX] active patches=${hits}`);
  console.log('[V-TRADE RUNTIME HOTFIX] analysis watchdog/header race protection active');
  console.log('[V-TRADE RUNTIME HOTFIX] H4/H1/M15 bias = ICT structure + EMA + MACD 2/3 consensus');
  console.log('[V-TRADE RUNTIME HOTFIX] strict ICT execution + valid LIMIT-zone logic active');
  return out;
}

fs.readFileSync=function(file,...args){
  const source=originalReadFileSync(file,...args);
  if(path.resolve(String(file))!==SERVER_FILE || typeof source!=='string') return source;
  return patchActiveEngine(source);
};

require('./package-access-hotfix.js');
require('./server-launcher.js');
