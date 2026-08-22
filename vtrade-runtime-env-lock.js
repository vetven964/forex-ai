// V-TRADE runtime safety lock
// Loaded before server.js so legacy/core Telegram behavior cannot override
// the dedicated Telegram Auto runtime credentials configured in Render.
'use strict';

// Keep the dedicated Auto scanner enabled when explicitly configured.
// Do NOT erase Render's TELEGRAM_AUTO_TOKEN / TELEGRAM_AUTO_CHAT_ID values.
process.env.TELEGRAM_AUTO_ALERT_ENABLED = String(
  process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'true'
).toLowerCase() === 'true' ? 'true' : 'false';

process.env.TELEGRAM_AUTO_TOKEN = String(
  process.env.TELEGRAM_AUTO_TOKEN || process.env.TELEGRAM_TOKEN || ''
).trim();

process.env.TELEGRAM_AUTO_CHAT_ID = String(
  process.env.TELEGRAM_AUTO_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ''
).trim();

process.env.TELEGRAM_AUTO_ALERT_INTERVAL_MS = String(
  Math.max(30000, Number(process.env.TELEGRAM_AUTO_ALERT_INTERVAL_MS || 60000))
);

// Compatibility alias for older scanner code that still reads the old
// readiness variable. This prevents a first-scan ReferenceError while the
// canonical global readiness state remains available to newer code.
if (typeof globalThis.telegramAutoLastReadinessLog === 'undefined') {
  globalThis.telegramAutoLastReadinessLog = '';
}
if (typeof globalThis.__vtradeTelegramAutoReadinessLog === 'undefined') {
  globalThis.__vtradeTelegramAutoReadinessLog = '';
}

console.log(
  '[V-TRADE TELEGRAM SEPARATION] Auto runtime preserved | enabled=' +
  (process.env.TELEGRAM_AUTO_ALERT_ENABLED === 'true') +
  ' | token=' + (process.env.TELEGRAM_AUTO_TOKEN ? 'configured' : 'missing') +
  ' | chat=' + (process.env.TELEGRAM_AUTO_CHAT_ID ? 'configured' : 'missing')
);
