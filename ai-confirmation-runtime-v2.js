// V-TRADE AI — AI Confirmation Runtime V2
// Diagnostic + compatibility hotfix. Never promotes an order.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_AI_CONFIRM_RUNTIME_V2';

if (fs.existsSync(SERVER)) {
  let s = fs.readFileSync(SERVER, 'utf8');
  if (!s.includes(MARK)) {
    const oldTimeout = "const OPENAI_TIMEOUT_MS = Math.max(2500, Number(process.env.OPENAI_TIMEOUT_MS || 9000));";
    const newTimeout = "const OPENAI_TIMEOUT_MS = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS || 12000));";
    if (s.includes(oldTimeout)) s = s.replace(oldTimeout, newTimeout);

    const oldTimer = "const timer=setTimeout(()=>controller.abort(),OPENAI_TIMEOUT_MS);\n  try {\n    const r=await fetch('https://api.openai.com/v1/responses',{";
    const newTimer = "const aiStartedAt=Date.now();\n  const timer=setTimeout(()=>controller.abort(),OPENAI_TIMEOUT_MS);\n  try {\n    const r=await fetch('https://api.openai.com/v1/responses',{";
    if (s.includes(oldTimer)) s = s.replace(oldTimer, newTimer);

    const oldHttp = "if(!r.ok) throw new Error(body?.error?.message || `OpenAI HTTP ${r.status}`);";
    const newHttp = "if(!r.ok){ const apiErr=body?.error||{}; const detail=apiErr.message||`OpenAI HTTP ${r.status}`; throw new Error(`[HTTP ${r.status}] ${apiErr.type||'api_error'}${apiErr.code?`/${apiErr.code}`:''}${apiErr.param?` param=${apiErr.param}`:''}: ${detail}`); }";
    if (s.includes(oldHttp)) s = s.replace(oldHttp, newHttp);

    const oldCatch = "} catch(e) {\n    return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};\n  } finally { clearTimeout(timer); }";
    const newCatch = "} catch(e) {\n    const elapsedMs=Date.now()-aiStartedAt;\n    const status=e.name==='AbortError'?'timeout':'error';\n    const errText=String(e.message||'OpenAI confirmation failed').slice(0,500);\n    console.error(`[AI CONFIRM ERROR] status=${status} model=${OPENAI_MODEL} elapsedMs=${elapsedMs} timeoutMs=${OPENAI_TIMEOUT_MS} detail=${errText}`);\n    return {enabled:true,configured:true,model:OPENAI_MODEL,status,error:errText,latencyMs:elapsedMs,decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};\n  } finally { clearTimeout(timer); }";
    if (s.includes(oldCatch)) s = s.replace(oldCatch, newCatch);

    const oldLog = "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'}`);";
    const newLog = "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'} model=${ai.model || OPENAI_MODEL}${ai.error?` error=${String(ai.error).replace(/\\s+/g,' ').slice(0,260)}`:''}`);";
    if (s.includes(oldLog)) s = s.replace(oldLog, newLog);

    s = s.replace("const MARK='VTRADE_AI_CONFIRM_RUNTIME_V2';", "const MARK='VTRADE_AI_CONFIRM_RUNTIME_V2';");
    s = "// " + MARK + " installed by runtime hotfix\n" + s;
    fs.writeFileSync(SERVER, s, 'utf8');
    console.log('[V-TRADE AI] AI Confirmation Runtime V2 installed');
  }
}
