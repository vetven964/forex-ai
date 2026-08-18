// V-TRADE AI production launcher
// One startup path for Render + npm start.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchExecutionLogic(source) {
  if (!/\bconst\s+executionLocationOk\s*=/.test(source) && /\bexecutionLocationOk\b/.test(source)) {
    const firstUse = source.search(/\bexecutionLocationOk\b/);
    if (firstUse >= 0) {
      const declaration = `const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;
  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';
  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;
  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);
  const executionLocationOk=pdOk||limitZoneReady;
  `;
      source = source.slice(0, firstUse) + declaration + source.slice(firstUse);
    }
  }
  const gatePattern = /(const\s+biasOk=[\s\S]*?structureAgreement=mssOk\|\|bosOk;)/;
  if (gatePattern.test(source) && !/\bconst\s+executionLocationOk\s*=/.test(source)) {
    source = source.replace(gatePattern, `$1
  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;
  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';
  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;
  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);
  const executionLocationOk=pdOk||limitZoneReady;`);
  }
  source = source.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}", "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  source = source.replace("const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);", "const setupReady=candlesFresh&&biasOk&&structureAgreement&&sweepOk&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&displacementOk&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);");
  source = source.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');", "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  source = source.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  source = source.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/, '$1executionLocationOk');
  source = source.replace("const selectedOpportunity = safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null;", "const selectedOpportunity = setupReady ? (safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null) : null;");
  source = source.replace(/\s*if \(selectedOpportunity && !setupReady && !newsBlocked\) \{[\s\S]*?\n  \}\n  if \(newsBlocked\)/, "\n  if (newsBlocked)");
  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) {
    source = source.replace(/(const\s+setupReady\s*=.*?;)/, `$1
  const tradeAuthorized=setupReady===true;`);
  }
  source = source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, `$1
    tradeAuthorized,`);
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
  if (!source.includes("require('./analysis-truth')")) {
    source = "const { applyTruthGuard } = require('./analysis-truth');\n" + source;
  }
  const marker = 'async function buildXauAnalysis() {';
  if (source.includes(marker) && !source.includes('async function buildXauAnalysisCore() {')) {
    source = source.replace(marker, `async function buildXauAnalysisCore() {`);
    source = source.replace(`async function buildXauAnalysisCore() {`, `async function buildXauAnalysis() {\n  const base = await buildXauAnalysisCore();\n  return applyTruthGuard(base);\n}\n\nasync function buildXauAnalysisCore() {`);
  }
  source = source.replace("const APP_VERSION = '7.3.1-FEED-STABLE';", "const APP_VERSION = '7.4.0-TRUTH-COUNCIL';");
  return source;
}

function patchWaitCard(source) {
  const waitSource = [
    'function telegramWaitText(a) {',
    "  const price = Number(a?.price ?? a?.livePrice ?? a?.bid);",
    "  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();",
    "  const directionScore = Number(a?.directionScore ?? a?.aiScore ?? 0);",
    "  const confidence = Number(a?.confidence ?? a?.score?.confidence ?? 0);",
    "  const blocked = Array.isArray(a?.score?.blockedReasons) ? a.score.blockedReasons.slice(0, 8).map(String) : [];",
    "  const ai = a?.aiConfirmation || a?.ai || null;",
    "  const aiDecision = String(ai?.decision || a?.aiDecision || 'WAIT').toUpperCase();",
    "  const aiConfidence = Number(ai?.confidence ?? a?.aiConfidence ?? 0);",
    "  const agreement = String(ai?.agreement || a?.aiAgreement || 'NEUTRAL').toUpperCase();",
    "  const broker = String(a?.broker || 'VT Markets MT5');",
    "  const quoteAgeValue = a?.quoteAge ?? a?.quote_age ?? a?.feedAgeSec ?? a?.priceAgeSec;",
    "  const quoteAge = Number.isFinite(Number(quoteAgeValue)) ? Number(quoteAgeValue) : 0;",
    "  const zone = a?.entryZone || a?.executionZone || null;",
    "  const low = Number(zone?.low);",
    "  const high = Number(zone?.high);",
    "  const entryZone = Number.isFinite(low) && Number.isFinite(high) ? `${low.toFixed(2)} — ${high.toFixed(2)}` : 'WAITING FOR CONFIRMATION';",
    "  const authorized = a?.tradeAuthorized === true || (a?.setupReady === true && blocked.length === 0);",
    "  const side = bias === 'BULLISH' ? 'BUY' : bias === 'BEARISH' ? 'SELL' : '';",
    "  if (authorized && side) {",
    "    const entry = Number(a?.entry ?? a?.entryPrice ?? a?.livePrice);",
    "    const sl = Number(a?.sl ?? a?.stopLoss);",
    "    const tp1 = Number(a?.tp1 ?? a?.takeProfit1);",
    "    const tp2 = Number(a?.tp2 ?? a?.takeProfit2);",
    "    const tp3 = Number(a?.tp3 ?? a?.takeProfit3);",
    "    const n = x => Number.isFinite(x) ? x.toFixed(2) : '—';",
    "    return ['🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',",
    "      '📊 Asset: *XAU/USD (Gold)*',",
    "      '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "      '🚨 Action: *' + (side === 'BUY' ? '🟢 BUY — TRADE AUTHORIZED' : '🔴 SELL — TRADE AUTHORIZED') + '*',",
    "      '📈 Bias: *' + bias + '*',",
    "      '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "      '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*','',",
    "      '🎯 Entry: *' + n(entry) + '*',",
    "      '🛑 Stop Loss: *' + n(sl) + '*',",
    "      '🎯 TP1: *' + n(tp1) + '*',",
    "      '🎯 TP2: *' + n(tp2) + '*',",
    "      '🎯 TP3: *' + n(tp3) + '*','',",
    "      '🧠 Council: *' + (a?.analystCouncil?.consensus || 'NEUTRAL') + ' ' + (a?.analystCouncil?.consensusVotes || '0/0') + '* | Confidence: *' + (a?.analystCouncil?.confidence ?? '—') + '/100*',",
    "      '🔎 Verified Win Rate: *' + (a?.truthMetrics?.verifiedWinRate == null ? 'N/A' : a.truthMetrics.verifiedWinRate + '%') + '* | Sample: *' + (a?.truthMetrics?.verifiedSampleSize ?? 0) + '*',",
    "      '🔐 *ORDER AUTHORIZED — TRUTH GUARD PASSED*',",
    "      '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'].join('\\n');",
    "  }",
    "  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';",
    "  const gateLine = blocked.length ? blocked.map(x => '• ' + x).join('\\n') : '• No confirmed entry gate';",
    "  return ['🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',",
    "    '📊 Asset: *XAU/USD (Gold)*',",
    "    '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "    '⚡ Action: *' + action + '*',",
    "    '📈 Bias: *' + bias + '*',",
    "    '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "    '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*','',",
    "    '🔎 *ICT ENTRY GATES*', gateLine,'',",
    "    '🧠 Analyst Council: *' + (a?.analystCouncil?.consensus || 'NEUTRAL') + ' ' + (a?.analystCouncil?.consensusVotes || '0/0') + '* | Confidence: *' + (a?.analystCouncil?.confidence ?? '—') + '/100*',",
    "    '📊 Verified Win Rate: *' + (a?.truthMetrics?.verifiedWinRate == null ? 'N/A' : a.truthMetrics.verifiedWinRate + '%') + '* | Sample: *' + (a?.truthMetrics?.verifiedSampleSize ?? 0) + '*',",
    "    '🎯 Execution Zone: *' + entryZone + '*',",
    "    '🟢 Entry: *WAIT — truth guard confirmation required*',",
    "    '🛑 Stop Loss (SL): *WAIT*','🎯 TP1: *WAIT*','🎯 TP2: *WAIT*','🎯 TP3: *WAIT*','',",
    "    '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "    '⚡ Status: *WAIT — NO ORDER AUTHORIZED*','',",
    "    '🔒 No order until engine gates + analyst council + risk/data checks pass.',",
    "    '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'].join('\\n');",
    "}", ""
  ].join('\n');
  const pattern = /function\s+telegramWaitText\s*\(a\)\s*\{[\s\S]*?\n\}\s*(?=\n\s*function\s+)/;
  if (pattern.test(source)) source = source.replace(pattern, waitSource);
  return source;
}

function patchFrontend(source) {
  source = source.replace("const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';", "const fmt=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';");
  source = source.replace("font:14px Segoe UI,Arial,sans-serif", "font:14px 'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  const oldGate="function gate(label,v,detail=''){return `<div class=\"gate\"><span class=\"dot ${v===true?'pass':'wait'}\"></span><div><b>${label}</b><small>${v===true?'PASS':'WAIT'}${detail?' · '+detail:''}</small></div></div>`}";
  const newGate="function gate(label,v,detail=''){const km=lang==='km';return `<div class=\"gate\"><span class=\"dot ${v===true?'pass':'wait'}\"></span><div><b>${label}</b><small>${v===true?(km?'ជាប់':'PASS'):(km?'រង់ចាំ':'WAIT')}${detail?' · '+detail:''}</small></div></div>`}";
  source = source.replace(oldGate,newGate);
  return source;
}

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchExecutionLogic(source);
  source = patchMtfBias(source);
  source = patchTruthGuard(source);
  source = patchWaitCard(source);
  console.log('[V-TRADE LAUNCHER] production MTF bias + strict ICT authorization active');
  console.log('[V-TRADE LAUNCHER] transparent analyst council + truth guard active');
  console.log('[V-TRADE LAUNCHER] verified win-rate remains N/A until real closed outcomes exist');
  mod._compile(source, filename);
};

try {
  if (fs.existsSync(FRONTEND_FILE)) {
    const before = fs.readFileSync(FRONTEND_FILE, 'utf8');
    const after = patchFrontend(before);
    if (after !== before) {
      fs.writeFileSync(FRONTEND_FILE, after, 'utf8');
      console.log('[V-TRADE LAUNCHER] critical frontend data/i18n fixes applied');
    }
  }
} catch (e) {
  console.warn('[V-TRADE LAUNCHER] frontend patch skipped:', e.message);
}

require('./server.js');
