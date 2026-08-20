// V-TRADE AI — Pre-Market AI Safe/Truth Hotfix V3
// Compatibility-safe patch: never crash the production launcher when the
// legacy aiHandler anchor is absent. The current selected-TF AI route is
// installed separately and remains authoritative for /api/pre-market/ai.
// AI is confirmation-only. Provider failure is UNAVAILABLE, never confidence=0.
'use strict';

const fs = require('fs');
const path = require('path');

const PRE = path.resolve(__dirname, 'pre-market-launcher-hook.js');
const TERM = path.resolve(__dirname, 'terminal-pre-market.js');
const MARK = 'VTRADE_PREMARKET_AI_SAFE_V3';

function patchFile(file, transform) {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next, 'utf8');
}

// The previous V2 patch expected an old `aiHandler` block inside
// pre-market-launcher-hook.js. The current launcher hook exposes the generic
// candle-open `handler` instead, so V2 threw during require() and killed the
// Telegram watchdog. Never make a missing optional patch anchor fatal.
patchFile(PRE, source => {
  if (source.includes(MARK)) return source;

  const legacyStart = source.indexOf(' async function aiHandler(req,res){');
  const route = source.indexOf(" app.options('/api/pre-market/candle-open',handler);");

  if (legacyStart < 0 || route < 0 || route <= legacyStart) {
    console.warn('[V-TRADE AI SAFE V3] legacy aiHandler anchor absent; skipping legacy PRE patch safely. Selected-TF AI route remains independent.');
    return source + `\n/* ${MARK}: legacy aiHandler patch intentionally skipped; no runtime mutation required. */\n`;
  }

  const handler = `\n async function aiHandler(req,res){
  cors(req,res);res.set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.status(204).end();
  try{
   const raw=await fetchAnalysis(req), pm=calculate(raw);
   if(!pm.complete)return res.status(409).json({success:false,error:'Pre-Market MTF incomplete; D1 is required before AI confirmation',preMarket:pm,ai:{status:'blocked',decision:'WAIT',confidence:null,agreement:'N/A'}});

   const aiEnabled=String(process.env.OPENAI_ENABLED||'false').toLowerCase()==='true';
   if(!aiEnabled){
    return res.json({success:true,preMarket:pm,engine:null,ai:{status:'disabled',decision:'DISABLED',confidence:null,agreement:'N/A',configured:false,enabled:false,reasons:['OPENAI_ENABLED is not true; deterministic ICT engine remains authoritative.']}});
   }

   const engine=await buildXauAnalysis();
   try{
    const ai=await openAIConfirmXauAnalysis(engine);
    return res.json({success:true,preMarket:pm,engine,ai:{...ai,status:ai?.status||'ok',configured:true,enabled:true}});
   }catch(aiErr){
    console.error('[AI CONFIRM] provider error — non-blocking:',String(aiErr?.message||aiErr));
    return res.json({success:true,preMarket:pm,engine,ai:{status:'unavailable',decision:'UNAVAILABLE',confidence:null,agreement:'N/A',configured:true,enabled:true,error:'AI confirmation unavailable; no trade is promoted by AI.'}});
   }
  }catch(e){
   console.error('[PRE-MARKET AI] endpoint error:',String(e?.message||e));
   return res.status(Number(e?.status)||502).json({success:false,error:String(e?.message||e),ai:{status:'error',decision:'UNAVAILABLE',confidence:null,agreement:'N/A'}});
  }
 }
`;
  return source.slice(0, legacyStart) + handler + source.slice(route);
});

// Render AI state truthfully. This patch is independent of the server route
// implementation and therefore remains safe when the backend route changes.
patchFile(TERM, source => {
  if (source.includes(MARK)) return source;

  source = source.replace(
    "<div class=\"vpm-row\"><span>Confidence</span><b>${pct(state.ai.confidence)}/100</b></div>",
    "<div class=\"vpm-row\"><span>Confidence</span><b>${(['unavailable','error','timeout','disabled','blocked'].includes(String(state.ai?.status||'').toLowerCase())||state.ai?.confidence==null)?'N/A':pct(state.ai.confidence)+'/100'}</b></div>"
  );
  source = source.replace(
    "<div class=\"vpm-row\"><span>Agreement</span><b>${esc(state.ai.agreement||'NEUTRAL')}</b></div>",
    "<div class=\"vpm-row\"><span>Agreement</span><b>${esc(state.ai.agreement||(['unavailable','error','timeout','disabled','blocked'].includes(String(state.ai?.status||'').toLowerCase())?'N/A':'NEUTRAL'))}</b></div>"
  );
  source = source.replace(
    "<div class=\"vpm-row\"><span>Decision</span><b>${esc(state.ai.decision||'WAIT')}</b></div>",
    "<div class=\"vpm-row\"><span>Decision</span><b>${esc(state.ai.decision||(['unavailable','error','timeout'].includes(String(state.ai?.status||'').toLowerCase())?'UNAVAILABLE':'WAIT'))}</b></div>"
  );
  source = source.replace(
    "${esc((state.ai.reasons||state.ai.key_drivers||[]).join(' · ') || state.ai.summary || 'No AI confirmation details.')}",
    "${esc((state.ai.reasons||state.ai.key_drivers||[]).join(' · ') || state.ai.summary || state.ai.error || (state.ai.status==='disabled'?'AI confirmation is disabled; deterministic ICT engine remains authoritative.':'AI confirmation unavailable; no trade is promoted by AI.'))}"
  );
  return source.replace(
    'AI confirmation loaded after complete M5 → M15 → H1 → H4 → D1 processing.',
    'AI confirmation state loaded after complete M5 → M15 → H1 → H4 → D1 processing. AI is optional and never authorizes an order.'
  ) + `\n/* ${MARK} */\n`;
});

console.log('[V-TRADE AI SAFE V3] compatibility-safe optional AI confirmation hotfix active');
