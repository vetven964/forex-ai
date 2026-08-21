/* V-TRADE AI — Pre-Market direct route hotfix V8
 * MT5 readiness-gated route.
 * Waits for broker-native M5/M15/H1/H4 history before returning Pre-Market data.
 * D1 remains optional/diagnostic. Analysis-only; Telegram remains independent.
 */
'use strict';
const MARKER='VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V8';
const OLD=['VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V4_MT5_FEED','VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V5_MT5_PARSE_FALLBACK','VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V6_MT5_PARSE_FALLBACK','VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V7'];
function stripOld(source){
  for(const old of OLD){
    let start=source.indexOf(`/* ${old} */`);
    while(start>=0){
      const end=source.indexOf('})(app);',start);
      if(end<0) break;
      source=source.slice(0,start)+source.slice(end+'})(app);'.length);
      start=source.indexOf(`/* ${old} */`);
    }
  }
  return source;
}
function inject(source){
  if(!source) return source;
  const marker='const app = express();';
  if(!source.includes(marker)||source.includes(MARKER)) return source;
  source=stripOld(source);
  const code=String.raw`
/* ${MARKER} */
(function installPreMarketDirectRouteV8(app){
 if(!app||app.__VTRADE_PREMARKET_DIRECT_ROUTE_V8__)return;
 app.__VTRADE_PREMARKET_DIRECT_ROUTE_V8__=true;
 const TFS=['M5','M15','H1','H4','D1'],CORE=['M5','M15','H1','H4'];
 const MIN_BARS=30,WAIT_MS=15000,POLL_MS=500;
 const n=v=>Number.isFinite(Number(v))?Number(v):null;
 const side=v=>{const s=String(v??'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
 const cors=(req,res)=>{const o=String(req.get('origin')||'');if(o==='https://vetven964.github.io'||o==='https://www.vetven964.github.io'){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Access-Control-Allow-Credentials','true');}res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');res.setHeader('Vary','Origin');};
 function arr(x){if(Array.isArray(x))return x;if(Array.isArray(x?.candles))return x.candles;if(Array.isArray(x?.bars))return x.bars;if(Array.isArray(x?.history))return x.history;return[];}
 function bar(x){return{t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0};}
 function feedBars(tf){try{const f=(typeof brokerFeed!=='undefined'&&brokerFeed?.timeframes?.[tf])||null;return arr(f);}catch(_){return[];}}
 function parsed(tf){try{if(typeof parseBrokerCandles==='function'){const x=parseBrokerCandles(tf);if(Array.isArray(x)&&x.length)return x;}}catch(e){console.warn('[V-TRADE PRE-MARKET] parser fallback',tf,e?.message||e);}return[];}
 function readiness(){const rows={};for(const tf of CORE){const fb=feedBars(tf);rows[tf]={feedBars:fb.length,ready:fb.length>=MIN_BARS};}return rows;}
 function mtfReady(){const r=readiness();return CORE.every(tf=>r[tf].ready);}
 async function waitForMTF(){const started=Date.now();let last='';while(Date.now()-started<=WAIT_MS){if(mtfReady())return true;const r=readiness();const state=CORE.map(tf=>tf+'='+r[tf].feedBars).join(' ');if(state!==last){console.log('[V-TRADE PRE-MARKET] MT5 SYNC WAIT | '+state);last=state;}await new Promise(resolve=>setTimeout(resolve,POLL_MS));}return mtfReady();}
 function frame(a,tf,price){
  const feed=(typeof brokerFeed!=='undefined'&&brokerFeed?.timeframes?.[tf])||null,node=a?.timeframes?.[tf]??a?.frames?.[tf]??a?.mtf?.timeframes?.[tf]??a?.mtf?.rows?.[tf]??a?.[tf]??{};
  const fb=arr(feed),pb=parsed(tf),nb=arr(node),raw=fb.length>=MIN_BARS?fb:pb.length>=MIN_BARS?pb:nb.length?nb:pb,c=raw.map(bar).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)),last=c[c.length-1]||{};
  const p=n(price??node?.currentPrice??last.c),score=n(node?.directionScore);
  return{...node,tf,ready:c.length>=MIN_BARS,bars:c.length,candles:c,open:n(last.o),high:n(last.h),low:n(last.l),close:n(last.c),currentPrice:p,bias:side(node?.structure?.bias??node?.resolvedBias??node?.trend??node?.bias),directionScore:score,score,feedBars:fb.length,parsedBars:pb.length,source:fb.length>=MIN_BARS?'brokerFeed.timeframes':pb.length>=MIN_BARS?'parseBrokerCandles':'analysis node',candle:{...(node?.candle||{}),open:n(last.o),high:n(last.h),low:n(last.l),close:n(last.c)},workflow:{entryAuthorization:false,telegramIndependent:true}};
 }
 function calc(core){
  const a=core?.analysis||core?.data||core?.result||core||{};let live=n(a?.livePrice??a?.price);try{if(live==null&&typeof brokerLivePrice==='function')live=n(brokerLivePrice()?.price);}catch(_){}if(live==null&&typeof brokerFeed!=='undefined')live=n(brokerFeed?.quote?.last??brokerFeed?.price);
  const rows={};for(const tf of TFS)rows[tf]=frame(a,tf,live);const ready=CORE.filter(tf=>rows[tf].ready).length,score=n(a?.directionScore??a?.aiScore??a?.score?.directionScore),buy=score==null?null:Math.max(0,Math.min(100,Math.round(score))),sell=buy==null?null:100-buy,bias=side(a?.bias??a?.directionBand??a?.macroBias),confidence=n(a?.confidence??a?.score?.confidence??a?.setupScore),complete=ready===4;
  return{success:true,symbol:'XAUUSD',source:a?.source||'VT Markets MT5',price:live,livePrice:live,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,directionScore:score,aiScore:score,directionBand:a?.directionBand||bias,preAiConfidence:confidence,confidence,available:ready,required:4,complete,optionalD1:rows.D1.ready,missingTimeframes:CORE.filter(tf=>!rows[tf].ready),timeframes:rows,frames:rows,canonical:{source:'buildXauAnalysis + brokerFeed.timeframes + parseBrokerCandles',directionScore:score,buyStrengthPct:buy,sellStrengthPct:sell,bias,confidence,status:a?.status||'WAIT',signal:a?.signal||'WAIT',phase:a?.phase||'WAIT'},ict:a?.ict||{},confirmations:a?.confirmations||{},gates:a?.confirmations||{},zone:{...(a?.zone||{}),authorization:false},workflow:{...(a?.workflow||{}),stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:['M5','M15','H1','H4','D1','MTF_CANONICAL_SCORE','ICT_CONFIRMATION','AI_CONFIRMATION'],coreTimeframes:CORE,executionTimeframe:'M5',aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true,mt5ReadyGate:complete},generatedAt:new Date().toISOString()};
 }
 async function handler(req,res){
  cors(req,res);res.set('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.status(204).end();
  try{
   if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');
   const ready=await waitForMTF();
   if(!ready){const r=readiness();console.warn('[V-TRADE PRE-MARKET] MT5 SYNC TIMEOUT | '+CORE.map(tf=>tf+'='+r[tf].feedBars).join(' '));return res.status(503).json({success:false,error:'MT5 MTF history not ready',code:'MT5_MTF_NOT_READY',retryAfterMs:POLL_MS,available:0,required:4,timeframes:r,workflow:{entryAuthorization:false,telegramIndependent:true}});}
   const r=calc(await buildXauAnalysis());
   console.log('[V-TRADE PRE-MARKET] V8 MT5 READY | core='+r.available+'/4 | M5='+r.timeframes.M5.bars+' M15='+r.timeframes.M15.bars+' H1='+r.timeframes.H1.bars+' H4='+r.timeframes.H4.bars+' | D1='+(r.optionalD1?'READY':'OPTIONAL')+' | price='+r.livePrice);
   return res.json(r);
  }catch(e){console.error('[V-TRADE PRE-MARKET] V8 ERROR:',e?.stack||e?.message||e);return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});}
 }
 for(const p of ['/api/pre-market/candle-open','/api/pre-market/xauusd','/api/pre-market/intelligence']){app.options(p,handler);app.get(p,handler);}
 console.log('[V-TRADE PRE-MARKET] DIRECT ROUTE V8 ACTIVE | MT5 readiness gate | wait='+WAIT_MS+'ms | core M5/M15/H1/H4');
})(app);
`;
 return source.replace(marker,marker+'\n'+code);
}
module.exports={inject};
