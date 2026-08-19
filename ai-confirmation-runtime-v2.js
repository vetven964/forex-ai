// V-TRADE AI — Local ICT Confirmation Runtime V5
// AI is confirmation-only. External paid AI is hard-disabled for this runtime.
// The deterministic broker-native ICT engine remains authoritative.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_LOCAL_CONFIRM_RUNTIME_V5';

process.env.OPENAI_ENABLED = 'false';
process.env.OPENAI_MODEL = 'local-ict-v1';

function replaceOnce(source, oldText, newText) {
  if (!source.includes(oldText)) return { source, changed: false };
  return { source: source.replace(oldText, newText), changed: true };
}

function install() {
  if (!fs.existsSync(SERVER)) {
    console.warn('[V-TRADE AI] server.js not found; environment hard-disable still active');
    return;
  }

  let s = fs.readFileSync(SERVER, 'utf8');
  let changed = false;

  let r = replaceOnce(
    s,
    "const OPENAI_ENABLED = String(process.env.OPENAI_ENABLED || 'false').toLowerCase() === 'true';",
    "const OPENAI_ENABLED = false;"
  );
  s = r.source; changed ||= r.changed;

  r = replaceOnce(
    s,
    "const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();",
    "const OPENAI_MODEL = 'local-ict-v1';"
  );
  s = r.source; changed ||= r.changed;

  const enabledPattern = /const OPENAI_ENABLED\s*=\s*[^;]+;/;
  if (enabledPattern.test(s)) {
    const next = s.replace(enabledPattern, 'const OPENAI_ENABLED = false;');
    changed ||= next !== s;
    s = next;
  }

  const modelPattern = /const OPENAI_MODEL\s*=\s*[^;]+;/;
  if (modelPattern.test(s)) {
    const next = s.replace(modelPattern, "const OPENAI_MODEL = 'local-ict-v1';");
    changed ||= next !== s;
    s = next;
  }

  const start = s.indexOf('async function openAIConfirmXauAnalysis(a) {');
  const end = s.indexOf('\nasync function buildXauAnalysis()', start);
  if (start >= 0 && end > start) {
    const localFn = `async function openAIConfirmXauAnalysis(a) {
  // Free deterministic confirmation: existing server-side ICT engine is authoritative.
  const c = a?.confirmations || {};
  const signal = ['BUY','SELL'].includes(a?.signal) ? a.signal : 'WAIT';
  const allGates = c.allGatesPassed === true;
  const evidence = [
    ['MTF alignment', c.mtfAligned === true],
    ['Liquidity sweep', c.liquiditySweep === true],
    ['MSS', c.mss === true],
    ['BOS', c.bos === true],
    ['Fresh FVG/OB', c.freshFvg === true || c.freshOb === true],
    ['Premium/Discount', c.premiumDiscountOk === true],
    ['Displacement or momentum', c.displacement?.confirmed === true || c.technicalMomentumOk === true],
    ['Trend strength', c.trendStrengthOk === true],
    ['Spread', c.spreadOk === true],
    ['Retest / execution zone', c.retest === true || c.zoneIsNear === true]
  ];
  const passed = evidence.filter(x => x[1]).map(x => x[0]);
  const missing = evidence.filter(x => !x[1]).map(x => x[0]);
  const decision = allGates && signal !== 'WAIT' ? signal : 'WAIT';
  const confidence = decision !== 'WAIT'
    ? Math.max(0, Math.min(100, Number(a?.confidence ?? a?.setupScore ?? 0)))
    : 0;
  const agreement = decision !== 'WAIT' ? 'AGREE' : 'NEUTRAL';
  const reasons = decision !== 'WAIT'
    ? ['Local ICT confirmation agrees with the server-authoritative execution gate.', ...passed.slice(0, 6)]
    : ['External AI confirmation is disabled.', ...missing.slice(0, 6)];
  const riskFlags = [];
  if (!c.spreadOk) riskFlags.push('Spread gate not confirmed');
  if (!c.premiumDiscountOk) riskFlags.push('Premium/Discount gate not confirmed');
  if (!c.mss && !c.bos) riskFlags.push('MSS/BOS not confirmed');
  if (!c.liquiditySweep && !c.bos) riskFlags.push('Liquidity/structure trigger not confirmed');
  return {
    enabled: true,
    configured: true,
    provider: 'LOCAL_DETERMINISTIC',
    model: 'local-ict-v1',
    status: 'local',
    decision,
    confidence,
    agreement,
    reasons,
    missingConfirmations: missing,
    riskFlags,
    summary: decision !== 'WAIT'
      ? 'Local ICT confirmation passed. No external AI API was used.'
      : 'Local ICT confirmation is waiting for mandatory execution gates.',
    gate: {
      engineSignal: signal,
      engineConfidence: Number(a?.confidence ?? a?.setupScore ?? 0),
      enginePassed: allGates,
      aiEligible: allGates && decision !== 'WAIT',
      finalSignal: decision
    },
    localEvidence: { passed, missing }
  };
}
`;
    s = s.slice(0, start) + localFn + s.slice(end);
    changed = true;
  }

  // Simple Telegram presentation layer: keep all scoring/ICT/risk calculations
  // internal, but show only the trade information the user actually needs.
  const tgStart = s.indexOf('function telegramText(a) {');
  const tgEnd = tgStart >= 0 ? s.indexOf('\nfunction ', tgStart + 1) : -1;
  if (tgStart >= 0 && tgEnd > tgStart) {
    const simpleTelegram = `function telegramText(a) {
  const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';
  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();
  const action=side==='BUY'?'🟢 BUY':side==='SELL'?'🔴 SELL':'🟡 WAIT';
  const z=a?.entryZone||a?.candidateZone||a?.referenceZone||{};
  const zone=Number.isFinite(Number(z?.low))&&Number.isFinite(Number(z?.high))?n(z.low)+' – '+n(z.high):'WAIT';
  const entry=['BUY','SELL'].includes(side)?n(a?.entry):'WAIT';
  const sl=['BUY','SELL'].includes(side)?n(a?.stopLoss):'WAIT';
  const tp=Array.isArray(a?.takeProfit)?a.takeProfit:[];
  return ['🤖 *V TRADE AI — XAUUSD*','',
    '*'+action+'*',
    '📍 Zone: *'+zone+'*',
    '🎯 Entry: *'+entry+'*',
    '🛑 SL: *'+sl+'*',
    '🎯 TP1: *'+n(tp[0])+'*',
    '🎯 TP2: *'+n(tp[1])+'*',
    '🎯 TP3: *'+n(tp[2])+'*'
  ].join('\\n');
}
`;
    s = s.slice(0, tgStart) + simpleTelegram + s.slice(tgEnd);
    changed = true;
    console.log('[V-TRADE TELEGRAM] Simple BUY/SELL alert formatter installed');
  }

  if (!s.includes(MARK)) {
    s = `// ${MARK} installed by runtime hotfix\n` + s;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(SERVER, s, 'utf8');
  }

  console.log('[V-TRADE AI] Local ICT Confirmation V5 active | OPENAI_ENABLED=false | model=local-ict-v1 | paid AI calls blocked');
}

install();