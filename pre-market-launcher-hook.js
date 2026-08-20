// V-TRADE AI — Pre-Market Candle-Open hook for the existing production launcher.
// Keeps server-launcher.js, Telegram, auth and all other runtime patches unchanged.
const fs=require('fs');
const Module=require('module');
const path=require('path');
const SERVER_FILE=path.resolve(__dirname,'server.js');
const previousLoader=Module._extensions['.js'];
const originalRead=fs.readFileSync.bind(fs);
function inject(source){
 if(!source||source.includes('VTRADE_CANDLE_OPEN_MTF_V3'))return source;
 const marker='const app = express();'; if(!source.includes(marker))return source;
 const code=String.raw`
/* VTRADE_CANDLE_OPEN_MTF_V3 */
(function installPreMarketCandleOpen(app){
 const frames=['M5','M15','H1','H4','D1'],weights={M5:1,M15:2,H1:3,H4:4,D1:5};
 const n=v=>Number.isFinite(Number(v))?Number(v):null,clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
 const cors=(req,res)=>{const o=String(req.get('origin')||'');if(o==='https://vetven964.github.io'||o==='https://www.vetven964.github.io'){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Access-Control-Allow-Credentials','true');}res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');res.setHeader('Vary','Origin');};
 const getBars=(a,tf)=>{const t=a?.timeframes||a?.mtf||a?.multiTimeframe||{},x=t[tf]??t[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()];if(Array.isArray(x))return x;if(Array.isArray(x?.bars))return x.bars;if(Array.isArray(x?.candles))return x.candles;return[]};
 const norm=x=>({o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),t:n(x?.t??x?.time)});
 function analyze(a,tf,price){
  const r=getBars(a,tf).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
  if(r.length<5)return{tf,ready:false,buyPct:null,sellPct:null,bias:'WAIT',reason:'INSUFFICIENT_CANDLES'};
  const x=r[r.length-1],p=n(price)??x.c,prev=r[r.length-2],recent=r.slice(-14),avg=recent.reduce((s,b)=>s+(b.h-b.l),0)/recent.length,range=Math.max(avg,1e-9);
  const openMove=(p-x.o)/range,body=(x.c-x.o)/range,mom=(prev.c-prev.o)/range,upper=Math.max(0,x.h-Math.max(x.o,x.c)),lower=Math.max(0,Math.min(x.o,x.c)-x.l),rejection=(lower-upper)/range;
  const prior=r.slice(-9,-1),ph=Math.max(...prior.map(b=>b.h)),pl=Math.min(...prior.map(b=>b.l));
  const structure=x.c>ph?1:x.c<pl?-1:x.c>prev.h?0.5:x.c<prev.l?-0.5:0;
  let buy=50+openMove*35+body*18+mom*12+rejection*8+structure*12;
  if(Math.abs(p-x.o)<=range*.03&&Math.abs(x.c-x.o)<=range*.03)buy=50;
  buy=Math.round(clamp(buy)*10)/10;
  return{tf,ready:true,buyPct:buy,sellPct:Math.round((100-buy)*10)/10,bias:buy>50?'BULLISH':buy<50?'BEARISH':'NEUTRAL',open:x.o,currentPrice:p,openMove:p-x.o,avgRange:avg,evidence:{body:Math.round(body*1000)/10,momentum:Math.round(mom*1000)/10,rejection:Math.round(rejection*1000)/10,structure}};
 }
 function calculate(raw){const a=raw?.analysis||raw?.data||raw||{},price=n(a?.price??a?.livePrice??a?.quote?.price??a?.mt5?.price);const rows={};let b=0,s=0,w=0,ready=0;for(const tf of frames){const x=analyze(a,tf,price);rows[tf]=x;if(x.ready){ready++;b+=x.buyPct*weights[tf];s+=x.sellPct*weights[tf];w+=100*weights[tf];}}const buy=w?Math.round(clamp(b/w*100)*10)/10:null,sell=buy==null?null:Math.round((100-buy)*10)/10;return{success:true,symbol:'XAUUSD',price,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias:buy==null?'WAIT':buy>sell?'BULLISH':buy<sell?'BEARISH':'NEUTRAL',preAiConfidence:buy==null?null:Math.round(clamp(50+Math.abs(buy-sell))),timeframes:rows,mtf:{weights,ready,required:5,buyPct:buy,sellPct:sell},workflow:{stage:'PRE_MARKET_CANDLE_OPEN',sequence:['M5','M15','H1','H4','D1','MTF_WEIGHT','ICT','AI'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false},calculatedAt:new Date().toISOString()};}
 async function handler(req,res){cors(req,res);if(req.method==='OPTIONS')return res.status(204).end();try{const token=String(req.get('x-vtrade-auth')||''),port=Number(process.env.PORT||10000),r=await fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(12000)}),raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));if(!r.ok||raw?.success===false)return res.status(r.status||502).json({success:false,error:raw?.error||'MT5 analysis unavailable'});return res.json(calculate(raw));}catch(e){return res.status(502).json({success:false,error:String(e?.message||e)});}}
 app.options('/api/pre-market/candle-open',handler);app.get('/api/pre-market/candle-open',handler);app.options('/api/pre-market/xauusd',handler);app.get('/api/pre-market/xauusd',handler);
 console.log('[V-TRADE PRE-MARKET] Candle-Open MTF engine ACTIVE | M5>M15>H1>H4>D1 | AI=CONFIRMATION_ONLY | CORS=READY');
})(app);`;
 return source.replace(marker,marker+'\n'+code);
}
Module._extensions['.js']=function(fileMod,filename){if(path.resolve(filename)!==SERVER_FILE)return previousLoader(fileMod,filename);const patched=inject(originalRead(filename,'utf8')),old=fs.readFileSync;fs.readFileSync=function(file,...args){if(path.resolve(String(file))===SERVER_FILE)return patched;return originalRead(file,...args)};try{return previousLoader(fileMod,filename)}finally{fs.readFileSync=old}};