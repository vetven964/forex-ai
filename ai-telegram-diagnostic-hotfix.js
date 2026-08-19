// V-TRADE AI — Telegram ENTRY-ONLY + isolated backend bootstrap
// Telegram sends only confirmed BUY/SELL entry plans.
// Backend CORS is isolated in backend/cors-runtime.js.
'use strict';

require('./backend/cors-runtime');

const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const LAUNCHER_FILE = path.resolve(__dirname, 'server-launcher.js');
const MARKER = '// V-TRADE AI TELEGRAM ENTRY-ONLY HOTFIX V3';

function redact(value) {
  return String(value || '')
    .replace(/(bot\d+:[A-Za-z0-9_-]+)/g, 'BOT_TOKEN_REDACTED')
    .replace(/(sk-[A-Za-z0-9_-]+)/g, 'OPENAI_KEY_REDACTED')
    .replace(/([?&](?:key|token)=)[^&]+/gi, '$1REDACTED');
}

function patchLauncherSafety() {
  try {
    let source = fs.readFileSync(LAUNCHER_FILE, 'utf8');
    const oldGuard = "if (gatePattern.test(source) && !/\\bconst\\s+executionLocationOk\\s*=/.test(source)) {";
    const newGuard = "if (gatePattern.test(source) && !/\\b(?:const|let|var)\\s+(?:executionLocationOk|zoneMid|limitZoneReady)\\s*=/.test(source)) {";
    if (source.includes(oldGuard)) {
      source = source.replace(oldGuard, newGuard);
      fs.writeFileSync(LAUNCHER_FILE, source, 'utf8');
      console.log('[V-TRADE SAFETY] launcher duplicate-zone guard patched');
    }
  } catch (e) {
    console.warn('[V-TRADE SAFETY] launcher guard skipped:', e.message);
  }
}

function patchTelegramEntryOnly() {
  try {
    let source = fs.readFileSync(SERVER_FILE, 'utf8');

    source = source.replace(
      /const ZONE_ALERT_ENABLED = String\(process\.env\.ZONE_ALERT_ENABLED \|\| 'true'\)\.toLowerCase\(\) === 'true';/,
      "const ZONE_ALERT_ENABLED = false; // ENTRY-ONLY: no pre-entry zone alerts"
    );

    // Delete automatic WAIT/state-change Telegram sends. WAIT remains internal only.
    const waitStart = source.indexOf('// Auto mode also sends a state-change WAIT update');
    const waitEnd = source.indexOf('// State logging is also stable:', waitStart);
    if (waitStart >= 0 && waitEnd > waitStart) {
      source = source.slice(0, waitStart) + source.slice(waitEnd);
    }

    const telegramStart = source.indexOf('function telegramText(a) {');
    if (telegramStart >= 0) {
      const candidates = ['\nfunction telegramButtons(', '\nfunction sendTelegram', '\nfunction maybeTelegramAlert('];
      let telegramEnd = -1;
      for (const marker of candidates) {
        const idx = source.indexOf(marker, telegramStart);
        if (idx >= 0 && (telegramEnd < 0 || idx < telegramEnd)) telegramEnd = idx;
      }
      if (telegramEnd > telegramStart) {
        const formatter = `function telegramText(a) {
  const o = a?.bestOpportunity || {};
  const signal = String(a?.signal || '').toUpperCase();
  const tf = String(a?.executionTimeframe || a?.timeframe || a?.selectedTF || o?.timeframe || '').toUpperCase();
  const confirmed = ['BUY','SELL'].includes(signal)
    && String(a?.status || '').includes('ENTRY CONFIRMED')
    && Number.isFinite(Number(a?.entry))
    && (o?.state === 'CONFIRMED' || a?.confirmations?.allGatesPassed === true || a?.tradeAuthorized === true);
  if (!confirmed) return '';

  const n = v => Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '—';
  const zone = a?.entryZone || o?.entryZone || a?.candidateZone || {};
  const low = Number(zone?.low), high = Number(zone?.high);
  const zoneText = Number.isFinite(low) && Number.isFinite(high) ? n(low) + ' — ' + n(high) : n(a?.entry ?? o?.entry);
  const tp = Array.isArray(a?.takeProfit) ? a.takeProfit : (Array.isArray(o?.takeProfit) ? o.takeProfit : []);
  const minutes = tf === 'M5' ? 5 : tf === 'M15' ? 15 : tf === 'M30' ? 30 : tf === 'H1' ? 60 : tf === 'H4' ? 240 : 5;
  const count = minutes <= 5 ? 1 : minutes < 60 ? 2 : 3;
  const confidenceRaw = Number(a?.confidence ?? o?.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
  const lines = [
    '🤖 *V TRADE AI — XAUUSD*',
    '',
    signal === 'BUY' ? '🟢 *BUY — ENTRY CONFIRMED*' : '🔴 *SELL — ENTRY CONFIRMED*',
    '🧠 Confidence: *' + confidence + '/100*',
    '⏱ TF: *' + (tf || '—') + '*',
    '',
    '📍 Zone: *' + zoneText + '*',
    '🎯 Entry: *' + n(a?.entry ?? o?.entry) + '*',
    '🛑 SL: *' + n(a?.stopLoss ?? o?.stopLoss) + '*'
  ];
  for (let i = 0; i < count; i++) lines.push('🎯 TP' + (i + 1) + ': *' + n(tp[i]) + '*');
  return lines.join('\\n');
}
`;
        source = source.slice(0, telegramStart) + formatter + source.slice(telegramEnd);
      }
    }

    if (!source.includes(MARKER)) source = MARKER + '\n' + source;
    fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE TELEGRAM] ENTRY-ONLY mode active | WAIT/ZONE auto alerts disabled');
    console.log('[V-TRADE TELEGRAM] Telegram message = confirmed BUY/SELL only');
  } catch (e) {
    console.error('[V-TRADE TELEGRAM] ENTRY-ONLY patch failed:', redact(e?.stack || e?.message || e));
    process.exitCode = 1;
  }
}

function patchTelegramRuntimeSafety() {
  try {
    let source = fs.readFileSync(SERVER_FILE, 'utf8');
    let changed = false;

    // The analysis endpoint already sends its JSON response. Never call an undefined
    // Telegram helper afterwards and then try to send a second 503 response.
    const badCall = /\n\s*maybeTelegramAlert\(a, tg, sid\)\.catch\(e=>console\.error\('Telegram alert:',e\.message\)\);/;
    if (badCall.test(source)) {
      source = source.replace(badCall, "\n    // ENTRY-ONLY: analysis requests never broadcast Telegram alerts.\n    // Telegram auto scanner is the single delivery path for confirmed BUY/SELL entries.\n");
      changed = true;
      console.log('[V-TRADE SAFETY] removed post-response Telegram alert call from /api/analysis/xauusd');
    }

    // Keep scanner diagnostics defined even if an older watchdog patch removed the declaration.
    if (!/\b(?:let|const|var)\s+telegramAutoLastReadinessLog\s*=/.test(source)) {
      const anchor = /\blet\s+telegramAutoLastState\s*=\s*'';/;
      if (anchor.test(source)) {
        source = source.replace(anchor, "let telegramAutoLastReadinessLog = '';\nlet telegramAutoLastState = '';" );
        changed = true;
        console.log('[V-TRADE SAFETY] restored Telegram readiness state variable');
      }
    }

    // Ensure the scanner state variables exist after any legacy entry-only patch.
    if (!/\blet\s+telegramAutoLastState\s*=/.test(source)) {
      const anchor = /\basync function runTelegramAutoAlertScan\(\)\s*\{/;
      if (anchor.test(source)) {
        source = source.replace(anchor, "let telegramAutoLastReadinessLog = '';\nlet telegramAutoLastState = '';\n\nasync function runTelegramAutoAlertScan() {");
        changed = true;
        console.log('[V-TRADE SAFETY] restored Telegram scanner state variables');
      }
    }

    if (changed) fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE SAFETY] Telegram runtime guards active');
  } catch (e) {
    console.error('[V-TRADE SAFETY] Telegram runtime guard failed:', redact(e?.stack || e?.message || e));
    process.exitCode = 1;
  }
}

function installRuntimeDiagnostics() {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    if (!TelegramBot.prototype.__vtradeDiagnosticSendMessage) {
      const original = TelegramBot.prototype.sendMessage;
      TelegramBot.prototype.sendMessage = function (...args) {
        const chatId = String(args[0] || '');
        const text = String(args[1] || '');
        if (!text.trim()) {
          console.log(`[TELEGRAM SUPPRESS] chat=${chatId || 'MISSING'} reason=empty-entry-message`);
          return Promise.resolve({ suppressed: true });
        }
        console.log(`[TELEGRAM SEND] chat=${chatId || 'MISSING'} chars=${text.length}`);
        return Promise.resolve(original.apply(this, args))
          .then(v => { console.log(`[TELEGRAM SEND OK] chat=${chatId || 'MISSING'}`); return v; })
          .catch(err => { console.error(`[TELEGRAM SEND ERROR] ${redact(err?.message || err)}`); throw err; });
      };
      TelegramBot.prototype.__vtradeDiagnosticSendMessage = true;
    }
  } catch (e) {
    console.warn('[TELEGRAM DIAGNOSTIC] install skipped:', e.message);
  }
}

try {
  patchLauncherSafety();
  installRuntimeDiagnostics();
  patchTelegramEntryOnly();
  patchTelegramRuntimeSafety();
  console.log('[V-TRADE DIAGNOSTIC] Telegram ENTRY-ONLY diagnostics enabled');
} catch (err) {
  console.error('[V-TRADE DIAGNOSTIC] startup failed:', redact(err?.stack || err?.message || err));
  process.exitCode = 1;
}

try {
  require('./mtf-d1-diagnostic-hotfix.js');
} catch (e) {
  console.error('[V-TRADE MTF] D1 diagnostic loader failed:', e.stack || e.message);
  process.exitCode = 1;
}

try {
  require('./telegram-auto-watchdog.js');
} catch (e) {
  console.error('[V-TRADE START] telegram watchdog launch failed:', e.stack || e.message);
  process.exitCode = 1;
}
