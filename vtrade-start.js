const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DASHBOARD = path.join(ROOT, 'premium-dashboard-live.html');
const TELEGRAM = path.join(ROOT, 'ai-telegram-diagnostic-hotfix.js');
const PREMARKET = path.join(ROOT, 'terminal-pre-market.js');
const MARK = 'VTRADE_PHONE_AND_TELEGRAM_TRUTH_FIX_V2';
const AI_BUTTON = 'vtrade-ai-button-hotfix.js';
const AI_SAFE = path.join(ROOT, 'pre-market-ai-safe-hotfix.js');

function patchFile(file, transform) {
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next, 'utf8');
}

// Apply the pre-market AI safety patch before the runtime/diagnostic layers.
// AI is confirmation-only and provider errors must never become trade signals.
if (fs.existsSync(AI_SAFE)) require(AI_SAFE);

// MOBILE + DESKTOP: Analyze AI must run Candle-Open MTF first and WAIT for it
// before requesting AI. The old handler fired both promises at the same time,
// creating a race where AI could see stale/incomplete MTF state.
patchFile(PREMARKET, source => {
  const old = "host.querySelector('#vpmAnalyze').onclick=()=>{loadPM();loadAI();};";
  const neu = "host.querySelector('#vpmAnalyze').onclick=async()=>{if(state.busy)return;await loadPM();if(state.pm?.complete)await loadAI();};";
  if (!source.includes(old)) return source;
  return source.replace(old, neu);
});

patchFile(DASHBOARD, source => {
  if (source.includes(MARK)) return source;
  const css = `
<style id="${MARK}">
/* ${MARK}: UI-only responsive layer */
html,body{width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;}
body{font-family:'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif;}
img,svg,canvas,video{max-width:100%;}
@media(max-width:767px){
  .app{display:block!important;min-width:0!important;width:100%!important;}
  .main{min-width:0!important;width:100%!important;}
  .top{width:100%!important;min-width:0!important;padding:8px 9px!important;gap:7px!important;}
  .pair{min-width:0!important;}.price{font-size:clamp(23px,7vw,30px)!important;}
  .tfs{min-width:0!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:2px!important;}
  .tfs button,.lang-btn{min-width:44px!important;min-height:40px!important;padding:8px 10px!important;flex:0 0 auto!important;}
  .wrap{width:100%!important;max-width:100%!important;padding:9px!important;}.toolbar{min-width:0!important;}.api{min-width:0!important;width:100%!important;}
  .card{min-width:0!important;overflow:hidden!important;}.news-item,.gate,.level,.kv{min-width:0!important;}
  .news-title,.notice,.sub,.gate small,.level span,.level b{overflow-wrap:anywhere!important;word-break:break-word!important;}
  #vtradePreMarket{width:100%!important;max-width:100%!important;margin-top:8px!important;}
  #vtradePreMarket .vpm-card{padding:10px!important;border-radius:14px!important;}
  #vtradePreMarket .vpm-actions{width:100%!important;display:flex!important;overflow-x:auto!important;gap:5px!important;padding:0 4px 3px 0!important;}
  #vtradePreMarket .vpm-btn{min-height:38px!important;padding:7px 9px!important;font-size:9px!important;flex:0 0 auto!important;white-space:nowrap!important;}
  #vtradePreMarket #vpmAnalyze{min-width:74px!important;}
  #vtradePreMarket .vpm-grid{grid-template-columns:1fr!important;gap:7px!important;}
  #vtradePreMarket .vpm-box{padding:10px!important;border-radius:11px!important;}.vpm-score{font-size:25px!important;}
  #vtradePreMarket .vpm-row{font-size:10px!important;gap:7px!important;}.vpm-gates{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}
  #vtradePreMarket .vpm-gate{padding:8px!important;font-size:9px!important;}
  #vtradePreMarket .vpm-mtf-row{grid-template-columns:34px minmax(0,1fr) 52px!important;gap:6px!important;padding:7px!important;font-size:9px!important;}
}
@media(max-width:380px){.wrap{padding:7px!important;}.price{font-size:23px!important;}#vtradePreMarket .vpm-card{padding:8px!important;}#vtradePreMarket .vpm-title{font-size:14px!important;}}
</style>
`;
  return source.replace('</head>', css + '</head>');
});

patchFile(DASHBOARD, source => {
  if (source.includes(AI_BUTTON)) return source;
  const anchor = '  <script src="terminal-pre-market.js"></script>';
  if (!source.includes(anchor)) return source;
  return source.replace(anchor, anchor + `\n  <script src="${AI_BUTTON}?v=20260819-ai-fix"></script>`);
});

patchFile(TELEGRAM, source => {
  if (source.includes(MARK)) return source;
  const old = "  const bias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();\n  const score = firstFinite(a?.directionScore, a?.score?.directionScore, a?.score, a?.aiScore) ?? 0;";
  const neu = `  // ${MARK}: authoritative core-MTF direction for Telegram
  const coreTfs = ['H4','H1','M15'];
  const coreRows = coreTfs.map(tf => (a?.timeframes?.[tf] || a?.mtf?.timeframes?.[tf] || a?.mtf?.[tf] || a?.multiTimeFrame?.[tf] || a?.multiTimeFrame?.[tf.toLowerCase()] || a?.[tf] || a?.[tf.toLowerCase()] || null)).filter(Boolean);
  const biasOf = x => String(x?.structure?.bias || x?.structureBias || x?.resolvedBias || x?.trend || x?.directionBand || x?.direction || x?.bias || '').toUpperCase();
  const coreBiases = coreRows.map(biasOf);
  const coreBull = coreBiases.filter(x => x.includes('BULL') || x === 'BUY').length;
  const coreBear = coreBiases.filter(x => x.includes('BEAR') || x === 'SELL').length;
  const coreBias = coreBull >= 2 ? 'BULLISH' : coreBear >= 2 ? 'BEARISH' : 'NEUTRAL';
  const fallbackBias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();
  const bias = coreBias !== 'NEUTRAL' ? coreBias : fallbackBias;
  const evidence = coreRows.map(x => ({bp:firstFinite(x?.buyPct,x?.buyStrengthPct,x?.buyScore),sp:firstFinite(x?.sellPct,x?.sellStrengthPct,x?.sellScore)})).filter(x => x.bp !== null || x.sp !== null);
  let score = 50;
  if (evidence.length) { const vals=evidence.map(x=>bias==='BEARISH'?(x.sp ?? (100-(x.bp ?? 50))):(x.bp ?? (100-(x.sp ?? 50)))); score=Math.round(vals.reduce((s,x)=>s+Math.max(0,Math.min(100,x)),0)/vals.length); }
  else score = firstFinite(a?.directionScore,a?.score?.directionScore,a?.score,a?.aiScore) ?? 50;
  if (!isConfirmed) score=Math.min(85,score); else score=Math.min(95,score);`;
  if (!source.includes(old)) throw new Error('Telegram bias anchor not found; refusing unsafe patch');
  return source.replace(old, neu);
});

// Pre-Market UI must consume the same directional zones and execution state
// emitted by the authoritative MT5 route. This runs before the dashboard loads.
if (fs.existsSync(path.join(ROOT, 'premarket-ui-truth-hotfix.js'))) require('./premarket-ui-truth-hotfix.js');

console.log('[VTRADE START] phone UI + Telegram truth sync + deterministic AI button fix ready');
require('./vtrade-logic-ui-hotfix.js');
require('./ai-telegram-diagnostic-hotfix.js');
