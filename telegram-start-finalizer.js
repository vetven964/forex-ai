// V-TRADE AI — deterministic Telegram scanner state finalizer
// Runs BEFORE telegram-auto-watchdog.js so the server source is normalized
// before the launcher compiles it.
'use strict';
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const OLD = 'telegramAutoLastReadinessLog';
const GLOBAL = 'globalThis.__vtradeTelegramAutoLastReadinessLog';

function finalizeTelegramState() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  const before = source;

  // Use a global runtime slot instead of a fragile lexical variable. This avoids
  // startup-order/loader-scope failures when launcher patches server.js in memory.
  source = source.replace(/\\btelegramAutoLastReadinessLog\\b/g, GLOBAL);
  if (!source.includes(`globalThis.__vtradeTelegramAutoReadinessLog = ''`)) {
    source = `// VTRADE_TELEGRAM_GLOBAL_STATE_FINALIZER_V1\nglobalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '');\n${source}`;
  }

  if (source !== before) {
    fs.writeFileSync(serverFile, source, 'utf8');
    console.log('[V-TRADE SAFETY] Telegram readiness state normalized to global runtime slot');
  } else {
    console.log('[V-TRADE SAFETY] Telegram readiness global state already normalized');
  }
}

finalizeTelegramState();
require('./telegram-auto-watchdog.js');
