/* V-TRADE AI — Pre-Market direct route hotfix V6
 * FIX: replace any older V4/V5 injected direct route before installing V6.
 * Uses brokerFeed.timeframes first and parseBrokerCandles() as MT5 fallback.
 * Core execution gate remains M5/M15/H1/H4; D1 is diagnostic/optional.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';
const MARKER='VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V6_MT5_PARSE_FALLBACK';
const OLD_MARKERS=['VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V4_MT5_FEED','VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V5_MT5_PARSE_FALLBACK'];
function inject(source){
  if(!source) return source;
  const marker='const app = express();';
  if(!source.includes(marker)) return source;
  if(source.includes(MARKER)) return source;
  // Remove previously injected direct-route blocks so Express cannot keep an old
  // first-match /api/pre-market/candle-open handler ahead of V6.
  for(const old of OLD_MARKERS){
    const start=source.indexOf(`/* ${old} */`);
    if(start>=0){
      const end=source.indexOf('})(app);',start);
      if(end>=0) source=source.slice(0,start)+source.slice(end+'})(app);'.length);
    }
  }
  const code=String.raw`
/* ${MARKER} */
(function installPreMarketDirectRouteV6(app){
  if(!app||app.__VTRADE_PREMARKET_DIRECT_ROUTE_V6__) return;
  app.__VTRADE_PREMARKET_DIRECT_ROUTE_V6__=true;
  const TFS=['M5','M15','H1','H4','D1'];
  const CORE=['M5','M15','H1','H4'];
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const side=v=>{const s=String(v??'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
  const cors=(req,res)=>{const o=String(req.get('origin')||'');if(o==='https://vetven964.github.io'||o==='https://www.vetven964.github.io'){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Access-Control-Allow-Credentials','true');}res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');res.setHeader('Vary','Origin');};
  function arrOf(x){if(Array.isArray(x))return x;if(Array.isArray(x?.candles))return x.candles;if(Array.isArray(x?.bars))return x.bars;if(Array.isArray(x?.history))return x.history;return [];}
  function normBar(x){return {t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0};}
  function safeParse(tf){try{if(typeof parseBrokerCandles==='function'){const a=parseBrokerCandles(tf);if(Array.isArray(a)&&a.length)return a;}}catch(e){console.warn('[V-TRADE PRE-MARKET] parser fallback failed',tf,e?.message||e);}return [];}
  function frame(a,tf,price){
    const feed=(typeof brokerFeed!=='undefined'&&brokerFeed?.timeframes?.[tf])||null;
    const node=a?.timeframes?.[tf]??a?.frames?.[tf]??a?.mtf?.timeframes?.[tf]??a?.mtf?.rows?.[tf]??a?.[tf]??{};
    const fb=arrOf(feed), pb=safeParse(tf), nb=arrOf(node);
    const raw=fb.length>=30?fb:(pb.length>=30?pb:(nb.length?nb:pb));
    const candles=raw.map(normBar).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
    const last=candles[candles.length-1]||{};const p=n(price??node?.currentPrice??last.c);
    const score=n(node?.directionScore);const bias=side(node?.structure?.bias??node?.resolvedBias??node?.trend??node?.bias);
    return {...node,tf,ready:candles.length>=30,bars:candles.length,candles,bars:candles,open:n(last.o),high:n(last.h),low:n(last.l),close:n(last.c),currentPrice:p,bias,directionScore:score,score,feedBars:fb.length,parsedBars:pb.length,source:fb.length>=30?'brokerFeed.timeframes':pb.length>=30?'parseBrokerCandles':'analysis node',candle:{...(node?.candle||{}),open:n(last.o),high:n(last.h),low:n(last.l),close:n(last.c)},workflow:{entryAuthorization:false,telegramIndependent:true}};
  }
  function calculate(core){
    const a=core?.analysis||core?.data||core?.result||core||{};
    let live=n(a?.livePrice??a?.price);try{if(live==null&&typeof brokerLivePrice==='function')live=n(brokerLivePrice()?.price);}catch(_){}if(live==null&&typeof brokerFeed!=='undefined')live=n(brokerFeed?.quote?.last??brokerFeed?.price);
    const rows={};for(const tf of TFS)rows[tf]=frame(a,tf,live);
    const ready=CORE.filter(tf=>rows[tf].ready).length, optionalD1=rows.D1.ready;
    const score=n(a?.directionScore??a?.aiScore??a?.score?.directionScore), buy=score==null?null:Math.max(0,Math.min(100,Math.round(score))), sell=buy==null?null:100-buy;
    const bias=side(a?.bias??a?.directionBand??a?.macroBias), confidence=n(a?.confidence??a?.score?.confidence??a?.setupScore), complete=ready===CORE.length;
    return {success:true,symbol:'XAUUSD',source:a?.source||'VT Markets MT5',price:live,livePrice:live,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,directionScore:score,aiScore:score,directionBand:a?.directionBand||bias,preAiConfidence:confidence,confidence,available:ready,required:4,complete,optionalD1,missingTimeframes:CORE.filter(tf=>!rows[tf].ready),timeframes:rows,frames:rows,canonical:{source:'buildXauAnalysis + brokerFeed.timeframes + parseBrokerCandles',directionScore:score,buyStrengthPct:buy,sellStrengthPct:sell,bias,confidence,status:a?.status||'WAIT',signal:a?.signal||'WAIT',phase:a?.phase||'WAIT'},ict:a?.ict||{},confirmations:a?.confirmations||{},gates:a?.confirmations||{},zone:{...(a?.zone||{}),authorization:false},workflow:{...(a?.workflow||{}),stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:['M5','M15','H1','H4','D1','MTF_CANONICAL_SCORE','ICT_CONFIRMATION','AI_CONFIRMATION'],coreTimeframes:CORE,executionTimeframe:'M5',aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true},generatedAt:new Date().toISOString()};
  }
  async function handler(req,res){cors(req,res);res.set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.status(204).end();try{if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');const result=calculate(await buildXauAnalysis());console.log('[V-TRADE PRE-MARKET] V6 MT5 OK | core='+result.available+'/4 | M5='+result.timeframes.M5.bars+' M15='+result.timeframes.M15.bars+' H1='+result.timeframes.H1.bars+' H4='+result.timeframes.H4.bars+' | D1='+(result.optionalD1?'READY':'OPTIONAL')+' | price='+result.livePrice);return res.json(result);}catch(e){console.error('[V-TRADE PRE-MARKET] V6 ERROR:',e?.stack||e?.message||e);return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});}}
  for(const p of ['/api/pre-market/candle-open','/api/pre-market/xauusd','/api/pre-market/intelligence']){app.options(p,handler);app.get(p,handler);}
  console.log('[V-TRADE PRE-MARKET] DIRECT ROUTE V6 ACTIVE | brokerFeed + parseBrokerCandles fallback | CORE M5/M15/H1/H4');
})(app);
`;
  return source.replace(marker,marker+'\n'+code);
}
module.exports={inject};
