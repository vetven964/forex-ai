// V-TRADE AI — Telegram WAIT formatter safety hotfix V2
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const AI_RUNTIME_FILE = path.resolve(__dirname, 'ai-confirmation-runtime-v2.js');
const MARKER = '// V-TRADE TELEGRAM WAIT FALLBACK HOTFIX V2';

try {
  // Patch the active Telegram formatter before server-launcher loads it.
  // Keep all ICT/scoring logic internal; Telegram only receives trader-facing fields.
  if (fs.existsSync(AI_RUNTIME_FILE)) {
    let ai = fs.readFileSync(AI_RUNTIME_FILE, 'utf8');
    const before = ai;
    if (!ai.includes('VTRADE_TELEGRAM_PRICE_FIELD_V1')) {
      ai = ai.replace(
        "  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();",
        "  // VTRADE_TELEGRAM_PRICE_FIELD_V1\n  const price=n(a?.livePrice ?? a?.price ?? a?.bid ?? a?.ask);\n  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();"
      );
      ai = ai.replace(
        "  return ['🤖 *V TRADE AI — XAUUSD*','', '*'+action+'*',",
        "  return ['🤖 *V TRADE AI — XAUUSD*','', '💰 Price: *'+price+'*', '*'+action+'*',"
      );
      ai = ai.replace(
        "  return ['🤖 *V TRADE AI — XAUUSD*','', '*'+action+'*','📍 Zone: *'+zone+'*',",
        "  return ['🤖 *V TRADE AI — XAUUSD*','', '💰 Price: *'+price+'*', '*'+action+'*','📍 Zone: *'+zone+'*',"
      );
      if (ai !== before) fs.writeFileSync(AI_RUNTIME_FILE, ai, 'utf8');
    }
  }

  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  if (!source.includes(MARKER)) {
    const needle = "function telegramText(a) {";
    const idx = source.indexOf(needle);
    if (idx >= 0) {
      const fallback = `// ${MARKER}\nfunction telegramWaitText(a) {\n  try {\n    if (typeof telegramText === 'function') return telegramText(a);\n  } catch (_) {}\n  const price = Number(a?.livePrice ?? a?.price ?? a?.bid ?? a?.ask);\n  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();\n  const p = Number.isFinite(price) ? price.toFixed(2) : '—';\n  return '🤖 *V TRADE AI — XAUUSD*\\n\\n' +\n    '💰 Price: *'+p+'*\\n' +\n    '⚡ Action: *🟡 WAIT — '+(bias === 'BULLISH' ? 'BUY BIAS' : bias === 'BEARISH' ? 'SELL BIAS' : 'NO BIAS')+'*\\n\\n' +\n    '📍 Zone: *WAIT*\\n🎯 Entry: *WAIT*\\n🛑 SL: *WAIT*\\n🎯 TP1: *WAIT*\\n🎯 TP2: *WAIT*\\n🎯 TP3: *WAIT*';\n}\n\n`;
      source = source.slice(0, idx) + fallback + source.slice(idx);
      fs.writeFileSync(SERVER_FILE, source, 'utf8');
      console.log('[V-TRADE TELEGRAM] WAIT formatter fallback V2 installed');
    }
  }
} catch (e) {
  console.error('[V-TRADE TELEGRAM] fallback V2 failed:', e.message);
  process.exitCode = 1;
}

require('./server-launcher.js');
