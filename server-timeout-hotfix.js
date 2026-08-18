// V-TRADE AI — runtime hotfix wrapper
// One deterministic runtime layer for Render. It patches server.js in memory before
// server-launcher.js loads it, so the production launcher and local npm start use
// the same timeout + MTF logic.
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync.bind(fs);

function patchActiveEngine(source) {
  let out = source;

  // 1) Prevent the API watchdog from racing the OpenAI confirmation request.
  out = out.replace(
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(1500, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 7000));",
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 15000));"
  );

  // 2) The previous launcher patch looked for an obsolete analyzeTF return shape.
  // Resolve a timeframe bias from three independent local signals: ICT structure,
  // EMA trend, and MACD momentum. A timeframe becomes directional only when at
  // least two of the three agree. This avoids turning a single EMA cross into a
  // fake MTF direction.
  const oldAnalyzeReturn = `  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,\n    score:directionScore,directionScore,`;
  const newAnalyzeReturn = `  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const bullVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BULLISH').length;\n  const bearVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BEARISH').length;\n  const resolvedBias=bullVotes>=2&&bullVotes>bearVotes?'BULLISH':bearVotes>=2&&bearVotes>bullVotes?'BEARISH':'NEUTRAL';\n  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore,components:{structure:structureBias,trend:trendBias,momentum:momentumBias,bullVotes,bearVotes}},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,\n    score:directionScore,directionScore,`;
  if (out.includes(oldAnalyzeReturn) && !out.includes('const bullVotes=[')) {
    out = out.replace(oldAnalyzeReturn, newAnalyzeReturn);
  }

  // 3) Core H4/H1/M15 alignment must use the resolved directional bias above,
  // not raw structure alone. This fixes the dashboard showing stale 1/3 alignment
  // when trend + momentum independently agree with the timeframe structure.
  out = out.replace(
    "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.structure?.bias || 'UNAVAILABLE');",
    "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE');"
  );
  out = out.replace(
    "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));",
    "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));"
  );

  // 4) Horizon alignment uses the same resolved MTF bias. Never let a raw
  // structure label disagree with the top-level MTF council.
  out = out.replace(
    "higherBiases:[tfs.M15?.structure?.bias,tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]",
    "higherBiases:[tfs.M15?.resolvedBias,tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]"
  );
  out = out.replace(
    "higherBiases:[tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]",
    "higherBiases:[tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]"
  );
  out = out.replace(
    "higherBiases:[tfs.H4?.structure?.bias,tfs.D1?.structure?.bias]",
    "higherBiases:[tfs.H4?.resolvedBias,tfs.D1?.resolvedBias]"
  );

  // 5) The active engine currently requires a retest/near-zone for canonical
  // setupReady. Keep that safety rule, but allow a valid LIMIT zone when price is
  // on the correct premium/discount side and close enough to the zone. The order
  // is still WAIT until the deterministic score, structure, sweep, displacement,
  // spread and RR gates all pass.
  const oldSetup = "const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const newSetup = "const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;\n  const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (out.includes(oldSetup) && !out.includes('const limitZoneReady=')) {
    out = out.replace(oldSetup, newSetup);
  }
  out = out.replace(
    "if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');",
    "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');"
  );
  out = out.replace(
    "if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);",
    "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);"
  );
  out = out.replace(
    "{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}",
    "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}"
  );
  out = out.replace(
    /const confirmations=\{[\s\S]*?premiumDiscountOk:/,
    m => m.replace('premiumDiscountOk:pdOk','premiumDiscountOk:executionLocationOk')
  );

  // 6) Never return a second HTTP response if a timeout/error already sent one.
  out = out.replace(
    "res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});",
    "if (!res.headersSent) res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});"
  );
  out = out.replace(
    "res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});",
    "if (!res.headersSent) res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});"
  );

  console.log('[V-TRADE HOTFIX] timeout/header race protection active');
  console.log('[V-TRADE HOTFIX] resolved MTF bias = structure + EMA trend + MACD 2/3 consensus');
  console.log('[V-TRADE HOTFIX] strict ICT execution + valid LIMIT-zone logic active');
  return out;
}

fs.readFileSync = function(file, ...args) {
  const source = originalReadFileSync(file, ...args);
  if (path.resolve(String(file)) !== SERVER_FILE || typeof source !== 'string') return source;
  return patchActiveEngine(source);
};

require('./server-launcher.js');
