'use strict';

// V-TRADE MTF CONTRACT V1
// Core direction = H4/H1/M15. M5 = execution context.
const CORE_TFS = ['H4', 'H1', 'M15'];
const EXECUTION_TF = 'M5';

function normalizeBias(value) {
  const s = String(value ?? '').toUpperCase();
  if (/BUY|BULL|LONG/.test(s)) return 'BULLISH';
  if (/SELL|BEAR|SHORT/.test(s)) return 'BEARISH';
  return 'NEUTRAL';
}

function readFrame(analysis, tf) {
  for (const group of [analysis?.timeframes, analysis?.frames, analysis?.mtf, analysis?.multiTimeFrame]) {
    if (!group || typeof group !== 'object') continue;
    const frame = group[tf] ?? group[tf.toLowerCase()];
    if (frame != null) return frame;
  }
  return analysis?.[tf] ?? analysis?.[tf.toLowerCase()] ?? null;
}

function frameBias(frame) {
  return normalizeBias(frame?.structure?.bias ?? frame?.resolvedBias ?? frame?.bias ?? frame?.trend ?? frame?.signal);
}

function buildMtfContract(analysis) {
  const frames = Object.fromEntries(CORE_TFS.map(tf => [tf, frameBias(readFrame(analysis, tf))]));
  const bullish = CORE_TFS.filter(tf => frames[tf] === 'BULLISH').length;
  const bearish = CORE_TFS.filter(tf => frames[tf] === 'BEARISH').length;
  const neutral = CORE_TFS.length - bullish - bearish;
  const bias = bullish === 3 ? 'BULLISH' : bearish === 3 ? 'BEARISH' : 'NEUTRAL';
  const aligned = Math.max(bullish, bearish);
  const executionBias = frameBias(readFrame(analysis, EXECUTION_TF));
  return {
    version: 'MTF-CONTRACT-V1',
    coreTimeframes: CORE_TFS.slice(),
    executionTimeframe: EXECUTION_TF,
    frames,
    bullish,
    bearish,
    neutral,
    alignment: `${aligned}/3`,
    coreAligned: aligned === 3,
    bias,
    executionBias,
    executionAligned: bias !== 'NEUTRAL' && executionBias === bias,
    decision: aligned === 3 && executionBias === bias ? 'ALIGNED' : 'WAIT'
  };
}

function applyMtfContract(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const out = { ...analysis };
  const mtf = buildMtfContract(out);
  out.mtfContract = mtf;
  out.coreMtf = mtf;
  out.mtfAlignment = mtf.alignment;
  out.mtfBias = mtf.bias;
  out.executionTimeframe = EXECUTION_TF;
  if (mtf.decision !== 'ALIGNED' && out.tradeAuthorized !== true) {
    out.tradeAuthorized = false;
    out.actionable = 'NO TRADE';
    if (out.signal === 'BUY' || out.signal === 'SELL') out.signal = 'WAIT';
  }
  return out;
}

module.exports = { CORE_TFS, EXECUTION_TF, buildMtfContract, applyMtfContract };
