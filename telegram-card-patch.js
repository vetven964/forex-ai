// V-TRADE AI Telegram card boundary patch.
// Loaded before the app so every node-telegram-bot-api sendMessage call is normalized.
const Module = require('module');
const originalLoad = Module._load;

function normalizeWait(text) {
  if (typeof text !== 'string' || !text.includes('V TRADE AI — XAUUSD WAIT')) return text;
  if (text.includes('ADVANCED ICT SIGNAL')) return text;

  const pick = (label, fallback = '—') => {
    const m = text.match(new RegExp(label + ': \\*([^*]*)\\*'));
    return m ? m[1].trim() : fallback;
  };
  const price = pick('Price');
  const bias = pick('Bias', 'NEUTRAL');
  const directionScore = pick('Direction Score', '0/100');
  const confidence = pick('Confidence', '0/100');
  const status = pick('Status', 'WAIT — NO ENTRY');
  const aiConfirm = pick('AI Confirm', 'WAIT');
  const ai = text.match(/AI Confirm: \\*[^*]*\\* \\| Confidence: \\*([^*]*)\\* \\| Agreement: \\*([^*]*)\\*/);
  const aiConfidence = ai ? ai[1].trim() : '0/100';
  const agreement = ai ? ai[2].trim() : 'NEUTRAL';
  const broker = text.match(/Broker: \\*([^*]*)\\* \\| Quote age: \\*([^*]*)\\*/);
  const brokerName = broker ? broker[1].trim() : 'VT Markets MT5';
  const quoteAge = broker ? broker[2].trim() : '—';
  const blocked = [];
  const waiting = text.split('Waiting for:')[1]?.split('⚠️')[0] || '';
  for (const line of waiting.split(/\\n|\n/)) {
    const s = line.replace(/^\\s*•\\s*/, '').trim();
    if (s) blocked.push(s);
  }
  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';
  const gates = [
    ['💧 Liquidity Sweep', blocked.some(x => /liquidity sweep/i.test(x)) ? '❌ NOT CONFIRMED' : '✅ CONFIRMED'],
    ['📐 M5 MSS', blocked.some(x => /M5 MSS(?!\\/BOS)/i.test(x)) ? '❌ NOT CONFIRMED' : '✅ CONFIRMED'],
    ['💥 Displacement', blocked.some(x => /displacement/i.test(x)) ? '❌ NOT CONFIRMED' : '✅ CONFIRMED'],
    ['🏗️ M5 MSS/BOS', blocked.some(x => /MSS\\/BOS/i.test(x)) ? '❌ NOT CONFIRMED' : '✅ CONFIRMED'],
    ['📍 Execution', /premium/i.test(text) ? '⏳ WAIT FOR DISCOUNT' : '⏳ WAITING']
  ];
  return `🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\n\n` +
    `📊 Asset: *XAU/USD (Gold)*\n` +
    `💰 Price: *${price}*\n` +
    `⚡ Action: *${action}*\n` +
    `📈 Bias: *${bias}* | Direction Score: *${directionScore}* | Confidence: *${confidence}*\n\n` +
    `🔎 *ICT ENTRY GATES*\n` + gates.map(([k,v]) => `${k}: *${v}*`).join('\n') + `\n\n` +
    `🤖 AI Confirm: *${aiConfirm}* | Confidence: *${aiConfidence}* | Agreement: *${agreement}*\n\n` +
    `🎯 Entry Zone: *WAITING FOR CONFIRMATION*\n` +
    `🛑 Stop Loss (SL): *—*\n` +
    `🎯 TP1: *—*\n` +
    `🎯 TP2: *—*\n` +
    `🎯 TP3: *—*\n\n` +
    `⚡ Status: *WAIT — NO ORDER AUTHORIZED*\n` +
    `⏳ ${status}\n\n` +
    `🏦 Broker: *${brokerName}* | Quote age: *${quoteAge}s*\n` +
    `🔒 *WAIT only — no order is authorized until all entry gates pass.*`;
}

Module._load = function(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  if (request === 'node-telegram-bot-api' && exported && exported.prototype && !exported.prototype.__vtradeCardPatch) {
    const originalSendMessage = exported.prototype.sendMessage;
    exported.prototype.sendMessage = function(chatId, text, options, ...rest) {
      return originalSendMessage.call(this, chatId, normalizeWait(text), options, ...rest);
    };
    exported.prototype.__vtradeCardPatch = true;
    console.log('[TELEGRAM CARD] WAIT formatter boundary patch active');
  }
  return exported;
};
