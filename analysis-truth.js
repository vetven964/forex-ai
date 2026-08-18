// V-TRADE AI — Transparent Analyst Council / Truth Guard
// Directional evidence only. Confidence is NOT a probability of profit.

function sideOf(v) {
  const s = String(v || '').toUpperCase();
  return s === 'BULLISH' || s === 'BUY' ? 'BULLISH' : s === 'BEARISH' || s === 'SELL' ? 'BEARISH' : 'NEUTRAL';
}
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0))); }
function vote(side, confidence, reasons, veto = false) {
  return { vote: sideOf(side), confidence: clamp(confidence), reasons: Array.isArray(reasons) ? reasons.slice(0, 6).map(String) : [], veto: !!veto };
}

function buildTimeframeSignals(a) {
  const t = a?.timeframes || {};
  const frames = ['M1', 'M5', 'M15', 'H1', 'H4'];
  const weights = { M1:1, M5:2, M15:3, H1:4, H4:5 };
  const signals = {};
  let bullWeight = 0, bearWeight = 0, availableWeight = 0;

  for (const tf of frames) {
    const row = t[tf];
    if (!row) {
      signals[tf] = { timeframe:tf, signal:'WAIT', side:'NEUTRAL', score:null, confidence:null, available:false, status:'DATA_UNAVAILABLE', reasons:['No verified candle/analysis data for this timeframe.'] };
      continue;
    }
    const structureBias = sideOf(row?.structure?.bias || row?.resolvedBias || row?.trend || row?.bias);
    const macdBias = sideOf(row?.macd?.bias);
    const rsi = Number(row?.rsi);
    const rawScore = Number(row?.directionScore ?? row?.score);
    const score = Number.isFinite(rawScore) ? clamp(rawScore) : 50;
    let side = structureBias;
    if (side === 'NEUTRAL' && macdBias !== 'NEUTRAL') side = macdBias;
    if (side === 'NEUTRAL' && Number.isFinite(rsi)) side = rsi > 50 ? 'BULLISH' : rsi < 50 ? 'BEARISH' : 'NEUTRAL';

    // A timeframe signal is directional evidence, not an order authorization.
    // 55/45 avoids turning tiny fluctuations around 50 into fake BUY/SELL calls.
    let signal = 'WAIT';
    if (side === 'BULLISH' && score >= 55) signal = 'BUY';
    if (side === 'BEARISH' && score <= 45) signal = 'SELL';

    const reasons = [];
    if (structureBias !== 'NEUTRAL') reasons.push(`Structure ${structureBias}`);
    if (macdBias !== 'NEUTRAL') reasons.push(`MACD ${macdBias}`);
    if (Number.isFinite(rsi)) reasons.push(`RSI ${rsi.toFixed(1)}`);
    if (row?.sweep?.bias && sideOf(row.sweep.bias) !== 'NEUTRAL') reasons.push(`Sweep ${sideOf(row.sweep.bias)}`);
    if (row?.adx?.trendStrength) reasons.push(`ADX ${row.adx.trendStrength}`);

    signals[tf] = {
      timeframe:tf,
      signal,
      side,
      score,
      confidence:score,
      available:true,
      status:signal === 'WAIT' ? 'WAIT_CONFIRMATION' : 'DIRECTIONAL_SIGNAL',
      reasons:reasons.slice(0,6),
      structure:structureBias,
      momentum:macdBias,
      rsi:Number.isFinite(rsi) ? Math.round(rsi*100)/100 : null
    };

    if (signal === 'BUY') bullWeight += weights[tf];
    if (signal === 'SELL') bearWeight += weights[tf];
    availableWeight += weights[tf];
  }

  const dominantSide = bullWeight > bearWeight ? 'BUY' : bearWeight > bullWeight ? 'SELL' : 'WAIT';
  const dominantWeight = Math.max(bullWeight, bearWeight);
  const confluenceScore = availableWeight ? clamp((dominantWeight / availableWeight) * 100) : 0;
  const aligned = frames.filter(tf => signals[tf]?.available && signals[tf]?.signal === dominantSide);
  const executionFrame = dominantSide === 'BUY' || dominantSide === 'SELL'
    ? (signals.M1?.signal === dominantSide ? 'M1' : signals.M5?.signal === dominantSide ? 'M5' : signals.M15?.signal === dominantSide ? 'M15' : 'M15')
    : null;

  return {
    version:'1.0-per-timeframe-confluence',
    signals,
    dominantSignal:dominantSide,
    dominantSide:dominantSide === 'BUY' ? 'BULLISH' : dominantSide === 'SELL' ? 'BEARISH' : 'NEUTRAL',
    confluenceScore,
    alignedTimeframes:aligned.map(x => x),
    weightedVotes:{BUY:bullWeight,SELL:bearWeight},
    executionTimeframe:executionFrame,
    note:'Per-timeframe signals are evidence. Final trade authorization still requires deterministic engine gates, ICT confirmation, risk/data gates, Truth Guard, and optional AI confirmation.'
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
  const structureConfidence = available.length ? clamp(55 + Math.abs(bull - bear) * 15 - (bull && bear ? 8 : 0)) : 0;

  const m5 = t.M5 || {};
  const rsi = Number(m5.rsi);
  const macdSide = sideOf(m5.macd?.bias);
  const momentumSide = rsi >= 50 && macdSide === 'BULLISH' ? 'BULLISH' : rsi <= 50 && macdSide === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
  const momentumReasons = [];
  if (Number.isFinite(rsi)) momentumReasons.push(`M5 RSI ${rsi.toFixed(1)}`);
  if (macdSide !== 'NEUTRAL') momentumReasons.push(`M5 MACD ${macdSide}`);
  const momentumConfidence = momentumSide === 'NEUTRAL' ? 35 : clamp(60 + (Number.isFinite(rsi) && (rsi >= 55 || rsi <= 45) ? 15 : 0));

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
  const ictConfidence = ictVotes.length ? clamp(45 + Math.max(ictBull, ictBear) / ictVotes.length * 50) : 30;
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
  if (Number.isFinite(spread) && a?.confirmations?.spreadOk === false) { riskReasons.push('Spread gate failed'); riskVeto = true; }
  if (Number.isFinite(rr) && rr < 1.5) { riskReasons.push(`RR ${rr.toFixed(2)} below 1.50`); riskVeto = true; }
  if (['LIVE', 'LOCK', 'POST_NEWS'].includes(newsState)) { riskReasons.push(`News state ${newsState}`); riskVeto = true; }
  if (Number.isFinite(dataQuality) && dataQuality < 90) { riskReasons.push(`Data quality ${Math.round(dataQuality)}/100`); riskVeto = true; }

  const analysts = [
    { id:'structure', name:'Structure Analyst', role:'H4/H1/M15 structure', ...vote(structureSide, structureConfidence, [`${bull} bullish / ${bear} bearish core TFs`, ...available.map(tf => `${tf}:${sideOf(t[tf]?.structure?.bias || t[tf]?.trend)}`)]) },
    { id:'momentum', name:'Momentum Analyst', role:'RSI + MACD + trend', ...vote(momentumSide, momentumConfidence, momentumReasons) },
    { id:'ict', name:'ICT / Liquidity Analyst', role:'Sweep + MSS/BOS + FVG/OB', ...vote(ictSide, ictConfidence, ictReasons) },
    { id:'risk', name:'Risk Analyst', role:'Spread + RR + news + data quality', ...vote('NEUTRAL', riskVeto ? 20 : 80, riskReasons.length ? riskReasons : ['Risk gates clear'], riskVeto) }
  ];

  const directional = analysts.filter(x => ['structure','momentum','ict'].includes(x.id));
  const active = directional.filter(x => x.vote !== 'NEUTRAL');
  const bullVotes = active.filter(x => x.vote === 'BULLISH').length;
  const bearVotes = active.filter(x => x.vote === 'BEARISH').length;
  const consensus = bullVotes > bearVotes ? 'BULLISH' : bearVotes > bullVotes ? 'BEARISH' : 'NEUTRAL';
  const consensusVotes = Math.max(bullVotes, bearVotes);
  const consensusRatio = active.length ? consensusVotes / active.length : 0;
  const avgConfidence = active.length ? clamp(active.reduce((s, x) => s + x.confidence, 0) / active.length) : 0;
  const vetoes = analysts.filter(x => x.veto);
  const ready = directional.every(x => x.vote !== 'NEUTRAL') && consensus !== 'NEUTRAL' && consensusVotes === directional.length && consensusRatio === 1 && vetoes.length === 0;
  const tradeSide = consensus === 'BULLISH' ? 'BUY' : consensus === 'BEARISH' ? 'SELL' : 'WAIT';

  return {
    version:'1.2-transparent-council', analysts, consensus,
    consensusVotes:`${consensusVotes}/${directional.length}`,
    consensusRatio:Number(consensusRatio.toFixed(2)), confidence:avgConfidence,
    confidenceMeaning:'Evidence-strength score only; NOT win probability, profit probability, or guaranteed accuracy.',
    vetoes:vetoes.map(x => ({analyst:x.name,reasons:x.reasons})), ready, tradeSide,
    note:'A trade is authorized only when deterministic gates, all three directional analysts, risk/data gates, and optional AI confirmation agree.'
  };
}

function verifiedMetricsFromAnalysis(a) {
  const src = a?.performance?.closedTrades || a?.verifiedOutcomes || null;
  if (!src) return {
    verifiedWinRate:null, verifiedSampleSize:0, verifiedWins:0, verifiedLosses:0,
    status:'NO_VERIFIED_OUTCOME_DATA', formula:'wins / closed trades × 100',
    confidenceMeaning:'AI/engine confidence is not a win rate.',
    note:'Win rate is N/A until real closed-trade outcomes are recorded.'
  };
  const wins=Math.max(0,Number(src.wins||0)), losses=Math.max(0,Number(src.losses||0)), sample=wins+losses;
  return {
    verifiedWinRate:sample>0?Number((wins/sample*100).toFixed(2)):null,
    verifiedSampleSize:sample, verifiedWins:wins, verifiedLosses:losses,
    status:sample>0?'VERIFIED_CLOSED_TRADES':'NO_VERIFIED_OUTCOME_DATA',
    formula:'wins / closed trades × 100', confidenceMeaning:'AI/engine confidence is not a win rate.',
    note:'Only actual recorded closed-trade outcomes can change this percentage.'
  };
}

function applyTruthGuard(a) {
  const timeframeSignals = buildTimeframeSignals(a);
  const council=buildAnalystCouncil(a);
  const engineSide=a?.signal==='BUY'?'BULLISH':a?.signal==='SELL'?'BEARISH':'NEUTRAL';
  const councilAgrees=engineSide!=='NEUTRAL' && council.tradeSide===(engineSide==='BULLISH'?'BUY':'SELL');
  const engineGate=a?.confirmations?.allGatesPassed===true;
  const dataQualityOk=Number(a?.dataQuality?.score||0)>=90;
  const ai=a?.aiConfirmation;
  const aiConfigured=!!ai && ai.configured===true && ai.enabled===true;
  const aiOk=!aiConfigured || (ai.decision===a?.signal && ai.agreement==='AGREE' && Number(ai.confidence)>=76);
  const guardPass=engineGate && council.ready && councilAgrees && dataQualityOk && aiOk;
  const truthMetrics=verifiedMetricsFromAnalysis(a);
  const out={...a, timeframeSignals, analystCouncil:council, truthMetrics, confidenceMeaning:'Setup/evidence confidence only — never a win-rate claim.', guard:{engineGate,councilReady:council.ready,councilAgrees,dataQualityOk,aiConfigured,aiOk,pass:guardPass,blockedBy:[!engineGate?'ENGINE_GATE':null,!council.ready?'ANALYST_COUNCIL':null,!councilAgrees?'COUNCIL_DISAGREEMENT':null,!dataQualityOk?'DATA_QUALITY':null,!aiOk?'AI_CONFIRMATION':null].filter(Boolean)}};

  if (['BUY','SELL'].includes(out.signal) && !guardPass) {
    out.signal='WAIT'; out.phase='WAIT'; out.status='WAIT — TRUTH GUARD BLOCKED ENTRY'; out.actionable='NO TRADE';
    out.entry=null; out.stopLoss=null; out.takeProfit=[]; out.entryMode='WATCH'; out.executionTimeframe='—';
    out.confirmations={...(out.confirmations||{}),allGatesPassed:false,truthGuardPassed:false};
    out.tradeAuthorized=false;
    out.decision={...(out.decision||{}),state:'WAIT',passed:false,reason:`Truth guard blocked: ${out.guard.blockedBy.join(', ') || 'additional confirmation required'}`};
    out.score={...(out.score||{}),blockedReasons:[...(out.score?.blockedReasons||[]),...out.guard.blockedBy.map(x=>`Truth guard: ${x}`)]};
    out.aiReasoning={...(out.aiReasoning||{}),summary:`WAIT — Truth guard blocked entry: ${out.guard.blockedBy.join(', ') || 'additional confirmation required'}`};
    if(out.zoneRadar) out.zoneRadar={...out.zoneRadar,entryTiming:'WAIT — truth guard confirmation required'};
    if(out.referenceZone) out.referenceZone={...out.referenceZone,entryTiming:'WAIT — truth guard confirmation required'};
    out.entryTiming='WAIT — truth guard confirmation required';
  } else if (out.signal==='BUY' || out.signal==='SELL') {
    out.confirmations={...(out.confirmations||{}),truthGuardPassed:true};
    out.tradeAuthorized=true;
  } else {
    out.tradeAuthorized=false;
  }
  return out;
}

module.exports={buildAnalystCouncil,applyTruthGuard,verifiedMetricsFromAnalysis,buildTimeframeSignals};
