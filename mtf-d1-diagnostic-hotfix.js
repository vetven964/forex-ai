// V-TRADE AI — D1 MTF readiness diagnostic hotfix
// Diagnostics only: does not alter signal scoring, trade authorization, or Telegram policy.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const MARKER = '// V-TRADE AI D1 MTF DIAGNOSTIC HOTFIX INSTALLED';

function patchServer() {
  try {
    let source = fs.readFileSync(SERVER_FILE, 'utf8');
    if (source.includes(MARKER)) {
      console.log('[V-TRADE MTF] D1 diagnostic already active');
      return;
    }

    // Keep the existing M5/M15/H1/H4 execution gate unchanged.
    // Add D1 only as an independent context/readiness diagnostic.
    const oldSnapshot = "const required=['M5','M15','H1','H4'];";
    const newSnapshot = "const required=['M5','M15','H1','H4'];\\n  const contextRequired=['M5','M15','H1','H4','D1'];";
    if (!source.includes(oldSnapshot)) throw new Error('telegramAutoReadinessSnapshot() marker not found');
    source = source.replace(oldSnapshot, newSnapshot);

    const oldFrames = "frames[tf]=Array.isArray(arr)?arr.length:0;\\n  }\\n  const connected=brokerFeedFresh();\\n  const ready=connected && required.every(tf=>frames[tf]>=30);\\n  return {ready,connected,ageSec,frames};";
    const newFrames = "frames[tf]=Array.isArray(arr)?arr.length:0;\\n  }\\n  const d1=brokerFeed.timeframes?.D1;\\n  const d1Count=Array.isArray(d1)?d1.length:0;\\n  const connected=brokerFeedFresh();\\n  const ready=connected && required.every(tf=>frames[tf]>=30);\\n  const contextReady=connected && contextRequired.every(tf => (tf==='D1'?d1Count:frames[tf])>=30);\\n  return {ready,contextReady,connected,ageSec,frames,d1Count};";
    if (!source.includes(oldFrames)) throw new Error('readiness return marker not found');
    source = source.replace(oldFrames, newFrames);

    const oldKey = "const readinessKey=`${r.ready?'READY':'NOT_READY'}:${r.connected?'CONNECTED':'DISCONNECTED'}:${r.frames.M5}:${r.frames.M15}:${r.frames.H1}:${r.frames.H4}`;";
    const newKey = "const readinessKey=`${r.ready?'READY':'NOT_READY'}:${r.contextReady?'D1READY':'D1WAIT'}:${r.connected?'CONNECTED':'DISCONNECTED'}:${r.frames.M5}:${r.frames.M15}:${r.frames.H1}:${r.frames.H4}:${r.d1Count}`;";
    if (!source.includes(oldKey)) throw new Error('readiness key marker not found');
    source = source.replace(oldKey, newKey);

    const oldReadyLog = "console.log(`[TELEGRAM AUTO] MT5 READY | ageSec=${r.ageSec} | M5=${r.frames.M5} M15=${r.frames.M15} H1=${r.frames.H1} H4=${r.frames.H4}`);";
    const newReadyLog = "console.log(`[TELEGRAM AUTO] MT5 READY | ageSec=${r.ageSec} | M5=${r.frames.M5} M15=${r.frames.M15} H1=${r.frames.H1} H4=${r.frames.H4} | D1=${r.d1Count} | D1_CONTEXT=${r.contextReady?'READY':'WAIT'}`);";
    if (!source.includes(oldReadyLog)) throw new Error('ready log marker not found');
    source = source.replace(oldReadyLog, newReadyLog);

    const oldWaitLog = "console.warn(`[TELEGRAM AUTO] Waiting for MT5 MTF | connected=${r.connected} ageSec=${r.ageSec===null?'null':r.ageSec} | M5=${r.frames.M5} M15=${r.frames.M15} H1=${r.frames.H1} H4=${r.frames.H4}`);";
    const newWaitLog = "console.warn(`[TELEGRAM AUTO] Waiting for MT5 MTF | connected=${r.connected} ageSec=${r.ageSec===null?'null':r.ageSec} | M5=${r.frames.M5} M15=${r.frames.M15} H1=${r.frames.H1} H4=${r.frames.H4} | D1=${r.d1Count}`);";
    if (!source.includes(oldWaitLog)) throw new Error('wait log marker not found');
    source = source.replace(oldWaitLog, newWaitLog);

    source = MARKER + '\n' + source;
    fs.writeFileSync(SERVER_FILE, source, 'utf8');
    console.log('[V-TRADE MTF] D1 diagnostic patch installed | execution gate unchanged | D1=context only');
  } catch (e) {
    console.error('[V-TRADE MTF] D1 diagnostic patch failed:', e.message);
    process.exitCode = 1;
  }
}

patchServer();
