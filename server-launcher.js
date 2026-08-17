// V-TRADE AI production launcher
// One startup path for Render + npm start.
// The launcher only normalizes Telegram WAIT output; trading/ICT gates stay in server.js.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalLoader = Module._extensions['.js'];

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
    "    '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*',",
    "    '',",
    "    '📊 Asset: *XAU/USD (Gold)*',",
    "    '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "    '⚡ Action: *' + action + '*',",
    "    '🧭 Phase: *' + phase + '*',",
    "    '',",
    "    '📈 Bias: *' + bias + '*',",
    "    '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "    '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*',",
    "    '',",
    "    '🔎 *ICT ENTRY GATES*',",
    '    gateLine,',
    "    '',",
    "    '🎯 Execution Zone: *' + entryZone + '*',",
    "    '🟢 Entry: *WAIT — gate confirmation required*',",
    "    '🛑 Stop Loss (SL): *WAIT*',",
    "    '🎯 TP1: *WAIT*',",
    "    '🎯 TP2: *WAIT*',",
    "    '🎯 TP3: *WAIT*',",
    "    '',",
    "    '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "    '⚡ Status: *WAIT — NO ORDER AUTHORIZED*',",
    "    '',",
    "    '🔒 No order until all required ICT execution gates pass.',",
    "    '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'",
    "  ].join('\\n');",
    '}',
    ''
  ].join('\n');

  // Replace the complete WAIT formatter without depending on the next function name.
  // This is intentionally broad so older server.js formatter variants cannot survive.
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
  source = patchWaitCard(source);
  console.log('[V-TRADE LAUNCHER] production WAIT-card logic active');
  mod._compile(source, filename);
};

require('./server.js');
