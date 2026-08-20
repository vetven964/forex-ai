// V-TRADE AI — deterministic Telegram scanner state finalizer
// Runs BEFORE telegram-auto-watchdog.js so the server source is normalized
// before the launcher compiles it.
'use strict';
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const GLOBAL = 'globalThis.__vtradeTelegramAutoReadinessLog';

function finalizeTelegramState() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  const before = source;

  source = source.replace(/\btelegramAutoLastReadinessLog\b/g, GLOBAL);
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

try {
  require('./logic-v4-bridge').install();
  console.log('[V-TRADE LOGIC V4] startup bridge installed');
} catch (e) {
  console.error('[V-TRADE LOGIC V4] startup bridge failed:', e.stack || e.message);
  throw e;
}

require('./telegram-auto-watchdog.js');
