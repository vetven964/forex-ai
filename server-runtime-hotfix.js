// V-TRADE AI runtime hotfixes loaded before the production launcher.
// This file intentionally patches only server source transformation/diagnostics.
// It does NOT modify Telegram, entry/SL/TP, or order execution logic.
'use strict';

const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync.bind(fs);
const SERVER_FILE = path.resolve(__dirname, 'server.js');
let installed = false;

function patchServerSource(source) {
  let out = String(source);

  // 1) Make D1 visible in the authoritative MT5 feed log.
  // brokerFeed.timeframes already stores the complete incoming payload;
  // this only exposes D1 count so Render proves the 5-TF transport.
  out = out.replace(
    "const frames=['M5','M15','H1','H4'];",
    "const frames=['M5','M15','H1','H4','D1'];"
  );
  out = out.replace(
    "console.log(`[MT5 FEED] QUOTE OK | seq=${brokerFeed.sequence} | symbol=${brokerFeed.symbol} | state=READY | M5=${counts.M5} M15=${counts.M15} H1=${counts.H1} H4=${counts.H4}`);",
    "console.log(`[MT5 FEED] QUOTE OK | seq=${brokerFeed.sequence} | symbol=${brokerFeed.symbol} | state=READY | M5=${counts.M5} M15=${counts.M15} H1=${counts.H1} H4=${counts.H4} D1=${counts.D1}`);"
  );

  // 2) Keep AI confirmation confirmation-only, but expose the actual provider
  // error instead of hiding it behind status=error. This is diagnostics only.
  out = out.replace(
    "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'}`);",
    "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'} model=${ai.model || OPENAI_MODEL}${ai.error ? ` error=${String(ai.error).slice(0,220)}` : ''}${ai.errorCode ? ` code=${ai.errorCode}` : ''}${ai.httpStatus ? ` http=${ai.httpStatus}` : ''}`);"
  );

  // 3) Preserve the exact provider error in the AI result for /api/ai/analysis/xauusd.
  const oldErrorReturn = "return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};";
  const newErrorReturn = "return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),errorCode:String(e.code||e.type||''),httpStatus:Number.isFinite(Number(e.status))?Number(e.status):null,decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};";
  out = out.replace(oldErrorReturn, newErrorReturn);

  return out;
}

if (!installed) {
  fs.readFileSync = function(file, options) {
    const resolved = path.resolve(String(file));
    const value = originalReadFileSync(file, options);
    if (resolved !== SERVER_FILE) return value;
    if (Buffer.isBuffer(value)) return Buffer.from(patchServerSource(value.toString('utf8')));
    return patchServerSource(value);
  };
  installed = true;
  console.log('[V-TRADE RUNTIME] D1 feed diagnostics + AI error diagnostics active');
}
