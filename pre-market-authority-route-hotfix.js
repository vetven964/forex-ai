/* V-TRADE AI — Pre-Market authoritative MT5 route V3
 * Directional ICT zone + real broker spread gate.
 * Uses CLOSED MT5 candles for structure and live broker quote for price.
 * NEVER authorizes an order and NEVER sends Telegram.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_AUTHORITY_ROUTE_V3';

function inject(source){
  if(!source) return source;
  if(source.includes(MARKER)) return source;
  const anchor='const app = express();';
  if(!source.includes(anchor)) throw new Error('server app marker not found');

  const code=String.raw`
/* ${MARKER} */
(function installPreMarketAuthorityV3(app){
  if(!app||app.__VTRADE_PREMARKET_AUTHORITY_V3__)return;
  app.__VTRADE_PREMARKET_AUTHORITY_V3__=true;

  const TFS=['M5','M15','H1','H4','D1'], CORE=['M5','M15','H1','H4'];
  const W={M5:1,M15:2,H1:3,H4:4,D1:5}, MIN=30;
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const arr=x=>Array.isArray(x)?x:Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:Array.isArray(x?.history)?x.history:[];
  const norm=x=>({t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),v:n(x?.v??x?.volume??x?.tickVolume)??0});
  const clean=a=>arr(a).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>(a.t??0)-(b.t??0));
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;

  function atr(c,p=14){
    if(c.length<p+1)return null;
    const tr=[];
    for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
    return avg(tr.slice(-p));
  }

  function feed(tf){
    let f=[];
    try{f=clean(typeof brokerFeed!=='undefined'?brokerFeed?.timeframes?.[tf]:null);}catch(_){}
    if(f.length>=MIN)return{bars:f,source:'brokerFeed.timeframes'};
    try{if(typeof parseBrokerCandles==='function'){const p=clean(parseBrokerCandles(tf));if(p.length>=MIN)return{bars:p,source:'parseBrokerCandles'};}}catch(e){console.warn('[PRE-MARKET V3] parser',tf,e?.message||e);}
    return{bars:f,source:f.length?'brokerFeed.timeframes':'none'};
  }

  function live(){
    try{
      if(typeof brokerLivePrice==='function'){
        const q=brokerLivePrice();
        if(q&&n(q.price)!=null)return q;
      }
    }catch(_){}
    return null;
  }

  function candle(c){
    if(c.length<2)return{ready:false};
    const x=c[c.length-1],p=c[c.length-2],r=Math.max(x.h-x.l,1e-9),b=Math.abs(x.c-x.o);
    const up=x.h-Math.max(x.o,x.c),lo=Math.min(x.o,x.c)-x.l,pos=(x.c-x.l)/r;
    const hammer=lo>=b*2&&up<=Math.max(b*.8,r*.15)&&pos>.55;
    const star=up>=b*2&&lo<=Math.max(b*.8,r*.15)&&pos<.45;
    const engulfBull=x.c>x.o&&p.c<p.o&&x.o<=p.c&&x.c>=p.o;
    const engulfBear=x.c<x.o&&p.c>p.o&&x.o>=p.c&&x.c<=p.o;
    return{ready:true,open:x.o,high:x.h,low:x.l,close:x.c,
      bodyPct:+(b/r*100).toFixed(1),upperWickPct:+(up/r*100).toFixed(1),
      lowerWickPct:+(lo/r*100).toFixed(1),closePosition:+(pos*100).toFixed(1),
      hammer,shootingStar:star,bullishEngulfing:engulfBull,bearishEngulfing:engulfBear,candleTime:x.t};
  }

  function liquidity(c){
    if(c.length<7)return{status:'WAIT',side:'NONE'};
    const x=c[c.length-1],p=c.slice(-7,-1),hi=Math.max(...p.map(z=>z.h)),lo=Math.min(...p.map(z=>z.l));
    const sellSide=x.l<lo&&x.c>lo,buySide=x.h>hi&&x.c<hi;
    return{status:sellSide||buySide?'PASS':'WAIT',
      side:sellSide?'SELL_SIDE_SWEPT':buySide?'BUY_SIDE_SWEPT':'NONE',
      referenceHigh:hi,referenceLow:lo};
  }

  function structure(c){
    if(c.length<17)return{mss:'WAIT',bos:'WAIT'};
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
    return out.reverse().map(z=>{
      const later=c.slice(z.index+1);
      const filled=z.type==='BULLISH'?later.some(x=>x.l<=z.low):later.some(x=>x.h>=z.high);
      return{...z,filled};
    }).filter(z=>!z.filled).slice(0,10);
  }

  function orderBlocks(c){
    if(c.length<8)return[];
    const st=structure(c),a=c.slice(-10,-1),out=[];
    const want=st.bos==='BULLISH'||st.mss==='BULLISH'?'BULLISH':st.bos==='BEARISH'||st.mss==='BEARISH'?'BEARISH':'NEUTRAL';
    if(want==='NEUTRAL')return[];
    for(let i=a.length-1;i>=0;i--){
      const z=a[i];
      if(want==='BULLISH'&&z.c<z.o){out.push({type:'BULLISH',low:z.l,high:z.o,time:z.t});break;}
      if(want==='BEARISH'&&z.c>z.o){out.push({type:'BEARISH',low:z.o,high:z.h,time:z.t});break;}
    }
    return out;
  }

  function row(c,tf,price){
    if(c.length<MIN)return{tf,ready:false,bars:c.length,source:null};
    const last=c[c.length-1],cs=candle(c),liq=liquidity(c),st=structure(c),gaps=fvg(c),obs=orderBlocks(c),a=atr(c);
    let bull=50,bear=50;
    if(last.c>last.o)bull+=12; else if(last.c<last.o)bear+=12;
    if(st.mss==='BULLISH')bull+=8; if(st.mss==='BEARISH')bear+=8;
    if(st.bos==='BULLISH')bull+=10; if(st.bos==='BEARISH')bear+=10;
    if(liq.side==='SELL_SIDE_SWEPT')bull+=8; if(liq.side==='BUY_SIDE_SWEPT')bear+=8;
    if(cs.hammer||cs.bullishEngulfing)bull+=5; if(cs.shootingStar||cs.bearishEngulfing)bear+=5;
    const total=Math.max(1,bull+bear),buy=clamp(bull/total*100),sell=100-buy;
    const bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    return{tf,ready:true,bars:c.length,open:last.o,high:last.h,low:last.l,close:last.c,
      currentPrice:n(price),buyPct:Math.round(buy),sellPct:Math.round(sell),direction:bias,score:Math.round(Math.max(buy,sell)),
      atr:a,candle:cs,liquidity:liq,structure:st,fvg:gaps,orderBlocks:obs,orderBlock:obs[0]||null};
  }

  // Only use zones that are directionally valid relative to live price:
  // BUY = below/at price; SELL = above/at price.
  // Never expose a bearish zone as BUY or a bullish zone as SELL.
  function pickZone(r,side,price){
    if(!r||!r.ready||price==null)return null;
    const want=side==='BUY'?'BULLISH':'BEARISH';
    const candidates=[];
    for(const z of (r.fvg||[]))if(z.type===want)candidates.push({...z,source:'FVG'});
    for(const z of (r.orderBlocks||[]))if(z.type===want)candidates.push({...z,source:'ORDER_BLOCK'});
    const valid=candidates.filter(z=>{
      if(!Number.isFinite(z.low)||!Number.isFinite(z.high))return false;
      const low=Math.min(z.low,z.high),high=Math.max(z.low,z.high);
      return side==='BUY' ? low<=price : high>=price;
    });
    if(!valid.length)return null;
    // Prefer the nearest valid zone to current price.
    valid.sort((a,b)=>{
      const da=price<a.low?a.low-price:price>a.high?price-a.high:0;
      const db=price<b.low?b.low-price:price>b.high?price-b.high:0;
      return da-db;
    });
    const z=valid[0];
    return{low:Math.min(z.low,z.high),high:Math.max(z.low,z.high),source:z.source,type:z.type,
      inZone:price>=Math.min(z.low,z.high)&&price<=Math.max(z.low,z.high)};
  }

  function analyze(){
    const liveQuote=live(),price=liveQuote?.price??null;
    const rows={};let wb=0,wt=0;
    for(const tf of TFS){
      const b=feed(tf); rows[tf]=row(b.bars,tf,price); rows[tf].source=b.source;
      if(rows[tf].ready){wb+=rows[tf].buyPct*W[tf];wt+=100*W[tf];}
    }

    const ready=CORE.filter(tf=>rows[tf].ready).length;
    const buy=wt?wb/wt*100:50,sell=100-buy;
    const bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const m=rows.M15,h=rows.H1||rows.H4;
    const ref={high:h?.structure?.rangeHigh??h?.high,low:h?.structure?.rangeLow??h?.low};

    const buyZ=pickZone(m,'BUY',price);
    const sellZ=pickZone(m,'SELL',price);

    const spread=n(liveQuote?.spread);
    // Gold spread is broker-native; do not invent a value.
    // Default maximum is 0.80 price units, configurable server-side.
    const maxSpread=Math.max(0.01,n(process.env.VTRADE_PREMARKET_MAX_SPREAD)??0.80);
    const spreadOk=spread!=null&&spread>=0&&spread<=maxSpread;

    const mid=Number.isFinite(ref.high)&&Number.isFinite(ref.low)?(ref.high+ref.low)/2:null;
    const premiumDiscount=price!=null&&mid!=null?(price>mid?'PREMIUM':price<mid?'DISCOUNT':'EQUILIBRIUM'):null;
    const pdOk=bias==='BULLISH'?premiumDiscount==='DISCOUNT':bias==='BEARISH'?premiumDiscount==='PREMIUM':false;

    const liq=m?.liquidity?.status==='PASS';
    const mss=m?.structure?.mss===bias;
    const bos=m?.structure?.bos===bias;
    const atrM=m?.atr;
    const body=Math.abs((m?.close??0)-(m?.open??0));
    const displacement=atrM!=null&&body/Math.max(atrM,1e-9)>=1;
    const fvg=!!(m?.fvg||[]).some(z=>z.type===(bias==='BULLISH'?'BULLISH':'BEARISH'));
    const ob=!!(m?.orderBlocks||[]).some(z=>z.type===(bias==='BULLISH'?'BULLISH':'BEARISH'));
    const momentum=Math.abs(buy-sell)>=8;
    const execZone=bias==='BULLISH'?buyZ:bias==='BEARISH'?sellZ:null;
    const all=ready===4&&bias!=='NEUTRAL'&&liq&&mss&&bos&&displacement&&fvg&&ob&&pdOk&&!!execZone&&momentum&&spreadOk;

    const gates={
      liquiditySweep:liq,mss,bos,displacement,fvg,orderBlock:ob,
      premiumDiscountOk:pdOk,executionZone:!!execZone,
      technicalMomentumOk:momentum,spreadOk,allGatesPassed:all
    };
    gates.premiumDiscount=gateValue(gates.premiumDiscountOk);
    gates.momentum=gateValue(gates.technicalMomentumOk);
    gates.spread=gateValue(gates.spreadOk);

    const entryStatus=all?'ENTRY_READY':'WAIT';
    const entryReason=all?'All mandatory ICT + MTF + spread gates passed':
      ready<4?'Waiting for M5/M15/H1/H4 history':
      !bias||bias==='NEUTRAL'?'No directional MTF bias':
      !liq?'Waiting for liquidity sweep':
      !mss?'Waiting for MSS aligned with MTF bias':
      !bos?'Waiting for BOS aligned with MTF bias':
      !displacement?'Waiting for displacement':
      !fvg?'Waiting for aligned FVG':
      !ob?'Waiting for aligned Order Block':
      !pdOk?'Waiting for correct premium/discount location':
      !execZone?'No directionally valid execution zone near/at current price':
      !momentum?'Waiting for momentum confirmation':
      !spreadOk?'Waiting for acceptable broker spread':
      'Waiting for mandatory gates';

    return{
      success:true,symbol:'XAUUSD',source:'MT5 brokerFeed',price,livePrice:price,
      bid:n(liveQuote?.bid),ask:n(liveQuote?.ask),spread,
      available:ready,required:4,complete:ready===4,optionalD1:!!rows.D1.ready,
      missingTimeframes:CORE.filter(tf=>!rows[tf].ready),
      timeframes:rows,frames:rows,
      buyStrengthPct:Math.round(buy),sellStrengthPct:Math.round(sell),
      bias,directionScore:Math.round(Math.max(buy,sell)),
      preAiConfidence:Math.round(50+Math.min(45,Math.abs(buy-sell)/2)),
      confidence:Math.round(50+Math.min(45,Math.abs(buy-sell)/2)),
      gates,confirmations:gates,
      ict:{
        liquiditySweep:m.liquidity,mss:m.structure?.mss,bos:m.structure?.bos,
        fvg:m.fvg,orderBlock:m.orderBlock,displacement:{confirmed:displacement,atr:atrM}
      },
      zone:{
        buyZone:buyZ?[buyZ.low,buyZ.high]:null,
        sellZone:sellZ?[sellZ.low,sellZ.high]:null,
        buySource:buyZ?.source??null,sellSource:sellZ?.source??null,
        premiumDiscount,executionZoneOk:!!execZone,authorization:false
      },
      zones:{buyZone:buyZ?[buyZ.low,buyZ.high]:null,sellZone:sellZ?[sellZ.low,sellZ.high]:null},
      execution:{
        status:entryStatus,reason:entryReason,side:bias==='BULLISH'?'BUY':bias==='BEARISH'?'SELL':null,
        zone:execZone?[execZone.low,execZone.high]:null,source:execZone?.source??null,
        inZone:!!execZone?.inZone,spread,spreadOk,authorization:false
      },
      workflow:{
        stage:ready===4?'PRE_MARKET_MTF_READY':'PRE_MARKET_MTF_WAITING',
        source:'MT5_AUTHORITATIVE_V3',entryAuthorization:false,orderAuthorization:false,
        aiRole:'CONFIRMATION_ONLY',telegramIndependent:true,executionBlocked:!all
      },
      generatedAt:new Date().toISOString()
    };
  }

  function gateValue(v){return !!v;}

  function handler(req,res){
    res.set('Cache-Control','no-store');
    try{return res.json(analyze());}
    catch(e){console.error('[PRE-MARKET V3] ERROR',e?.stack||e);
      return res.status(502).json({success:false,error:String(e?.message||e),
        workflow:{entryAuthorization:false,orderAuthorization:false}});
    }
  }

  app.options('/api/pre-market/mt5-authoritative',handler);
  app.get('/api/pre-market/mt5-authoritative',handler);
  console.log('[V-TRADE PRE-MARKET AUTH V3] directional ICT + real spread route ACTIVE');
})(app);
`;

  return source.replace(anchor,anchor+'\n'+code);
}

if(fs.existsSync(SERVER)){
  let source=fs.readFileSync(SERVER,'utf8');
  // Fresh deploys normally have no injected authority block. If a previous
  // V2 block is already present in server.js, remove it so V3 becomes the
  // single authoritative route.
  for(const marker of ['VTRADE_PREMARKET_AUTHORITY_ROUTE_V2','VTRADE_PREMARKET_AUTHORITY_ROUTE_V1']){
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
