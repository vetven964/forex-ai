// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V10 — strict process separation + deterministic global startup state
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V10_GLOBAL_STATE';
const READINESS = 'globalThis.__vtradeTelegramAutoReadinessLog';

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

  // Never depend on a lexical variable affected by launcher patch order.
  if (/\btelegramAutoLastReadinessLog\b/.test(source)) {
    source = source.replace(/\btelegramAutoLastReadinessLog\b/g, READINESS);
    changed = true;
    console.log('[V-TRADE SAFETY] Telegram readiness state normalized to global runtime slot');
  }
  if (!source.includes("globalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '')")) {
    source = `// ${marker}\nglobalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '');\n${source}`;
    changed = true;
  }

  // Other scanner state uses global slots to prevent duplicate declarations.
  const stateDefs = [
    ['telegramAutoLastState', "''"],
    ['telegramAutoLastWaitSentAt', '0'],
    ['telegramAutoScanCount', '0']
  ];
  for (const [name, value] of stateDefs) {
    const globalName = `globalThis.__vtrade_${name}`;
    if (!source.includes(globalName)) {
      source = `${globalName} = ${globalName} ?? ${value};\n` + source;
      changed = true;
      console.log('[V-TRADE SAFETY] scanner state restored | missing=' + name);
    }
    const lexical = new RegExp('\\b(?:let|const|var)\\s+' + name + '\\s*=');
    if (lexical.test(source)) {
      source = source.replace(new RegExp('\\b(?:let|const|var)\\s+' + name + '\\s*=\\s*[^;]+;\\n?', ''), '');
      changed = true;
    }
    source = source.replace(new RegExp('(?<![.$])\\b' + name + '\\b', 'g'), globalName);
  }

  const envNeedle = "const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';";
  const envPatch = `const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
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
    ["    const a = await buildXauAnalysis();", "    globalThis.__vtrade_telegramAutoScanCount += 1;\n    console.log(`[TELEGRAM AUTO] Scan start | count=${globalThis.__vtrade_telegramAutoScanCount} | delivery=${telegramDeliveryReady?'READY':'NOT_CONFIGURED'}`);\n\n    const a = await buildXauAnalysis();"]
  ];
  for (const [from, to] of replacements) {
    if (source.includes(from) && !source.includes(to)) {
      source = source.replace(from, to);
      changed = true;
    }
  }

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
