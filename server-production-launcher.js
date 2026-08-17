// V-TRADE AI production launcher — deterministic logic fixes
// Keeps server.js as the source of truth and applies only safe runtime patches.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchMtfAndContext(source) {
  // Fix: structure() often returns RANGE during consolidation. RANGE is valid
  // structure, but it must not erase a real EMA/MACD directional bias from the
  // MTF dashboard. Priority: confirmed structure > EMA trend > MACD momentum.
  const oldTrend = "  const trend=e20&&e50 ? (e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL') : 'UNKNOWN';";
  const newTrend = oldTrend + "\n  const structureBias=(s?.bias==='BULLISH'||s?.bias==='BEARISH')?s.bias:null;\n  const trendBias=(trend==='BULLISH'||trend==='BEARISH')?trend:null;\n  const momentumBias=m?.histogram>0?'BULLISH':m?.histogram<0?'BEARISH':null;\n  const resolvedBias=structureBias||trendBias||momentumBias||'NEUTRAL';\n  const directionScore=Math.max(0,Math.min(100,Math.round(50+(resolvedBias==='BULLISH'?12:resolvedBias==='BEARISH'?-12:0)+(trendBias===resolvedBias?(resolvedBias==='BULLISH'?10:-10):0)+(momentumBias===resolvedBias?(resolvedBias==='BULLISH'?8:-8):0)+(r!=null?(resolvedBias==='BULLISH'?(r>=50?6:-3):resolvedBias==='BEARISH'?(r<=50?-6:3):0):0)+(dx?.value>=18?(resolvedBias==='BULLISH'?4:resolvedBias==='BEARISH'?-4:0):0))));";
  if (source.includes(oldTrend) && !source.includes('const resolvedBias=')) source=source.replace(oldTrend,newTrend);

  const oldReturn = "  return {\n    structure:s,sweep,atr:a,ema20:e20,ema50:e50,trend,rsi:r==null?null:Math.round(r*100)/100,";
  const newReturn = "  return {\n    structure:{...s,bias:resolvedBias,rawBias:s?.bias||null,score:directionScore},sweep,atr:a,ema20:e20,ema50:e50,trend,resolvedBias,directionScore,rsi:r==null?null:Math.round(r*100)/100,";
  if (source.includes(oldReturn)) source=source.replace(oldReturn,newReturn);

  // Fix: Premium/Discount is an execution filter only when there is a real
  // bullish/bearish execution side. Neutral must display NEUTRAL/CONTEXT,
  // never "wait for premium execution".
  const oldPd = "  const premiumDiscount=live.price>mid?'PREMIUM':'DISCOUNT';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  const newPd = "  const premiumDiscount=(side==='BULLISH'||side==='BEARISH')?(live.price>mid?'PREMIUM':'DISCOUNT'):'NEUTRAL';\n  const pdOk=side==='BULLISH'?premiumDiscount==='DISCOUNT':side==='BEARISH'?premiumDiscount==='PREMIUM':false;";
  if (source.includes(oldPd)) source=source.replace(oldPd,newPd);
  source=source.replace("  if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "  if(side!=='NEUTRAL'&&!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");

  // The setup gate stays strict: MTF + liquidity + MSS/BOS + aligned zone +
  // displacement/momentum + location + spread + RR are still required.
  // Only allow a directional opportunity to be selected when setupReady is true.
  source=source.replace("const selectedOpportunity = safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null;", "const selectedOpportunity = setupReady ? (safeConfirmed.sort((x,y)=>(y.score-x.score)||((y.riskReward||0)-(x.riskReward||0)))[0] || null) : null;");
  source=source.replace(/\s*if \(selectedOpportunity && !setupReady && !newsBlocked\) \{[\s\S]*?\n  \}\n  if \(newsBlocked\)/, "\n  if (newsBlocked)");

  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) {
    source=source.replace(/(const\s+setupReady\s*=.*?;)/, "$1\n  const tradeAuthorized=setupReady===true;");
  }
  if (!/tradeAuthorized\s*,/.test(source)) source=source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, "$1\n    tradeAuthorized,");
  return source;
}

function patchFrontend(source) {
  source=source.replace("font:14px Segoe UI,Arial,sans-serif", "font:14px 'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  source=source.replace("font-family:Segoe UI,Arial,sans-serif", "font-family:'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  return source;
}

Module._extensions['.js']=function vtradeServerLoader(mod,filename){
  if(path.resolve(filename)!==SERVER_FILE) return originalLoader(mod,filename);
  let source=fs.readFileSync(filename,'utf8');
  source=patchMtfAndContext(source);
  console.log('[V-TRADE LAUNCHER] MTF resolved-bias + neutral P/D logic active');
  console.log('[V-TRADE LAUNCHER] strict ICT authorization remains active');
  mod._compile(source,filename);
};

try {
  if(fs.existsSync(FRONTEND_FILE)){
    const before=fs.readFileSync(FRONTEND_FILE,'utf8');
    const after=patchFrontend(before);
    if(after!==before){fs.writeFileSync(FRONTEND_FILE,after,'utf8');console.log('[V-TRADE LAUNCHER] Khmer frontend font compatibility applied');}
  }
}catch(e){console.warn('[V-TRADE LAUNCHER] frontend patch skipped:',e.message);}

require('./server.js');
