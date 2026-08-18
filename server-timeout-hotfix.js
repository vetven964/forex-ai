// V-TRADE AI — runtime hotfix wrapper
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync.bind(fs);

function patchActiveEngine(source) {
  let out = source;

  // Analysis watchdog must not beat the OpenAI confirmation request.
  out = out.replace(
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(1500, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 7000));",
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 15000));"
  );

  // Resolve each timeframe from structure + EMA trend + MACD momentum.
  // A timeframe is directional only when at least 2/3 components agree.
  const oldAnalyzeReturn = `  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,\n    score:directionScore,directionScore,`;
  const newAnalyzeReturn = `  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const bullVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BULLISH').length;\n  const bearVotes=[structureBias,trendBias,momentumBias].filter(x=>x==='BEARISH').length;\n  const resolvedBias=bullVotes>=2&&bullVotes>bearVotes?'BULLISH':bearVotes>=2&&bearVotes>bullVotes?'BEARISH':'NEUTRAL';\n  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore,components:{structure:structureBias,trend:trendBias,momentum:momentumBias,bullVotes,bearVotes}},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,\n    score:directionScore,directionScore,`;
  if (out.includes(oldAnalyzeReturn) && !out.includes('const bullVotes=[')) out=out.replace(oldAnalyzeReturn,newAnalyzeReturn);

  // Use the resolved bias consistently for the H4/H1/M15 council and horizon gates.
  out=out.replace(
    "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.structure?.bias || 'UNAVAILABLE');",
    "const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE');"
  );
  out=out.replace(
    "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));",
    "const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.resolvedBias || tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));"
  );
  out=out.replace("higherBiases:[tfs.M15?.structure?.bias,tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]","higherBiases:[tfs.M15?.resolvedBias,tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]");
  out=out.replace("higherBiases:[tfs.H1?.structure?.bias,tfs.H4?.structure?.bias]","higherBiases:[tfs.H1?.resolvedBias,tfs.H4?.resolvedBias]");
  out=out.replace("higherBiases:[tfs.H4?.structure?.bias,tfs.D1?.structure?.bias]","higherBiases:[tfs.H4?.resolvedBias,tfs.D1?.resolvedBias]");

  // Define the LIMIT-zone execution variables before the reasons/setup gates.
  const marker="  let signal='WAIT',status='WAIT — CONFIRMATION PENDING',entry=null,sl=null,tp=[],trigger=''; const reasons=[];";
  const zoneLogic="  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;\n";
  if(out.includes(marker) && !out.includes('const zoneMid=Number.isFinite(Number(candidateZone?.low))')) out=out.replace(marker,zoneLogic+marker);

  const oldSetup="const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const newSetup="const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  out=out.replace(oldSetup,newSetup);
  out=out.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');","if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  out=out.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);","if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  out=out.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}","{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  out=out.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/,'$1executionLocationOk');

  // Never send a second HTTP response after an earlier timeout/error response.
  out=out.replace("res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});","if (!res.headersSent) res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});");
  out=out.replace("res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});","if (!res.headersSent) res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});");

  console.log('[V-TRADE HOTFIX] timeout/header race protection active');
  console.log('[V-TRADE HOTFIX] MTF bias = structure + EMA + MACD 2/3 consensus');
  console.log('[V-TRADE HOTFIX] strict ICT execution + valid LIMIT-zone logic active');
  return out;
}

fs.readFileSync=function(file,...args){
  const source=originalReadFileSync(file,...args);
  if(path.resolve(String(file))!==SERVER_FILE || typeof source!=='string') return source;
  return patchActiveEngine(source);
};

require('./server-launcher.js');
