// V-TRADE AI — AI/Telegram diagnostic + runtime safety hotfix
// Purpose: expose the real upstream error without bypassing the existing
// Candle-Open Pre-Market MTF / timeout / production startup chain.
// Secrets are never printed.
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const LAUNCHER_FILE = path.resolve(__dirname, 'server-launcher.js');
const MARKER = '// V-TRADE AI AI/TELEGRAM DIAGNOSTIC HOTFIX INSTALLED';
const TELEGRAM_FORMAT_MARKER = '// V-TRADE AI TELEGRAM WAIT FORMAT HOTFIX INSTALLED';

function redact(value) {
  return String(value || '')
    .replace(/(bot\d+:[A-Za-z0-9_-]+)/g, 'BOT_TOKEN_REDACTED')
    .replace(/(sk-[A-Za-z0-9_-]+)/g, 'OPENAI_KEY_REDACTED')
    .replace(/([?&]key=)[^&]+/gi, '$1REDACTED')
    .replace(/([?&]token=)[^&]+/gi, '$1REDACTED');
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
    } else if (/!\/\\b(?:const|let|var)\\s+\(\?:executionLocationOk\|zoneMid\|limitZoneReady\)/.test(source)) {
      console.log('[V-TRADE SAFETY] launcher duplicate-zone guard already active');
    } else {
      console.log('[V-TRADE SAFETY] launcher guard pattern not found; leaving launcher unchanged');
    }
  } catch (e) {
    console.warn('[V-TRADE SAFETY] launcher guard patch skipped:', e.message);
  }
}

function patchTelegramWaitFormat() {
  try {
    let source = fs.readFileSync(SERVER_FILE, 'utf8');
    if (source.includes(TELEGRAM_FORMAT_MARKER)) {
      console.log('[V-TRADE STYLE] Telegram WAIT format already active');
      return;
    }

    const start = source.indexOf('function telegramWaitText(a) {');
    const end = source.indexOf('\nfunction telegramText(a) {', start);
    if (start < 0 || end < 0) {
      console.warn('[V-TRADE STYLE] telegramWaitText function not found; leaving format unchanged');
      return;
    }

    const replacement = `${TELEGRAM_FORMAT_MARKER}\nfunction telegramWaitText(a) {
  const score = Number(a?.directionScore ?? a?.aiScore ?? 0);
  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();
  const blocked = Array.isArray(a?.score?.blockedReasons)
    ? a.score.blockedReasons.slice(0, 6)
    : [];
  const gates = Array.isArray(blocked) ? blocked : [];
  const gateLine = (label, ok) => `${label}: ${ok ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}`;
  const hasGate = (keywords) => gates.some(x => keywords.some(k => String(x).toLowerCase().includes(k)));

  const liquidity = hasGate(['liquidity sweep', 'sweep']);
  const displacement = hasGate(['displacement', 'directional displacement']);
  const momentum = hasGate(['momentum']);
  const execution = hasGate(['execution direction', 'execution']);

  const status = String(a?.status || 'WAIT — NO ENTRY').replace(/^WAIT\s*[—-]?\s*/i, '');
  const aiDecision = a?.aiConfirmation?.decision || 'NOT RUN';
  const aiConfidence = a?.aiConfirmation?.confidence ?? '—';
  const aiAgreement = a?.aiConfirmation?.agreement || '—';

  return `🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\\n\\n` +
    `📊 Asset: *XAU/USD (Gold)*\\n` +
    `💰 Price: *${formatPrice(a?.livePrice ?? a?.bid)}*\\n\\n` +
    `🟡 *ACTION: WAIT — ${bias === 'BULLISH' ? 'BUY BIAS' : bias === 'BEARISH' ? 'SELL BIAS' : 'NO BIAS'}*\\n` +
    `📈 Bias: *${bias}*\\n` +
    `⚡ Direction Score: *${score}/100*\\n` +
    `🧠 Confidence: *${Number(a?.confidence ?? 0)}/100*\\n\\n` +
    `🔎 *ICT ENTRY GATES*\\n` +
    `• ${gateLine('Liquidity Sweep', liquidity)}\\n` +
    `• ${gateLine('Displacement', displacement)}\\n` +
    `• ${gateLine('Momentum', momentum)}\\n` +
    `• ${gateLine('Execution Direction', execution)}\\n\\n` +
    `🧠 *ANALYST COUNCIL*\\n` +
    `• Consensus: *${bias} ${a?.analystCouncil?.bullishCount ?? a?.analystCouncil?.count ?? '—'}/3*\\n` +
    `• Confidence: *${score}/100*\\n` +
    `• Verified Win Rate: *${a?.analystCouncil?.verifiedWinRate ?? 'N/A'}*\\n` +
    `• Sample: *${a?.analystCouncil?.sample ?? 0}*\\n\\n` +
    `🎯 *EXECUTION*\\n` +
    `• Zone: *WAITING FOR CONFIRMATION*\\n` +
    `• Entry: *WAIT*\\n` +
    `• Stop Loss: *WAIT*\\n` +
    `• TP1: *WAIT*\\n` +
    `• TP2: *WAIT*\\n` +
    `• TP3: *WAIT*\\n\\n` +
    `🤖 *AI CONFIRM*\\n` +
    `• Decision: *${aiDecision}*\\n` +
    `• Confidence: *${aiConfidence}/100*\\n` +
    `• Agreement: *${aiAgreement}*\\n\\n` +
    `🟡 *STATUS*\\n` +
    `*WAIT — NO ORDER AUTHORIZED*\\n\\n` +
    `🔐 *TRUTH GUARD*\\n` +
    `No order until entry gates + analyst council + risk/data checks pass.\\n\\n` +
    `🏦 Broker: *VT Markets MT5*\\n` +
    `⏱ Quote age: *${a?.priceAgeSec ?? '—'}s*`;
}
`;

    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE STYLE] Telegram WAIT format patched — logic unchanged');
  } catch (e) {
    console.warn('[V-TRADE STYLE] Telegram WAIT format patch skipped:', e.message);
  }
}

function installRuntimeDiagnostics() {
  const TelegramBot = require('node-telegram-bot-api');
  if (!TelegramBot.prototype.__vtradeDiagnosticSendMessage) {
    const originalSendMessage = TelegramBot.prototype.sendMessage;
    TelegramBot.prototype.sendMessage = function vtradeDiagnosticSendMessage(...args) {
      const chatId = String(args[0] || '');
      const text = String(args[1] || '');
      console.log(`[TELEGRAM SEND] chat=${chatId || 'MISSING'} chars=${text.length}`);
      const result = originalSendMessage.apply(this, args);
      return Promise.resolve(result)
        .then((value) => {
          console.log(`[TELEGRAM SEND OK] chat=${chatId || 'MISSING'}`);
          return value;
        })
        .catch((err) => {
          console.error(`[TELEGRAM SEND ERROR] ${redact(err?.message || err)}`);
          throw err;
        });
    };
    TelegramBot.prototype.__vtradeDiagnosticSendMessage = true;
  }

  if (!global.__vtradeOpenAIFetchDiagnostic) {
    const originalFetch = global.fetch;
    if (typeof originalFetch === 'function') {
      global.fetch = async function vtradeDiagnosticFetch(input, init) {
        const url = typeof input === 'string' ? input : String(input?.url || '');
        const isOpenAI = /api\.openai\.com/i.test(url);
        const isTelegram = /api\.telegram\.org/i.test(url);

        // HARD COST GUARD: when OPENAI_ENABLED=false, no OpenAI request may leave Render.
        // This protects the account from accidental calls from legacy /api/ai routes
        // or overlapping hotfixes even when an API key is still configured.
        if (isOpenAI && String(process.env.OPENAI_ENABLED || 'false').toLowerCase() !== 'true') {
          console.warn('[OPENAI BLOCKED] OPENAI_ENABLED=false — no API request sent');
          return new Response(JSON.stringify({
            error: { type: 'disabled', code: 'openai_disabled', message: 'OpenAI integration is disabled by OPENAI_ENABLED=false' }
          }), { status: 503, headers: { 'content-type': 'application/json' } });
        }

        let response;
        try {
          response = await originalFetch(input, init);
        } catch (err) {
          if (isOpenAI) console.error(`[AI CONFIRM ERROR] network=${redact(err?.message || err)}`);
          if (isTelegram) console.error(`[TELEGRAM HTTP ERROR] network=${redact(err?.message || err)}`);
          throw err;
        }
        if (isOpenAI || isTelegram) {
          const label = isOpenAI ? 'OPENAI' : 'TELEGRAM';
          if (!response.ok) {
            try {
              const body = await response.clone().text();
              console.error(`[${label} HTTP ERROR] status=${response.status} ${response.statusText || ''} body=${redact(body).slice(0,800)}`);
            } catch (_) {
              console.error(`[${label} HTTP ERROR] status=${response.status} ${response.statusText || ''}`);
            }
          } else if (isOpenAI) {
            console.log(`[OPENAI HTTP OK] status=${response.status}`);
          }
        }
        return response;
      };
      global.__vtradeOpenAIFetchDiagnostic = true;
    }
  }
}

try {
  // Patch the known duplicate-declaration guard before the production launcher chain loads.
  patchLauncherSafety();
  installRuntimeDiagnostics();
  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  if (!source.includes(MARKER)) {
    source = `${MARKER}\n${source}`;
    fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE DIAGNOSTIC] server.js diagnostic marker installed');
  }
  patchTelegramWaitFormat();
  console.log('[V-TRADE DIAGNOSTIC] AI + Telegram diagnostics enabled');
  console.log(`[V-TRADE DIAGNOSTIC] OpenAI hard guard=${String(process.env.OPENAI_ENABLED || 'false').toLowerCase() === 'true' ? 'OFF' : 'ON'}`);
  // IMPORTANT: keep the existing Pre-Market MTF startup chain.
  // server-strength-hotfix -> server-timeout-hotfix -> server.js
  require('./server-strength-hotfix.js');
} catch (err) {
  console.error('[V-TRADE DIAGNOSTIC] startup failed:', redact(err?.stack || err?.message || err));
  process.exitCode = 1;
}
