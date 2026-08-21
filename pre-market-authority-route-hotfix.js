/* V-TRADE AI — Pre-Market authoritative MT5 route V3
 * MT5-native snapshot. Directional ICT zones + truthful execution gates.
 * Analysis only: never authorizes orders and never sends Telegram.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_AUTHORITY_ROUTE_V3';

function stripAuthority(source){
  for(const marker of ['VTRADE_PREMARKET_AUTHORITY_ROUTE_V1','VTRADE_PREMARKET_AUTHORITY_ROUTE_V2','VTRADE_PREMARKET_AUTHORITY_ROUTE_V3']){
    let start=source.indexOf('/* '+marker+' */');
    while(start>=0){
      const end=source.indexOf('})(app);',start);
      if(end<0)break;
      source=source.slice(0,start)+source.slice(end+'})(app);'.length);
      start=source.indexOf('/* '+marker+' */');
    }
  }
  return source;
}

function inject(source){
  if(!source)return source;
  if(source.includes(MARKER))return source;
  const anchor='const app = express();';
  if(!source.includes(anchor))throw new Error('server app marker not found');
  source=stripAuthority(source);
  const code=String.raw`
/* ${MARKER} */
(function installPreMarketAuthorityV3(app){
 if(!app||app.__VTRADE_PREMARKET_AUTHORITY_V3__)return;
 app.__VTRADE_PREMARKET_AUTHORITY_V3__=true;
 const TFS=['M5','M15','H1','H4','D1'],CORE=['M5','M15','H1','H4'];
 const W={M5:1,M15:2,H1:3,H4:4,D1:5},MIN=30;
 const n=v=>Number.isFinite(Number(v))?Number(v):null;
 const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
 const arr=x=>Array.isArray(x)?x:Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:Array.isArray(x?.history)?x.history:[];
 const norm=x=>({t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0});
 const clean=a=>arr(a).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>(a.t??0)-(b.t??0));
 const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 function atr(c,p=14){if(c.length<p+1)return null;const tr=[];for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));return avg(tr.slice(-p));}
 function ema(a,p){if(!a.length)return null;const k=2/(p+1);let e=a[0];for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e;}
 function feed(tf){
  let f=[];try{f=clean(typeof brokerFeed!=='undefined'?brokerFeed?.timeframes?.[tf]:null);}catch(_){}
  if(f.length>=MIN)return{bars:f,source:'brokerFeed.timeframes'};
  try{if(typeof parseBrokerCandles==='function'){const p=clean(parseBrokerCandles(tf));if(p.length>=MIN)return{bars:p,source:'parseBrokerCandles'};}}catch(e){console.warn('[PRE-MARKET V3] parser',tf,e?.message||e);}
  return{bars:f,source:f.length?'brokerFeed.timeframes':'none'};
 }
 function quote(){try{const q=typeof brokerFeed!=='undefined'?brokerFeed?.quote:null;return q||{};}catch(_){return{};}}
 function live(){try{if(typeof brokerLivePrice==='function'){const q=brokerLivePrice();const p=n(q?.price??q?.last);if(p!=null)return p;}}catch(_){}const q=quote();return n(q?.last??q?.price??q?.mid??q?.bid??q?.ask);}
 function candle(c){if(c.length<2)return{ready:false};const x=c[c.length-1],p=c[c.length-2],r=Math.max(x.h-x.l,1e-9),b=Math.abs(x.c-x.o),up=x.h-Math.max(x.o,x.c),lo=Math.min(x.o,x.c)-x.l,pos=(x.c-x.l)/r;return{ready:true,open:x.o,high:x.h,low:x.l,close:x.c,bodyPct:+(b/r*100).toFixed(1),upperWickPct:+(up/r*100).toFixed(1),lowerWickPct:+(lo/r*100).toFixed(1),closePosition:+(pos*100).toFixed(1),hammer:lo>=b*2&&up<=Math.max(b*.8,r*.15)&&pos>.55,shootingStar:up>=b*2&&lo<=Math.max(b*.8,r*.15)&&pos<.45,bullishEngulfing:x.c>x.o&&p.c<p.o&&x.o<=p.c&&x.c>=p.o,bearishEngulfing:x.c<x.o&&p.c>p.o&&x.o>=p.c&&x.c<=p.o,candleTime:x.t};}
 function liquidity(c){if(c.length<7)return{status:'WAIT',side:'NONE'};const x=c[c.length-1],p=c.slice(-7,-1),hi=Math.max(...p.map(z=>z.h)),lo=Math.min(...p.map(z=>z.l)),sell=x.l<lo&&x.c>lo,buy=x.h>hi&&x.c<hi;return{status:sell||buy?'PASS':'WAIT',side:sell?'SELL_SIDE_SWEPT':buy?'BUY_SIDE_SWEPT':'NONE',referenceHigh:hi,referenceLow:lo};}
 function structure(c){if(c.length<17)return{mss:'WAIT',bos:'WAIT'};const x=c[c.length-1],a=c.slice(-9,-1),b=c.slice(-17,-9),hi=Math.max(...a.map(z=>z.h)),lo=Math.min(...a.map(z=>z.l)),hi2=Math.max(...b.map(z=>z.h)),lo2=Math.min(...b.map(z=>z.l));return{mss:x.c>hi2?'BULLISH':x.c<lo2?'BEARISH':'WAIT',bos:x.c>hi?'BULLISH':x.c<lo?'BEARISH':'WAIT',rangeHigh:hi,rangeLow:lo,mssHigh:hi2,mssLow:lo2};}
 function fvg(c){const out=[];for(let i=2;i<c.length;i++){const a=c[i-2],x=c[i];if(a.h<x.l)out.push({type:'BULLISH',low:a.h,high:x.l,index:i,time:x.t});if(a.l>x.h)out.push({type:'BEARISH',low:x.h,high:a.l,index:i,time:x.t});}return out.slice(-15).reverse().map(z=>({...z,filled:z.type==='BULLISH'?c.slice(z.index+1).some(x=>x.l<=z.low):c.slice(z.index+1).some(x=>x.h>=z.high)})).filter(z=>!z.filled).slice(0,8);}
 function orderBlock(c,dir){if(c.length<8||!dir)return null;for(let i=c.length-2;i>=Math.max(0,c.length-12);i--){const z=c[i];if(dir==='BULLISH'&&z.c<z.o)return{type:'BULLISH',low:z.l,high:z.o,time:z.t,index:i};if(dir==='BEARISH'&&z.c>z.o)return{type:'BEARISH',low:z.o,high:z.h,time:z.t,index:i};}return null;}
 function row(c,tf,price){const last=c[c.length-1],cs=candle(c),liq=liquidity(c),st=structure(c),gaps=fvg(c),a=atr(c);if(c.length<MIN)return{tf,ready:false,bars:c.length,source:null};let bull=50,bear=50;if(last.c>last.o)bull+=10;else if(last.c<last.o)bear+=10;if(st.mss==='BULLISH')bull+=10;if(st.mss==='BEARISH')bear+=10;if(st.bos==='BULLISH')bull+=12;if(st.bos==='BEARISH')bear+=12;if(liq.side==='SELL_SIDE_SWEPT')bull+=8;if(liq.side==='BUY_SIDE_SWEPT')bear+=8;if(cs.hammer||cs.bullishEngulfing)bull+=5;if(cs.shootingStar||cs.bearishEngulfing)bear+=5;const total=bull+bear,buy=clamp(bull/total*100),sell=100-buy,bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';const dir=bias==='BULLISH'?'BULLISH':bias==='BEARISH'?'BEARISH':(st.mss!=='WAIT'?st.mss:st.bos!=='WAIT'?st.bos:null);return{tf,ready:true,bars:c.length,open:last.o,high:last.h,low:last.l,close:last.c,currentPrice:n(price??last.c),buyPct:Math.round(buy),sellPct:Math.round(sell),direction:bias,score:Math.round(Math.max(buy,sell)),atr:a,candle:cs,liquidity:liq,structure:st,fvg:gaps,orderBlock:orderBlock(c,dir),directionForZones:dir};}
 function pickZone(row,kind,price){
  if(!row?.ready||price==null)return null;
  const desired=kind==='BUY'?'BULLISH':'BEARISH';
  const candidates=[];
  for(const z of (row.fvg||[])){if(z.type!==desired)continue;const center=(z.low+z.high)/2;if(kind==='BUY'&&center<=price)candidates.push({...z,source:'FVG'});if(kind==='SELL'&&center>=price)candidates.push({...z,source:'FVG'});}
  if(candidates.length){candidates.sort((a,b)=>kind==='BUY'?b.high-a.high:a.low-b.low);return candidates[0];}
  const ob=row.orderBlock;if(ob?.type===desired){const center=(ob.low+ob.high)/2;if((kind==='BUY'&&center<=price)||(kind==='SELL'&&center>=price))return{...ob,source:'ORDER_BLOCK'};}
  return null;
 }
 function spreadGate(){const q=quote();const bid=n(q?.bid),ask=n(q?.ask),raw=n(q?.spread);const sp=bid!=null&&ask!=null?Math.max(0,ask-bid):raw;const max=n(process.env.VTRADE_MAX_SPREAD)??5;if(sp==null)return{status:'WAIT',spread:null,reason:'Broker bid/ask spread unavailable'};return{status:sp<=max?'PASS':'WAIT',spread:sp,maxSpread:max,reason:sp<=max?'Spread within configured limit':'Spread above configured limit'};}
 function analyze(){
  const price=live(),rows={};let wb=0,wt=0;
  for(const tf of TFS){const b=feed(tf);rows[tf]=row(b.bars,tf,price);rows[tf].source=b.source;if(rows[tf].ready){wb+=rows[tf].buyPct*W[tf];wt+=100*W[tf];}}
  const ready=CORE.filter(tf=>rows[tf].ready).length,buy=wt?wb/wt*100:50,sell=100-buy,bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
  const m=rows.M15,h=rows.H1?.ready?rows.H1:rows.H4,activeBias=bias==='NEUTRAL'?(m?.direction||'NEUTRAL'):bias;
  const buyZ=pickZone(m,'BUY',price),sellZ=pickZone(m,'SELL',price);
  const a=m?.atr??h?.atr??null,body=m?.candle?.bodyPct??0,range=m?.high!=null&&m?.low!=null?m.high-m.low:0;
  const displacement=!!(a&&range>0&&body>=60&&range>=a*1.15);
  const fast=m?.ready?ema((m?.close!=null?[...Array(20)].map(()=>m.close):[]),8):null;
  const closes=m?.ready?[]:[];
  const momentum=!!(m?.ready&&(m.buyPct>=57||m.sellPct>=57));
  const pd=price!=null&&h?.structure?.rangeHigh!=null&&h?.structure?.rangeLow!=null?(()=>{const hi=h.structure.rangeHigh,lo=h.structure.rangeLow,mid=(hi+lo)/2;return{mid,side:price<mid?'DISCOUNT':price>mid?'PREMIUM':'EQUILIBRIUM',ok:true};})():null;
  const sp=spreadGate();
  const structureOk=(m?.structure?.mss===activeBias||m?.structure?.bos===activeBias);
  const fvgOk=!!((activeBias==='BULLISH'?(m?.fvg||[]).some(z=>z.type==='BULLISH'):(activeBias==='BEARISH'?(m?.fvg||[]).some(z=>z.type==='BEARISH'):m?.fvg?.length)));
  const obOk=!!(m?.orderBlock&&(activeBias==='NEUTRAL'||m.orderBlock.type===activeBias));
  const executionZone=!!(activeBias==='BULLISH'?buyZ:activeBias==='BEARISH'?sellZ:(buyZ||sellZ));
  const gates={liquiditySweep:m?.liquidity?.status==='PASS',mss:m?.structure?.mss===activeBias,bos:m?.structure?.bos===activeBias,displacement,fvg:fvgOk,orderBlock:obOk,premiumDiscountOk:!!pd,executionZone,technicalMomentumOk:momentum,spreadOk:sp.status==='PASS'};
  gates.premiumDiscount=gates.premiumDiscountOk;gates.momentum=gates.technicalMomentumOk;gates.spread=gates.spreadOk;
  gates.allGatesPassed=Object.values(gates).filter(v=>typeof v==='boolean').slice(0,10).every(Boolean);
  const executionStatus=gates.allGatesPassed?'READY':'WAIT';
  const reason=gates.allGatesPassed?'All ICT execution gates confirmed':Object.entries(gates).filter(([k,v])=>['liquiditySweep','mss','bos','displacement','fvg','orderBlock','premiumDiscountOk','executionZone','technicalMomentumOk','spreadOk'].includes(k)&&!v).map(([k])=>k).join(', ');
  const confidence=Math.round(50+Math.min(45,Math.abs(buy-sell)/2));
  const zone={buyZone:buyZ?[buyZ.low,buyZ.high]:null,sellZone:sellZ?[sellZ.low,sellZ.high]:null,buySource:buyZ?.source??null,sellSource:sellZ?.source??null,premiumDiscount:pd,executionZoneOk:executionZone,authorization:false};
  return{success:true,symbol:'XAUUSD',source:'MT5 brokerFeed',price,livePrice:price,available:ready,required:4,complete:ready===4,optionalD1:!!rows.D1?.ready,missingTimeframes:CORE.filter(tf=>!rows[tf]?.ready),timeframes:rows,frames:rows,buyStrengthPct:Math.round(buy),sellStrengthPct:Math.round(sell),bias,directionScore:Math.round(Math.max(buy,sell)),preAiConfidence:confidence,confidence,gates,ict:{liquiditySweep:m?.liquidity,mss:m?.structure?.mss,bos:m?.structure?.bos,fvg:m?.fvg,orderBlock:m?.orderBlock,displacement:{confirmed:displacement,atr:a},spread:sp},confirmations:gates,zone,zones:zone,executionStatus,executionReason:reason,workflow:{stage:ready===4?'PRE_MARKET_MTF_READY':'PRE_MARKET_MTF_WAITING',source:'MT5_AUTHORITATIVE_V3',entryAuthorization:false,orderAuthorization:false,aiRole:'CONFIRMATION_ONLY',telegramIndependent:true,executionBlocked:!gates.allGatesPassed},generatedAt:new Date().toISOString()};
 }
 function handler(req,res){res.set('Cache-Control','no-store');try{return res.json(analyze());}catch(e){console.error('[PRE-MARKET V3] ERROR',e?.stack||e);return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,orderAuthorization:false}});}}
 app.options('/api/pre-market/mt5-authoritative',handler);app.get('/api/pre-market/mt5-authoritative',handler);
 console.log('[V-TRADE PRE-MARKET AUTH V3] MT5 directional ICT engine ACTIVE');
})(app);
`;
 return source.replace(anchor,anchor+'\n'+code);
}
if(fs.existsSync(SERVER)){let source=fs.readFileSync(SERVER,'utf8');source=inject(source);fs.writeFileSync(SERVER,source,'utf8');}
module.exports={inject};
