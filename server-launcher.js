// V-TRADE AI production launcher
// Keeps Render and `npm start` on one startup path and installs the Telegram
// WAIT-card formatter before server.js is compiled.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalLoader = Module._extensions['.js'];

function patchWaitCard(source) {
  const advancedWait = [
    'function telegramWaitText(a) {',
    '  const price = Number(a?.price ?? a?.livePrice ?? a?.bid);',
    "  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();",
    '  const directionScore = Number(a?.directionScore ?? a?.aiScore ?? 0);',
    '  const confidence = Number(a?.confidence ?? a?.score?.confidence ?? 0);',
    "  const blocked = Array.isArray(a?.score?.blockedReasons) ? a.score.blockedReasons.slice(0, 8).map(String) : [];",
    "  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';",
    '  const ai = a?.aiConfirmation || a?.ai || null;',
    "  const aiDecision = String(ai?.decision || a?.aiDecision || 'WAIT').toUpperCase();",
    '  const aiConfidence = Number(ai?.confidence ?? a?.aiConfidence ?? 0);',
    "  const agreement = String(ai?.agreement || a?.aiAgreement || 'NEUTRAL').toUpperCase();",
    "  const broker = String(a?.broker || 'VT Markets MT5');",
    "  const quoteAgeValue = a?.quoteAge ?? a?.quote_age ?? a?.feedAgeSec ?? a?.priceAgeSec;",
    "  const quoteAge = Number.isFinite(Number(quoteAgeValue)) ? Number(quoteAgeValue) : 0;",
    "  const zone = a?.entryZone || a?.executionZone || null;",
    "  const entryZone = zone && Number.isFinite(Number(zone.low)) && Number.isFinite(Number(zone.high)) ? `${Number(zone.low).toFixed(2)} — ${Number(zone.high).toFixed(2)}` : 'WAITING FOR CONFIRMATION';",
    "  const gateLine = blocked.length ? blocked.map(x => '• ' + x).join('\\n') : '• Entry gates not confirmed';",
    '  return [',
    "    '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*',",
    "    '',",
    "    '📊 Asset: *XAU/USD (Gold)*',",
    "    '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "    '⚡ Action: *' + action + '*',",
    "    '',",
    "    '📈 Bias: *' + bias + '*',",
    "    '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "    '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*',",
    "    '',",
    "    '🔎 *ICT ENTRY GATES*',",
    '    gateLine,',
    "    '',",
    "    '🎯 Entry Zone: *' + entryZone + '*',",
    "    '🛑 Stop Loss (SL): *—*',",
    "    '🎯 Take Profit 1 (TP1): *—*',",
    "    '🎯 Take Profit 2 (TP2): *—*',",
    "    '🎯 Take Profit 3 (TP3): *—*',",
    "    '',",
    "    '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "    '⚡ Status: *WAIT — NO ORDER AUTHORIZED*',",
    "    '',",
    "    '🔒 WAIT only — no order is authorized until all entry gates pass.',",
    "    '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'",
    "  ].join('\\n');",
    '}',
    ''
  ].join('\n');

  const pattern = /function\s+telegramWaitText\s*\(a\)\s*\{[\s\S]*?\n\}\s*\n\s*function\s+telegramMtfText/;
  if (!pattern.test(source)) {
    console.warn('[V-TRADE LAUNCHER] telegramWaitText() boundary not found; server source left unchanged');
    return source;
  }
  return source.replace(pattern, advancedWait + 'function telegramMtfText');
}

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);

  let source = fs.readFileSync(filename, 'utf8');
  source = patchWaitCard(source);
  console.log('[V-TRADE LAUNCHER] production source patch active');
  mod._compile(source, filename);
};

require('./server.js');
