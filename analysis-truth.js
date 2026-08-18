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
      timeframe:tf, signal, side, score, confidence:score, available:true,
      status:signal === 'WAIT' ? 'WAIT_CONFIRMATION' : 'DIRECTIONAL_SIGNAL',
      reasons:reasons.slice(0,6), structure:structureBias, momentum:macdBias,
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
    version:'1.1-per-timeframe-confluence', signals, dominantSignal:dominantSide,
    dominantSide:dominantSide === 'BUY' ? 'BULLISH' : dominantSide === 'SELL' ? 'BEARISH' : 'NEUTRAL',
    confluenceScore, alignedTimeframes:aligned.map(x => x),
    weightedVotes:{BUY:bullWeight,SELL:bearWeight}, executionTimeframe:executionFrame,
    note:'Per-timeframe signals are evidence. Final trade authorization still requires deterministic ICT gates, risk/data checks, Truth Guard, and optional AI confirmation.'
  };
}

function buildAnalystCouncil(a) {
  const t = a?.timeframes || {};
  const core = ['H4', 'H1', 'M15'];
  const available = core.filter(tf => t[tf]);
  const biases = available.map(tf => sideOf(t[tf]?.structure?.bias || t[tf]?.resolvedBias || t[tf]?.trend));
  const bull = biases.filter(x => x === 'BULLISH').length;
  const bear = biases.filter(x => x === 'BEARISH').length;
  const structureSide = bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
  const structureConfidence = available.length ? clamp(55 + Math.abs(bull - bear) * 15 - (bull && bear ? 8 : 0)) : 0;
  const coreBiasReady = available.length >= 3 && Math.max(bull, bear) >= 2 && bull !== bear;
  const coreBiasVotes = Math.max(bull, bear);

  const m5 = t.M5 || {};
  const rsi = Number(m5.rsi);
  const macdSide = sideOf(m5.macd?.bias);
  const momentumSide = rsi >= 50 && macdSide === 'BULLISH' ? 'BULLISH' : rsi <= 50 && macdSide === 'BEARISH' ? 'BEARISH' : 'NEUTRAL';
  const momentumReasons = [];
  if (Number.isFinite(rsi)) momentumReasons.push(`M5 RSI ${rsi.toFixed(1)}`);
  if (macdSide !== 'NEUTRAL') momentumReasons.push(`M5 MACD ${macdSide}`);
  const momentumConfidence = momentumSide === 'NEUTRAL' ? 35 : clamp(60 + (Number.isFinite(rsi) && (rsi >= 55 || rsi <= 45) ? 15 : 0));

  const ict = a?.ict || {};
  const sweepSide = sideOf(ict.liquiditySweep?.bias || ict.sweep?.bias);
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
    { id:'structure', name:'Structure Analyst', role:'H4/H1/M15 structure', ...vote(structureSide, structureConfidence, [`${bull} bullish / ${bear} bearish core TFs`, ...available.map(tf => `${tf}:${sideOf(t[tf]?.structure?.bias || t[tf]?.resolvedBias || t[tf]?.trend)}`)]) },
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
  const councilReady = coreBiasReady && structureSide !== 'NEUTRAL';
  const tradeSide = structureSide === 'BULLISH' ? 'BUY' : structureSide === 'BEARISH' ? 'SELL' : 'WAIT';
  return {
    version:'1.3-workflow-council', analysts, consensus, consensusVotes:`${consensusVotes}/${directional.length}`,
    consensusRatio:Number(consensusRatio.toFixed(2)), confidence:avgConfidence,
    coreBias:{required:'2/3 H4/H1/M15',votes:coreBiasVotes,available:available.length,side:structureSide,ready:coreBiasReady,
      detail:available.map(tf=>({timeframe:tf,bias:sideOf(t[tf]?.structure?.bias || t[tf]?.resolvedBias || t[tf]?.trend)}))},
    confidenceMeaning:'Evidence-strength score only; NOT win probability, profit probability, or guaranteed accuracy.',
    vetoes:vetoes.map(x => ({analyst:x.name,reasons:x.reasons})), ready:councilReady, tradeSide,
    note:'Council establishes bias. Deterministic engine gates establish setup/execution. No single analyst or AI score can authorize an order.'
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
    status:sample>0?'VERIFIED_CLOSED_TRADES':'NO_VERIFIED_OUTCOME_DATA', formula:'wins / closed trades × 100',
    confidenceMeaning:'AI/engine confidence is not a win rate.', note:'Only actual recorded closed-trade outcomes can change this percentage.'
  };
}

function buildExecutionWorkflow(a, council) {
  const c = a?.confirmations || {};
  const side = a?.signal === 'BUY' ? 'BULLISH' : a?.signal === 'SELL' ? 'BEARISH' : (council?.tradeSide === 'BUY' ? 'BULLISH' : council?.tradeSide === 'SELL' ? 'BEARISH' : 'NEUTRAL');
  const feedReady = a?.feedReady !== false && a?.mt5?.ready !== false;
  const dataQualityOk = Number(a?.dataQuality?.score || 0) >= 90;
  const coreBiasReady = council?.coreBias?.ready === true;
  const sweepOk = c.sweepOk === true || c.liquiditySweepOk === true || a?.ict?.liquiditySweep?.confirmed === true;
  const displacementOk = c.displacementOk === true || a?.ict?.displacement?.confirmed === true;
  const structureShiftOk = c.structureAgreement === true || c.mssOk === true || c.bosOk === true || ['BULLISH','BEARISH'].includes(sideOf(a?.ict?.mss)) || ['BULLISH','BEARISH'].includes(sideOf(a?.ict?.bos));
  const zoneOk = c.executionZoneOk === true || c.premiumDiscountOk === true || c.locationOk === true || a?.zoneRadar?.executionZoneOk === true || a?.referenceZone?.executionZoneOk === true;
  const riskOk = c.spreadOk !== false && (!Number.isFinite(Number(a?.bestOpportunity?.riskReward ?? a?.riskReward)) || Number(a?.bestOpportunity?.riskReward ?? a?.riskReward) >= 1.5) && !['LIVE','LOCK','POST_NEWS'].includes(String(a?.news?.state || '').toUpperCase());
  const engineReady = c.allGatesPassed === true;
  const ai = a?.aiConfirmation;
  const aiConfigured = !!ai && ai.configured === true && ai.enabled === true;
  const aiReady = !aiConfigured || (ai.decision === a?.signal && ai.agreement === 'AGREE' && Number(ai.confidence) >= 76);
  const setupReady = coreBiasReady && sweepOk && displacementOk && structureShiftOk && zoneOk;
  const executionReady = engineReady && setupReady && riskOk && feedReady && dataQualityOk;
  const finalReady = executionReady && aiReady;
  const blockers = [];
  if (!feedReady) blockers.push('MT5_FEED');
  if (!dataQualityOk) blockers.push('DATA_QUALITY');
  if (!coreBiasReady) blockers.push('MTF_2_OF_3');
  if (!sweepOk) blockers.push('LIQUIDITY_SWEEP');
  if (!displacementOk) blockers.push('DISPLACEMENT');
  if (!structureShiftOk) blockers.push('MSS_BOS');
  if (!zoneOk) blockers.push('EXECUTION_ZONE');
  if (!riskOk) blockers.push('RISK');
  if (!engineReady) blockers.push('ENGINE_GATES');
  if (!aiReady) blockers.push('AI_CONFIRMATION');
  const stages = [
    {id:'DATA',label:'Data / MT5',passed:feedReady && dataQualityOk,detail:feedReady && dataQualityOk?'PASS':'WAIT — feed/data quality'},
    {id:'BIAS',label:'MTF Bias',passed:coreBiasReady,detail:coreBiasReady?`${council.coreBias.votes}/3 ${council.coreBias.side}`:'WAIT — need 2/3 H4/H1/M15'},
    {id:'SETUP',label:'ICT Setup',passed:setupReady,detail:setupReady?'PASS':'WAIT — sweep + displacement + MSS/BOS + zone'},
    {id:'EXECUTION',label:'Execution',passed:executionReady,detail:executionReady?'PASS':'WAIT — engine/risk/location gates'},
    {id:'AI',label:'AI Confirmation',passed:aiReady,detail:!aiConfigured?'OPTIONAL':aiReady?'PASS':'WAIT — AI must agree'},
    {id:'FINAL',label:'Authorization',passed:finalReady,detail:finalReady?'BUY/SELL AUTHORIZED':'NO ORDER AUTHORIZED'}
  ];
  return {version:'1.0-basic-workflow',side,stages,feedReady,dataQualityOk,coreBiasReady,sweepOk,displacementOk,structureShiftOk,zoneOk,riskOk,engineReady,aiConfigured,aiReady,setupReady,executionReady,finalReady,blockers,decision:finalReady ? (a?.signal || 'WAIT') : 'WAIT'};
}

function applyTruthGuard(a) {
  const timeframeSignals = buildTimeframeSignals(a);
  const council=buildAnalystCouncil(a);
  const workflow=buildExecutionWorkflow(a,council);
  const engineSide=a?.signal==='BUY'?'BULLISH':a?.signal==='SELL'?'BEARISH':'NEUTRAL';
  const councilAgrees=engineSide!=='NEUTRAL' && council.tradeSide===(engineSide==='BULLISH'?'BUY':'SELL');
  const engineGate=a?.confirmations?.allGatesPassed===true;
  const dataQualityOk=Number(a?.dataQuality?.score||0)>=90;
  const ai=a?.aiConfirmation;
  const aiConfigured=!!ai && ai.configured===true && ai.enabled===true;
  const aiOk=!aiConfigured || (ai.decision===a?.signal && ai.agreement==='AGREE' && Number(ai.confidence)>=76);
  const guardPass=engineGate && council.ready && councilAgrees && dataQualityOk && aiOk && workflow.finalReady;
  const truthMetrics=verifiedMetricsFromAnalysis(a);
  const out={...a, timeframeSignals, analystCouncil:council, executionWorkflow:workflow, truthMetrics,
    confidenceMeaning:'Setup/evidence confidence only — never a win-rate claim.',
    guard:{engineGate,councilReady:council.ready,councilAgrees,dataQualityOk,aiConfigured,aiOk,workflowReady:workflow.finalReady,pass:guardPass,
      blockedBy:[!engineGate?'ENGINE_GATE':null,!council.ready?'MTF_BIAS':null,!councilAgrees?'COUNCIL_DISAGREEMENT':null,!dataQualityOk?'DATA_QUALITY':null,!workflow.sweepOk?'LIQUIDITY_SWEEP':null,!workflow.displacementOk?'DISPLACEMENT':null,!workflow.structureShiftOk?'MSS_BOS':null,!workflow.zoneOk?'EXECUTION_ZONE':null,!aiOk?'AI_CONFIRMATION':null].filter(Boolean)}};

  if (out.aiConfirmation) {
    out.aiConfirmation={...out.aiConfirmation,
      rawDecision:out.aiConfirmation.decision,
      rawConfidence:Number(out.aiConfirmation.confidence),
      executionEligible:workflow.executionReady === true,
      status:workflow.executionReady ? 'EXECUTION_ELIGIBLE' : 'ADVISORY_ONLY'
    };
    if (!workflow.executionReady) {
      out.aiConfirmation.decision='WAIT';
      out.aiConfirmation.agreement='WAIT';
      out.aiConfirmation.confidence=Math.min(50,Number(out.aiConfirmation.rawConfidence)||0);
      out.aiConfirmation.summary='AI advisory only — deterministic ICT execution gates are not ready.';
    }
  }

  if (['BUY','SELL'].includes(out.signal) && !guardPass) {
    out.signal='WAIT'; out.phase='WAIT'; out.status='WAIT — TRUTH GUARD BLOCKED ENTRY'; out.actionable='NO TRADE';
    out.entry=null; out.stopLoss=null; out.takeProfit=[]; out.entryMode='WATCH'; out.executionTimeframe='—';
    out.confirmations={...(out.confirmations||{}),allGatesPassed:false,truthGuardPassed:false};
    out.tradeAuthorized=false;
    out.decision={...(out.decision||{}),state:'WAIT',passed:false,reason:`WAIT — ${workflow.blockers.join(', ') || 'additional confirmation required'}`};
    out.score={...(out.score||{}),blockedReasons:[...(out.score?.blockedReasons||[]),...workflow.blockers.map(x=>`Workflow: ${x}`)]};
    out.aiReasoning={...(out.aiReasoning||{}),summary:`WAIT — execution workflow blocked: ${workflow.blockers.join(', ') || 'additional confirmation required'}`};
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

module.exports={buildAnalystCouncil,applyTruthGuard,verifiedMetricsFromAnalysis,buildTimeframeSignals,buildExecutionWorkflow};
