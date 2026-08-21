/* V-TRADE AI — Pre-Market authoritative MT5 route V2
 * MT5-native pre-market snapshot.
 * Calculates candle structure + ICT evidence for UI display.
 * NEVER authorizes an order and NEVER sends Telegram.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_AUTHORITY_ROUTE_V2';

function inject(source){
  if(!source) return source;
  if(source.includes(MARKER)) return source;
  const anchor='const app = express();';
  if(!source.includes(anchor)) throw new Error('server app marker not found');

  const code=String.raw`
/* ${MARKER} */
(function installPreMarketAuthorityV2(app){
  if(!app||app.__VTRADE_PREMARKET_AUTHORITY_V2__)return;
  app.__VTRADE_PREMARKET_AUTHORITY_V2__=true;

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
    try{if(typeof parseBrokerCandles==='function'){const p=clean(parseBrokerCandles(tf));if(p.length>=MIN)return{bars:p,source:'parseBrokerCandles'};}}catch(e){console.warn('[PRE-MARKET V2] parser',tf,e?.message||e);}
    return{bars:f,source:f.length?'brokerFeed.timeframes':'none'};
  }
  function live(){
    try{if(typeof brokerLivePrice==='function'){const q=brokerLivePrice();const p=n(q?.price??q?.last);if(p!=null)return p;}}catch(_){}
    try{if(typeof brokerFeed!=='undefined')return n(brokerFeed?.quote?.last??brokerFeed?.price);}catch(_){}
    return null;
  }
  function candle(c){
    if(c.length<2)return{ready:false};
    const x=c[c.length-1],p=c[c.length-2],r=Math.max(x.h-x.l,1e-9),b=Math.abs(x.c-x.o);
    const up=x.h-Math.max(x.o,x.c),lo=Math.min(x.o,x.c)-x.l;
    const bp=b/r,upP=up/r,loP=lo/r,pos=(x.c-x.l)/r;
    const hammer=lo>=b*2&&up<=Math.max(b*.8,r*.15)&&pos>.55;
    const star=up>=b*2&&lo<=Math.max(b*.8,r*.15)&&pos<.45;
    const engulfBull=x.c>x.o&&p.c<p.o&&x.o<=p.c&&x.c>=p.o;
    const engulfBear=x.c<x.o&&p.c>p.o&&x.o>=p.c&&x.c<=p.o;
    return{ready:true,open:x.o,high:x.h,low:x.l,close:x.c,bodyPct:+(bp*100).toFixed(1),upperWickPct:+(upP*100).toFixed(1),lowerWickPct:+(loP*100).toFixed(1),closePosition:+(pos*100).toFixed(1),hammer,shootingStar:star,bullishEngulfing:engulfBull,bearishEngulfing:engulfBear,candleTime:x.t};
  }
  function liquidity(c){
    if(c.length<7)return{status:'WAIT',side:'NONE'};
    const x=c[c.length-1],p=c.slice(-7,-1),hi=Math.max(...p.map(z=>z.h)),lo=Math.min(...p.map(z=>z.l));
    const sellSide=x.l<lo&&x.c>lo,buySide=x.h>hi&&x.c<hi;
    return{status:sellSide||buySide?'PASS':'WAIT',side:sellSide?'SELL_SIDE_SWEPT':buySide?'BUY_SIDE_SWEPT':'NONE',referenceHigh:hi,referenceLow:lo};
  }
  function structure(c){
    if(c.length<12)return{mss:'WAIT',bos:'WAIT'};
    const x=c[c.length-1],a=c.slice(-9,-1),b=c.slice(-17,-9);
    const hi=Math.max(...a.map(z=>z.h)),lo=Math.min(...a.map(z=>z.l));
    const hi2=Math.max(...b.map(z=>z.h)),lo2=Math.min(...b.map(z=>z.l));
    const bos=x.c>hi?'BULLISH':x.c<lo?'BEARISH':'WAIT';
    const mss=x.c>hi2?'BULLISH':x.c<lo2?'BEARISH':'WAIT';
    return{mss,bos,rangeHigh:hi,rangeLow:lo};
  }
  function fvg(c){
    const out=[];
    for(let i=2;i<c.length;i++){
      const a=c[i-2],x=c[i];
      if(a.h<x.l)out.push({type:'BULLISH',low:a.h,high:x.l,index:i,time:x.t});
      if(a.l>x.h)out.push({type:'BEARISH',low:x.h,high:a.l,index:i,time:x.t});
    }
    return out.slice(-10).reverse().map(z=>{
      const later=c.slice(z.index+1);
      const filled=z.type==='BULLISH'?later.some(x=>x.l<=z.low):later.some(x=>x.h>=z.high);
      return{...z,filled};
    }).filter(z=>!z.filled).slice(0,3);
  }
  function orderBlock(c){
    if(c.length<6)return null;
    const st=structure(c),x=c[c.length-1],a=c.slice(-8,-1),bull=st.bos==='BULLISH'||st.mss==='BULLISH',bear=st.bos==='BEARISH'||st.mss==='BEARISH';
    if(!bull&&!bear)return null;
    for(let i=a.length-1;i>=0;i--){
      const z=a[i];
      if(bull&&z.c<z.o)return{type:'BULLISH',low:z.l,high:z.o,time:z.t};
      if(bear&&z.c>z.o)return{type:'BEARISH',low:z.o,high:z.h,time:z.t};
    }
    return null;
  }
  function row(c,tf,price){
    const last=c[c.length-1],cs=candle(c),liq=liquidity(c),st=structure(c),gaps=fvg(c),ob=orderBlock(c),a=atr(c);
    if(c.length<MIN)return{tf,ready:false,bars:c.length,source:null};
    let bull=50,bear=50;
    if(last.c>last.o)bull+=12;else if(last.c<last.o)bear+=12;
    if(st.mss==='BULLISH')bull+=8;if(st.mss==='BEARISH')bear+=8;
    if(st.bos==='BULLISH')bull+=10;if(st.bos==='BEARISH')bear+=10;
    if(liq.side==='SELL_SIDE_SWEPT')bull+=8;if(liq.side==='BUY_SIDE_SWEPT')bear+=8;
    if(cs.hammer||cs.bullishEngulfing)bull+=5;if(cs.shootingStar||cs.bearishEngulfing)bear+=5;
    const total=Math.max(1,bull+bear),buy=clamp(bull/total*100),sell=100-buy;
    const bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    return{tf,ready:true,bars:c.length,open:last.o,high:last.h,low:last.l,close:last.c,currentPrice:n(price??last.c),buyPct:Math.round(buy),sellPct:Math.round(sell),direction:bias,score:Math.round(Math.max(buy,sell)),atr:a,candle:cs,liquidity:liq,structure:st,fvg:gaps,orderBlock:ob};
  }
  function zoneFrom(row,refRange,price){
    const f=row.fvg?.[0],ob=row.orderBlock;
    if(f&&price!=null){
      const inside=price>=f.low&&price<=f.high;
      if(f.type==='BULLISH'&&(!inside||price>=f.high))return{low:f.low,high:f.high,source:'FVG'};
      if(f.type==='BEARISH'&&(!inside||price<=f.low))return{low:f.low,high:f.high,source:'FVG'};
    }
    if(ob)return{low:ob.low,high:ob.high,source:'ORDER_BLOCK'};
    if(price!=null&&refRange?.high!=null&&refRange?.low!=null){
      const mid=(refRange.high+refRange.low)/2, w=Math.max((refRange.high-refRange.low)*.12,(row.atr||1)*.35);
      return price>=mid?{low:mid-w,high:mid,source:'DISCOUNT_RANGE'}:{low:mid,high:mid+w,source:'PREMIUM_RANGE'};
    }
    return null;
  }
  function analyze(){
    const price=live(),rows={};let wb=0,wt=0;
    for(const tf of TFS){const b=feed(tf);rows[tf]=row(b.bars,tf,price);rows[tf].source=b.source;if(rows[tf].ready){wb+=rows[tf].buyPct*W[tf];wt+=100*W[tf];}}
    const ready=CORE.filter(tf=>rows[tf].ready).length;
    const buy=wt?wb/wt*100:50,sell=100-buy,bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const m=rows.M15,h=rows.H1||rows.H4;
    const ref={high:h?.structure?.rangeHigh??h?.high,low:h?.structure?.rangeLow??h?.low};
    const buyZ=zoneFrom(m,ref,price),sellZ=zoneFrom({...m, fvg:(m.fvg||[]).filter(z=>z.type==='BEARISH'), orderBlock:m.orderBlock?.type==='BEARISH'?m.orderBlock:null},ref,price);
    const last=m.candle||{}, a=m.atr||h?.atr||null, range=Math.max((m.high??0)-(m.low??0),1e-9);
    const displacement=a!=null?Math.abs((m.close??0)-(m.open??0))/a>=1.0:false;
    const momentum=buy>=57||sell>=57;
    const pd=price!=null&&ref.high!=null&&ref.low!=null?{mid:(ref.high+ref.low)/2,side:price>(ref.high+ref.low)/2?'PREMIUM':'DISCOUNT',ok:true}:null;
    const exec=buyZ||sellZ;
    const gates={
      liquiditySweep:!!(m.liquidity?.status==='PASS'),
      mss:m.structure?.mss==='BULLISH'||m.structure?.mss==='BEARISH',
      bos:m.structure?.bos==='BULLISH'||m.structure?.bos==='BEARISH',
      displacement,
      fvg:!!(m.fvg?.length),
      orderBlock:!!m.orderBlock,
      premiumDiscountOk:!!pd,
      executionZone:!!exec,
      technicalMomentumOk:momentum,
      spreadOk:false,
      allGatesPassed:false
    };
    gates.premiumDiscount=gates.premiumDiscountOk;
    gates.momentum=gates.technicalMomentumOk;
    gates.spread=gates.spreadOk;
    const allCore=gates.liquiditySweep&&gates.mss&&gates.bos&&gates.displacement&&gates.fvg&&gates.orderBlock&&gates.premiumDiscountOk&&gates.executionZone&&gates.technicalMomentumOk&&gates.spreadOk;
    gates.allGatesPassed=allCore;
    const confidence=Math.round(50+Math.min(45,Math.abs(buy-sell)/2));
    return{success:true,symbol:'XAUUSD',source:'MT5 brokerFeed',price,livePrice:price,available:ready,required:4,complete:ready===4,optionalD1:!!rows.D1.ready,missingTimeframes:CORE.filter(tf=>!rows[tf].ready),timeframes:rows,frames:rows,buyStrengthPct:Math.round(buy),sellStrengthPct:Math.round(sell),bias,directionScore:Math.round(Math.max(buy,sell)),preAiConfidence:confidence,confidence,gates,ict:{liquiditySweep:m.liquidity,mss:m.structure?.mss,bos:m.structure?.bos,fvg:m.fvg,orderBlock:m.orderBlock,displacement:{confirmed:displacement,atr:a}},confirmations:gates,zone:{buyZone:buyZ?[buyZ.low,buyZ.high]:null,sellZone:sellZ?[sellZ.low,sellZ.high]:null,buySource:buyZ?.source??null,sellSource:sellZ?.source??null,premiumDiscount:pd,executionZoneOk:!!exec,authorization:false},zones:{buyZone:buyZ?[buyZ.low,buyZ.high]:null,sellZone:sellZ?[sellZ.low,sellZ.high]:null},workflow:{stage:ready===4?'PRE_MARKET_MTF_READY':'PRE_MARKET_MTF_WAITING',source:'MT5_AUTHORITATIVE_V2',entryAuthorization:false,orderAuthorization:false,aiRole:'CONFIRMATION_ONLY',telegramIndependent:true,executionBlocked:!allCore},generatedAt:new Date().toISOString()};
  }
  function handler(req,res){
    res.set('Cache-Control','no-store');
    try{return res.json(analyze());}
    catch(e){console.error('[PRE-MARKET V2] ERROR',e?.stack||e);return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,orderAuthorization:false}});}
  }
  app.options('/api/pre-market/mt5-authoritative',handler);
  app.get('/api/pre-market/mt5-authoritative',handler);
  console.log('[V-TRADE PRE-MARKET AUTH V2] MT5 ICT snapshot ACTIVE');
})(app);
`;
  return source.replace(anchor,anchor+'\n'+code);
}
if(fs.existsSync(SERVER)){
  let source=fs.readFileSync(SERVER,'utf8');
  // If an older authority marker exists, remove only its injected block before installing V2.
  for(const marker of ['VTRADE_PREMARKET_AUTHORITY_ROUTE_V1']){
    let start=source.indexOf('/* '+marker+' */');
    while(start>=0){
      const end=source.indexOf('})(app);',start);
      if(end<0)break;
      source=source.slice(0,start)+source.slice(end+'})(app);'.length);
      start=source.indexOf('/* '+marker+' */');
    }
  }
  source=inject(source);
  fs.writeFileSync(SERVER,source,'utf8');
}
module.exports={inject};
