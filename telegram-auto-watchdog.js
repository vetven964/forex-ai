// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V8 — strict process separation + deterministic startup state
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V8_STARTUP_STATE';

// PRE-MARKET IS ANALYSIS ONLY.
// It may read broker/MT5 analysis, but it must never create/send Telegram messages.
try {
  require('./pre-market-launcher-hook.js');
  console.log('[V-TRADE PROCESS SEPARATION] Pre-Market Zone Analysis hook loaded | Telegram=INDEPENDENT | mode=ANALYSIS_ONLY');
} catch (e) {
  console.error('[V-TRADE PROCESS SEPARATION] Pre-Market hook load failed:', e.stack || e.message);
  throw e;
}

function patchServer() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  let changed = false;

  // Deterministic scanner state: define it before ANY Telegram scanner function can run.
  // This is intentionally inserted near the top of server.js, not conditionally near a legacy marker.
  const startupState = `// ${marker}\n// Telegram auto scanner state is initialized before all routes/timers.\nlet telegramAutoLastReadinessLog = '';\nlet telegramAutoLastState = '';\nlet telegramAutoLastWaitSentAt = 0;\nlet telegramAutoScanCount = 0;\n`;
  const stateDecl = /(?:let|const|var)\s+telegramAutoLastReadinessLog\s*=/.test(source);
  if (!stateDecl) {
    source = startupState + source;
    changed = true;
    console.log('[V-TRADE SAFETY] deterministic Telegram scanner state inserted at server startup');
  } else {
    // If an older patch already declared the state, do not create duplicate const/let declarations.
    console.log('[V-TRADE SAFETY] Telegram scanner state already present');
  }

  // Main Telegram bot remains responsible for commands/admin/user flows.
  // Auto-alert delivery is STRICTLY isolated and does not fall back to the main bot.
  const envNeedle = "const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';";
  const envPatch = `const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
// STRICTLY SEPARATE Telegram Auto-Alert bot/channel.
// No fallback to TELEGRAM_TOKEN/TELEGRAM_CHAT_ID: missing auto credentials disable delivery only.
const TELEGRAM_AUTO_TOKEN = process.env.TELEGRAM_AUTO_TOKEN || '';
const TELEGRAM_AUTO_CHAT_ID = process.env.TELEGRAM_AUTO_CHAT_ID || '';
let telegramAutoBot = null;
try {
  if (TELEGRAM_AUTO_TOKEN) telegramAutoBot = new TelegramBot(TELEGRAM_AUTO_TOKEN, { polling: false });
} catch (e) {
  console.warn('[TELEGRAM AUTO] isolated bot init failed:', e.message);
}
`;
  if (source.includes(envNeedle) && !source.includes('const TELEGRAM_AUTO_TOKEN =')) {
    source = source.replace(envNeedle, envPatch);
    changed = true;
  }

  // Telegram AUTO is ENTRY-ONLY. WAIT/zone/news states remain internal.
  const zonePattern = /const ZONE_ALERT_ENABLED = String\(process\.env\.ZONE_ALERT_ENABLED \|\| 'true'\)\.toLowerCase\(\) === 'true';/;
  if (zonePattern.test(source)) {
    source = source.replace(zonePattern, "const ZONE_ALERT_ENABLED = false; // ENTRY-ONLY: no pre-entry zone alerts");
    changed = true;
  }
  const newsPattern = /const TELEGRAM_NEWS_ALERTS = String\(process\.env\.TELEGRAM_NEWS_ALERTS \|\| 'true'\)\.toLowerCase\(\) === 'true';/;
  if (newsPattern.test(source)) {
    source = source.replace(newsPattern, "const TELEGRAM_NEWS_ALERTS = false; // ENTRY-ONLY: no news alerts");
    changed = true;
  }

  // Remove legacy automatic WAIT/state-change broadcasts. WAIT stays internal to the engine.
  const waitStart = source.indexOf('// Auto mode also sends a state-change WAIT update');
  const waitEnd = source.indexOf('// State logging is also stable:', waitStart);
  if (waitStart >= 0 && waitEnd > waitStart) {
    source = source.slice(0, waitStart) + source.slice(waitEnd);
    changed = true;
  }

  const replacements = [
    ["if (!TELEGRAM_AUTO_ALERT_ENABLED || !bot || !TELEGRAM_CHAT_ID || telegramAutoAlertRunning) return;", "if (!TELEGRAM_AUTO_ALERT_ENABLED || telegramAutoAlertRunning) return;"],
    ["  telegramAutoAlertRunning = true;\n  try {\n    const r=telegramAutoReadinessSnapshot();", "  telegramAutoAlertRunning = true;\n  const telegramDeliveryReady = !!telegramAutoBot && !!TELEGRAM_AUTO_CHAT_ID;\n  try {\n    const r=telegramAutoReadinessSnapshot();\n    if (!telegramDeliveryReady) console.warn('[TELEGRAM AUTO] delivery disabled | scanner remains active | configure TELEGRAM_AUTO_TOKEN + TELEGRAM_AUTO_CHAT_ID');"],
    ["    const tg = { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO' , session: false };", "    const tg = telegramDeliveryReady ? { bot:telegramAutoBot, chatId:TELEGRAM_AUTO_CHAT_ID, botUsername:'AUTO_ALERT', session:false } : null;"],
    ["    const tg = { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO', session: false };", "    const tg = telegramDeliveryReady ? { bot:telegramAutoBot, chatId:TELEGRAM_AUTO_CHAT_ID, botUsername:'AUTO_ALERT', session:false } : null;"],
    ["    const a = await buildXauAnalysis();", "    telegramAutoScanCount += 1;\n    console.log(`[TELEGRAM AUTO] Scan start | count=${telegramAutoScanCount} | delivery=${telegramDeliveryReady?'READY':'NOT_CONFIGURED'}`);\n\n    const a = await buildXauAnalysis();"],
    ["  await tg.bot.sendMessage(tg.chatId, waitText);", "  if (tg) {\n    await tg.bot.sendMessage(tg.chatId, waitText);\n  } else {\n    console.log('[TELEGRAM AUTO] WAIT alert not sent | isolated delivery not configured');\n  }"]
  ];

  for (const [from, to] of replacements) {
    if (source.includes(from) && !source.includes(to)) {
      source = source.replace(from, to);
      changed = true;
    }
  }

  // Never allow an eager scan to run before MT5 readiness has been established.
  const oldTrigger = /\n\/\/ Trigger one scan shortly after startup;[\s\S]*?\n\}, 3000\);\n?/;
  if (oldTrigger.test(source)) {
    source = source.replace(oldTrigger, '\n');
    changed = true;
  }

  if (!source.includes(marker)) {
    source = `// ${marker}\n${source}`;
    changed = true;
  }

  if (changed) fs.writeFileSync(serverFile, source, 'utf8');
  console.log(`[V-TRADE TELEGRAM WATCHDOG] active | scanner=${String(process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'true').toLowerCase()==='true'} | mainBot=${process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'configured' : 'not-configured'} | autoBot=${process.env.TELEGRAM_AUTO_TOKEN && process.env.TELEGRAM_AUTO_CHAT_ID ? 'configured' : 'NOT_CONFIGURED'} | first-scan=interval | PreMarket=SEPARATE`);
}

patchServer();

// When called from server-launcher.js this module is an initializer only.
// Standalone execution keeps the historical launcher behavior.
if (process.env.VTRADE_WATCHDOG_NO_LAUNCHER !== '1') {
  require('./server-launcher.js');
}
