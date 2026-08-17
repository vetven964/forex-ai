// V-TRADE AI production launcher
// One startup path for Render + npm start.
// Applies a narrow source-boundary patch to the deterministic ICT gate and
// normalizes the Telegram WAIT card. Core trading calculations remain in server.js.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalLoader = Module._extensions['.js'];

function patchExecutionLogic(source) {
  // Current server.js keeps the canonical ICT calculation in buildXauAnalysis().
  // Patch that exact block instead of relying on stale variable names from older builds.
  const gateAnchor = "  const biasOk=(side==='BULLISH'&&coreBull>=MIN_MTF_ALIGNMENT)||(side==='BEARISH'&&coreBear>=MIN_MTF_ALIGNMENT),sweepOk=sweep.bias===side&&sweep.fresh,mssOk=execStruct.mss===side&&execStruct.mssFresh,bosOk=execStruct.bos===side&&execStruct.bosFresh,displacementOk=displacement.confirmed&&displacement.direction===side,retestOk=!!candidateZone&&inZone,zoneNearOk=!!candidateZone&&zoneDistance(live.price,candidateZone)<=Math.max(a*3.5,12),structureAgreement=mssOk||bosOk;";
  const gatePatch = `${gateAnchor}\n  // A valid bullish discount FVG/OB can be staged as a LIMIT below premium price.\n  // A valid bearish premium FVG/OB can be staged as a LIMIT above discount price.\n  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;`;
  if (!source.includes(gateAnchor)) {
    console.warn('[V-TRADE PATCH] current ICT gate anchor not found');
    return source;
  }
  source = source.replace(gateAnchor, gatePatch);

  source = source.replace(
    "{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}",
    "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}"
  );

  const setupAnchor = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const setupPatch = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (source.includes(setupAnchor)) source = source.replace(setupAnchor, setupPatch);

  source = source.replace(
    "  if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');",
    "  if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');"
  );
  source = source.replace(
    "  if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);",
    "  if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);"
  );
  source = source.replace(/premiumDiscountOk:pdOk/g, 'premiumDiscountOk:executionLocationOk');
  return source;
}

function patchWaitCard(source) {
  const advancedWait = [
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
    "  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';",
    "  const premium = blocked.some(x => /PREMIUM/i.test(x));",
    "  const sweep = blocked.some(x => /liquidity sweep/i.test(x));",
    "  const mss = blocked.some(x => /MSS|BOS/i.test(x));",
    "  const displacement = blocked.some(x => /displacement|momentum/i.test(x));",
    "  const fvgob = blocked.some(x => /FVG|OB/i.test(x));",
    "  const phase = premium ? 'PREMIUM — WAIT FOR DISCOUNT' : (sweep || mss || displacement || fvgob) ? 'SETUP FORMING — WAIT FOR CONFIRMATION' : 'WAITING FOR QUALIFIED SETUP';",
    "  const gateLine = blocked.length ? blocked.map(x => '• ' + x).join('\\n') : '• No confirmed entry gate';",
    '  return [',
    "    '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*',", "    '',", "    '📊 Asset: *XAU/USD (Gold)*',",
    "    '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "    '⚡ Action: *' + action + '*',", "    '🧭 Phase: *' + phase + '*',", "    '',",
    "    '📈 Bias: *' + bias + '*',", "    '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "    '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*',", "    '',",
    "    '🔎 *ICT ENTRY GATES*',", '    gateLine,', "    '',",
    "    '🎯 Execution Zone: *' + entryZone + '*',", "    '🟢 Entry: *WAIT — gate confirmation required*',",
    "    '🛑 Stop Loss (SL): *WAIT*',", "    '🎯 TP1: *WAIT*',", "    '🎯 TP2: *WAIT*',", "    '🎯 TP3: *WAIT*',", "    '',",
    "    '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "    '⚡ Status: *WAIT — NO ORDER AUTHORIZED*',", "    '',", "    '🔒 No order until all required ICT execution gates pass.',",
    "    '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'", "  ].join('\\n');", '}', ''
  ].join('\n');
  const pattern = /function\s+telegramWaitText\s*\(a\)\s*\{[\s\S]*?\n\}\s*(?=\n\s*function\s+)/;
  if (!pattern.test(source)) {
    console.warn('[V-TRADE LAUNCHER] telegramWaitText() not found; source unchanged');
    return source;
  }
  return source.replace(pattern, advancedWait);
}

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchExecutionLogic(source);
  source = patchWaitCard(source);
  console.log('[V-TRADE LAUNCHER] production ICT execution policy active');
  console.log('[V-TRADE LAUNCHER] production WAIT-card logic active');
  mod._compile(source, filename);
};

require('./server.js');
