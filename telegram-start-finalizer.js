// V-TRADE AI — deterministic Telegram scanner state finalizer
// Normalizes Telegram readiness state without starting the legacy watchdog.
'use strict';
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const GLOBAL = 'globalThis.__vtradeTelegramAutoReadinessLog';
const MARKER = 'VTRADE_TELEGRAM_GLOBAL_STATE_FINALIZER_V4';

function finalizeTelegramState() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  const before = source;

  source = source.replace(
    /\b(?:let|const|var)\s+globalThis\.__vtradeTelegramAutoReadinessLog\s*=\s*([^;]*);/g,
    `${GLOBAL} = $1;`
  );
  source = source.replace(
    /\b(?:let|const|var)\s+telegramAutoLastReadinessLog\s*=\s*([^;]*);/g,
    `${GLOBAL} = $1;`
  );
  source = source.replace(/\btelegramAutoLastReadinessLog\b/g, GLOBAL);

  if (!source.includes(`${GLOBAL} =`)) {
    source = `${GLOBAL} = String(${GLOBAL} || '');\n${source}`;
  }
  if (!source.includes(MARKER)) source = `// ${MARKER}\n${source}`;

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

// IMPORTANT: the legacy Telegram watchdog is intentionally NOT required here.
// Telegram delivery remains entry-only through the canonical Telegram service.
console.log('[V-TRADE TELEGRAM SEPARATION] legacy Telegram watchdog NOT loaded by finalizer');
