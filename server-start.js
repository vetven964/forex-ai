// V-TRADE AI canonical Render startup entrypoint.
// Keep runtime hotfixes, but do not install the legacy Telegram Auto watchdog
// when the runtime safety lock explicitly disables the legacy scanner.
require('./server-runtime-hotfix.js');

const legacyTelegramAutoEnabled = String(process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'false').toLowerCase() === 'true';
if (legacyTelegramAutoEnabled) {
  require('./telegram-auto-watchdog.js');
  console.log('[V-TRADE TELEGRAM SEPARATION] legacy Telegram watchdog enabled by explicit opt-in');
} else {
  console.log('[V-TRADE TELEGRAM SEPARATION] legacy Telegram watchdog SKIPPED | core Telegram Auto disabled');
}
