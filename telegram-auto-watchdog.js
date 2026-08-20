// V-TRADE AI — Telegram Auto Scanner watchdog / startup hotfix
// V-TRADE V16 — confirmed-entry delivery guard + directional execution + target-spacing validation
'use strict';
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = 'VTRADE_TELEGRAM_AUTO_WATCHDOG_V16_SAFE';
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
    source = "// VTRADE_TELEGRAM_AUTO_WATCHDOG_V16_SAFE\nglobalThis.__vtradeTelegramAutoReadinessLog = String(globalThis.__vtradeTelegramAutoReadinessLog || '');\n" + source;
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

  const deliveryMarker = 'VTRADE_TELEGRAM_CONFIRMED_ENTRY_DELIVERY_V6';
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

  // FINAL EXECUTION SAFETY GATE: never send a trade whose geometry or target spacing is invalid.
  const tf = String(a.executionTimeframe || a.timeframe || '').trim().toUpperCase();
  const entry = Number(a.entry);
  const sl = Number(a.stopLoss != null ? a.stopLoss : (a.sl != null ? a.sl : a.stop_loss));
  const tps = Array.isArray(a.takeProfit) ? a.takeProfit : [];
  const tp1 = Number(a.tp1 != null ? a.tp1 : tps[0]);
  const tp2 = a.tp2 != null ? Number(a.tp2) : (Number.isFinite(Number(tps[1])) ? Number(tps[1]) : NaN);
  const tp3 = a.tp3 != null ? Number(a.tp3) : (Number.isFinite(Number(tps[2])) ? Number(tps[2]) : NaN);
  const risk = Math.abs(entry - sl);
  const finiteTargets = Number.isFinite(entry) && Number.isFinite(sl) && Number.isFinite(tp1) && Number.isFinite(tp2) && Number.isFinite(tp3) && risk > 0;
  const geometryValid = tf !== '' && tf !== '—' && tf !== '-' && finiteTargets &&
    (signal === 'BUY'
      ? (sl < entry && entry < tp1 && tp1 < tp2 && tp2 < tp3)
      : (sl > entry && entry > tp1 && tp1 > tp2 && tp2 > tp3));
  const targetSpacingValid = finiteTargets &&
    (signal === 'BUY'
      ? (tp1 >= entry + risk && tp2 >= entry + risk * 1.5 && tp3 >= entry + risk * 2)
      : (tp1 <= entry - risk && tp2 <= entry - risk * 1.5 && tp3 <= entry - risk * 2));
  const rr = risk > 0 ? Math.abs(tp1 - entry) / risk : 0;
  if (!geometryValid || !targetSpacingValid || !Number.isFinite(rr) || rr < 1.3) {
    console.warn('[TELEGRAM AUTO] BLOCKED invalid execution geometry/spacing | signal=' + signal +
      ' | tf=' + (tf || 'MISSING') + ' | entry=' + entry + ' | sl=' + sl +
      ' | tp1=' + tp1 + ' | tp2=' + tp2 + ' | tp3=' + tp3 +
      ' | rr=' + rr.toFixed(2));
    return false;
  }

  if (!tg || !tg.bot || !tg.chatId) {
    console.warn('[TELEGRAM AUTO] confirmed valid entry ready but delivery is not configured');
    return false;
  }
  const confidence = Number(a.confidence);
  const fmt = function(v) { return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : 'WAIT'; };
  const lines = [
    '🤖 *V TRADE AI — XAUUSD*',
    '',
    signal === 'BUY' ? '🟢 *BUY*' : '🔴 *SELL*',
    '⏱️ TF: *' + tf + '*',
    '🎯 Entry: *' + fmt(entry) + '*',
    '🛑 SL: *' + fmt(sl) + '*',
    '🎯 TP1: *' + fmt(tp1) + '*',
    '🎯 TP2: *' + fmt(tp2) + '*',
    '🎯 TP3: *' + fmt(tp3) + '*'
  ];
  if (Number.isFinite(confidence)) lines.push('🧠 Confidence: *' + Math.max(0, Math.min(100, confidence)).toFixed(0) + '/100*');
  await tg.bot.sendMessage(tg.chatId, lines.join('\\n'), { parse_mode: 'Markdown' });
  console.log('[TELEGRAM AUTO] VALID ENTRY sent | signal=' + signal + ' | tf=' + tf + ' | rr=' + rr.toFixed(2) + ' | chat=' + String(tg.chatId).slice(-4));
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
