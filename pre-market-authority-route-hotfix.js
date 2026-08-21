/* V-TRADE AI — Pre-Market authoritative MT5 route V2
 * Purpose: one immutable MT5-backed Pre-Market snapshot.
 * Analysis only: no Telegram, no order execution, no AI authorization.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_AUTHORITY_ROUTE_V2';

function inject(source){
  if(!source||source.includes(MARKER))return source;
  const anchor='const app = express();';
  if(!source.includes(anchor))throw new Error('server app marker not found');
  const code=String.raw`
/* ${MARKER} */
(function installPreMarketAuthorityV2(app){
 if(!app||app.__VTRADE_PREMARKET_AUTHORITY_V2__)return;
 app.__VTRADE_PREMARKET_AUTHORITY_V2__=true;

 const TFS=['M5','M15','H1','H4','D1'],CORE=['M5','M15','H1','H4'];
 const WEIGHTS={M5:1,M15:2,H1:3,H4:4,D1:5};
 const n=v=>Number.isFinite(Number(v))?Number(v):null;
 const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
 const arr=x=>Array.isArray(x)?x:Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:Array.isArray(x?.history)?x.history:[];
 const norm=x=>({t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0});
 const round2=v=>v==null?null:Math.round(Number(v)*100)/100;

 function parsed(tf){
   try{
     if(typeof parseBrokerCandles==='function'){
       const x=parseBrokerCandles(tf);
       if(Array.isArray(x)&&x.length)return x;
     }
   }catch(e){console.warn('[V-TRADE PRE-MARKET AUTH] parser',tf,e?.message||e);}
   return [];
 }
 function bars(tf){
   const f=(typeof brokerFeed!=='undefined'&&brokerFeed?.timeframes?.[tf])||null;
   const fb=arr(f).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
   if(fb.length>=30)return{bars:fb,source:'brokerFeed.timeframes'};
   const pb=parsed(tf).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
   if(pb.length>=30)return{bars:pb,source:'parseBrokerCandles'};
   return{bars:fb.length?fb:pb,source:fb.length?'brokerFeed.timeframes':'parseBrokerCandles'};
 }
 function live(){
   try{
     if(typeof brokerLivePrice==='function'){
       const x=brokerLivePrice();
       const p=n(x?.price??x?.last);
       if(p!=null)return p;
     }
   }catch(_){}
   if(typeof brokerFeed!=='undefined')return n(brokerFeed?.quote?.last??brokerFeed?.price);
   return null;
 }
 function atr(c,p=14){
   if(!Array.isArray(c)||c.length<p+1)return null;
   const tr=[];
   for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
   return tr.slice(-p).reduce((a,b)=>a+b,0)/Math.min(p,tr.length);
 }
 function ema(values,p){
   if(!values.length)return null;
   const k=2/(p+1);let e=values[0];
   for(let i=1;i<values.length;i++)e=values[i]*k+e*(1-k);
   return e;
 }
 function score(c){
   if(!Array.isArray(c)||c.length<3)return{buy:50,sell:50,bias:'NEUTRAL',score:0};
   const x=c[c.length-1],p=c[c.length-2],look=c.slice(-20);
   const hi=Math.max(...look.map(b=>b.h)),lo=Math.min(...look.map(b=>b.l));
   const range=Math.max(x.h-x.l,1e-9),body=x.c-x.o;
   let bull=50,bear=50;
   if(body>0)bull+=Math.min(15,15*Math.abs(body)/range);
   if(body<0)bear+=Math.min(15,15*Math.abs(body)/range);
   if(x.c>p.c)bull+=7;else if(x.c<p.c)bear+=7;
   if(x.c>(hi+lo)/2)bull+=10;else bear+=10;
   const closes=c.slice(-Math.min(50,c.length)).map(b=>b.c);
   if(closes.length>=20){
     const fast=ema(closes.slice(-20),8),slow=ema(closes,20);
     if(fast>slow)bull+=13;else if(fast<slow)bear+=13;
   }
   const total=Math.max(1,bull+bear),buy=clamp(bull/total*100),sell=clamp(100-buy);
   return{buy,sell,bias:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',score:Math.round(Math.max(buy,sell))};
 }

 function candleInfo(c){
   const x=c[c.length-1];if(!x)return null;
   const range=Math.max(x.h-x.l,1e-9),body=Math.abs(x.c-x.o);
   const upper=x.h-Math.max(x.o,x.c),lower=Math.min(x.o,x.c)-x.l;
   const closePos=(x.c-x.l)/range;
   return {range,body,bodyPct:body/range*100,upper,lower,upperPct:upper/range*100,lowerPct:lower/range*100,closePos};
 }

 function liquidity(c){
   if(c.length<7)return{status:'WAIT',side:'NONE',reason:'Need more closed candles'};
   const x=c[c.length-1],prior=c.slice(-7,-1);
   const hi=Math.max(...prior.map(b=>b.h)),lo=Math.min(...prior.map(b=>b.l));
   const sweepHigh=x.h>hi&&x.c<hi;
   const sweepLow=x.l<lo&&x.c>lo;
   return{
     status:sweepHigh||sweepLow?'PASS':'WAIT',
     side:sweepLow?'SELL_SIDE_SWEPT':sweepHigh?'BUY_SIDE_SWEPT':'NONE',
     referenceHigh:round2(hi),referenceLow:round2(lo),
     reason:sweepLow?'Sell-side liquidity swept':sweepHigh?'Buy-side liquidity swept':'No confirmed liquidity sweep on latest closed candle'
   };
 }

 function structure(c){
   if(c.length<15)return{mss:'WAIT',bos:'WAIT',reason:'Need more closed candles'};
   const x=c[c.length-1];
   const recent=c.slice(-9,-1),prior=c.slice(-15,-9);
   const hi=Math.max(...recent.map(b=>b.h)),lo=Math.min(...recent.map(b=>b.l));
   const hi2=Math.max(...prior.map(b=>b.h)),lo2=Math.min(...prior.map(b=>b.l));
   const bos=x.c>hi?'BULLISH':x.c<lo?'BEARISH':'WAIT';
   const mss=x.c>hi2?'BULLISH':x.c<lo2?'BEARISH':'WAIT';
   return{mss,bos,rangeHigh:round2(hi),rangeLow:round2(lo),mssHigh:round2(hi2),mssLow:round2(lo2)};
 }

 function displacement(c){
   if(c.length<15)return{status:'WAIT',side:'NONE'};
   const x=c[c.length-1],ci=candleInfo(c),a=atr(c);
   if(!ci||!a)return{status:'WAIT',side:'NONE'};
   const strong=ci.bodyPct>=60&&ci.range>=a*1.15;
   return{status:strong?'PASS':'WAIT',side:strong?(x.c>x.o?'BULLISH':'BEARISH'):'NONE',bodyPct:round2(ci.bodyPct),atr:round2(a),range:round2(ci.range)};
 }

 function fvg(c){
   const out=[];
   for(let i=2;i<c.length;i++){
     const a=c[i-2],x=c[i];
     if(a.h<x.l)out.push({type:'BULLISH',low:a.h,high:x.l,size:x.l-a.h,index:i,time:x.t});
     if(a.l>x.h)out.push({type:'BEARISH',low:x.h,high:a.l,size:a.l-x.h,index:i,time:x.t});
   }
   return out.map(z=>{
     const later=c.slice(z.index+1);
     const filled=z.type==='BULLISH'?later.some(x=>x.l<=z.low):later.some(x=>x.h>=z.high);
     return {...z,filled};
   }).filter(z=>!z.filled).slice(-5).reverse();
 }

 function orderBlock(c,dir){
   if(c.length<6||!dir)return null;
   const start=Math.max(0,c.length-8);
   for(let i=c.length-2;i>=start;i--){
     const x=c[i];
     if(dir==='BULLISH'&&x.c<x.o)return{type:'BULLISH',low:x.l,high:x.o,index:i,time:x.t};
     if(dir==='BEARISH'&&x.c>x.o)return{type:'BEARISH',low:x.o,high:x.h,index:i,time:x.t};
   }
   return null;
 }

 function momentum(c){
   if(c.length<20)return{status:'WAIT',side:'NONE'};
   const closes=c.map(x=>x.c),fast=ema(closes.slice(-20),8),slow=ema(closes.slice(-50),20);
   const x=c[c.length-1],up=fast>slow&&x.c>closes[closes.length-3],down=fast<slow&&x.c<closes[closes.length-3];
   return{status:up||down?'PASS':'WAIT',side:up?'BULLISH':down?'BEARISH':'NONE',fast:round2(fast),slow:round2(slow)};
 }

 function premiumDiscount(c,price){
   if(c.length<10||price==null)return{status:'WAIT',side:'NONE'};
   const look=c.slice(-20),hi=Math.max(...look.map(x=>x.h)),lo=Math.min(...look.map(x=>x.l)),mid=(hi+lo)/2;
   const span=Math.max(hi-lo,1e-9),pos=(price-lo)/span;
   return{status:'PASS',side:pos<0.5?'BULLISH':pos>0.5?'BEARISH':'NEUTRAL',high:round2(hi),low:round2(lo),midpoint:round2(mid),positionPct:round2(pos*100)};
 }

 function spreadGate(){
   try{
     const q=typeof brokerFeed!=='undefined'?brokerFeed?.quote:null;
     const bid=n(q?.bid),ask=n(q?.ask);
     if(bid!=null&&ask!=null&&ask>=bid)return{status:'PASS',spread:round2(ask-bid)};
   }catch(_){}
   return{status:'WAIT',spread:null,reason:'Broker spread not exposed to Pre-Market route'};
 }

 function zones(c,price,dir,activeFvg,ob){
   if(!c.length||price==null)return{buyZone:null,sellZone:null,referenceHigh:null,referenceLow:null,midpoint:null};
   const look=c.slice(-30),hi=Math.max(...look.map(x=>x.h)),lo=Math.min(...look.map(x=>x.l)),mid=(hi+lo)/2,span=hi-lo;
   let buyZone=null,sellZone=null;
   const bf=activeFvg.find(z=>z.type==='BULLISH'),sf=activeFvg.find(z=>z.type==='BEARISH');
   if(bf)buyZone=[bf.low,bf.high];
   else if(ob?.type==='BULLISH')buyZone=[ob.low,ob.high];
   else buyZone=[lo+span*.25,lo+span*.40];
   if(sf)sellZone=[sf.low,sf.high];
   else if(ob?.type==='BEARISH')sellZone=[ob.low,ob.high];
   else sellZone=[hi-span*.40,hi-span*.25];
   return{buyZone:buyZone.map(round2),sellZone:sellZone.map(round2),referenceHigh:round2(hi),referenceLow:round2(lo),midpoint:round2(mid),entryArea:price<mid?'DISCOUNT / BELOW MIDPOINT':price>mid?'PREMIUM / ABOVE MIDPOINT':'EQUILIBRIUM'};
 }

 function buildGates(c,price){
   const s=structure(c),liq=liquidity(c),disp=displacement(c),gaps=fvg(c);
   const dir=disp.side!=='NONE'?disp.side:(s.bos!=='WAIT'?s.bos:(s.mss!=='WAIT'?s.mss:null));
   const ob=orderBlock(c,dir),mom=momentum(c),pd=premiumDiscount(c,price),spr=spreadGate();
   const bullFvg=gaps.find(x=>x.type==='BULLISH'),bearFvg=gaps.find(x=>x.type==='BEARISH');
   const fvgGate=!!(bullFvg||bearFvg),obGate=!!ob;
   const executionZone=(pd.status==='PASS')&&(fvgGate||obGate);
   const all=liq.status==='PASS'&&s.mss!=='WAIT'&&s.bos!=='WAIT'&&disp.status==='PASS'&&fvgGate&&obGate&&pd.status==='PASS'&&executionZone&&mom.status==='PASS'&&spr.status==='PASS';
   return{
     gates:{
       liquiditySweep:liq.status==='PASS',mss:s.mss!=='WAIT',bos:s.bos!=='WAIT',
       displacement:disp.status==='PASS',fvg:fvgGate,orderBlock:obGate,
       premiumDiscountOk:pd.status==='PASS',executionZone,technicalMomentumOk:mom.status==='PASS',
       spreadOk:spr.status==='PASS',allGatesPassed:all
     },
     details:{liquiditySweep:liq,mss:s.mss,bos:s.bos,displacement:disp,fvg:gaps,orderBlock:ob,premiumDiscount:pd,momentum:mom,spread:spr},
     direction:dir||'NEUTRAL',activeFvg:gaps
   };
 }

 function handler(req,res){
   res.set('Cache-Control','no-store');
   try{
     const q=live(),timeframes={};let weighted=0,totalWeight=0;
     for(const tf of TFS){
       const b=bars(tf),c=b.bars,last=c[c.length-1]||{},s=score(c),ci=candleInfo(c);
       const tfG=buildGates(c,q);
       timeframes[tf]={
         tf,ready:c.length>=30,bars:c.length,candles:c,source:b.source,
         open:last.o??null,high:last.h??null,low:last.l??null,close:last.c??null,
         currentPrice:q??last.c??null,buyPct:Math.round(s.buy),sellPct:Math.round(s.sell),
         direction:s.bias,score:s.score,atr:round2(atr(c)),candle:ci,
         gates:tfG.gates,ict:tfG.details,activeFvg:tfG.activeFvg
       };
       if(timeframes[tf].ready){weighted+=s.buy*WEIGHTS[tf];totalWeight+=100*WEIGHTS[tf];}
     }
     const ready=CORE.filter(tf=>timeframes[tf].ready).length;
     const buy=totalWeight?weighted/totalWeight*100:50,sell=100-buy,bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
     const active=timeframes.M15?.ready?timeframes.M15:timeframes.H1;
     const gates=buildGates(active?.candles||[],q);
     const confidence=Math.round(50+Math.abs(buy-sell)/2);
     const z=zones(active?.candles||[],q,gates.direction,gates.activeFvg,gates.details.orderBlock);
     return res.json({
       success:true,symbol:'XAUUSD',source:'MT5 brokerFeed',
       price:q??active?.close??null,livePrice:q??active?.close??null,
       available:ready,required:4,complete:ready===4,optionalD1:timeframes.D1.ready,
       missingTimeframes:CORE.filter(tf=>!timeframes[tf].ready),timeframes,frames:timeframes,
       buyStrengthPct:Math.round(buy),sellStrengthPct:Math.round(sell),bias,
       directionScore:Math.round(Math.max(buy,sell)),preAiConfidence:confidence,confidence,
       gates:gates.gates,ict:gates.details,confirmations:gates.gates,
       zone:{...z,authorization:false},workflow:{
         stage:ready===4?'PRE_MARKET_MTF_READY':'PRE_MARKET_MTF_WAITING',
         source:'MT5_AUTHORITATIVE',entryAuthorization:false,orderAuthorization:false,
         aiRole:'CONFIRMATION_ONLY',telegramIndependent:true
       },generatedAt:new Date().toISOString()
     });
   }catch(e){
     console.error('[V-TRADE PRE-MARKET AUTH] ERROR',e?.stack||e?.message||e);
     return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});
   }
 }

 app.options('/api/pre-market/mt5-authoritative',handler);
 app.get('/api/pre-market/mt5-authoritative',handler);
 console.log('[V-TRADE PRE-MARKET AUTH] V2 ACTIVE | MT5 authoritative + ICT zone/gate engine');
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
