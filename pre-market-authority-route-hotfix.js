/* V-TRADE AI — Pre-Market authoritative MT5 route
 * Purpose: give the frontend one immutable MT5-backed snapshot path.
 * No Telegram, no execution, no AI authorization.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_AUTHORITY_ROUTE_V1';

function inject(source){
  if(!source||source.includes(MARKER))return source;
  const anchor='const app = express();';
  if(!source.includes(anchor))throw new Error('server app marker not found');
  const code=`
/* ${MARKER} */
(function installPreMarketAuthorityV1(app){
 if(!app||app.__VTRADE_PREMARKET_AUTHORITY_V1__)return;
 app.__VTRADE_PREMARKET_AUTHORITY_V1__=true;
 const TFS=['M5','M15','H1','H4','D1'],CORE=['M5','M15','H1','H4'];
 const n=v=>Number.isFinite(Number(v))?Number(v):null;
 const side=v=>{const s=String(v??'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
 const arr=x=>Array.isArray(x)?x:Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:Array.isArray(x?.history)?x.history:[];
 const norm=x=>({t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0});
 function parsed(tf){try{if(typeof parseBrokerCandles==='function'){const x=parseBrokerCandles(tf);if(Array.isArray(x)&&x.length)return x;}}catch(e){console.warn('[V-TRADE PRE-MARKET AUTH] parser',tf,e?.message||e);}return[];}
 function bars(tf){const f=(typeof brokerFeed!=='undefined'&&brokerFeed?.timeframes?.[tf])||null;const fb=arr(f).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));if(fb.length>=30)return{bars:fb,source:'brokerFeed.timeframes'};const pb=parsed(tf).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));if(pb.length>=30)return{bars:pb,source:'parseBrokerCandles'};return{bars:fb.length?fb:pb,source:fb.length?'brokerFeed.timeframes':'parseBrokerCandles'};}
 function live(){try{if(typeof brokerLivePrice==='function'){const x=brokerLivePrice();const p=n(x?.price??x?.last);if(p!=null)return p;}}catch(_){}if(typeof brokerFeed!=='undefined')return n(brokerFeed?.quote?.last??brokerFeed?.price);return null;}
 function handler(req,res){res.set('Cache-Control','no-store');const q=live();const timeframes={};for(const tf of TFS){const b=bars(tf),last=b.bars[b.bars.length-1]||{};timeframes[tf]={tf,ready:b.bars.length>=30,bars:b.bars.length,candles:b.bars,source:b.source,open:last.o??null,high:last.h??null,low:last.l??null,close:last.c??null,currentPrice:q??last.c??null};}const ready=CORE.filter(tf=>timeframes[tf].ready).length;return res.json({success:true,symbol:'XAUUSD',source:'MT5 brokerFeed',price:q??timeframes.M5.currentPrice??null,livePrice:q??timeframes.M5.currentPrice??null,available:ready,required:4,complete:ready===4,optionalD1:timeframes.D1.ready,missingTimeframes:CORE.filter(tf=>!timeframes[tf].ready),timeframes,frames:timeframes,buyStrengthPct:null,sellStrengthPct:null,bias:'NEUTRAL',directionScore:null,preAiConfidence:null,confidence:null,gates:{},ict:{},confirmations:{},zone:{authorization:false},workflow:{stage:ready===4?'PRE_MARKET_MTF_READY':'PRE_MARKET_MTF_WAITING',source:'MT5_AUTHORITATIVE',entryAuthorization:false,orderAuthorization:false,aiRole:'CONFIRMATION_ONLY',telegramIndependent:true},generatedAt:new Date().toISOString()});}
 app.options('/api/pre-market/mt5-authoritative',handler);app.get('/api/pre-market/mt5-authoritative',handler);
 console.log('[V-TRADE PRE-MARKET AUTH] MT5 authoritative route ACTIVE | /api/pre-market/mt5-authoritative');
})(app);
`;
  return source.replace(anchor,anchor+'\n'+code);
}

if(fs.existsSync(SERVER)){
 let source=fs.readFileSync(SERVER,'utf8');
 source=inject(source);
 fs.writeFileSync(SERVER,source,'utf8');
}
module.exports={inject};
