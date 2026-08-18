// V-TRADE AI — Candle-Open MTF Pre-Market Hotfix
// M5 -> M15 -> H1 -> H4 -> D1 first. AI is confirmation only.
const fs=require('fs');
const path=require('path');
const SERVER_FILE=path.resolve(__dirname,'server.js');
const previousReadFileSync=fs.readFileSync.bind(fs);

function patchPreAiStrength(source){
 if(!source||source.includes('VTRADE_CANDLE_OPEN_MTF_V2'))return source;
 const marker='const app = express();';
 if(!source.includes(marker))return source;
 const injected=String.raw`
/* VTRADE_CANDLE_OPEN_MTF_V2 */
(function installCandleOpenMtf(app){
 const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
 const n=v=>Number.isFinite(Number(v))?Number(v):null;
 const frames=['M5','M15','H1','H4','D1'];
 const weights={M5:1,M15:2,H1:3,H4:4,D1:5};
 function bars(a,tf){const t=a?.timeframes||a?.mtf||a?.multiTimeframe||{};const x=t[tf]??t[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()];if(Array.isArray(x))return x;if(Array.isArray(x?.bars))return x.bars;if(Array.isArray(x?.candles))return x.candles;return []}
 function c(x){return {t:n(x?.t??x?.time),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close)}}
 function frame(a,tf,price){
  const r=bars(a,tf).map(c).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
  if(r.length<5)return {tf,ready:false,buyPct:50,sellPct:50,bias:'NEUTRAL',reason:'INSUFFICIENT_CANDLES'};
  const last=r[r.length-1],prev=r[r.length-2],p=n(price)??last.c;
  const recent=r.slice(Math.max(0,r.length-14));
  const avg=recent.reduce((s,x)=>s+Math.max(0,x.h-x.l),0)/Math.max(1,recent.length);
  const safe=Math.max(avg*0.01,1e-9);
  const displacement=clamp(50+((p-last.o)/Math.max(avg,safe))*50);
  const body=clamp(50+((last.c-last.o)/Math.max(avg,safe))*50);
  const momentum=clamp(50+((prev.c-prev.o)/Math.max(avg,safe))*35);
  const upper=Math.max(0,last.h-Math.max(last.o,last.c));
  const lower=Math.max(0,Math.min(last.o,last.c)-last.l);
  const rejection=clamp(50+((lower-upper)/Math.max(avg,safe))*35);
  const prior=r.slice(Math.max(0,r.length-8),r.length-1);
  const ph=Math.max(...prior.map(x=>x.h)),pl=Math.min(...prior.map(x=>x.l));
  const structure=last.c>ph?75:last.c<pl?25:last.c>prev.h?65:last.c<prev.l?35:50;
  const closeLocation=clamp(((last.c-last.l)/Math.max(last.h-last.l,safe))*100);
  let buy=displacement*.35+body*.20+momentum*.15+rejection*.10+structure*.10+closeLocation*.10;
  // At candle open there is not enough new-bar evidence. Hold neutral instead of inventing direction.
  if(Math.abs(p-last.o)<=safe*.05 && Math.abs(last.c-last.o)<=safe*.05)buy=50;
  buy=Math.round(clamp(buy)*10)/10;
  const sell=Math.round((100-buy)*10)/10;
  return {tf,ready:true,buyPct:buy,sellPct:sell,bias:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',open:last.o,currentPrice:p,openMove:p-last.o,avgRange:avg,lastCandle:last,previousCandle:prev,evidence:{openDisplacement:Math.round(displacement*10)/10,body:Math.round(body*10)/10,momentum:Math.round(momentum*10)/10,rejection:Math.round(rejection*10)/10,structure:Math.round(structure*10)/10,closeLocation:Math.round(closeLocation*10)/10}};
 }
 function calculate(raw){
  const a=raw?.analysis||raw?.data||raw||{};const price=n(a?.price??a?.livePrice??a?.quote?.price??a?.mt5?.price);const rows={};let b=0,s=0,total=0,ready=0;
  for(const tf of frames){const x=frame(a,tf,price);rows[tf]=x;if(x.ready){ready++;b+=x.buyPct*weights[tf];s+=x.sellPct*weights[tf];total+=100*weights[tf]}}
  let buy=total?b/total*100:50;buy=Math.round(clamp(buy)*10)/10;const sell=Math.round((100-buy)*10)/10;const gap=Math.abs(buy-sell);
  const q=n(a?.dataQuality?.score);const feedReady=a?.feedReady!==false&&a?.mt5?.ready!==false;const quality=q==null?100:clamp(q);const confidence=Math.round(clamp((50+gap)*quality/100));
  return {success:true,symbol:'XAUUSD',price,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',preAiConfidence:confidence,confidenceMeaning:'Directional evidence strength from MT5 candle-open MTF processing; not win probability.',timeframes:rows,mtf:{weights,ready,required:5,buyPct:buy,sellPct:sell},data:{feedReady,dataQuality:q},workflow:{stage:'PRE_MARKET_CANDLE_OPEN',sequence:['M5','M15','H1','H4','D1','MTF_WEIGHT','ICT_CONFIRMATION','AI_CONFIRMATION'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false},calculatedAt:new Date().toISOString()};
 }
 async function getCore(req){const token=String(req.get('x-vtrade-auth')||'');const port=Number(process.env.PORT||10000);return fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(12000)})}
 app.get('/api/pre-market/candle-open',async(req,res)=>{try{const r=await getCore(req);const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));if(!r.ok||raw?.success===false)return res.status(r.status||502).json({success:false,error:raw?.error||'MT5 analysis unavailable'});return res.json(calculate(raw))}catch(e){return res.status(502).json({success:false,error:String(e?.message||e)})}});
 app.get('/api/pre-market/xauusd',async(req,res)=>{try{const r=await getCore(req);const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));if(!r.ok||raw?.success===false)return res.status(r.status||502).json({success:false,error:raw?.error||'MT5 analysis unavailable'});return res.json(calculate(raw))}catch(e){return res.status(502).json({success:false,error:String(e?.message||e)})}});
 console.log('[V-TRADE PRE-MARKET] Candle-Open MTF engine ACTIVE | M5>M15>H1>H4>D1 | AI=CONFIRMATION_ONLY');
})(app);
`;
 return source.replace(marker,marker+'\n'+injected);
}
fs.readFileSync=function(file,...args){const source=previousReadFileSync(file,...args);if(path.resolve(String(file))!==SERVER_FILE||typeof source!=='string')return source;return patchPreAiStrength(source)};
require('./server-timeout-hotfix.js');
