// V-TRADE AI — Free Local Confirmation Runtime V4
// Replaces paid OpenAI confirmation with deterministic broker-native ICT confirmation.
// No external AI API, no API key, no billing required.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_LOCAL_CONFIRM_RUNTIME_V4';

function install() {
  if (!fs.existsSync(SERVER)) return;
  let s = fs.readFileSync(SERVER, 'utf8');
  let changed = false;

  // Never attempt the paid provider on Render.
  const oldEnabled = "const OPENAI_ENABLED = String(process.env.OPENAI_ENABLED || 'false').toLowerCase() === 'true';";
  const newEnabled = "const OPENAI_ENABLED = false;";
  if (s.includes(oldEnabled)) { s = s.replace(oldEnabled, newEnabled); changed = true; }

  const oldModel = "const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();";
  const newModel = "const OPENAI_MODEL = 'local-ict-v1';";
  if (s.includes(oldModel)) { s = s.replace(oldModel, newModel); changed = true; }

  const start = s.indexOf('async function openAIConfirmXauAnalysis(a) {');
  const end = s.indexOf('\nasync function buildXauAnalysis()', start);
  if (start >= 0 && end > start) {
    const localFn = `async function openAIConfirmXauAnalysis(a) {
  // Free deterministic confirmation: the existing server-side ICT engine is authoritative.
  // This function intentionally keeps the old API name so the frontend needs no rewrite.
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
  const confidence = decision !== 'WAIT' ? Math.max(0, Math.min(100, Number(a?.confidence ?? a?.setupScore ?? 0))) : 0;
  const agreement = decision !== 'WAIT' ? 'AGREE' : 'NEUTRAL';
  const reasons = decision !== 'WAIT'
    ? ['Local ICT confirmation agrees with the server-authoritative execution gate.', ...passed.slice(0, 6)]
    : ['No paid AI provider is used.', ...missing.slice(0, 6)];
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
      ? 'Free local ICT confirmation passed. No external AI API was used.'
      : 'Free local ICT confirmation is waiting for the mandatory execution gates.',
    gate: {
      engineSignal: signal,
      engineConfidence: Number(a?.confidence ?? a?.setupScore ?? 0),
      enginePassed: allGates,
      aiEligible: allGates && decision !== 'WAIT',
      finalSignal: decision
    },
    localEvidence: { passed, missing }
  };
}`;
    s = s.slice(0, start) + localFn + s.slice(end);
    changed = true;
  }

  if (!s.includes(MARK)) {
    s = `// ${MARK} installed by runtime hotfix\\n` + s;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(SERVER, s, 'utf8');
    console.log('[V-TRADE AI] Free Local ICT Confirmation V4 installed — OpenAI API disabled');
  } else {
    console.log('[V-TRADE AI] Free Local ICT Confirmation V4 already active');
  }
}

install();
