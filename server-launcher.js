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
  const pdAnchor = "  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  if (!source.includes(pdAnchor)) {
    console.warn('[V-TRADE PATCH] premium/discount anchor not found');
    return source;
  }

  const pdPatch = pdAnchor;
  source = source.replace(pdAnchor, pdPatch);

  // IMPORTANT: retestOk and atr are declared in this scope immediately before this
  // anchor. Keep the limit-zone calculation after those declarations so the launcher
  // cannot introduce a temporal-dead-zone or undefined-variable runtime error.
  const retestAnchor = "  const retestOk=inZone;";
  const retestPatch = `${retestAnchor}\n  // A valid bullish discount FVG/OB may be staged as LIMIT while live price is premium.\n  // A valid bearish premium FVG/OB may be staged as LIMIT while live price is discount.\n  const zoneMid = zone ? (Number(zone.low) + Number(zone.high)) / 2 : NaN;\n  const zonePremiumDiscount = Number.isFinite(zoneMid) ? (zoneMid > mid ? 'PREMIUM' : 'DISCOUNT') : 'UNKNOWN';\n  const zonePdOk = side==='BULLISH' ? zonePremiumDiscount==='DISCOUNT' : side==='BEARISH' ? zonePremiumDiscount==='PREMIUM' : false;\n  const limitZoneReady=!!zone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(zone.high)<live.price)||(side==='BEARISH'&&Number(zone.low)>live.price))&&zoneDistance(live.price,zone)<=Math.max(atr*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;`;
  if (!source.includes(retestAnchor)) {
    console.warn('[V-TRADE PATCH] retest anchor not found');
    return source;
  }
  source = source.replace(retestAnchor, retestPatch);

  const setupAnchor = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);";
  const setupPatch = "  const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);";
  if (source.includes(setupAnchor)) source = source.replace(setupAnchor, setupPatch);

  const reasonAnchor = "  if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);";
  const reasonPatch = "  if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);";
  if (source.includes(reasonAnchor)) source = source.replace(reasonAnchor, reasonPatch);

  const confirmAnchor = "premiumDiscountOk:pdOk";
  if (source.includes(confirmAnchor)) source = source.replace(confirmAnchor, "premiumDiscountOk:executionLocationOk");
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
