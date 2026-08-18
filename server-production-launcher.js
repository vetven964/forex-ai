// V-TRADE AI production launcher — deterministic logic fixes
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchCors(source) {
  const marker = "const app = express();";
  if (!source.includes(marker) || source.includes('[V-TRADE CORS]')) return source;
  const corsPatch = `
// [V-TRADE CORS] GitHub Pages / Render browser access — credentials-safe allowlist.
const VTRADE_ALLOWED_ORIGINS = new Set([
  'https://vetven964.github.io','https://www.vetven964.github.io',
  'http://localhost:3000','http://localhost:5173','http://127.0.0.1:3000','http://127.0.0.1:5173'
]);
app.use((req,res,next)=>{
  const origin = String(req.headers.origin || '');
  const configured = String(process.env.ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean);
  const allowed = VTRADE_ALLOWED_ORIGINS.has(origin) || configured.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-VTRADE-AUTH, X-MT5-API-KEY');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, X-V-TRADE-Version');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
console.log('[V-TRADE CORS] GitHub Pages origin allowlist active');`;
  return source.replace(marker, marker + corsPatch);
}

function patchPublicPricing(source) {
  if (source.includes("app.get('/api/public/pricing'")) return source;
  const marker = "app.get('/api/pricing', requireAuth, (req,res) => {";
  if (!source.includes(marker)) return source;
  const publicRoute = `app.get('/api/public/pricing', (req,res) => {
  res.set('Cache-Control','no-store');
  res.json({success:true, public:true, plans:pricingPlans.filter(p=>p.enabled!==false).map(p=>({id:p.id,name:p.name,price:p.price,period:p.period,enabled:true,features:Array.isArray(p.features)?p.features:[]}))});
});

`;
  return source.replace(marker, publicRoute + marker);
}

function patchMtfAndContext(source) {
  const oldTrend = "  const trend=e20&&e50 ? (e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL') : 'UNKNOWN';";
  const newTrend = oldTrend + "\n  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const resolvedBias=structureBias||trendBias||momentumBias||'NEUTRAL';\n  const directionScore=Math.max(0,Math.min(100,Math.round(50+(resolvedBias==='BULLISH'?12:resolvedBias==='BEARISH'?-12:0)+(trendBias===resolvedBias?(resolvedBias==='BULLISH'?10:-10):0)+(momentumBias===resolvedBias?(resolvedBias==='BULLISH'?8:-8):0)+(r!=null?(resolvedBias==='BULLISH'?(r>=50?6:-3):resolvedBias==='BEARISH'?(r<=50?-6:3):0):0)+(dx?.value>=18?(resolvedBias==='BULLISH'?4:resolvedBias==='BEARISH'?-4:0):0))));";
  if (source.includes(oldTrend) && !source.includes('const resolvedBias=')) source=source.replace(oldTrend,newTrend);
  const oldReturn = "  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,rsi:r==null?null:Math.round(r*100)/100,";
  const newReturn = "  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,directionScore,rsi:r==null?null:Math.round(r*100)/100,";
  if (source.includes(oldReturn)) source=source.replace(oldReturn,newReturn);
  const oldPd = "  const premiumDiscount=live.price>mid?'PREMIUM':'DISCOUNT';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  const newPd = "  const premiumDiscount=(side==='BULLISH'||side==='BEARISH')?(live.price>mid?'PREMIUM':'DISCOUNT'):'NEUTRAL';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  if (source.includes(oldPd)) source=source.replace(oldPd,newPd);
  source=source.replace("  if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "  if(side!=='NEUTRAL'&&!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  const oldSetup = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const newSetup = "  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  var executionLocationOk=pdOk||limitZoneReady;\n  const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (source.includes(oldSetup) && !/\b(?:const|let|var)\s+executionLocationOk\s*=/.test(source)) source=source.replace(oldSetup,newSetup);
  source=source.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}", "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  source=source.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');", "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  source=source.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  // Do not rewrite confirmations here: the runtime hotfix declares executionLocationOk safely.
  source=source.replace("const selectedOpportunity = safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null;", "const selectedOpportunity = setupReady ? (safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null) : null;");
  source=source.replace(/\s*if \(selectedOpportunity && !setupReady && !newsBlocked\) \{[\s\S]*?\n  \}\n  if \(newsBlocked\)/, "\n  if (newsBlocked)");
  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) source=source.replace(/(const\s+setupReady\s*=.*?;)/, "$1\n  const tradeAuthorized=setupReady===true;");
  if (!/tradeAuthorized\s*,/.test(source)) source=source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, "$1\n    tradeAuthorized,");
  return source;
}

function patchMt5StartupReadiness(source) {
  const old = "    const detail = `VT Markets MT5 feed not ready: missing=${readinessMissing.join(',')} ageSec=${age===null?'null':age} maxAgeMs=${MT5_MAX_AGE_MS}`;\n    throw new Error(detail);";
  const replacement = "    const detail = `VT Markets MT5 feed not ready: missing=${readinessMissing.join(',')} ageSec=${age===null?'null':age} maxAgeMs=${MT5_MAX_AGE_MS}`;\n    return {feedReady:false,signal:'WAIT',status:'WAIT',bias:'NEUTRAL',directionBand:'NEUTRAL',directionScore:0,confidence:0,setupReady:false,tradeAuthorized:false,entry:null,stopLoss:null,tp1:null,tp2:null,tp3:null,confirmations:{allGatesPassed:false,feedReady:false},score:{blockedReasons:[detail],confidence:0},mt5:{ready:false,missing:readinessMissing,ageSec,maxAgeMs:MT5_MAX_AGE_MS}};";
  if (source.includes(old)) source=source.replace(old,replacement);
  const oldAi = "    const ai = OPENAI_ENABLED ? await openAIConfirmXauAnalysis(a) : null;\n    res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});";
  const newAi = "    if(a?.feedReady===false){ return res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:null}); }\n    const ai = OPENAI_ENABLED ? await openAIConfirmXauAnalysis(a) : null;\n    const {applyTruthGuard}=require('./analysis-truth');\n    const guarded=applyTruthGuard({...a,aiConfirmation:ai});\n    res.json({success:true,...guarded,telegramConfigured:!!tg,aiConfirmation:guarded.aiConfirmation});";
  if (source.includes(oldAi)) source=source.replace(oldAi,newAi);
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
  source=patchCors(source);
  source=patchPublicPricing(source);
  source=patchMt5StartupReadiness(source);
  source=patchMtfAndContext(source);
  console.log('[V-TRADE LAUNCHER] public pricing endpoint active');
  console.log('[V-TRADE LAUNCHER] MT5 startup readiness gate active');
  console.log('[V-TRADE LAUNCHER] resolved MTF bias + neutral P/D logic active');
  console.log('[V-TRADE LAUNCHER] strict ICT execution gates active');
  console.log('[V-TRADE LAUNCHER] basic workflow + Truth Guard active');
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
