/* V-TRADE AI — Telegram Market Bridge V3
 * READ-ONLY MT5 MARKET DATA ONLY.
 * This bridge intentionally does NOT read Pre-Market analysis, ICT results,
 * execution zones, AI confirmation, or trade authorization.
 * Telegram AI consumes this raw broker-native snapshot and owns its own scan.
 */
'use strict';

const MARKER='VTRADE_TELEGRAM_MARKET_BRIDGE_V3';
const API_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();
const PORT=Number(process.env.PORT||10000);

function install(app){
  if(!app||app.__VTRADE_TELEGRAM_MARKET_BRIDGE_V3__)return;
  app.__VTRADE_TELEGRAM_MARKET_BRIDGE_V3__=true;

  app.get('/api/telegram/market-snapshot',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(API_KEY&&String(req.get('X-VTRADE-TELEGRAM-KEY')||'')!==API_KEY){
      return res.status(401).json({success:false,error:'Telegram market bridge unauthorized'});
    }
    try{
      const feed=(typeof brokerFeed!=='undefined'&&brokerFeed)||null;
      const quote=feed?.quote||{};
      const n=v=>Number.isFinite(Number(v))?Number(v):null;
      const arr=x=>Array.isArray(x)?x:(Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:[]);
      const bar=x=>({
        t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),
        o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),
        c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0
      });
      const timeframes={};
      for(const tf of ['M5','M15','H1','H4']){
        const raw=arr(feed?.timeframes?.[tf]).map(bar).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
        timeframes[tf]={bars:raw.slice(-120),count:raw.length,ready:raw.length>=30};
      }
      const bid=n(quote?.bid??feed?.bid),ask=n(quote?.ask??feed?.ask),last=n(quote?.last??quote?.price??feed?.price??(bid!=null&&ask!=null?(bid+ask)/2:null));
      return res.json({
        success:true,source:'BROKER_NATIVE_MT5',contract:'VTRADE_TELEGRAM_MARKET_V3',symbol:String(feed?.symbol||'XAUUSD'),
        price:last,bid,ask,spread:bid!=null&&ask!=null?Math.max(0,ask-bid):null,
        connected:feed?.connected===true,quoteAgeSec:n(feed?.quoteAgeSec??feed?.ageSec),
        timeframes,generatedAt:new Date().toISOString(),
        telegramRole:'INDEPENDENT_AI_SCAN',preMarketLoaded:false,preMarketAuthority:false,executionLoaded:false
      });
    }catch(e){
      return res.status(502).json({success:false,error:String(e?.message||e),source:'BROKER_NATIVE_MT5'});
    }
  });

  console.log('[V-TRADE TELEGRAM BRIDGE] V3 ACTIVE | raw MT5 market only | PreMarket=NOT_READ');
}

module.exports={MARKER,install};
