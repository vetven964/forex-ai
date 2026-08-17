const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalLoader = Module._extensions['.js'];

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);

  let source = fs.readFileSync(filename, 'utf8');

  source = source.replace(
    /const\s+CORE_MTF_TFS\s*=\s*\[[^\]]*\]\s*;/,
    "const CORE_MTF_TFS = ['H4','H1','M15'];"
  );
  source = source.replace(
    /const\s+FULL_MTF_TFS\s*=\s*\[[^\]]*\]\s*;/,
    "const FULL_MTF_TFS = ['D1','H4','H1','M15','M5','M1'];"
  );

  const advancedWait = [
    'function telegramWaitText(a) {',
    '  const price = Number(a?.price);',
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
    "  const quoteAgeValue = a?.quoteAge ?? a?.quote_age ?? a?.feedAgeSec;",
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

  source = source.replace(
    /function\s+telegramWaitText\s*\(a\)\s*\{[\s\S]*?\n\}\s*\n\s*function\s+telegramMtfText/,
    advancedWait + 'function telegramMtfText'
  );

  console.log('[V-TRADE LAUNCHER] clean server source formatter active');
  console.log('[V-TRADE LAUNCHER] Advanced ICT WAIT card formatter installed');
  mod._compile(source, filename);
};

require('./server.js');
