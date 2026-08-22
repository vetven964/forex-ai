// V-TRADE runtime safety lock
// Loaded before server.js so Render dashboard env cannot re-enable legacy Telegram Auto.
'use strict';

process.env.TELEGRAM_AUTO_ALERT_ENABLED = 'false';
process.env.TELEGRAM_AUTO_TOKEN = '';
process.env.TELEGRAM_AUTO_CHAT_ID = '';
process.env.TELEGRAM_AUTO_ALERT_INTERVAL_MS = '0';

console.log('[V-TRADE TELEGRAM SEPARATION] LEGACY CORE TELEGRAM AUTO = HARD DISABLED');
