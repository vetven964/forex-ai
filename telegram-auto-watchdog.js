// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V-TRADE V14 — startup-safe global delivery guard + literal-safe patching
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V14_SAFE';
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

  if (source.indexOf('telegramAutoLastReadinessLog') >= 0) {
    source = source.split('telegramAutoLastReadinessLog').join(READINESS);
    changed = true;
    console.log('[V-TRADE SAFETY] Telegram readiness state normalized to global runtime slot');
  }
  if (source.indexOf("globalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '')") < 0) {
    source = "// " + marker + "\nglobalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '');\n" + source;
    changed = true;
  }

  const stateDefs = [
    ['telegramAutoLastState', "''"],
    ['telegramAutoLastWaitSentAt', '0'],
    ['telegramAutoScanCount', '0']
  ];
  for (const pair of stateDefs) {
    const name = pair[0];
    const value = pair[1];
    const globalName = 'globalThis.__vtrade_' + name;
    if (source.indexOf(globalName) < 0) {
      source = globalName + ' = ' + globalName + ' ?? ' + value + ';\n' + source;
      changed = true;
      console.log('[V-TRADE SAFETY] scanner state restored | missing=' + name);
    }
    const decl = new RegExp('\\b(?:let|const|var)\\s+' + name + '\\s*=\\s*[^;]+;\\n?', 'm');
    if (decl.test(source)) {
      source = source.replace(decl, '');
      changed = true;
    }
    // Only replace bare references; never touch the globalName we just created.
    const ref = new RegExp('(?<![A-Za-z0-9_.$])' + name + '\\b', 'g');
    source = source.replace(ref, globalName);
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
  if (source.indexOf(envNeedle) >= 0 && source.indexOf('const TELEGRAM_AUTO_TOKEN =') < 0) {
    source = source.replace(envNeedle, envPatch);
    changed = true;
  }

  const deliveryMarker = 'VTRADE_TELEGRAM_CONFIRMED_ENTRY_DELIVERY_V4';
  if (source.indexOf(deliveryMarker) < 0) {
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
  if (['M15','M30','H1','H4','D1'].indexOf(tf) >= 0) lines.push('🎯 TP2: *' + fmt(tp2) + '*');
  if (['H1','H4','D1'].indexOf(tf) >= 0) lines.push('🎯 TP3: *' + fmt(tp3) + '*');
  if (Number.isFinite(confidence)) lines.push('🧠 Confidence: *' + Math.max(0, Math.min(100, confidence)).toFixed(0) + '/100*');
  await tg.bot.sendMessage(tg.chatId, lines.join('\\n'), { parse_mode: 'Markdown' });
  console.log('[TELEGRAM AUTO] ENTRY sent | signal=' + signal + ' | tf=' + tf + ' | chat=' + String(tg.chatId).slice(-4));
  return true;
};
`;
    source = deliveryFn + source;
    changed = true;
  }

  const calls = [
    'maybeTelegramAlert(a, tg, sid).catch(e=>console.error(\'Telegram alert:\',e.message));',
    'maybeTelegramAlert(a,tg,sid).catch(e=>console.error(\'Telegram alert:\',e.message));'
  ];
  for (const call of calls) {
    if (source.indexOf(call) >= 0) {
      source = source.split(call).join('globalThis.maybeTelegramAlert(a, tg).catch(e=>console.error(\'Telegram alert:\',e.message));');
      changed = true;
    }
  }

  const analysisCall = 'globalThis.maybeTelegramAlert(a, tg).catch(e=>console.error(\'Telegram alert:\',e.message));';
  // Only remove the call inside /api/analysis/xauusd, not the scanner call.
  const analysisNeedle = "storage.saveAnalysis(a).catch(()=>{});\n    " + analysisCall;
  if (source.indexOf(analysisNeedle) >= 0) {
    source = source.split(analysisNeedle).join("storage.saveAnalysis(a).catch(()=>{});\n    console.log('[V-TRADE TELEGRAM] analysis route is delivery-independent | no alert sent');");
    changed = true;
  }

  const zoneLine = "const ZONE_ALERT_ENABLED = String(process.env.ZONE_ALERT_ENABLED || 'true').toLowerCase() === 'true';";
  if (source.indexOf(zoneLine) >= 0) {
    source = source.replace(zoneLine, "const ZONE_ALERT_ENABLED = false; // ENTRY-ONLY");
    changed = true;
  }
  const newsLine = "const TELEGRAM_NEWS_ALERTS = String(process.env.TELEGRAM_NEWS_ALERTS || 'true').toLowerCase() === 'true';";
  if (source.indexOf(newsLine) >= 0) {
    source = source.replace(newsLine, "const TELEGRAM_NEWS_ALERTS = false; // ENTRY-ONLY");
    changed = true;
  }

  if (source.indexOf(marker) < 0) {
    source = '// ' + marker + '\n' + source;
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
