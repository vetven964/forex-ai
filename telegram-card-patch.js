// V-TRADE AI Telegram WAIT card boundary patch.
// Patches the real telegramWaitText() source before server.js is compiled.
const Module = require('module');
const path = require('path');
const fs = require('fs');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalJsLoader = Module._extensions['.js'];

function formatPrice(n) {
  return Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—';
}

function valueFromLine(text, label, fallback = '—') {
  const line = String(text || '').split(/\r?\n/).find(x => x.trimStart().startsWith(label + ':'));
  if (!line) return fallback;
  const value = line.slice(line.indexOf(':') + 1).trim();
  const star = value.match(/^\*([^*]*)\*/);
  return star && star[1] != null ? String(star[1]).trim() : (value || fallback);
}

function normalizeWait(text) {
  if (typeof text !== 'string' || !text.includes('V TRADE AI — XAUUSD WAIT')) return text;
  if (text.includes('ADVANCED ICT SIGNAL')) return text;

  const price = valueFromLine(text, 'Price', '—');
  const bias = String(valueFromLine(text, 'Bias', 'NEUTRAL') || 'NEUTRAL').toUpperCase();
  const directionScore = valueFromLine(text, 'Direction Score', '0/100');
  const confidence = valueFromLine(text, 'Confidence', '0/100');
  const status = valueFromLine(text, 'Status', 'WAIT — NO ENTRY');
  const aiLine = String(text.split(/\r?\n/).find(x => x.includes('AI Confirm:')) || '');
  const aiParts = aiLine.split('|').map(x => x.trim());
  const aiConfirm = ((aiParts[0] || '').split(':').slice(1).join(':').replace(/\*/g, '').trim()) || 'WAIT';
  const aiConfidence = ((aiParts[1] || '').split(':').slice(1).join(':').replace(/\*/g, '').trim()) || '0/100';
  const agreement = ((aiParts[2] || '').split(':').slice(1).join(':').replace(/\*/g, '').trim()) || 'NEUTRAL';
  const brokerLine = String(text.split(/\r?\n/).find(x => x.includes('Broker:')) || '');
  const brokerParts = brokerLine.split('|').map(x => x.trim());
  const brokerName = ((brokerParts[0] || '').split(':').slice(1).join(':').replace(/\*/g, '').trim()) || 'VT Markets MT5';
  const quoteAge = ((brokerParts[1] || '').split(':').slice(1).join(':').replace(/\*/g, '').trim().replace(/s$/i, '')) || '—';
  const waitingIndex = text.indexOf('Waiting for:');
  const blocked = [];
  if (waitingIndex >= 0) {
    const waiting = text.slice(waitingIndex).split('⚠️')[0];
    for (const raw of waiting.split(/\r?\n/)) {
      const s = raw.replace(/^\s*•\s*/, '').replace(/\*/g, '').trim();
      if (s && s !== 'Waiting for:') blocked.push(s);
    }
  }
  const has = pattern => blocked.some(x => pattern.test(x));
  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';
  const gates = [
    ['💧 Liquidity Sweep', has(/liquidity sweep/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['📐 M5 MSS', has(/Fresh M5 MSS not confirmed/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['💥 Displacement', has(/displacement/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['🏗️ M5 MSS/BOS', has(/MSS\/BOS/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['📊 ADX Gate', has(/ADX/i) ? '❌ TOO WEAK' : '⏳ WAITING'],
    ['📍 Execution Zone', /premium/i.test(text) ? '⏳ WAIT FOR DISCOUNT' : '⏳ WAITING']
  ];
  return `🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\n\n` +
    `📊 Asset: *XAU/USD (Gold)*\n` +
    `💰 Price: *${price}*\n` +
    `⚡ Action: *${action}*\n\n` +
    `📈 Bias: *${bias}* | Direction Score: *${directionScore}* | Confidence: *${confidence}*\n\n` +
    `🔎 *ICT ENTRY GATES*\n` + gates.map(([k,v]) => `${k}: *${v}*`).join('\n') + `\n\n` +
    `🤖 AI Confirm: *${aiConfirm}* | Confidence: *${aiConfidence}* | Agreement: *${agreement}*\n\n` +
    `🎯 Entry Zone: *WAITING FOR CONFIRMATION*\n` +
    `🛑 Stop Loss (SL): *—*\n` +
    `🎯 Take Profit 1 (TP1): *—*\n` +
    `🎯 Take Profit 2 (TP2): *—*\n` +
    `🎯 Take Profit 3 (TP3): *—*\n\n` +
    `⚡ Status: *WAIT — NO ORDER AUTHORIZED*\n` +
    `⏳ ${status}\n\n` +
    `🏦 Broker: *${brokerName}* | Quote age: *${quoteAge}s*\n` +
    `🔒 *WAIT only — no order is authorized until all entry gates pass.*`;
}

function patchServerSource(source) {
  const start = source.indexOf('function telegramWaitText(a) {');
  const end = source.indexOf('\nfunction telegramText(a) {', start);
  if (start < 0 || end < 0) {
    console.warn('[TELEGRAM CARD] telegramWaitText() not found in server.js');
    return source;
  }

  const replacement = `function telegramWaitText(a) {
  const price = Number.isFinite(Number(a?.livePrice ?? a?.bid)) ? Number(a.livePrice ?? a.bid).toFixed(2) : '—';
  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();
  const directionScore = Number(a?.directionScore ?? a?.aiScore ?? 0);
  const confidence = Number(a?.confidence ?? 0);
  const status = String(a?.status || 'NO TRADE — confirmation pending');
  const aiDecision = String(a?.aiConfirmation?.decision || 'NOT RUN');
  const aiConfidence = String(a?.aiConfirmation?.confidence ?? '—');
  const aiAgreement = String(a?.aiConfirmation?.agreement || '—');
  const blocked = Array.isArray(a?.score?.blockedReasons) ? a.score.blockedReasons.slice(0, 6).map(String) : [];
  const has = pattern => blocked.some(x => pattern.test(x));
  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';
  const gates = [
    ['💧 Liquidity Sweep', has(/liquidity sweep/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['📐 M5 MSS', has(/Fresh M5 MSS not confirmed/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['💥 Displacement', has(/displacement/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['🏗️ M5 MSS/BOS', has(/MSS\\/BOS/i) ? '❌ NOT CONFIRMED' : '⏳ WAITING'],
    ['📊 ADX Gate', has(/ADX/i) ? '❌ TOO WEAK' : '⏳ WAITING'],
    ['📍 Execution Zone', blocked.some(x => /premium/i.test(x)) ? '⏳ WAIT FOR DISCOUNT' : '⏳ WAITING']
  ];
  return `🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\\n\\n` +
    `📊 Asset: *XAU/USD (Gold)*\\n` +
    `💰 Price: *${price}*\\n` +
    `⚡ Action: *${action}*\\n\\n` +
    `📈 Bias: *${bias}* | Direction Score: *${directionScore}/100* | Confidence: *${confidence}/100*\\n\\n` +
    `🔎 *ICT ENTRY GATES*\\n` + gates.map(([k,v]) => `${k}: *${v}*`).join('\\n') + `\\n\\n` +
    `🤖 AI Confirm: *${aiDecision}* | Confidence: *${aiConfidence}/100* | Agreement: *${aiAgreement}*\\n\\n` +
    `🎯 Entry Zone: *WAITING FOR CONFIRMATION*\\n` +
    `🛑 Stop Loss (SL): *—*\\n` +
    `🎯 Take Profit 1 (TP1): *—*\\n` +
    `🎯 Take Profit 2 (TP2): *—*\\n` +
    `🎯 Take Profit 3 (TP3): *—*\\n\\n` +
    `⚡ Status: *WAIT — NO ORDER AUTHORIZED*\\n` +
    `⏳ ${status}\\n\\n` +
    `🏦 Broker: *VT Markets MT5* | Quote age: *${a?.priceAgeSec ?? '—'}s*\\n` +
    `🔒 *WAIT only — no order is authorized until all entry gates pass.*`;
}
`;
  return source.slice(0, start) + replacement + source.slice(end);
}

Module._extensions['.js'] = function vtradeTelegramSourceLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalJsLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchServerSource(source);
  console.log('[TELEGRAM CARD] server.js WAIT formatter patched at source boundary');
  return mod._compile(source, filename);
};

const originalLoad = Module._load;
function patchTelegramBot(Bot) {
  if (!Bot || !Bot.prototype || Bot.prototype.__vtradeCardPatch) return;
  const originalSendMessage = Bot.prototype.sendMessage;
  if (typeof originalSendMessage !== 'function') return;
  Bot.prototype.sendMessage = function(chatId, text, options, ...rest) {
    const normalized = normalizeWait(text);
    if (normalized !== text) console.log('[TELEGRAM CARD] WAIT message normalized to Advanced ICT format');
    return originalSendMessage.call(this, chatId, normalized, options, ...rest);
  };
  Bot.prototype.__vtradeCardPatch = true;
  console.log('[TELEGRAM CARD] sendMessage fallback patch active');
}
Module._load = function(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  if (request === 'node-telegram-bot-api') patchTelegramBot(exported);
  return exported;
};

console.log('[TELEGRAM CARD] source-level WAIT formatter patch active');
