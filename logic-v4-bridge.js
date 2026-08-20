// V-TRADE AI — Logic V4 startup bridge
// Feeds the real MT5 candles into the V4 engine before the final signal is emitted.
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER_FILE=path.join(__dirname,'server.js');
const MARKER='VTRADE_LOGIC_V4_HISTORICAL_RANGE_ENGINE';

function install(){
  if(!fs.existsSync(SERVER_FILE)) throw new Error('server.js not found');
  let source=fs.readFileSync(SERVER_FILE,'utf8');
  if(source.includes(MARKER)) return;
  const marker='const app = express();';
  if(!source.includes(marker)) throw new Error('server app marker not found');
  const injected=`
// ${MARKER}
(function(){
  const {applyV4}=require('./logic-v4-finalizer');
  const {applyExecution}=require('./logic-v4-execution');
  const __vtradeOriginalBuild=buildXauAnalysis;

  function __vtradeV4FeedSnapshot(){
    const q=typeof brokerLivePrice==='function'?brokerLivePrice():null;
    const price=Number(q?.price);
    const frame={};
    for(const tf of ['M5','M15','H1','H4']){
      try{
        const raw=typeof parseBrokerCandles==='function'?parseBrokerCandles(tf):null;
        const minutes=tf==='M5'?5:tf==='M15'?15:tf==='H1'?60:240;
        const candles=Array.isArray(raw)&&typeof closedCandles==='function'
          ?closedCandles(raw,minutes)
          :(Array.isArray(raw)?raw:[]);
        const node={candles};
        if(typeof analyzeTF==='function' && candles.length>=30){
          const a=analyzeTF(candles);
          node.structure=a?.structure||null;
          node.trend=a?.trend||null;
          node.resolvedBias=a?.resolvedBias||a?.structure?.bias||null;
          node.directionScore=a?.directionScore??a?.score??null;
        }
        frame[tf]=node;
      }catch(e){ frame[tf]={candles:[]}; }
    }
    return {
      price:Number.isFinite(price)?price:null,
      livePrice:Number.isFinite(price)?price:null,
      feedReady:typeof brokerFeedFresh==='function'?brokerFeedFresh():false,
      mt5:{ready:typeof brokerFeedFresh==='function'?brokerFeedFresh():false,price:Number.isFinite(price)?price:null},
      timeframes:frame
    };
  }

  buildXauAnalysis=async function(){
    const base=await __vtradeOriginalBuild();
    const feed=__vtradeV4FeedSnapshot();
    const merged={...base,...feed,timeframes:{...(base?.timeframes||{}),...(feed.timeframes||{})}};
    const v4=applyV4(merged);
    const out=typeof applyExecution==='function'?applyExecution(v4):v4;
    console.log('[V-TRADE LOGIC V4] APPLY | regime=%s edge=%s hist=%s prob=%s side=%s decision=%s',
      out?.marketRegime?.type||'UNKNOWN',
      out?.marketRegime?.edge||'UNKNOWN',
      out?.historicalPatternScan?.sample??0,
      out?.historicalPatternScan?.directionalProbability??'—',
      out?.historicalPatternScan?.side||'NEUTRAL',
      out?.entryMode||out?.signal||'WAIT');
    return out;
  };
  console.log('[V-TRADE LOGIC V4] startup bridge installed — REAL MT5 candles connected');
})();
`;
  source=source.replace(marker,marker+injected);
  fs.writeFileSync(SERVER_FILE,source,'utf8');
}
module.exports={install};
