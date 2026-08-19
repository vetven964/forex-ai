// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V9 — strict process separation + safe deterministic startup state
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V9_STARTUP_STATE';

// PRE-MARKET IS ANALYSIS ONLY.
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

  // Define each scanner state variable only when it does not already exist.
  // This prevents both "not defined" and duplicate let/const declarations.
  const stateDefs = [
    ['telegramAutoLastReadinessLog', "''"],
    ['telegramAutoLastState', "''"],
    ['telegramAutoLastWaitSentAt', '0'],
    ['telegramAutoScanCount', '0']
  ];
  const missingDefs = stateDefs.filter(([name]) => !new RegExp('\\b(?:let|const|var)\\s+' + name + '\\s*=').test(source));
  if (missingDefs.length) {
    const block = `// ${marker}\n// Telegram auto scanner state is initialized before routes/timers.\n${missingDefs.map(([name, value]) => `let ${name} = ${value};`).join('\n')}\n`;
    source = block + source;
    changed = true;
    console.log('[V-TRADE SAFETY] scanner state restored | missing=' + missingDefs.map(x => x[0]).join(','));
  }

  // Main Telegram bot remains responsible for commands/admin/user flows.
  // Auto-alert delivery is strictly isolated from the main bot.
  const envNeedle = "const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';";
  const envPatch = `const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
// STRICTLY SEPARATE Telegram Auto-Alert bot/channel.
// Missing auto credentials disable delivery only; scanner remains alive.
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

  // ENTRY-ONLY: WAIT/zone/news remain internal and never become Telegram alerts.
  const zonePattern = /const ZONE_ALERT_ENABLED = String\(process\.env\.ZONE_ALERT_ENABLED \|\| 'true'\)\.toLowerCase\(\) === 'true';/;
  if (zonePattern.test(source)) {
    source = source.replace(zonePattern, "const ZONE_ALERT_ENABLED = false; // ENTRY-ONLY");
    changed = true;
  }
  const newsPattern = /const TELEGRAM_NEWS_ALERTS = String\(process\.env\.TELEGRAM_NEWS_ALERTS \|\| 'true'\)\.toLowerCase\(\) === 'true';/;
  if (newsPattern.test(source)) {
    source = source.replace(newsPattern, "const TELEGRAM_NEWS_ALERTS = false; // ENTRY-ONLY");
    changed = true;
  }

  // Remove legacy automatic WAIT/state-change broadcasts.
  const waitStart = source.indexOf('// Auto mode also sends a state-change WAIT update');
  const waitEnd = source.indexOf('// State logging is also stable:', waitStart);
  if (waitStart >= 0 && waitEnd > waitStart) {
    source = source.slice(0, waitStart) + source.slice(waitEnd);
    changed = true;
  }

  const replacements = [
    ["if (!TELEGRAM_AUTO_ALERT_ENABLED || !bot || !TELEGRAM_CHAT_ID || telegramAutoAlertRunning) return;", "if (!TELEGRAM_AUTO_ALERT_ENABLED || telegramAutoAlertRunning) return;"],
    ["  telegramAutoAlertRunning = true;\n  try {\n    const r=telegramAutoReadinessSnapshot();", "  telegramAutoAlertRunning = true;\n  const telegramDeliveryReady = !!telegramAutoBot && !!TELEGRAM_AUTO_CHAT_ID;\n  try {\n    const r=telegramAutoReadinessSnapshot();\n    if (!telegramDeliveryReady) console.warn('[TELEGRAM AUTO] delivery disabled | scanner active | configure TELEGRAM_AUTO_TOKEN + TELEGRAM_AUTO_CHAT_ID');"],
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

  // No eager scan: normal interval starts after MT5 readiness checks.
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

if (process.env.VTRADE_WATCHDOG_NO_LAUNCHER !== '1') {
  require('./server-launcher.js');
}
