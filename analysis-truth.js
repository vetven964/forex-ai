// V-TRADE AI — Transparent Analyst Council / Truth Guard
// General multi-factor design only; no third-party implementation is copied.

function sideOf(v) {
  const s = String(v || '').toUpperCase();
  return s === 'BULLISH' || s === 'BUY' ? 'BULLISH' : s === 'BEARISH' || s === 'SELL' ? 'BEARISH' : 'NEUTRAL';
}

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}

function vote(side, confidence, reasons, veto = false) {
  return {
    vote: sideOf(side),
    confidence: clamp(confidence),
    reasons: Array.isArray(reasons) ? reasons.slice(0, 6).map(String) : [],
    veto: !!veto
  };
}

function buildAnalystCouncil(a) {
  const t = a?.timeframes || {};
  const core = ['H4', 'H1', 'M15'];
  const available = core.filter(tf => t[tf]);
  const biases = available.map(tf => sideOf(t[tf]?.structure?.bias || t[tf]?.trend));
  const bull = biases.filter(x => x === 'BULLISH').length;
  const bear = biases.filter(x => x === 'BEARISH').length;
  const structureSide = bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
  const structureConfidence = available.length
    ? clamp(55 + Math.abs(bull - bear) * 15 - (bull && bear ? 8 : 0))
    : 0;

  const m5 = t.M5 || {};
  const rsi = Number(m5.rsi);
  const macdSide = sideOf(m5.macd?.bias);
  const momentumSide = rsi >= 50 && macdSide === 'BULLISH'
    ? 'BULLISH'
    : rsi <= 50 && macdSide === 'BEARISH'
      ? 'BEARISH'
      : 'NEUTRAL';
  const momentumReasons = [];
  if (Number.isFinite(rsi)) momentumReasons.push(`M5 RSI ${rsi.toFixed(1)}`);
  if (macdSide !== 'NEUTRAL') momentumReasons.push(`M5 MACD ${macdSide}`);
  const momentumConfidence = momentumSide === 'NEUTRAL'
    ? 35
    : clamp(60 + (Number.isFinite(rsi) && (rsi >= 55 || rsi <= 45) ? 15 : 0));

  const ict = a?.ict || {};
  const sweepSide = sideOf(ict.liquiditySweep?.bias);
  const mssSide = sideOf(ict.mss);
  const bosSide = sideOf(ict.bos);
  const fvgSide = sideOf(ict.fvg?.type);
  const obSide = sideOf(ict.orderBlock?.type);
  const ictVotes = [sweepSide, mssSide, bosSide, fvgSide, obSide].filter(x => x !== 'NEUTRAL');
  const ictBull = ictVotes.filter(x => x === 'BULLISH').length;
  const ictBear = ictVotes.filter(x => x === 'BEARISH').length;
  const ictSide = ictBull > ictBear ? 'BULLISH' : ictBear > ictBull ? 'BEARISH' : 'NEUTRAL';
  const ictConfidence = ictVotes.length
    ? clamp(45 + Math.max(ictBull, ictBear) / ictVotes.length * 50)
    : 30;
  const ictReasons = [];
  if (sweepSide !== 'NEUTRAL') ictReasons.push(`Liquidity sweep ${sweepSide}`);
  if (mssSide !== 'NEUTRAL') ictReasons.push(`MSS ${mssSide}`);
  if (bosSide !== 'NEUTRAL') ictReasons.push(`BOS ${bosSide}`);
  if (fvgSide !== 'NEUTRAL') ictReasons.push(`FVG ${fvgSide}`);
  if (obSide !== 'NEUTRAL') ictReasons.push(`OB ${obSide}`);

  const spread = Number(a?.spread);
  const rr = Number(a?.bestOpportunity?.riskReward ?? a?.riskReward);
  const newsState = String(a?.news?.state || 'UNAVAILABLE').toUpperCase();
  const dataQuality = Number(a?.dataQuality?.score);
  const riskReasons = [];
  let riskVeto = false;
  if (Number.isFinite(spread) && a?.confirmations?.spreadOk === false) {
    riskReasons.push('Spread gate failed'); riskVeto = true;
  }
  if (Number.isFinite(rr) && rr < 1.5) {
    riskReasons.push(`RR ${rr.toFixed(2)} below 1.50`); riskVeto = true;
  }
  if (newsState === 'LIVE' || newsState === 'LOCK' || newsState === 'POST_NEWS') {
    riskReasons.push(`News state ${newsState}`); riskVeto = true;
  }
  if (Number.isFinite(dataQuality) && dataQuality < 90) {
    riskReasons.push(`Data quality ${Math.round(dataQuality)}/100`); riskVeto = true;
  }

  // Risk is a veto/check layer, NOT a directional vote. This prevents the
  // engine's own BUY/SELL signal from artificially increasing council agreement.
  const analysts = [
    {
      id:'structure', name:'Structure Analyst', role:'H4/H1/M15 structure',
      ...vote(structureSide, structureConfidence, [
        `${bull} bullish / ${bear} bearish core TFs`,
        ...available.map(tf => `${tf}:${sideOf(t[tf]?.structure?.bias || t[tf]?.trend)}`)
      ])
    },
    {
      id:'momentum', name:'Momentum Analyst', role:'RSI + MACD + trend',
      ...vote(momentumSide, momentumConfidence, momentumReasons)
    },
    {
      id:'ict', name:'ICT / Liquidity Analyst', role:'Sweep + MSS/BOS + FVG/OB',
      ...vote(ictSide, ictConfidence, ictReasons)
    },
    {
      id:'risk', name:'Risk Analyst', role:'Spread + RR + news + data quality',
      ...vote('NEUTRAL', riskVeto ? 20 : 80, riskReasons.length ? riskReasons : ['Risk gates clear'], riskVeto)
    }
  ];

  // Only directional analysts participate in directional consensus.
  const directional = analysts.filter(x => ['structure','momentum','ict'].includes(x.id));
  const active = directional.filter(x => x.vote !== 'NEUTRAL');
  const bullVotes = active.filter(x => x.vote === 'BULLISH').length;
  const bearVotes = active.filter(x => x.vote === 'BEARISH').length;
  const consensus = bullVotes > bearVotes ? 'BULLISH' : bearVotes > bullVotes ? 'BEARISH' : 'NEUTRAL';
  const consensusVotes = Math.max(bullVotes, bearVotes);
  const consensusRatio = active.length ? consensusVotes / active.length : 0;
  const avgConfidence = active.length
    ? clamp(active.reduce((s, x) => s + x.confidence, 0) / active.length)
    : 0;
  const vetoes = analysts.filter(x => x.veto);

  // A directional council is ready only when all three directional analysts
  // that have data agree. A neutral analyst cannot be counted as agreement.
  const ready = directional.every(x => x.vote !== 'NEUTRAL')
    && consensus !== 'NEUTRAL'
    && consensusVotes === directional.length
    && consensusRatio === 1
    && vetoes.length === 0;
  const tradeSide = consensus === 'BULLISH' ? 'BUY' : consensus === 'BEARISH' ? 'SELL' : 'WAIT';

  return {
    version: '1.1-transparent-council',
    analysts,
    consensus,
    consensusVotes: `${consensusVotes}/${directional.length}`,
    consensusRatio: Number(consensusRatio.toFixed(2)),
    confidence: avgConfidence,
    vetoes: vetoes.map(x => ({analyst:x.name, reasons:x.reasons})),
    ready,
    tradeSide,
    note: 'Council confidence measures evidence strength. It is NOT a probability of profit or win rate.'
  };
}

function verifiedMetricsFromAnalysis(a) {
  // Only consume explicitly recorded closed-trade outcomes. Never infer a win
  // rate from AI confidence, council confidence, score, or paper signals.
  const src = a?.performance?.closedTrades || a?.verifiedOutcomes || null;
  if (!src) {
    return {
      verifiedWinRate: null,
      verifiedSampleSize: 0,
      verifiedWins: 0,
      verifiedLosses: 0,
      status: 'NO_VERIFIED_OUTCOME_DATA',
      formula: 'wins / closed trades × 100',
      note: 'Win rate remains N/A until closed trade outcomes are actually recorded.'
    };
  }
  const wins = Number(src.wins || 0);
  const losses = Number(src.losses || 0);
  const sample = wins + losses;
  return {
    verifiedWinRate: sample > 0 ? Number((wins / sample * 100).toFixed(2)) : null,
    verifiedSampleSize: sample,
    verifiedWins: wins,
    verifiedLosses: losses,
    status: sample > 0 ? 'VERIFIED_CLOSED_TRADES' : 'NO_VERIFIED_OUTCOME_DATA',
    formula: 'wins / closed trades × 100',
    note: 'Verified rate is calculated only from recorded closed trade outcomes.'
  };
}

function applyTruthGuard(a) {
  const council = buildAnalystCouncil(a);
  const engineSide = a?.signal === 'BUY' ? 'BULLISH' : a?.signal === 'SELL' ? 'BEARISH' : 'NEUTRAL';
  const councilAgrees = engineSide !== 'NEUTRAL' && council.tradeSide === (engineSide === 'BULLISH' ? 'BUY' : 'SELL');
  const engineGate = a?.confirmations?.allGatesPassed === true;
  const dataQualityOk = Number(a?.dataQuality?.score || 0) >= 90;
  const ai = a?.aiConfirmation;
  const aiConfigured = !!ai && ai.configured === true && ai.enabled === true;
  const aiOk = !aiConfigured || (
    ai.decision === a?.signal &&
    ai.agreement === 'AGREE' &&
    Number(ai.confidence) >= 76
  );
  const guardPass = engineGate && council.ready && councilAgrees && dataQualityOk && aiOk;

  const truthMetrics = verifiedMetricsFromAnalysis(a);

  const out = {
    ...a,
    analystCouncil: council,
    truthMetrics,
    guard: {
      engineGate,
      councilReady: council.ready,
      councilAgrees,
      dataQualityOk,
      aiConfigured,
      aiOk,
      pass: guardPass,
      blockedBy: [
        !engineGate ? 'ENGINE_GATE' : null,
        !council.ready ? 'ANALYST_COUNCIL' : null,
        !councilAgrees ? 'COUNCIL_DISAGREEMENT' : null,
        !dataQualityOk ? 'DATA_QUALITY' : null,
        !aiOk ? 'AI_CONFIRMATION' : null
      ].filter(Boolean)
    }
  };

  if (['BUY','SELL'].includes(out.signal) && !guardPass) {
    out.signal = 'WAIT';
    out.phase = 'WAIT';
    out.status = 'WAIT — TRUTH GUARD BLOCKED ENTRY';
    out.actionable = 'NO TRADE';
    out.entry = null;
    out.stopLoss = null;
    out.takeProfit = [];
    out.entryMode = 'WATCH';
    out.executionTimeframe = '—';
    out.confirmations = {...(out.confirmations || {}), allGatesPassed:false, truthGuardPassed:false};
    out.decision = {...(out.decision || {}), state:'WAIT', passed:false, reason:`Truth guard blocked: ${out.guard.blockedBy.join(', ') || 'additional confirmation required'}`};
    out.score = {...(out.score || {}), blockedReasons:[...(out.score?.blockedReasons || []), ...out.guard.blockedBy.map(x => `Truth guard: ${x}`)]};
    out.tradeAuthorized = false;
    out.aiReasoning = {...(out.aiReasoning || {}), summary:`WAIT — Truth guard blocked entry: ${out.guard.blockedBy.join(', ') || 'additional confirmation required'}`};
    if (out.zoneRadar) out.zoneRadar = {...out.zoneRadar, entryTiming:'WAIT — truth guard confirmation required'};
    if (out.referenceZone) out.referenceZone = {...out.referenceZone, entryTiming:'WAIT — truth guard confirmation required'};
    out.entryTiming = 'WAIT — truth guard confirmation required';
  } else if (out.signal === 'BUY' || out.signal === 'SELL') {
    out.confirmations = {...(out.confirmations || {}), truthGuardPassed:true};
    out.tradeAuthorized = true;
  }

  return out;
}

module.exports = { buildAnalystCouncil, applyTruthGuard };
