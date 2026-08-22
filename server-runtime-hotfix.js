// V-TRADE AI runtime hotfixes loaded before the production launcher.
'use strict';
const fs=require('fs');
const path=require('path');
const originalReadFileSync=fs.readFileSync.bind(fs);
const SERVER_FILE=path.resolve(__dirname,'server.js');
let installed=false;

// Canonical architecture: CORE owns MT5/Pre-Market/ICT analysis only.
// Legacy Telegram Auto must never start inside CORE, even if Render dashboard
// environment variables still contain TELEGRAM_AUTO_ALERT_ENABLED=true.
process.env.TELEGRAM_AUTO_ALERT_ENABLED='false';
process.env.TELEGRAM_AUTO_ALERT_INTERVAL_MS='0';
process.env.TELEGRAM_AUTO_TOKEN='';
process.env.TELEGRAM_AUTO_CHAT_ID='';
console.log('[V-TRADE TELEGRAM SEPARATION] LEGACY CORE TELEGRAM AUTO = HARD DISABLED');

function patchServerSource(source){
  let out=String(source);
  out=out.replace("const frames=['M5','M15','H1','H4'];","const frames=['M5','M15','H1','H4','D1'];");
  out=out.replace("console.log(`[MT5 FEED] QUOTE OK | seq=${brokerFeed.sequence} | symbol=${brokerFeed.symbol} | state=READY | M5=${counts.M5} M15=${counts.M15} H1=${counts.H1} H4=${counts.H4}`);","console.log(`[MT5 FEED] QUOTE OK | seq=${brokerFeed.sequence} | symbol=${brokerFeed.symbol} | state=READY | M5=${counts.M5} M15=${counts.M15} H1=${counts.H1} H4=${counts.H4} D1=${counts.D1}`);");
  const configNeedle="const OPENAI_MIN_SCORE = Math.max(0, Math.min(100, Number(process.env.OPENAI_MIN_SCORE || 76)));";
  if(out.includes(configNeedle)&&!out.includes('[AI CONFIG] enabled=')) out=out.replace(configNeedle,configNeedle+"\nconsole.log(`[AI CONFIG] enabled=${OPENAI_ENABLED} keyPresent=${Boolean(OPENAI_API_KEY)} model=${OPENAI_MODEL} timeoutMs=${OPENAI_TIMEOUT_MS}`);");
  out=out.replace("text:{format:{type:'json_object'}}","text:{format:{type:'json_schema',name:'xau_ai_confirmation',strict:true,schema:{type:'object',additionalProperties:false,properties:{decision:{type:'string',enum:['BUY','SELL','WAIT']},confidence:{type:'number',minimum:0,maximum:100},agreement:{type:'string',enum:['AGREE','DISAGREE','NEUTRAL']},reasons:{type:'array',items:{type:'string'}},missingConfirmations:{type:'array',items:{type:'string'}},riskFlags:{type:'array',items:{type:'string'}},summary:{type:'string'}},required:['decision','confidence','agreement','reasons','missingConfirmations','riskFlags','summary']}}}");
  out=out.replace("if(!r.ok) throw new Error(body?.error?.message || `OpenAI HTTP ${r.status}`);","if(!r.ok){const apiErr=body?.error||{};const err=new Error(apiErr.message||`OpenAI HTTP ${r.status}`);err.status=r.status;err.code=apiErr.code||'';err.type=apiErr.type||'';err.param=apiErr.param||'';throw err;}");
  out=out.replace("try { parsed=JSON.parse(raw); } catch (_) { throw new Error('OpenAI returned non-JSON confirmation'); }","try { parsed=JSON.parse(raw); } catch (_) { const err=new Error('OpenAI returned non-JSON confirmation'); err.code='INVALID_JSON'; throw err; }");
  const oldLog="console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'}`);";
  const newLog="console.log(`[AI CONFIRM] status=${ai.status} decision=${ai.decision} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} final=${ai.gate?.finalSignal || 'WAIT'} model=${ai.model || OPENAI_MODEL}${ai.error ? ` error=${String(ai.error).replace(/\\s+/g,' ').slice(0,300)}` : ''}${ai.errorCode ? ` code=${ai.errorCode}` : ''}${ai.httpStatus ? ` http=${ai.httpStatus}` : ''}`);";
  out=out.replace(oldLog,newLog);
  const oldErrorReturn="return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),errorCode:String(e.code||e.type||''),httpStatus:Number.isFinite(Number(e.status))?Number(e.status):null,decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};";
  const oldBasic="return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:String(e.message||'OpenAI confirmation failed').slice(0,300),decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};";
  const newError="const errText=String(e.message||'OpenAI confirmation failed').slice(0,500);console.error(`[AI CONFIRM ERROR] status=${e.name==='AbortError'?'timeout':'error'} model=${OPENAI_MODEL} http=${Number.isFinite(Number(e.status))?Number(e.status):'N/A'} type=${String(e.type||'')} code=${String(e.code||'')} param=${String(e.param||'')} detail=${errText}`);return {enabled:true,configured:true,model:OPENAI_MODEL,status:e.name==='AbortError'?'timeout':'error',error:errText,errorCode:String(e.code||e.type||''),httpStatus:Number.isFinite(Number(e.status))?Number(e.status):null,decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[],missingConfirmations:[],riskFlags:['AI confirmation unavailable; deterministic gate remains authoritative'],summary:'AI confirmation unavailable; no trade signal is promoted.'};";
  if(out.includes(oldErrorReturn)) out=out.replace(oldErrorReturn,newError); else if(out.includes(oldBasic)) out=out.replace(oldBasic,newError);
  return out;
}
if(!installed){fs.readFileSync=function(file,options){const resolved=path.resolve(String(file));const value=originalReadFileSync(file,options);if(resolved!==SERVER_FILE)return value;if(Buffer.isBuffer(value))return Buffer.from(patchServerSource(value.toString('utf8')));return patchServerSource(value);};installed=true;console.log('[V-TRADE RUNTIME] D1 + AI provider diagnostics + Structured Outputs active');}
