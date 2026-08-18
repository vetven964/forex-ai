// V-TRADE AI — Pre-Market Candle-Open hook for the existing production launcher.
// Keeps server-launcher.js, Telegram, auth and all other runtime patches unchanged.
// IMPORTANT: Pre-Market is analysis-only. Telegram and order execution remain independent.
const fs=require('fs');
const Module=require('module');
const path=require('path');
const SERVER_FILE=path.resolve(__dirname,'server.js');
const previousLoader=Module._extensions['.js'];
const originalRead=fs.readFileSync.bind(fs);
function inject(source){
 if(!source||source.includes('VTRADE_CANDLE_OPEN_MTF_V4'))return source;
 const marker='const app = express();'; if(!source.includes(marker))return source;
 const code=String.raw`
/* VTRADE_CANDLE_OPEN_MTF_V4 */
(function installPreMarketCandleOpen(app){
 const frames=['M5','M15','H1','H4','D1'],weights={M5:1,M15:2,H1:3,H4:4,D1:5};
 const n=v=>Number.isFinite(Number(v))?Number(v):null,clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
 const cors=(req,res)=>{const o=String(req.get('origin')||'');if(o==='https://vetven964.github.io'||o==='https://www.vetven964.github.io'){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Access-Control-Allow-Credentials','true');}res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');res.setHeader('Vary','Origin');};
 const getBars=(a,tf)=>{const t=a?.timeframes||a?.mtf||a?.multiTimeframe||{},x=t[tf]??t[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()];if(Array.isArray(x))return x;if(Array.isArray(x?.bars))return x.bars;if(Array.isArray(x?.candles))return x.candles;return[]};
 const norm=x=>({o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),t:n(x?.t??x?.time)});
 function analyze(a,tf,price){
  const r=getBars(a,tf).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
  if(r.length<5)return{tf,ready:false,buyPct:null,sellPct:null,bias:'WAIT',reason:'INSUFFICIENT_CANDLES',bars:r.length};
  const x=r[r.length-1],p=n(price)??x.c,prev=r[r.length-2],recent=r.slice(-14),avg=recent.reduce((s,b)=>s+(b.h-b.l),0)/recent.length,range=Math.max(avg,1e-9);
  const openMove=(p-x.o)/range,body=(x.c-x.o)/range,mom=(prev.c-prev.o)/range,upper=Math.max(0,x.h-Math.max(x.o,x.c)),lower=Math.max(0,Math.min(x.o,x.c)-x.l),rejection=(lower-upper)/range;
  const prior=r.slice(-9,-1),ph=Math.max(...prior.map(b=>b.h)),pl=Math.min(...prior.map(b=>b.l));
  const structure=x.c>ph?1:x.c<pl?-1:x.c>prev.h?0.5:x.c<prev.l?-0.5:0;
  let buy=50+openMove*35+body*18+mom*12+rejection*8+structure*12;
  if(Math.abs(p-x.o)<=range*.03&&Math.abs(x.c-x.o)<=range*.03)buy=50;
  buy=Math.round(clamp(buy)*10)/10;
  return{tf,ready:true,buyPct:buy,sellPct:Math.round((100-buy)*10)/10,bias:buy>50?'BULLISH':buy<50?'BEARISH':'NEUTRAL',open:x.o,currentPrice:p,openMove:p-x.o,avgRange:avg,evidence:{body:Math.round(body*1000)/10,momentum:Math.round(mom*1000)/10,rejection:Math.round(rejection*1000)/10,structure},bars:r.length,candleTime:x.t};
 }
 function calculate(a){
  const price=n(a?.price??a?.livePrice??a?.quote?.price??a?.mt5?.price);
  const rows={}; let b=0,w=0,ready=0;
  for(const tf of frames){const x=analyze(a,tf,price);rows[tf]=x;if(x.ready){ready++;b+=x.buyPct*weights[tf];w+=100*weights[tf];}}
  const complete=ready===frames.length;
  const buy=complete?Math.round(clamp(b/w*100)*10)/10:null;
  const sell=complete?Math.round((100-buy)*10)/10:null;
  const bias=!complete?'WAIT':buy>sell?'BULLISH':buy<sell?'BEARISH':'NEUTRAL';
  const preAiConfidence=!complete?0:Math.round(clamp(50+Math.abs(buy-sell)));
  return{success:true,symbol:'XAUUSD',price,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,preAiConfidence,complete,missingTimeframes:frames.filter(tf=>!rows[tf].ready),timeframes:rows,mtf:{weights,ready,required:5,complete,buyPct:buy,sellPct:sell},workflow:{stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:['M5','M15','H1','H4','D1','MTF_WEIGHT','ICT','AI'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true},calculatedAt:new Date().toISOString()};
 }
 async function fetchAnalysis(req){
  const token=String(req.get('x-vtrade-auth')||''),port=Number(process.env.PORT||10000);
  const r=await fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(12000)});
  const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));
  if(!r.ok||raw?.success===false)throw Object.assign(new Error(raw?.error||'MT5 analysis unavailable'),{status:r.status||502});
  return raw;
 }
 async function handler(req,res){cors(req,res);res.set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.status(204).end();try{return res.json(calculate(await fetchAnalysis(req)));}catch(e){return res.status(Number(e?.status)||502).json({success:false,error:String(e?.message||e)});}}
 async function aiHandler(req,res){
  cors(req,res);res.set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.status(204).end();
  try{
   const raw=await fetchAnalysis(req), pm=calculate(raw);
   if(!pm.complete)return res.status(409).json({success:false,error:'Pre-Market MTF incomplete; D1 is required before AI confirmation',preMarket:pm,ai:{status:'blocked',decision:'WAIT',confidence:0,agreement:'NEUTRAL'}});
   const engine=await buildXauAnalysis();
   const ai=await openAIConfirmXauAnalysis(engine);
   return res.json({success:true,preMarket:pm,engine,ai});
  }catch(e){return res.status(Number(e?.status)||502).json({success:false,error:String(e?.message||e),ai:{status:'error',decision:'WAIT',confidence:0,agreement:'NEUTRAL'}});}
 }
 app.options('/api/pre-market/candle-open',handler);app.get('/api/pre-market/candle-open',handler);
 app.options('/api/pre-market/xauusd',handler);app.get('/api/pre-market/xauusd',handler);
 app.options('/api/pre-market/ai',aiHandler);app.get('/api/pre-market/ai',aiHandler);
 console.log('[V-TRADE PRE-MARKET] Candle-Open MTF v4 ACTIVE | M5>M15>H1>H4>D1 | ALL-5 REQUIRED BEFORE AI | Telegram=INDEPENDENT');
})(app);`;
 return source.replace(marker,marker+'\n'+code);
}
Module._extensions['.js']=function(fileMod,filename){if(path.resolve(filename)!==SERVER_FILE)return previousLoader(fileMod,filename);const patched=inject(originalRead(filename,'utf8')),old=fs.readFileSync;fs.readFileSync=function(file,...args){if(path.resolve(String(file))===SERVER_FILE)return patched;return originalRead(file,...args)};try{return previousLoader(fileMod,filename)}finally{fs.readFileSync=old}};
