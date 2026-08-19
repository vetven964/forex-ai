/* V-TRADE AI — Pre-Market direct route hotfix
 * The existing pre-market launcher hook used Module._extensions, but server-launcher.js
 * installs its own loader afterwards. That made the pre-market route disappear at runtime
 * and the GitHub Pages dashboard showed HTTP 404.
 *
 * This hotfix injects the route directly into the source that server-launcher compiles.
 * Analysis-only: no Telegram delivery and no order authorization.
 */
'use strict';

const MARKER = 'VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V1';

function inject(source) {
  if (!source || source.includes(MARKER)) return source;
  const marker = 'const app = express();';
  if (!source.includes(marker)) return source;

  const code = String.raw`
/* ${MARKER} */
(function installPreMarketDirectRoute(app){
  if(!app || app.__VTRADE_PREMARKET_DIRECT_ROUTE_V1__) return;
  app.__VTRADE_PREMARKET_DIRECT_ROUTE_V1__ = true;

  const corsPreMarket=(req,res)=>{
    const origin=String(req.get('origin')||'');
    if(origin==='https://vetven964.github.io' || origin==='https://www.vetven964.github.io'){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Credentials','true');
    }
    res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');
    res.setHeader('Vary','Origin');
  };

  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const side=v=>{const s=String(v||'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
  const normalize=(raw)=>{
    const a=raw?.analysis||raw?.data||raw?.result||raw||{};
    const rows=a.timeframes||a.mtf?.timeframes||a.mtf?.rows||a.mtf||{};
    const out={};
    for(const tf of ['M5','M15','H1','H4','D1']){
      const x=rows?.[tf]??rows?.[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()]??{};
      const candles=Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:Array.isArray(x)?x:[];
      const last=candles.length?candles[candles.length-1]:x?.lastCandle||x?.candle||{};
      const open=n(last?.open??last?.o??x?.open);
      const high=n(last?.high??last?.h??x?.high);
      const low=n(last?.low??last?.l??x?.low);
      const close=n(last?.close??last?.c??x?.close??x?.currentPrice);
      const buy=n(x?.buyPct??x?.buyStrengthPct??x?.buyScore);
      const sell=n(x?.sellPct??x?.sellStrengthPct??x?.sellScore);
      out[tf]={...x,tf,candles,bars:candles,open,high,low,close,currentPrice:n(x?.currentPrice??close),buyPct:buy,sellPct:sell,buyStrengthPct:buy,sellStrengthPct:sell,bias:side(x?.bias??x?.direction??x?.resolvedBias??x?.trend),ready:!!(open!=null&&high!=null&&low!=null&&close!=null)};
    }
    const price=n(a?.livePrice??a?.price??a?.quote?.price??a?.quote?.ask??a?.mt5?.price);
    const bias=side(a?.bias??a?.directionBand??a?.direction);
    const buy=n(a?.buyStrengthPct??a?.buyPct??a?.directionScore)!=null?n(a?.buyStrengthPct??a?.buyPct??a?.directionScore):null;
    const sell=n(a?.sellStrengthPct??a?.sellPct)!=null?n(a?.sellStrengthPct??a?.sellPct):buy==null?null:100-buy;
    const ready=Object.values(out).filter(x=>x.ready).length;
    return {...a,success:true,symbol:'XAUUSD',source:a?.source||'VT Markets MT5',price,timeframes:out,frames:out,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,available:ready,complete:ready===5,missingTimeframes:Object.keys(out).filter(tf=>!out[tf].ready),zone:{...(a.zone||{}),authorization:false},workflow:{...(a.workflow||{}),stage:ready===5?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',entryAuthorization:false,telegramIndependent:true}};
  };

  async function handler(req,res){
    corsPreMarket(req,res);
    res.set('Cache-Control','no-store');
    if(req.method==='OPTIONS') return res.status(204).end();
    try{
      if(typeof buildXauAnalysis!=='function') throw new Error('Canonical XAUUSD analysis function unavailable');
      const core=await buildXauAnalysis();
      const result=normalize(core);
      console.log('[V-TRADE PRE-MARKET] direct route OK | ready='+result.available+'/5 | bias='+result.bias+' | price='+(result.price==null?'—':result.price));
      return res.json(result);
    }catch(e){
      console.error('[V-TRADE PRE-MARKET] direct route ERROR:',e?.stack||e?.message||e);
      return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});
    }
  }

  for(const p of ['/api/pre-market/candle-open','/api/pre-market/xauusd','/api/pre-market/intelligence']){
    app.options(p,handler);
    app.get(p,handler);
  }
  console.log('[V-TRADE PRE-MARKET] DIRECT ROUTE V1 ACTIVE | M5>M15>H1>H4>D1 | 404 FIXED');
})(app);
`;

  return source.replace(marker,marker+'\n'+code);
}

module.exports={inject};
