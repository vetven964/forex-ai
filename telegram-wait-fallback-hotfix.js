// V-TRADE AI — Telegram WAIT formatter safety hotfix
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const MARKER = '// V-TRADE TELEGRAM WAIT FALLBACK HOTFIX V1';

try {
  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  if (!source.includes(MARKER)) {
    const needle = "function telegramText(a) {";
    const idx = source.indexOf(needle);
    if (idx >= 0) {
      const fallback = `// V-TRADE TELEGRAM WAIT FALLBACK HOTFIX V1\nfunction telegramWaitText(a) {\n  try {\n    if (typeof telegramText === 'function') return telegramText(a);\n  } catch (_) {}\n  const price = Number(a?.livePrice ?? a?.price ?? a?.bid ?? a?.ask);\n  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();\n  const score = Number(a?.directionScore ?? a?.score?.directionScore ?? a?.score ?? 0);\n  const confidence = Number(a?.confidence ?? a?.score?.confidence ?? 0);\n  const p = Number.isFinite(price) ? price.toFixed(2) : '—';\n  return '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\\n\\n' +\n    '📊 Asset: *XAU/USD (Gold)*\\n' +\n    \`💰 Price: *\${p}*\\n⚡ Action: *🟡 WAIT — \${bias === 'BULLISH' ? 'BUY BIAS' : bias === 'BEARISH' ? 'SELL BIAS' : 'NO BIAS'}*\\n\` +\n    \`📈 Bias: *\${bias}*\\n📊 Direction Score: *\${score}/100*\\n🧠 Confidence: *\${confidence}/100*\\n\\n\` +\n    '🟡 *STATUS*\\n*WAIT — NO ORDER AUTHORIZED*\\n\\n' +\n    '🔐 *TRUTH GUARD*\\nEntry gates + risk/data checks must pass before BUY/SELL authorization.';\n}\n\n`;
      source = source.slice(0, idx) + fallback + source.slice(idx);
      fs.writeFileSync(SERVER_FILE, source, 'utf8');
      console.log('[V-TRADE TELEGRAM] WAIT formatter fallback installed');
    } else {
      console.warn('[V-TRADE TELEGRAM] telegramText marker not found; fallback not injected');
    }
  } else {
    console.log('[V-TRADE TELEGRAM] WAIT formatter fallback already installed');
  }
} catch (e) {
  console.error('[V-TRADE TELEGRAM] fallback hotfix failed:', e.message);
  process.exitCode = 1;
}

require('./server-launcher.js');
