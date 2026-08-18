const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DASHBOARD = path.join(ROOT, 'premium-dashboard-live.html');
const TELEGRAM = path.join(ROOT, 'ai-telegram-diagnostic-hotfix.js');
const MARK = 'VTRADE_PHONE_AND_TELEGRAM_TRUTH_FIX_V1';

function patchFile(file, transform) {
  let source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next, 'utf8');
}

patchFile(DASHBOARD, source => {
  if (source.includes(MARK)) return source;
  const css = `
<style id="${MARK}">
/* ${MARK}: UI-only mobile layer */
html,body{width:100%;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;}
body{font-family:'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif;}
img,svg,canvas,video{max-width:100%;}
@media(max-width:767px){
  .app{display:block!important;min-width:0!important;width:100%!important;}
  .main{min-width:0!important;width:100%!important;}
  .top{width:100%!important;min-width:0!important;padding:8px 9px!important;gap:7px!important;}
  .pair{min-width:0!important;}
  .price{font-size:clamp(23px,7vw,30px)!important;}
  .tfs{min-width:0!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:2px;}
  .tfs button,.lang-btn{min-width:44px!important;min-height:40px!important;padding:8px 10px!important;flex:0 0 auto!important;}
  .wrap{width:100%!important;max-width:100%!important;padding:9px!important;}
  .toolbar{min-width:0!important;}
  .api{min-width:0!important;width:100%!important;}
  .card{min-width:0!important;overflow:hidden!important;}
  .news-item,.gate,.level,.kv{min-width:0!important;}
  .news-title,.notice,.sub,.gate small,.level span,.level b{overflow-wrap:anywhere!important;word-break:break-word!important;}
  #vtradePreMarket{width:100%!important;max-width:100%!important;margin-top:8px!important;}
  #vtradePreMarket .vpm-card{padding:10px!important;border-radius:14px!important;}
  #vtradePreMarket .vpm-head{gap:8px!important;margin-bottom:8px!important;}
  #vtradePreMarket .vpm-title{font-size:15px!important;line-height:1.25!important;}
  #vtradePreMarket .vpm-sub{font-size:8px!important;line-height:1.35!important;}
  #vtradePreMarket .vpm-actions{width:100%!important;display:flex!important;overflow-x:auto!important;gap:5px!important;padding-bottom:2px!important;}
  #vtradePreMarket .vpm-btn{min-height:38px!important;padding:7px 9px!important;font-size:9px!important;flex:0 0 auto!important;}
  #vtradePreMarket .vpm-grid{grid-template-columns:1fr!important;gap:7px!important;}
  #vtradePreMarket .vpm-box{padding:10px!important;border-radius:11px!important;}
  #vtradePreMarket .vpm-score{font-size:25px!important;}
  #vtradePreMarket .vpm-row{font-size:10px!important;gap:7px!important;}
  #vtradePreMarket .vpm-gates{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}
  #vtradePreMarket .vpm-gate{padding:8px!important;font-size:9px!important;}
  #vtradePreMarket .vpm-mtf-row{grid-template-columns:34px minmax(0,1fr) 52px!important;gap:6px!important;padding:7px!important;font-size:9px!important;}
  #vtradePreMarket .vpm-mtf-row .vpm-weight{grid-column:2 / 4!important;font-size:8px!important;line-height:1.2!important;}
  #vtradePreMarket .vpm-open{font-size:8px!important;}
  #vtradePreMarket .vpm-news-item{grid-template-columns:7px minmax(0,1fr)!important;}
  #vtradePreMarket .vpm-chip{grid-column:2!important;width:max-content!important;}
  #vtradePreMarket .vpm-news-title{font-size:13px!important;}
  #vtradePreMarket .vpm-count{font-size:18px!important;}
}
@media(max-width:380px){
  .wrap{padding:7px!important;}
  .price{font-size:23px!important;}
  #vtradePreMarket .vpm-card{padding:8px!important;}
  #vtradePreMarket .vpm-title{font-size:14px!important;}
  #vtradePreMarket .vpm-gates{grid-template-columns:1fr 1fr!important;}
  #vtradePreMarket .vpm-mtf-row{grid-template-columns:31px minmax(0,1fr) 48px!important;}
}
@media(max-width:767px) and (orientation:landscape){
  .top{position:sticky!important;top:0!important;}
  #vtradePreMarket .vpm-grid{grid-template-columns:1fr 1fr!important;}
  #vtradePreMarket .vpm-mtf-row{grid-template-columns:34px minmax(0,1fr) 52px!important;}
}
</style>
`;
  return source.replace('</head>', css + '</head>');
});

patchFile(TELEGRAM, source => {
  if (source.includes(MARK)) return source;
  const old = "  const bias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();\n  const score = firstFinite(a?.directionScore, a?.score?.directionScore, a?.score, a?.aiScore) ?? 0;";
  const neu = "  // ${MARK}: authoritative core-MTF direction for Telegram\n  const coreTfs = ['H4','H1','M15'];\n  const coreRows = coreTfs.map(tf => a?.timeframes?.[tf] || a?.mtf?.[tf] || null).filter(Boolean);\n  const coreBiases = coreRows.map(x => String(x?.structure?.bias || x?.resolvedBias || x?.trend || x?.bias || '').toUpperCase());\n  const coreBull = coreBiases.filter(x => x === 'BULLISH' || x === 'BUY').length;\n  const coreBear = coreBiases.filter(x => x === 'BEARISH' || x === 'SELL').length;\n  const coreBias = coreBull >= 2 ? 'BULLISH' : coreBear >= 2 ? 'BEARISH' : 'NEUTRAL';\n  const fallbackBias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();\n  const bias = coreBias !== 'NEUTRAL' ? coreBias : fallbackBias;\n  const coreScoreRows = coreRows.map(x => firstFinite(x?.directionScore, x?.score, x?.structure?.score)).filter(Number.isFinite);\n  const rawCoreScore = coreScoreRows.length ? coreScoreRows.reduce((s,x) => s + x, 0) / coreScoreRows.length : null;\n  const score = rawCoreScore !== null ? Math.round(bias === 'BEARISH' ? 100 - rawCoreScore : rawCoreScore) : (firstFinite(a?.directionScore, a?.score?.directionScore, a?.score, a?.aiScore) ?? 0);";
  if (!source.includes(old)) throw new Error('Telegram bias anchor not found; refusing unsafe patch');
  return source.replace(old, neu);
});

console.log('[VTRADE START] phone UI + Telegram core-MTF truth sync ready');
require('./ai-telegram-diagnostic-hotfix.js');
