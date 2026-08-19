// V-TRADE AI — Telegram auto scanner runtime fix
// Runs before the existing diagnostic hotfix and makes the auto scanner independent
// from the main Telegram bot. It also removes the fragile lexical readiness-state bug.
'use strict';

const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');

function patchServer() {
  if (!fs.existsSync(SERVER_FILE)) throw new Error('server.js not found');
  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  let changed = false;

  // Auto-alert bot is deliberately separate from the main Telegram bot.
  const envNeedle = "const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';";
  if (source.includes(envNeedle) && !source.includes('const TELEGRAM_AUTO_TOKEN = process.env.TELEGRAM_AUTO_TOKEN')) {
    source = source.replace(envNeedle, `${envNeedle}\n// Dedicated Telegram auto-alert bot. Never fall back to the main bot.\nconst TELEGRAM_AUTO_TOKEN = process.env.TELEGRAM_AUTO_TOKEN || '';\nconst TELEGRAM_AUTO_CHAT_ID = process.env.TELEGRAM_AUTO_CHAT_ID || '';\nlet telegramAutoBot = null;\ntry {\n  if (TELEGRAM_AUTO_TOKEN) telegramAutoBot = new TelegramBot(TELEGRAM_AUTO_TOKEN, { polling: false });\n} catch (e) {\n  console.warn('[TELEGRAM AUTO] isolated bot init failed:', e.message);\n}`);
    changed = true;
  }

  // Remove the fragile lexical state variables. Store them on globalThis so no
  // startup patch/loader can accidentally leave the scanner with an undefined name.
  source = source.replace("let telegramAutoLastReadinessLog = '';\n", "");
  source = source.replace("let telegramAutoLastState = '';\n", "");
  if (source.includes('telegramAutoLastReadinessLog')) {
    source = source.replace(/\btelegramAutoLastReadinessLog\b/g, 'globalThis.__vtradeTelegramAutoLastReadinessLog');
    changed = true;
  }
  if (source.includes('telegramAutoLastState')) {
    source = source.replace(/\btelegramAutoLastState\b/g, 'globalThis.__vtradeTelegramAutoLastState');
    changed = true;
  }

  // Initialize global state once.
  const stateAnchor = 'async function runTelegramAutoAlertScan() {';
  if (source.includes(stateAnchor) && !source.includes('__vtradeTelegramAutoStateInit')) {
    source = source.replace(stateAnchor, `if (!globalThis.__vtradeTelegramAutoStateInit) {\n  globalThis.__vtradeTelegramAutoLastReadinessLog = '';\n  globalThis.__vtradeTelegramAutoLastState = '';\n  globalThis.__vtradeTelegramAutoStateInit = true;\n}\n\n${stateAnchor}`);
    changed = true;
  }

  // Scanner must use the dedicated auto bot, not TELEGRAM_TOKEN/TELEGRAM_CHAT_ID.
  source = source.replace(
    "if (!TELEGRAM_AUTO_ALERT_ENABLED || !bot || !TELEGRAM_CHAT_ID || telegramAutoAlertRunning) return;",
    "if (!TELEGRAM_AUTO_ALERT_ENABLED || !telegramAutoBot || !TELEGRAM_AUTO_CHAT_ID || telegramAutoAlertRunning) return;"
  );
  source = source.replace(
    "const tg = { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO' , session: false };",
    "const tg = { bot: telegramAutoBot, chatId: TELEGRAM_AUTO_CHAT_ID, botUsername: 'AUTO_ALERT', session: false };"
  );

  // The startup gate must also accept the dedicated auto-alert credentials.
  source = source.replace(
    "if (TELEGRAM_AUTO_ALERT_ENABLED && bot && TELEGRAM_CHAT_ID) {",
    "if (TELEGRAM_AUTO_ALERT_ENABLED && telegramAutoBot && TELEGRAM_AUTO_CHAT_ID) {"
  );

  // If auto credentials are missing, keep the service alive and log the exact reason.
  source = source.replace(
    "console.log('[TELEGRAM AUTO] Disabled or Telegram env credentials missing');",
    "console.log('[TELEGRAM AUTO] Disabled or dedicated auto credentials missing (TELEGRAM_AUTO_TOKEN / TELEGRAM_AUTO_CHAT_ID)');"
  );

  if (changed) fs.writeFileSync(SERVER_FILE, source, 'utf8');
  console.log('[V-TRADE TELEGRAM FIX] isolated auto bot + global scanner state patch active');
}

patchServer();

// Keep the existing entry-only / account / MTF launcher stack.
require('./ai-telegram-diagnostic-hotfix.js');
