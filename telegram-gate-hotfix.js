// V-TRADE AI — Telegram gate hotfix
// This wrapper runs before the existing startup hotfix and makes the Telegram
// policy deterministic: WAIT is dashboard-only unless explicitly enabled.
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const ENABLE_WAIT = String(process.env.TELEGRAM_WAIT_ALERTS_ENABLED || 'false').toLowerCase() === 'true';

try {
  let source = fs.readFileSync(SERVER_FILE, 'utf8');

  // Expose one explicit server-side policy flag.
  if (!source.includes('const TELEGRAM_WAIT_ALERTS_ENABLED =')) {
    const marker = "const TELEGRAM_SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.TELEGRAM_SESSION_TTL_MS || 24 * 60 * 60 * 1000));";
    if (source.includes(marker)) {
      source = source.replace(marker, `${marker}\nconst TELEGRAM_WAIT_ALERTS_ENABLED = String(process.env.TELEGRAM_WAIT_ALERTS_ENABLED || 'false').toLowerCase() === 'true';`, 1);
    }
  }

  // The current engine has a WAIT-alert block. Gate it by the explicit flag.
  // Default=false prevents WAIT spam and ensures Telegram is reserved for
  // confirmed actionable BUY/SELL signals.
  const waitBlock = /if\s*\(\s*!sent\s*&&\s*a\.signal\s*===\s*'WAIT'\s*&&/m;
  if (waitBlock.test(source) && !source.includes('TELEGRAM_WAIT_ALERTS_ENABLED && !sent')) {
    source = source.replace(waitBlock, "if (TELEGRAM_WAIT_ALERTS_ENABLED && !sent && a.signal === 'WAIT' &&", 1);
  }

  fs.writeFileSync(SERVER_FILE, source, 'utf8');
  console.log(`[V-TRADE TELEGRAM HOTFIX] WAIT alerts ${ENABLE_WAIT ? 'ENABLED' : 'DISABLED'} by policy`);
} catch (err) {
  console.error('[V-TRADE TELEGRAM HOTFIX] failed:', err.message);
  process.exitCode = 1;
}

require('./startup-logic-hotfix.js');
