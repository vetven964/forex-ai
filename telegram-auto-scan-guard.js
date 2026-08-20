'use strict';

// V-TRADE Telegram scanner safety/continuity guard.
// MT5 READY -> analysis scan must continue even when Telegram delivery is unavailable.
// V17: expose deterministic ICT gate diagnostics so WAIT scores are explainable.
const INTERVAL_MS = Math.max(5000, Number(process.env.TELEGRAM_AUTO_ALERT_INTERVAL_MS || 15000));
let timer = null;
let running = false;
let scanSeq = 0;

function mt5Ready() {
  const feed = global.mt5FeedState || global.mt5State || global.MT5_STATE || null;
  if (!feed) return false;
  const counts = feed.historyCounts || feed.counts || {};
  return feed.connected === true && Number(counts.M5 || feed.M5 || 0) >= 200 && Number(counts.M15 || feed.M15 || 0) >= 200 && Number(counts.H1 || feed.H1 || 0) >= 200 && Number(counts.H4 || feed.H4 || 0) >= 200;
}

function gateValue(obj, keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === 'boolean') return v ? 'PASS' : 'WAIT';
    if (typeof v === 'string' && v.trim()) return v.toUpperCase();
  }
  return 'N/A';
}

function diagnostics(result) {
  if (!result || typeof result !== 'object') return;
  const c = result.confirmations || result.gates || result.ictGates || {};
  const mtf = result.mtfContract || result.coreMtf || result.mtf || {};
  const structure = result.structure || result.executionStructure || {};
  const sweep = result.sweep || result.liquiditySweep || {};
  const disp = result.displacement || result.candleDisplacement || {};
  const fvg = result.fvg || result.fvgZone || {};
  const ob = result.orderBlock || result.ob || {};
  const parts = [
    `MTF=${String(mtf.alignment || result.mtfAlignment || 'N/A')}`,
    `MTF_BIAS=${String(mtf.bias || result.mtfBias || result.bias || 'N/A')}`,
    `SWEEP=${gateValue(c, ['liquiditySweep','sweep','liquidity']) !== 'N/A' ? gateValue(c, ['liquiditySweep','sweep','liquidity']) : String(sweep.bias || (sweep.confirmed ? 'PASS' : 'WAIT')).toUpperCase()}`,
    `MSS=${gateValue(c, ['mss','marketStructureShift']) !== 'N/A' ? gateValue(c, ['mss','marketStructureShift']) : String(structure.mss || 'N/A').toUpperCase()}`,
    `BOS=${gateValue(c, ['bos','breakOfStructure']) !== 'N/A' ? gateValue(c, ['bos','breakOfStructure']) : String(structure.bos || 'N/A').toUpperCase()}`,
    `DISP=${gateValue(c, ['displacement','displacementConfirmed']) !== 'N/A' ? gateValue(c, ['displacement','displacementConfirmed']) : String(disp.confirmed ? 'PASS' : 'WAIT').toUpperCase()}`,
    `FVG=${gateValue(c, ['fvg','fvgConfirmed']) !== 'N/A' ? gateValue(c, ['fvg','fvgConfirmed']) : String(fvg.found ? 'PASS' : 'WAIT').toUpperCase()}`,
    `OB=${gateValue(c, ['orderBlock','ob','orderBlockConfirmed']) !== 'N/A' ? gateValue(c, ['orderBlock','ob','orderBlockConfirmed']) : String(ob.found ? 'PASS' : 'WAIT').toUpperCase()}`,
    `ENTRY=${gateValue(c, ['entryZone','executionZone','retest'])}`,
    `SPREAD=${gateValue(c, ['spread','spreadValid'])}`,
    `ALL=${String(c.allGatesPassed ?? result.allGatesPassed ?? result.tradeAuthorized ?? false).toUpperCase()}`
  ];
  console.log(`[V-TRADE ICT DIAGNOSTIC] ${parts.join(' | ')}`);
}

async function runScan() {
  if (running) return;
  running = true;
  scanSeq += 1;
  const started = Date.now();
  console.log(`[TELEGRAM AUTO] Scan start | seq=${scanSeq} | MT5_READY=${mt5Ready()}`);
  try {
    // Hook point: existing server scanner remains authoritative.
    // Never block analysis on Telegram send/delivery.
    if (typeof global.vtradeRunTelegramScan === 'function') {
      const result = await Promise.race([
        Promise.resolve(global.vtradeRunTelegramScan()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('scan-timeout')), 12000))
      ]);
      diagnostics(result);
      const score = Number(result?.score ?? result?.directionScore ?? result?.confluenceScore);
      const scoreText = Number.isFinite(score) ? ` | score=${Math.round(score)}` : '';
      const status = String(result?.status || result?.decision || result?.action || 'READY');
      console.log(`[TELEGRAM AUTO] Scan OK | seq=${scanSeq} | elapsedMs=${Date.now()-started} | signal=${String(result?.signal || result?.action || 'WAIT').toUpperCase()} | bias=${String(result?.bias || result?.direction || 'N/A').toUpperCase()}${scoreText} | status=${status}`);
    } else {
      console.log(`[TELEGRAM AUTO] Scan READY | seq=${scanSeq} | elapsedMs=${Date.now()-started} | scanner-hook=not-exposed`);
    }
  } catch (e) {
    console.error(`[TELEGRAM AUTO] Scan ERROR | seq=${scanSeq} | elapsedMs=${Date.now()-started} | reason=${e.message}`);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  timer = setInterval(runScan, INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log(`[TELEGRAM AUTO] Continuity guard ACTIVE | interval=${INTERVAL_MS}ms | analysis-independent-delivery=true | ict-diagnostics=true`);
  setTimeout(runScan, 1500).unref?.();
}

start();
module.exports = { runScan, start };
