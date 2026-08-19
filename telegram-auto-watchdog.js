// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V11 — isolated confirmed-entry delivery + safe scanner startup
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V11_ENTRY_ONLY';
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

  // Define the scanner's delivery function in one place. It is deliberately
  // entry-only: WAIT, zone, news, bias and score never trigger Telegram.
  const deliveryMarker = 'VTRADE_TELEGRAM_CONFIRMED_ENTRY_DELIVERY_V1';
  if (!source.includes(deliveryMarker)) {
    const deliveryFn = `
// ${deliveryMarker}
async function maybeTelegramAlert(a, tg, sid) {
  const signal = String(a?.signal || '').toUpperCase();
  const status = String(a?.status || '').toUpperCase();
  const confirmed = ['BUY','SELL'].includes(signal) &&
    status.includes('ENTRY CONFIRMED') &&
    a?.confirmations?.allGatesPassed === true &&
    Number.isFinite(Number(a?.entry));
  if (!confirmed) return false;

  const botRef = telegramAutoBot || tg?.bot || null;
  const chatRef = TELEGRAM_AUTO_CHAT_ID || tg?.chatId || '';
  if (!botRef || !chatRef) {
    console.warn('[TELEGRAM AUTO] confirmed entry ready but delivery is not configured');
    return false;
  }

  const tf = String(a?.executionTimeframe || a?.timeframe || 'M5').toUpperCase();
  const tfMin = tf === 'M5' ? 5 : tf === 'M15' ? 15 : tf === 'M30' ? 30 : tf === 'H1' ? 60 : tf === 'H4' ? 240 : tf === 'D1' ? 1440 : 5;
  const zone = a?.zone ?? a?.executionZone ?? a?.entryZone ?? a?.entry;
  const sl = a?.stopLoss ?? a?.sl ?? a?.stop_loss;
  const tps = Array.isArray(a?.takeProfit) ? a.takeProfit.filter(Number.isFinite).map(Number) : [];
  const tp1 = a?.tp1 ?? tps[0];
  const tp2 = a?.tp2 ?? tps[1];
  const tp3 = a?.tp3 ?? tps[2];
  const confidence = Number(a?.confidence);
  const fmt = v => Number.isFinite(Number(v)) ? Number(v).toFixed(2) : 'WAIT';

  const lines = [
    '🤖 *V TRADE AI — XAUUSD*',
    '',
    signal === 'BUY' ? '🟢 *BUY*' : '🔴 *SELL*',
    `⏱️ TF: *${tf}*`,
    `📍 Zone: *${typeof zone === 'object' ? (zone.low ?? zone.from ?? '') + ' — ' + (zone.high ?? zone.to ?? '') : fmt(zone)}*`,
    `🎯 Entry: *${fmt(a.entry)}*`,
    `🛑 SL: *${fmt(sl)}*`,
    `🎯 TP1: *${fmt(tp1)}*`
  ];
  if (tfMin >= 15) lines.push(`🎯 TP2: *${fmt(tp2)}*`);
  if (tfMin >= 60) lines.push(`🎯 TP3: *${fmt(tp3)}*`);
  if (Number.isFinite(confidence)) lines.push(`🧠 Confidence: *${Math.max(0, Math.min(100, confidence)).toFixed(0)}/100*`);

  await botRef.sendMessage(chatRef, lines.join('\\n'), { parse_mode: 'Markdown' });
  console.log(`[TELEGRAM AUTO] ENTRY sent | signal=${signal} | tf=${tf} | chat=${String(chatRef).slice(-4)}`);
  return true;
}
`;
    source = deliveryFn + source;
    changed = true;
  }

  // Analysis endpoint must never be responsible for Telegram delivery.
  const analysisAlertCall = /\n\s*maybeTelegramAlert\(a, tg, sid\)\.catch\(e=>console\.error\('Telegram alert:',e\.message\)\);/;
  if (analysisAlertCall.test(source)) {
    source = source.replace(analysisAlertCall, '\n    console.log(\'[V-TRADE TELEGRAM] analysis route is delivery-independent | no alert sent\');');
    changed = true;
    console.log('[V-TRADE SAFETY] removed Telegram delivery from /api/analysis/xauusd');
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
