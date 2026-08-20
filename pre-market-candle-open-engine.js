/* V-TRADE AI — Pre-Market Candle-Open MTF Engine
 * Scope: Pre-Market Zone Analysis only.
 * No Telegram, no order execution, no AI calls.
 * Uses the exact closed candles already exposed by /api/analysis/xauusd.
 */
'use strict';

module.exports = function installPreMarketCandleOpenEngine(app){
  if(!app || app.__VTRADE_PREMARKET_CANDLE_OPEN__) return;
  app.__VTRADE_PREMARKET_CANDLE_OPEN__=true;

  const TFS=['M5','M15','H1','H4','D1'];
  const WEIGHTS={M5:1,M15:2,H1:3,H4:4,D1:5};
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const round1=v=>Math.round(clamp(v)*10)/10;
  const side=v=>{const s=String(v||'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
  const avg=a=>Array.isArray(a)&&a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

  function ema(values,period){
    if(!values.length)return null;
    const k=2/(period+1); let e=values[0];
    for(let i=1;i<values.length;i++)e=values[i]*k+e*(1-k);
    return e;
  }
  function atr(c,period=14){
    if(c.length<period+1)return null;
    const tr=[]; for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
    return avg(tr.slice(-period));
  }
  function rsi(c,period=14){
    if(c.length<period+1)return null;
    let g=0,l=0; for(let i=c.length-period;i<c.length;i++){const d=c[i].c-c[i-1].c;if(d>0)g+=d;else l-=d;}
    if(l===0)return 100; const rs=(g/period)/(l/period); return 100-100/(1+rs);
  }
  function candleScore(c){
    if(c.length<3)return {direction:'NEUTRAL',score:50,reason:'Insufficient closed candles'};
    const last=c[c.length-1], prev=c[c.length-2], body=last.c-last.o, range=Math.max(last.h-last.l,1e-9);
    const bodyPct=Math.abs(body)/range;
    const closePos=(last.c-last.l)/range;
    const upper=last.h-Math.max(last.o,last.c), lower=Math.min(last.o,last.c)-last.l;
    let bull=50, bear=50;
    if(body>0){bull+=15*bodyPct;bear-=15*bodyPct;} else if(body<0){bear+=15*bodyPct;bull-=15*bodyPct;}
    if(closePos>.65)bull+=10; else if(closePos<.35)bear+=10;
    if(lower>upper*1.4)bull+=8; if(upper>lower*1.4)bear+=8;
    if(last.c>prev.c)bull+=7; else if(last.c<prev.c)bear+=7;
    return {direction:bull>bear?'BULLISH':bear>bull?'BEARISH':'NEUTRAL',score:clamp(Math.max(bull,bear)),bull:clamp(bull),bear:clamp(bear),bodyPct,closePos};
  }
  function structureScore(c){
    if(c.length<20)return {direction:'NEUTRAL',score:50};
    const closes=c.map(x=>x.c), e20=ema(closes.slice(-80),20), e50=ema(closes.slice(-120),50), last=c[c.length-1];
    const trend=e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL';
    const look=c.slice(-10), hi=Math.max(...look.map(x=>x.h)), lo=Math.min(...look.map(x=>x.l));
    let bull=50,bear=50;
    if(trend==='BULLISH')bull+=15; if(trend==='BEARISH')bear+=15;
    if(last.c>(hi+lo)/2)bull+=8; else bear+=8;
    const a=atr(c); if(a){if(last.c-last.o>a*.6)bull+=7;if(last.o-last.c>a*.6)bear+=7;}
    return {direction:bull>bear?'BULLISH':bear>bull?'BEARISH':'NEUTRAL',score:clamp(Math.max(bull,bear)),trend};
  }
  function timeframe(c,tf){
    if(!Array.isArray(c)||c.length<3)return {tf,direction:'NEUTRAL',buyPct:50,sellPct:50,score:0,ready:false,reason:'Candle history unavailable'};
    const clean=c.filter(x=>n(x.o)!=null&&n(x.h)!=null&&n(x.l)!=null&&n(x.c)!=null).sort((a,b)=>Number(a.t)-Number(b.t));
    const last=clean[clean.length-1]; const cs=candleScore(clean), ss=structureScore(clean), rr=rsi(clean), aa=atr(clean);
    let buy=50,sell=50;
    buy+=(cs.bull-50)*0.45+(ss.direction==='BULLISH'?ss.score-50:ss.direction==='BEARISH'?-(ss.score-50):0)*0.55;
    sell+=(cs.bear-50)*0.45+(ss.direction==='BEARISH'?ss.score-50:ss.direction==='BULLISH'?-(ss.score-50):0)*0.55;
    if(rr!=null){if(rr>50)buy+=Math.min(10,(rr-50)*.25);if(rr<50)sell+=Math.min(10,(50-rr)*.25);}
    const total=Math.max(1,buy+sell); buy=buy/total*100; sell=sell/total*100;
    return {tf,ready:true,candleTime:last.t,open:last.o,high:last.h,low:last.l,close:last.c,currentPrice:last.c,currentVsOpen:last.c-last.o,direction:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',buyPct:round1(buy),sellPct:round1(100-buy),score:Math.round(Math.max(buy,100-buy)),candle:cs,structure:ss,rsi:rr==null?null:Math.round(rr*10)/10,atr:aa==null?null:Math.round(aa*100)/100};
  }

  function buildGates(a){
    const c=a?.confirmations||{};
    const ict=a?.ict||{};
    const zone=a?.zoneRadar||{};
    const ref=a?.referenceZone||{};
    const confirmed=v=>v===true || v===1 || String(v).toLowerCase()==='true' || String(v).toUpperCase()==='PASS';
    const directional=v=>side(v)!=='NEUTRAL';
    return {
      liquiditySweep: confirmed(c.sweepOk)||confirmed(c.liquiditySweepOk)||confirmed(ict.liquiditySweep?.confirmed),
      mss: confirmed(c.mssOk)||confirmed(c.structureAgreement)||directional(ict.mss),
      bos: confirmed(c.bosOk)||directional(ict.bos),
      displacement: confirmed(c.displacementOk)||confirmed(ict.displacement?.confirmed),
      fvg: confirmed(c.fvgOk)||confirmed(ict.fvg?.confirmed)||directional(ict.fvg?.type),
      orderBlock: confirmed(c.orderBlockOk)||confirmed(c.obOk)||confirmed(ict.orderBlock?.confirmed)||directional(ict.orderBlock?.type),
      premiumDiscountOk: confirmed(c.premiumDiscountOk)||confirmed(c.locationOk)||confirmed(zone.executionZoneOk)||confirmed(ref.executionZoneOk),
      executionZone: confirmed(c.executionZoneOk)||confirmed(c.locationOk)||confirmed(zone.executionZoneOk)||confirmed(ref.executionZoneOk),
      technicalMomentumOk: confirmed(c.technicalMomentumOk)||confirmed(c.momentumOk),
      spreadOk: confirmed(c.spreadOk),
      allGatesPassed: confirmed(c.allGatesPassed)
    };
  }

  function calculate(raw){
    const a=raw?.analysis||raw?.data||raw||{};
    const tfData=a.timeframes||a.mtf||{};
    const rows={}; let weightedBuy=0,weightTotal=0,available=0;
    for(const tf of TFS){
      const node=tfData[tf]||tfData[tf.toLowerCase()]||a[tf]||a[tf.toLowerCase()]||{};
      const row=timeframe(node.candles||[],tf); rows[tf]=row;
      if(row.ready){weightedBuy+=row.buyPct*WEIGHTS[tf];weightTotal+=100*WEIGHTS[tf];available++;}
    }
    const buy=weightTotal?weightedBuy/weightTotal*100:50;
    const sell=100-buy;
    const bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const active=rows.H4;
    const currentPrice=n(a.price??a.livePrice??a.quote?.price??a.mt5?.price);
    const refAtr=active?.atr||5;
    const zoneWidth=Math.max(refAtr*.35,.5);
    // Zone map is intentionally two-sided: pre-market identifies BOTH possible entry areas.
    // Direction strength is evidence, not permission to hide the opposite zone.
    const buyZone=currentPrice!=null?[currentPrice-zoneWidth,currentPrice-zoneWidth*.20]:null;
    const sellZone=currentPrice!=null?[currentPrice+zoneWidth*.20,currentPrice+zoneWidth]:null;
    const gates=buildGates(a);
    const confidence=round1(50+Math.abs(buy-sell)/2);
    return {
      symbol:'XAUUSD',price:currentPrice,frames:rows,timeframes:rows,available,complete:available===TFS.length,weights:WEIGHTS,
      buyStrengthPct:round1(buy),sellStrengthPct:round1(sell),buyScore:round1(buy),sellScore:round1(sell),bias,
      preAiConfidence:confidence,confidence,
      gates,confirmations:a.confirmations||{},ict:a.ict||{},
      zone:{buyZone,sellZone,reference:'Candle-Open MTF reference zone; not an execution authorization'},
      workflow:{stage:'PRE_MARKET_CANDLE_OPEN',orderAuthorization:false,aiRole:'AFTER_PRE_AI'},
      generatedAt:new Date().toISOString()
    };
  }

  async function getAnalysis(req){
    const host=String(process.env.INTERNAL_HOST||'127.0.0.1'); const port=Number(process.env.PORT||10000);
    const token=String(req.get('x-vtrade-auth')||'');
    const r=await fetch(`http://${host}:${port}/api/analysis/xauusd`,{headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(9000)});
    const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));
    if(!r.ok||raw?.success===false)throw new Error(raw?.error||`analysis HTTP ${r.status}`);
    return raw;
  }

  app.get('/api/pre-market/candle-open',async(req,res)=>{
    try{return res.json({success:true,...calculate(await getAnalysis(req))});}
    catch(e){return res.status(502).json({success:false,error:String(e?.message||e)});}
  });
  console.log('[PRE-MARKET CANDLE] M5→M15→H1→H4→D1 Candle-Open MTF engine ACTIVE');
};
