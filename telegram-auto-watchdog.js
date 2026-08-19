// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V12 — startup-safe global delivery guard + strict entry-only Telegram
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V12_STARTUP_SAFE';
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

  // Deterministic readiness state. Never rely on launcher patch order.
  if (/\btelegramAutoLastReadinessLog\b/.test(source)) {
    source = source.replace(/\btelegramAutoLastReadinessLog\b/g, READINESS);
    changed = true;
    console.log('[V-TRADE SAFETY] Telegram readiness state normalized to global runtime slot');
  }
  if (!source.includes("globalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '')")) {
    source = "// " + marker + "\nglobalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '');\n" + source;
    changed = true;
  }

  // Scanner state is global so repeated launcher patches cannot redeclare let/const.
  const stateDefs = [
    ['telegramAutoLastState', "''"],
    ['telegramAutoLastWaitSentAt', '0'],
    ['telegramAutoScanCount', '0']
  ];
  for (const pair of stateDefs) {
    const name = pair[0];
    const value = pair[1];
    const globalName = 'globalThis.__vtrade_' + name;
    if (!source.includes(globalName)) {
      source = globalName + ' = ' + globalName + ' ?? ' + value + ';\n' + source;
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

  // Dedicated auto bot credentials. These are separate from the user-session bot.
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

  // One global, dependency-light delivery function. It only accepts confirmed BUY/SELL.
  // Using globalThis avoids the CommonJS module-scope problem that caused
  // "maybeTelegramAlert is not defined" in the scanner.
  const deliveryMarker = 'VTRADE_TELEGRAM_CONFIRMED_ENTRY_DELIVERY_V2';
  if (!source.includes(deliveryMarker)) {
    const deliveryFn = `
// ${deliveryMarker}
globalThis.maybeTelegramAlert = async function(a, tg) {
  const signal = String(a && a.signal || '').toUpperCase();
  const status = String(a && a.status || '').toUpperCase();
  const confirmed = (signal === 'BUY' || signal === 'SELL') &&
    status.indexOf('ENTRY CONFIRMED') >= 0 &&
    a && a.confirmations && a.confirmations.allGatesPassed === true &&
    Number.isFinite(Number(a.entry));
  if (!confirmed) return false;
  if (!tg || !tg.bot || !tg.chatId) {
    console.warn('[TELEGRAM AUTO] confirmed entry ready but delivery is not configured');
    return false;
  }

  const tf = String(a.executionTimeframe || a.timeframe || 'M5').toUpperCase();
  const sl = a.stopLoss != null ? a.stopLoss : (a.sl != null ? a.sl : a.stop_loss);
  const tps = Array.isArray(a.takeProfit) ? a.takeProfit : [];
  const tp1 = a.tp1 != null ? a.tp1 : tps[0];
  const tp2 = a.tp2 != null ? a.tp2 : tps[1];
  const tp3 = a.tp3 != null ? a.tp3 : tps[2];
  const confidence = Number(a.confidence);
  const fmt = function(v) { return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : 'WAIT'; };

  const lines = [
    '🤖 *V TRADE AI — XAUUSD*',
    '',
    signal === 'BUY' ? '🟢 *BUY*' : '🔴 *SELL*',
    '⏱️ TF: *' + tf + '*',
    '🎯 Entry: *' + fmt(a.entry) + '*',
    '🛑 SL: *' + fmt(sl) + '*',
    '🎯 TP1: *' + fmt(tp1) + '*'
  ];
  if (tf === 'M15' || tf === 'M30' || tf === 'H1' || tf === 'H4' || tf === 'D1') lines.push('🎯 TP2: *' + fmt(tp2) + '*');
  if (tf === 'H1' || tf === 'H4' || tf === 'D1') lines.push('🎯 TP3: *' + fmt(tp3) + '*');
  if (Number.isFinite(confidence)) lines.push('🧠 Confidence: *' + Math.max(0, Math.min(100, confidence)).toFixed(0) + '/100*');

  await tg.bot.sendMessage(tg.chatId, lines.join('\\n'), { parse_mode: 'Markdown' });
  console.log('[TELEGRAM AUTO] ENTRY sent | signal=' + signal + ' | tf=' + tf + ' | chat=' + String(tg.chatId).slice(-4));
  return true;
};
`;
    source = deliveryFn + source;
    changed = true;
  }

  // Route every existing scanner call through the global function.
  const directCall = /(?<![.$])\\bmaybeTelegramAlert\\(/g;
  const before = source;
  source = source.replace(directCall, 'globalThis.maybeTelegramAlert(');
  if (source !== before) changed = true;

  // The HTTP analysis endpoint must not send Telegram as a side effect.
  const analysisCall = /\\n\\s*globalThis\\.maybeTelegramAlert\\(a, tg, sid\\)\\.catch\\(e=>console\\.error\\('Telegram alert:',e\\.message\\)\\);/;
  if (analysisCall.test(source)) {
    source = source.replace(analysisCall, "\n    console.log('[V-TRADE TELEGRAM] analysis route is delivery-independent | no alert sent');");
    changed = true;
    console.log('[V-TRADE SAFETY] removed Telegram delivery from /api/analysis/xauusd');
  }

  // Entry-only policy: no WAIT/ZONE/NEWS auto messages.
  const zonePattern = /const ZONE_ALERT_ENABLED = String\\(process\\.env\\.ZONE_ALERT_ENABLED \\|\\| 'true'\\)\\.toLowerCase\\(\\) === 'true';/;
  if (zonePattern.test(source)) {
    source = source.replace(zonePattern, "const ZONE_ALERT_ENABLED = false; // ENTRY-ONLY");
    changed = true;
  }
  const newsPattern = /const TELEGRAM_NEWS_ALERTS = String\\(process\\.env\\.TELEGRAM_NEWS_ALERTS \\|\\| 'true'\\)\\.toLowerCase\\(\\) === 'true';/;
  if (newsPattern.test(source)) {
    source = source.replace(newsPattern, "const TELEGRAM_NEWS_ALERTS = false; // ENTRY-ONLY");
    changed = true;
  }

  if (!source.includes(marker)) {
    source = "// " + marker + "\n" + source;
    changed = true;
  }

  if (changed) fs.writeFileSync(serverFile, source, 'utf8');
  console.log('[V-TRADE TELEGRAM WATCHDOG] active | scanner=' +
    (String(process.env.TELEGRAM_AUTO_ALERT_ENABLED || 'true').toLowerCase() === 'true') +
    ' | mainBot=' + (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'configured' : 'not-configured') +
    ' | autoBot=' + (process.env.TELEGRAM_AUTO_TOKEN && process.env.TELEGRAM_AUTO_CHAT_ID ? 'configured' : 'NOT_CONFIGURED') +
    ' | first-scan=interval | PreMarket=SEPARATE');
}

patchServer();

if (process.env.VTRADE_WATCHDOG_NO_LAUNCHER !== '1') {
  require('./server-launcher.js');
}
