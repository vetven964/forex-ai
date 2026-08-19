// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V2';

function patchServer() {
  if (!fs.existsSync(serverFile)) throw new Error('server.js not found');
  let source = fs.readFileSync(serverFile, 'utf8');
  let changed = false;

  const replacements = [
    ["if (!TELEGRAM_AUTO_ALERT_ENABLED || !bot || !TELEGRAM_CHAT_ID || telegramAutoAlertRunning) return;", "if (!TELEGRAM_AUTO_ALERT_ENABLED || telegramAutoAlertRunning) return;"],
    ["  telegramAutoAlertRunning = true;\n  try {\n    const r=telegramAutoReadinessSnapshot();", "  telegramAutoAlertRunning = true;\n  const telegramDeliveryReady = !!bot && !!TELEGRAM_CHAT_ID;\n  try {\n    const r=telegramAutoReadinessSnapshot();\n    if (!telegramDeliveryReady) console.warn('[TELEGRAM AUTO] Delivery not configured | scanner continues | set TELEGRAM_TOKEN + TELEGRAM_CHAT_ID in Render Environment');"],
    ["    const tg = { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO' , session: false };", "    const tg = telegramDeliveryReady ? { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_AUTO', session: false } : null;"],
    ["let telegramAutoLastWaitSentAt = 0;", "let telegramAutoLastWaitSentAt = 0;\nlet telegramAutoScanCount = 0;"],
    ["    const a = await buildXauAnalysis();", "    telegramAutoScanCount += 1;\n    console.log(`[TELEGRAM AUTO] Scan start | count=${telegramAutoScanCount} | delivery=${telegramDeliveryReady?'READY':'NOT_CONFIGURED'}`);\n\n    const a = await buildXauAnalysis();"],
    ["  await tg.bot.sendMessage(tg.chatId, waitText);", "  if (tg) {\n    await tg.bot.sendMessage(tg.chatId, waitText);\n  } else {\n    console.log('[TELEGRAM AUTO] WAIT alert not sent | delivery not configured');\n  }"]
  ];

  for (const [from, to] of replacements) {
    if (source.includes(from) && !source.includes(to)) {
      source = source.replace(from, to);
      changed = true;
    }
  }

  // Add an independent first-scan trigger after the server has loaded.
  const triggerMarker = 'VTRADE_TELEGRAM_FIRST_SCAN_V2';
  if (!source.includes(triggerMarker)) {
    source = `// ${triggerMarker}\n${source}\n\n// Trigger one scan shortly after startup; do not depend on Telegram delivery credentials.\nsetTimeout(() => {\n  try {\n    if (typeof telegramAutoAlertTick === 'function') {\n      console.log('[TELEGRAM AUTO] First-scan trigger | scanner startup');\n      telegramAutoAlertTick();\n    } else {\n      console.warn('[TELEGRAM AUTO] First-scan trigger unavailable | telegramAutoAlertTick not exposed');\n    }\n  } catch (e) {\n    console.error('[TELEGRAM AUTO] First-scan trigger ERROR |', e.message);\n  }\n}, 3000);\n`;
    changed = true;
  }

  if (!source.includes(marker)) {
    source = `// ${marker}\n` + source;
    changed = true;
  }

  if (changed) fs.writeFileSync(serverFile, source, 'utf8');
  console.log(`[V-TRADE TELEGRAM WATCHDOG] active | scanner=${String(process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'true').toLowerCase()==='true'} | delivery=${process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'configured' : 'not-configured'} | first-scan=true`);
}

patchServer();
require('./server-launcher.js');
