'use strict';

// V-TRADE Telegram scanner safety/continuity guard.
// This module is intentionally independent from Telegram credentials:
// MT5 READY -> analysis scan must continue even when Telegram delivery is unavailable.
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
      console.log(`[TELEGRAM AUTO] Scan OK | seq=${scanSeq} | elapsedMs=${Date.now()-started} | result=${String(result?.signal || result?.action || 'READY')}`);
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
  console.log(`[TELEGRAM AUTO] Continuity guard ACTIVE | interval=${INTERVAL_MS}ms | analysis-independent-delivery=true`);
  setTimeout(runScan, 1500).unref?.();
}

start();
module.exports = { runScan, start };
