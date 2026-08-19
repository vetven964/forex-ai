// V-TRADE AI — AI Confirmation Runtime V3
// Diagnostics + API compatibility hotfix. Never promotes an order.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_AI_CONFIRM_RUNTIME_V3';

if (fs.existsSync(SERVER)) {
  let s = fs.readFileSync(SERVER, 'utf8');
  let changed = false;

  const replaceOnce = (from, to) => {
    if (s.includes(from)) { s = s.replace(from, to); changed = true; return true; }
    return false;
  };

  replaceOnce(
    "const OPENAI_TIMEOUT_MS = Math.max(2500, Number(process.env.OPENAI_TIMEOUT_MS || 9000));",
    "const OPENAI_TIMEOUT_MS = Math.max(5000, Number(process.env.OPENAI_TIMEOUT_MS || 12000));"
  );

  replaceOnce(
    "const timer=setTimeout(()=>controller.abort(),OPENAI_TIMEOUT_MS);\n  try {\n    const r=await fetch('https://api.openai.com/v1/responses',{",
    "const aiStartedAt=Date.now();\n  const timer=setTimeout(()=>controller.abort(),OPENAI_TIMEOUT_MS);\n  try {\n    const r=await fetch('https://api.openai.com/v1/responses',{"
  );

  replaceOnce(
    "text:{format:{type:'json_object'}}",
    "text:{format:{type:'json_schema',name:'xau_ai_confirmation',strict:true,schema:{type:'object',additionalProperties:false,properties:{decision:{type:'string',enum:['BUY','SELL','WAIT']},confidence:{type:'number'},agreement:{type:'string',enum:['AGREE','DISAGREE','NEUTRAL']},reasons:{type:'array',items:{type:'string'}},missingConfirmations:{type:'array',items:{type:'string'}},riskFlags:{type:'array',items:{type:'string'}},summary:{type:'string'}},required:['decision','confidence','agreement','reasons','missingConfirmations','riskFlags','summary']}}}"
  );

  replaceOnce(
    "if(!r.ok) throw new Error(body?.error?.message || `OpenAI HTTP ${r.status}`);",
    "if(!r.ok){ const apiErr=body?.error||{}; const detail=apiErr.message||`OpenAI HTTP ${r.status}`; throw new Error(`[HTTP ${r.status}] ${apiErr.type||'api_error'}${apiErr.code?`/${apiErr.code}`:''}${apiErr.param?` param=${apiErr.param}`:''}: ${detail}`); }"
  );

  const oldCatch = "} catch(e) {\n    return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};\n  } finally { clearTimeout(timer); }";
  const newCatch = "} catch(e) {\n    const elapsedMs=Date.now()-aiStartedAt;\n    const status=e.name==='AbortError'?'timeout':'error';\n    const errText=String(e.message||'OpenAI confirmation failed').slice(0,500);\n    console.error(`[AI CONFIRM ERROR] status=${status} model=${OPENAI_MODEL} elapsedMs=${elapsedMs} timeoutMs=${OPENAI_TIMEOUT_MS} detail=${errText}`);\n    return {enabled:true,configured:true,model:OPENAI_MODEL,status,error:errText,latencyMs:elapsedMs,decision:'WAIT',confidence:null,agreement:'N/A',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};\n  } finally { clearTimeout(timer); }";
  replaceOnce(oldCatch, newCatch);

  const oldLog = "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'}`);";
  const newLog = "console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 'N/A'} agreement=${ai.agreement || 'N/A'} final=${ai.gate?.finalSignal || 'WAIT'} model=${ai.model || OPENAI_MODEL}${ai.latencyMs!=null?` latencyMs=${ai.latencyMs}`:''}${ai.error?` error=${String(ai.error).replace(/\\s+/g,' ').slice(0,300)}`:''}`);";
  replaceOnce(oldLog, newLog);

  if (!s.includes(MARK)) {
    s = `// ${MARK} installed by runtime hotfix\n` + s;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(SERVER, s, 'utf8');
    console.log('[V-TRADE AI] AI Confirmation Runtime V3 diagnostics synchronized');
  } else {
    console.log('[V-TRADE AI] AI Confirmation Runtime V3 already synchronized');
  }
}
