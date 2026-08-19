// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// Purpose: never let missing Telegram credentials silently disable the analysis scan.
// The scanner still runs and logs Scan OK; actual Telegram delivery requires
// TELEGRAM_TOKEN + TELEGRAM_CHAT_ID (or a user Telegram session for manual sends).
'use strict';
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V1';

function patchServer() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  let changed = false;

  // The old guard returned before buildXauAnalysis() whenever the owner-level
  // Telegram env bot/chat was not configured. That made MT5 appear healthy while
  // the actual auto-analysis loop silently stopped. Keep delivery optional, but
  // never disable the scanner itself.
  const oldGuard = "if (!TELEGRAM_AUTO_ALERT_ENABLED || !bot || !TELEGRAM_CHAT_ID || telegramAutoAlertRunning) return;";
  const newGuard = "if (!TELEGRAM_AUTO_ALERT_ENABLED || telegramAutoAlertRunning) return;";
  if (source.includes(oldGuard)) {
    source = source.replace(oldGuard, newGuard);
    changed = true;
  }

  const oldStart = "  telegramAutoAlertRunning = true;\n  try {\n    const r=telegramAutoReadinessSnapshot();";
  const newStart = "  telegramAutoAlertRunning = true;\n  const telegramDeliveryReady = !!bot && !!TELEGRAM_CHAT_ID;\n  try {\n    const r=telegramAutoReadinessSnapshot();\n    if (!telegramDeliveryReady) {\n      console.warn('[TELEGRAM AUTO] Delivery not configured | scanner continues | set TELEGRAM_TOKEN + TELEGRAM_CHAT_ID in Render Environment');\n    }";
  if (source.includes(oldStart)) {
    source = source.replace(oldStart, newStart);
    changed = true;
  }

  // Avoid calling Telegram methods when env delivery is absent. Analysis and
  // state logging continue, while maybeTelegramAlert safely returns false.
  const oldTg = "    const tg = { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO' , session: false };";
  const newTg = "    const tg = telegramDeliveryReady ? { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO', session: false } : null;";
  if (source.includes(oldTg)) {
    source = source.replace(oldTg, newTg);
    changed = true;
  }

  // Make the scan loop observable even when state does not change. This is a
  // heartbeat only; it does not send a Telegram message and does not alter signal logic.
  const markerNeedle = "let telegramAutoLastWaitSentAt = 0;";
  const markerInsert = "let telegramAutoLastWaitSentAt = 0;\nlet telegramAutoScanCount = 0;";
  if (source.includes(markerNeedle) && !source.includes('let telegramAutoScanCount = 0;')) {
    source = source.replace(markerNeedle, markerInsert);
    changed = true;
  }

  const scanNeedle = "    const a = await buildXauAnalysis();";
  const scanInsert = "    telegramAutoScanCount += 1;\n    console.log(`[TELEGRAM AUTO] Scan start | count=${telegramAutoScanCount} | delivery=${telegramDeliveryReady?'READY':'NOT_CONFIGURED'}`);\n\n    const a = await buildXauAnalysis();";
  if (source.includes(scanNeedle) && !source.includes('[TELEGRAM AUTO] Scan start | count=')) {
    source = source.replace(scanNeedle, scanInsert);
    changed = true;
  }

  if (!source.includes(marker)) {
    source = `// ${marker}\n` + source;
    changed = true;
  }

  if (changed) fs.writeFileSync(serverFile, source, 'utf8');
  console.log(`[V-TRADE TELEGRAM WATCHDOG] active | scanner=${TELEGRAM_AUTO_ALERT_ENABLED_VALUE()} | delivery=${process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'configured' : 'not-configured'}`);
}

function TELEGRAM_AUTO_ALERT_ENABLED_VALUE() {
  return String(process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'true').toLowerCase() === 'true';
}

patchServer();

// Continue through the normal production launcher after the source patch is installed.
require('./server-launcher.js');
