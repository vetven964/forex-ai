// V-TRADE AI Telegram WAIT card boundary patch.
// Loaded before the app so every node-telegram-bot-api sendMessage call is normalized.
const Module = require('module');
const originalLoad = Module._load;

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
  console.log('[TELEGRAM CARD] WAIT formatter boundary patch active');
}

Module._load = function(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  if (request === 'node-telegram-bot-api') patchTelegramBot(exported);
  return exported;
};
