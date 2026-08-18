// V-TRADE AI production launcher
// One startup path for Render + npm start.
const fs = require('fs');
const Module = require('module');
const path = require('path');
const crypto = require('crypto');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchExecutionLogic(source) {
  const gatePattern = /(const\s+biasOk=[\s\S]*?structureAgreement=mssOk\|\|bosOk;)/;
  if (gatePattern.test(source) && !/\bconst\s+executionLocationOk\s*=/.test(source)) {
    source = source.replace(gatePattern, `$1\n  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;`);
  }
  source = source.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}", "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  source = source.replace("const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);", "const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);");
  source = source.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');", "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  source = source.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  source = source.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/, '$1executionLocationOk');
  source = source.replace("const selectedOpportunity = safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null;", "const selectedOpportunity = setupReady ? (safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null) : null;");
  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) source = source.replace(/(const\s+setupReady\s*=.*?;)/, `$1\n  const tradeAuthorized=setupReady===true;`);
  source = source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, `$1\n    tradeAuthorized,`);
  return source;
}

function patchMtfBias(source) {
  const needle = "return {\n    structure:s,trend";
  if (source.includes(needle)) {
    const replacement = "const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=(m?.histogram>0)?'BULLISH':(m?.histogram<0)?'BEARISH':null;\n  const resolvedBias=structureBias||trendBias||momentumBias||'NEUTRAL';\n  const directionScore=Math.max(0,Math.min(100,Math.round(50 + (resolvedBias==='BULLISH'?12:resolvedBias==='BEARISH'?-12:0) + (trendBias===resolvedBias?(resolvedBias==='BULLISH'?10:-10):0) + (momentumBias===resolvedBias?(resolvedBias==='BULLISH'?8:-8):0) + (r!=null ? (resolvedBias==='BULLISH'?(r>=50?6:-3):resolvedBias==='BEARISH'?(r<=50?-6:3):0) : 0) + (dx?.value>=18 ? (resolvedBias==='BULLISH'?4:resolvedBias==='BEARISH'?-4:0) : 0))));\n  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore},trend,resolvedBias,directionScore";
    source = source.replace(needle, replacement);
  }
  return source;
}

function patchTruthGuard(source) {
  if (!source.includes("require('./analysis-truth')")) source = "const { applyTruthGuard } = require('./analysis-truth');\n" + source;
  const marker = 'async function buildXauAnalysis() {';
  if (source.includes(marker) && !source.includes('async function buildXauAnalysisCore() {')) {
    source = source.replace(marker, `async function buildXauAnalysisCore() {`);
    source = source.replace(`async function buildXauAnalysisCore() {`, `async function buildXauAnalysis() {\n  const base = await buildXauAnalysisCore();\n  return applyTruthGuard(base);\n}\n\nasync function buildXauAnalysisCore() {`);
  }
  source = source.replace(/const APP_VERSION\s*=\s*'[^']+';/, "const APP_VERSION = '7.5.0-MEMBER-MTF';");
  return source;
}

function patchWaitCard(source) {
  const marker = 'function telegramWaitText(a) {';
  const next = 'function telegramWaitText(a) {';
  if (!source.includes(marker)) return source;
  const start = source.indexOf(marker);
  const end = source.indexOf('\nfunction ', start + marker.length);
  if (end < 0) return source;
  const fn = `function telegramWaitText(a) {\n  const price=Number(a?.price ?? a?.livePrice ?? a?.bid);\n  const bias=String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();\n  const directionScore=Number(a?.directionScore ?? a?.aiScore ?? 0);\n  const confidence=Number(a?.confidence ?? a?.score?.confidence ?? 0);\n  const blocked=Array.isArray(a?.score?.blockedReasons)?a.score.blockedReasons.slice(0,8).map(String):[];\n  const ai=a?.aiConfirmation || a?.ai || null;\n  const aiDecision=String(ai?.decision || a?.aiDecision || 'WAIT').toUpperCase();\n  const aiConfidence=Number(ai?.confidence ?? a?.aiConfidence ?? 0);\n  const agreement=String(ai?.agreement || a?.aiAgreement || 'NEUTRAL').toUpperCase();\n  const broker=String(a?.broker || 'VT Markets MT5');\n  const quoteAge=Number.isFinite(Number(a?.quoteAge ?? a?.feedAgeSec ?? a?.priceAgeSec))?Number(a?.quoteAge ?? a?.feedAgeSec ?? a?.priceAgeSec):0;\n  const authorized=a?.tradeAuthorized===true;\n  const side=bias==='BULLISH'?'BUY':bias==='BEARISH'?'SELL':'';\n  const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';\n  const council=a?.analystCouncil||{}; const truth=a?.truthMetrics||{};\n  if(authorized && side){return ['🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',` +
    `'📊 Asset: *XAU/USD (Gold)*','💰 Price: *'+n(price)+'*','🚨 Action: *'+(side==='BUY'?'🟢 BUY — TRADE AUTHORIZED':'🔴 SELL — TRADE AUTHORIZED')+'*','📈 Bias: *'+bias+'*','📊 Direction Score: *'+(Number.isFinite(directionScore)?directionScore:0)+'/100*','🧠 Confidence: *'+(Number.isFinite(confidence)?confidence:0)+'/100*','',` +
    `'🎯 Entry: *'+n(a.entry)+'*','🛑 Stop Loss: *'+n(a.stopLoss)+'*','🎯 TP1: *'+n(a.takeProfit?.[0])+'*','🎯 TP2: *'+n(a.takeProfit?.[1])+'*','🎯 TP3: *'+n(a.takeProfit?.[2])+'*','',` +
    `'🧠 Council: *'+(council.consensus||'NEUTRAL')+' '+(council.consensusVotes||'0/0')+'* | Confidence: *'+(council.confidence??'—')+'/100*','🔎 Verified Win Rate: *'+(truth.verifiedWinRate==null?'N/A':truth.verifiedWinRate+'%')+'* | Sample: *'+(truth.verifiedSampleSize??0)+'*','🔐 *ORDER AUTHORIZED — TRUTH GUARD PASSED*','🏦 Broker: *'+broker+'* | Quote age: *'+quoteAge+'s*'].join('\\n');}` +
    ` const action=bias==='BULLISH'?'🟡 WAIT — BUY BIAS':bias==='BEARISH'?'🟡 WAIT — SELL BIAS':'🟡 WAIT — NO ENTRY';\n  const gateLine=blocked.length?blocked.map(x=>'• '+x).join('\\n'):'• No confirmed entry gate';\n  return ['🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',` +
    `'📊 Asset: *XAU/USD (Gold)*','💰 Price: *'+n(price)+'*','⚡ Action: *'+action+'*','📈 Bias: *'+bias+'*','📊 Direction Score: *'+(Number.isFinite(directionScore)?directionScore:0)+'/100*','🧠 Confidence: *'+(Number.isFinite(confidence)?confidence:0)+'/100*','',` +
    `'🔎 *ICT ENTRY GATES*',gateLine,'','🧠 Analyst Council: *'+(council.consensus||'NEUTRAL')+' '+(council.consensusVotes||'0/0')+'* | Confidence: *'+(council.confidence??'—')+'/100*','📊 Verified Win Rate: *'+(truth.verifiedWinRate==null?'N/A':truth.verifiedWinRate+'%')+'* | Sample: *'+(truth.verifiedSampleSize??0)+'*','🎯 Execution Zone: *WAITING FOR CONFIRMATION*','🟢 Entry: *WAIT — truth guard confirmation required*','🛑 Stop Loss (SL): *WAIT*','🎯 TP1: *WAIT*','🎯 TP2: *WAIT*','🎯 TP3: *WAIT*','',` +
    `'🤖 AI Confirm: *'+aiDecision+'* | Confidence: *'+(Number.isFinite(aiConfidence)?aiConfidence:0)+'/100* | Agreement: *'+agreement+'*','⚡ Status: *WAIT — NO ORDER AUTHORIZED*','',` +
    `'🔒 No order until engine gates + analyst council + risk/data checks pass.','🏦 Broker: *'+broker+'* | Quote age: *'+quoteAge+'s*'].join('\\n');\n}`;
  return source.slice(0,start)+fn+source.slice(end);
}

function patchRegistration(source) {
  if (source.includes("app.post('/api/auth/register'")) return source;
  const marker = "app.use((err,req,res,next)=>{";
  if (!source.includes(marker)) return source;
  const route = `\n// NEW MEMBER REGISTRATION — server-side only, never return password/hash.\napp.post('/api/auth/register', async (req,res)=>{\n  try {\n    const body=req.body||{};\n    const name=String(body.name||'').trim().replace(/[<>]/g,'').slice(0,80);\n    const email=String(body.email||'').trim().toLowerCase();\n    const password=String(body.password||'');\n    const plan=['FREE','PRO','PREMIUM'].includes(String(body.plan||'').toUpperCase())?String(body.plan).toUpperCase():'FREE';\n    if(name.length<2) return res.status(400).json({success:false,error:'Name is required'});\n    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return res.status(400).json({success:false,error:'Valid email is required'});\n    if(password.length<8) return res.status(400).json({success:false,error:'Password must be at least 8 characters'});\n    const key='vtrade-members';\n    const file=path.resolve(__dirname,'data','vtrade-members.json');\n    fs.mkdirSync(path.dirname(file),{recursive:true});\n    let members=[]; try { members=JSON.parse(fs.readFileSync(file,'utf8')); if(!Array.isArray(members))members=[]; } catch(_) {}\n    if(members.some(x=>String(x.email).toLowerCase()===email)) return res.status(409).json({success:false,error:'Email is already registered'});\n    const salt=crypto.randomBytes(16).toString('hex');\n    const passwordHash=crypto.scryptSync(password,salt,64).toString('hex')+':'+salt;\n    const user={id:crypto.randomUUID(),name,email,plan,status:'ACTIVE',createdAt:new Date().toISOString(),passwordHash};\n    members.push(user); fs.writeFileSync(file,JSON.stringify(members,null,2),'utf8');\n    const safe={id:user.id,name:user.name,email:user.email,plan:user.plan,status:user.status,createdAt:user.createdAt};\n    console.log('[AUTH] NEW MEMBER REGISTERED',safe.email,'plan='+safe.plan);\n    if(typeof bot!=='undefined' && bot && typeof TELEGRAM_CHAT_ID!=='undefined' && TELEGRAM_CHAT_ID){\n      bot.sendMessage(TELEGRAM_CHAT_ID,['🆕 *V TRADE AI — NEW MEMBER*','',` +
        `'👤 Name: *'+safe.name+'*','📧 Email: *'+safe.email+'*','📦 Plan: *'+safe.plan+'*','🟢 Status: *ACTIVE*','🕒 Created: *'+safe.createdAt+'*'].join('\\n'),{parse_mode:'Markdown'}).catch(e=>console.error('[TELEGRAM NEW MEMBER]',e.message));\n    }\n    res.status(201).json({success:true,user:safe});\n  } catch(e) { console.error('[AUTH] registration failed:',e.message); res.status(500).json({success:false,error:'Registration temporarily unavailable'}); }\n});\n\n`;
  return source.replace(marker,route+marker);
}

function patchFrontend(source) {
  source = source.replace("const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';", "const fmt=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';");
  source = source.replace("font:14px Segoe UI,Arial,sans-serif", "font:14px 'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  return source;
}

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchExecutionLogic(source);
  source = patchMtfBias(source);
  source = patchTruthGuard(source);
  source = patchWaitCard(source);
  source = patchRegistration(source);
  console.log('[V-TRADE LAUNCHER] production MTF bias + strict ICT authorization active');
  console.log('[V-TRADE LAUNCHER] transparent analyst council + truth guard active');
  console.log('[V-TRADE LAUNCHER] NEW MEMBER registration + Telegram event active');
  mod._compile(source, filename);
};

try {
  if (fs.existsSync(FRONTEND_FILE)) {
    const before=fs.readFileSync(FRONTEND_FILE,'utf8'); const after=patchFrontend(before);
    if(after!==before){fs.writeFileSync(FRONTEND_FILE,after,'utf8');console.log('[V-TRADE LAUNCHER] critical frontend data/i18n fixes applied');}
  }
} catch(e){console.warn('[V-TRADE LAUNCHER] frontend patch skipped:',e.message);}

require('./server.js');
