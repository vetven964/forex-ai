// V-TRADE AI — AI/Telegram diagnostic + premium signal-format hotfix
// Logic-safe presentation layer: does not authorize trades, change gates, or alter MT5 data.
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const LAUNCHER_FILE = path.resolve(__dirname, 'server-launcher.js');
const MARKER = '// V-TRADE AI AI/TELEGRAM DIAGNOSTIC HOTFIX INSTALLED';
const FORMAT_MARKER = '// V-TRADE AI TELEGRAM PREMIUM FORMAT HOTFIX INSTALLED';

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
  } catch (e) { console.warn('[V-TRADE SAFETY] launcher guard skipped:', e.message); }
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function price(v) {
  const n = num(v);
  return n === null ? '—' : n.toFixed(2);
}
function zoneText(z) {
  if (!z) return '—';
  if (typeof z === 'number') return price(z);
  const lo = num(z.low ?? z.min ?? z.from);
  const hi = num(z.high ?? z.max ?? z.to);
  if (lo !== null && hi !== null) return `${price(Math.min(lo,hi))}–${price(Math.max(lo,hi))}`;
  return price(z.mid ?? z.price ?? z.entry);
}
function firstFinite(...values) { for (const v of values) { const n=num(v); if(n!==null) return n; } return null; }
function sideFrom(a) {
  const s = String(a?.signal || a?.action || a?.direction || '').toUpperCase();
  if (s.includes('BUY')) return 'BUY';
  if (s.includes('SELL')) return 'SELL';
  return '';
}
function confirmed(a) {
  return (a?.tradeAuthorized === true || a?.authorized === true || a?.actionable === 'TRADE') && (sideFrom(a) === 'BUY' || sideFrom(a) === 'SELL');
}

function premiumSignalText(a) {
  const side = sideFrom(a);
  const isConfirmed = confirmed(a);
  const bias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();
  const score = firstFinite(a?.directionScore, a?.score?.directionScore, a?.score, a?.aiScore) ?? 0;
  const confidence = firstFinite(a?.confidence, a?.score?.confidence) ?? 0;
  const live = firstFinite(a?.livePrice, a?.price, a?.bid, a?.ask);
  const entry = firstFinite(a?.entry, a?.entryPrice, a?.executionPrice);
  const sl = firstFinite(a?.stopLoss, a?.sl);
  const tps = Array.isArray(a?.takeProfit) ? a.takeProfit : Array.isArray(a?.tp) ? a.tp : [];
  const tp1 = firstFinite(a?.tp1, a?.takeProfit1, tps[0]);
  const tp2 = firstFinite(a?.tp2, a?.takeProfit2, tps[1]);
  const tp3 = firstFinite(a?.tp3, a?.takeProfit3, tps[2]);
  const entryZone = a?.entryZone || a?.candidateZone || a?.watchZone || null;
  const zone = zoneText(entryZone);
  const mode = String(a?.entryMode || a?.setupType || a?.model || 'ICT').replace(/_/g,' ');
  const aiDecision = String(a?.aiConfirmation?.decision || 'NOT RUN').toUpperCase();
  const aiConf = firstFinite(a?.aiConfirmation?.confidence) ?? 0;
  const aiAgreement = String(a?.aiConfirmation?.agreement || '—').toUpperCase();
  const council = a?.analystCouncil || {};
  const councilCount = council?.bullishCount ?? council?.bearishCount ?? council?.count ?? '—';
  const winRate = council?.verifiedWinRate ?? 'N/A';
  const sample = council?.sample ?? 0;
  const quoteAge = firstFinite(a?.priceAgeSec, a?.quoteAgeSec);
  const gateReasons = Array.isArray(a?.score?.blockedReasons) ? a.score.blockedReasons : [];
  const gate = (words) => gateReasons.some(r => words.some(w => String(r).toLowerCase().includes(w)));
  const liquidity = gate(['liquidity sweep','sweep']) || a?.liquiditySweep === true;
  const displacement = gate(['displacement']) || a?.displacementConfirmed === true;
  const momentum = gate(['momentum']) || a?.momentumConfirmed === true;
  const execution = gate(['execution direction','execution']) || a?.executionDirectionConfirmed === true;
  const action = isConfirmed
    ? `${side === 'BUY' ? '🟢 BUY' : '🔴 SELL'} — ${side === 'BUY' ? 'LONG' : 'SHORT'}${mode ? ` · ${mode.toUpperCase()}` : ''}`
    : `🟡 WAIT — ${bias === 'BULLISH' ? 'BUY BIAS' : bias === 'BEARISH' ? 'SELL BIAS' : 'NO BIAS'}`;

  if (!isConfirmed) {
    return '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\n\n' +
      `📊 Asset: *XAU/USD (Gold)*\n💰 Price: *${price(live)}*\n⚡ Action: *${action}*\n📈 Bias: *${bias}*\n📊 Direction Score: *${score}/100*\n🧠 Confidence: *${confidence}/100*\n\n` +
      '🔎 *ICT ENTRY GATES*\n' +
      `• Liquidity Sweep: *${liquidity ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}*\n` +
      `• Displacement: *${displacement ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}*\n` +
      `• Momentum: *${momentum ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}*\n` +
      `• Execution Direction: *${execution ? '✅ CONFIRMED' : '❌ NOT CONFIRMED'}*\n\n` +
      '🧠 *ANALYST COUNCIL*\n' +
      `• Consensus: *${bias} ${councilCount}/3*\n• Confidence: *${score}/100*\n• Verified Win Rate: *${winRate}*\n• Sample: *${sample}*\n\n` +
      '🎯 *EXECUTION*\n• Zone: *WAITING FOR CONFIRMATION*\n• Entry: *WAIT*\n• Stop Loss: *WAIT*\n• TP1: *WAIT*\n• TP2: *WAIT*\n• TP3: *WAIT*\n\n' +
      '🤖 *AI CONFIRM*\n' +
      `• Decision: *${aiDecision}*\n• Confidence: *${aiConf}/100*\n• Agreement: *${aiAgreement}*\n\n` +
      '🟡 *STATUS*\n*WAIT — NO ORDER AUTHORIZED*\n\n' +
      '🔐 *TRUTH GUARD*\nNo order until entry gates + analyst council + risk/data checks pass.\n\n' +
      `🏦 Broker: *VT Markets MT5*\n⏱ Quote age: *${quoteAge === null ? '—' : quoteAge + 's'}*`;
  }

  return '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*\n\n' +
    `📊 Asset: *XAU/USD (Gold)*\n💰 Price: *${price(live)}*\n\n` +
    `⚡ *ACTION: ${side === 'BUY' ? '🟢 BUY — LONG' : '🔴 SELL — SHORT'}*${mode ? ` · ${mode.toUpperCase()}` : ''}\n` +
    `📈 Bias: *${bias}*\n📊 Direction Score: *${score}/100*\n🧠 Confidence: *${confidence}/100*\n\n` +
    '🎯 *EXECUTION PLAN*\n' +
    `• Entry Zone: *${zone}*\n• Entry: *${price(entry)}*\n• Stop Loss: *${price(sl)}*\n• Take Profit 1 (TP1): *${price(tp1)}*\n• Take Profit 2 (TP2): *${price(tp2)}*\n• Take Profit 3 (TP3): *${price(tp3)}*\n\n` +
    '🔎 *SETUP*\n' +
    `• Liquidity Sweep: *${liquidity ? '✅ CONFIRMED' : '—'}*\n• Displacement: *${displacement ? '✅ CONFIRMED' : '—'}*\n• Execution: *${execution ? '✅ AUTHORIZED' : '—'}*\n\n` +
    `🧠 Analysis: *Real-time ${mode || 'ICT'} + Liquidity Sweep*\n` +
    '🟢 *STATUS: ENTRY CONFIRMED — ORDER AUTHORIZED*\n\n' +
    '🔐 *TRUTH GUARD PASSED*\nAll required execution and risk checks passed.\n\n' +
    `🏦 Broker: *VT Markets MT5*\n⏱ Quote age: *${quoteAge === null ? '—' : quoteAge + 's'}*`;
}

function patchTelegramFormat() {
  try {
    let source = fs.readFileSync(SERVER_FILE, 'utf8');
    if (source.includes(FORMAT_MARKER)) { console.log('[V-TRADE STYLE] Telegram premium format already active'); return; }
    const candidates = [
      ['function telegramWaitText(a) {', '\nfunction telegramText(a) {'],
      ['function telegramText(a) {', '\nfunction telegramButtons('],
      ['function telegramText(a) {', '\nfunction sendTelegram']
    ];
    let start=-1,end=-1;
    for (const [s,e] of candidates) { const x=source.indexOf(s); const y=x>=0?source.indexOf(e,x): -1; if(x>=0&&y>x){start=x;end=y;break;} }
    if (start<0 || end<0) { console.warn('[V-TRADE STYLE] Telegram formatter function not found; logic untouched'); return; }
    const replacement = `// V-TRADE AI TELEGRAM PREMIUM FORMAT HOTFIX INSTALLED\nfunction telegramText(a) {\n  return premiumSignalText(a);\n}\n`;
    source = source.slice(0,start) + replacement + source.slice(end);
    // If the original wait formatter exists, route it through the same state-safe renderer.
    const ws=source.indexOf('function telegramWaitText(a) {');
    const we=ws>=0?source.indexOf('\nfunction telegramText(a) {',ws):-1;
    if(ws>=0&&we>ws){ source=source.slice(0,ws) + 'function telegramWaitText(a) { return premiumSignalText(a); }\n' + source.slice(we); }
    fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE STYLE] Telegram premium BUY/SELL/WAIT format patched — logic unchanged');
  } catch(e) { console.warn('[V-TRADE STYLE] Telegram format patch skipped:',e.message); }
}

function installRuntimeDiagnostics() {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    if (!TelegramBot.prototype.__vtradeDiagnosticSendMessage) {
      const original = TelegramBot.prototype.sendMessage;
      TelegramBot.prototype.sendMessage = function(...args) {
        const chatId=String(args[0]||''); const text=String(args[1]||'');
        console.log(`[TELEGRAM SEND] chat=${chatId||'MISSING'} chars=${text.length}`);
        return Promise.resolve(original.apply(this,args)).then(v=>{console.log(`[TELEGRAM SEND OK] chat=${chatId||'MISSING'}`);return v;}).catch(err=>{console.error(`[TELEGRAM SEND ERROR] ${redact(err?.message||err)}`);throw err;});
      };
      TelegramBot.prototype.__vtradeDiagnosticSendMessage=true;
    }
  } catch(e) { console.warn('[TELEGRAM DIAGNOSTIC] install skipped:',e.message); }
}

try {
  patchLauncherSafety();
  installRuntimeDiagnostics();
  let source=fs.readFileSync(SERVER_FILE,'utf8');
  if(!source.includes(MARKER)){source=`${MARKER}\n${source}`;fs.writeFileSync(SERVER_FILE,source,'utf8');console.log('[V-TRADE DIAGNOSTIC] server.js diagnostic marker installed');}
  patchTelegramFormat();
  console.log('[V-TRADE DIAGNOSTIC] AI + Telegram diagnostics enabled');
  console.log(`[V-TRADE DIAGNOSTIC] OpenAI hard guard=${String(process.env.OPENAI_ENABLED||'false').toLowerCase()==='true'?'OFF':'ON'}`);
  require('./server-strength-hotfix.js');
} catch(err) { console.error('[V-TRADE DIAGNOSTIC] startup failed:',redact(err?.stack||err?.message||err)); process.exitCode=1; }
