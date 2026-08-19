const fs=require('fs');
const Module=require('module');
const path=require('path');
const SERVER_FILE=path.resolve(__dirname,'server.js');
const previousLoader=Module._extensions['.js'];
const originalRead=fs.readFileSync.bind(fs);
function inject(source){
  if(!source || source.includes('VTRADE_PREMARKET_STRUCTURE_V2')) return source;
  const marker='const app = express();';
  if(!source.includes(marker)) return source;
  const code=String.raw`
/* VTRADE_PREMARKET_STRUCTURE_V2 */
(function installPreMarketStructureV2(app){
  if(!app || app.__VTRADE_PREMARKET_STRUCTURE_V2__) return;
  app.__VTRADE_PREMARKET_STRUCTURE_V2__=true;
  const TFS=['M5','M15','H1','H4','D1'];
  const WEIGHTS={M5:1,M15:2,H1:3,H4:4,D1:5};
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const round=v=>Math.round(Number(v)*10)/10;
  const norm=x=>({o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),t:n(x?.t??x?.time)});
  const getBars=(a,tf)=>{const t=a?.timeframes||a?.mtf||a?.multiTimeFrame||a?.multiTimeframe||{};const x=t[tf]??t[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()];const arr=Array.isArray(x)?x:(Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:[]);return arr.map(norm).filter(b=>[b.o,b.h,b.l,b.c].every(Number.isFinite)).sort((a,b)=>(a.t??0)-(b.t??0));};
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const atr=(c,p=14)=>{if(c.length<p+1)return null;const tr=[];for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));return avg(tr.slice(-p));};
  function candle(c){
    if(c.length<2)return {ready:false};
    const x=c[c.length-1],p=c[c.length-2],range=Math.max(x.h-x.l,1e-9),body=Math.abs(x.c-x.o),upper=x.h-Math.max(x.o,x.c),lower=Math.min(x.o,x.c)-x.l,bodyPct=body/range,upperPct=upper/range,lowerPct=lower/range,closePos=(x.c-x.l)/range;
    const bullish=x.c>x.o;
    const hammer=lower>=body*2&&upper<=Math.max(body*.8,range*.12)&&closePos>.55;
    const invertedHammer=upper>=body*2&&lower<=Math.max(body*.8,range*.12)&&closePos<.75;
    const doji=bodyPct<=.12;
    const bullishEngulf=bullish&&!(p.c>p.o)&&x.o<=p.c&&x.c>=p.o;
    const bearishEngulf=!bullish&&(p.c>p.o)&&x.o>=p.c&&x.c<=p.o;
    const wickBias=lower>upper*1.4?'BUY_REJECTION':upper>lower*1.4?'SELL_REJECTION':'BALANCED_WICKS';
    return {ready:true,open:x.o,high:x.h,low:x.l,close:x.c,range,body,bodyPct:round(bodyPct*100),upperWick:upper,lowerWick:lower,upperWickPct:round(upperPct*100),lowerWickPct:round(lowerPct*100),wickBias,closePosition:round(closePos*100),hammer,invertedHammer,doji,bullishEngulf,bearishEngulf,candleTime:x.t,previousClose:p.c};
  }
  function pressure(c,cs){
    if(!cs.ready)return {buy:50,sell:50,side:'BALANCED',quality:'LOW'};
    const body=(cs.close-cs.open)/Math.max(cs.range,1e-9),close=(cs.closePosition-50)/50,rejection=(cs.lowerWick-cs.upperWick)/Math.max(cs.range,1e-9);
    let buy=clamp(50+body*24+close*16+rejection*12);const sell=100-buy,diff=Math.abs(buy-sell);
    return {buy:round(buy),sell:round(sell),side:diff<8?'BALANCED':buy>sell?'BUYERS_DOMINANT':'SELLERS_DOMINANT',quality:diff>=25?'HIGH':diff>=12?'MEDIUM':'LOW',note:'Estimated from candle structure; not broker order-flow volume'};
  }
  function fvg(c){
    const out=[];
    for(let i=2;i<c.length;i++){const a=c[i-2],x=c[i];if(a.h<x.l)out.push({type:'BULLISH',low:a.h,high:x.l,size:x.l-a.h,index:i,time:x.t});if(a.l>x.h)out.push({type:'BEARISH',low:x.h,high:a.l,size:a.l-x.h,index:i,time:x.t});}
    return out.slice(-12).map(z=>{const later=c.slice(z.index+1);const filled=z.type==='BULLISH'?later.some(x=>x.l<=z.low):later.some(x=>x.h>=z.high);return {...z,filled};}).filter(z=>!z.filled).slice(-3).reverse();
  }
  function liquidity(c){
    if(c.length<5)return {status:'WAIT',side:'NONE'};
    const x=c[c.length-1],prior=c.slice(-6,-1),hi=Math.max(...prior.map(b=>b.h)),lo=Math.min(...prior.map(b=>b.l));
    const sweepHigh=x.h>hi&&x.c<hi,sweepLow=x.l<lo&&x.c>lo;
    return {status:sweepHigh||sweepLow?'PASS':'WAIT',side:sweepHigh?'BUY_SIDE_SWEPT':sweepLow?'SELL_SIDE_SWEPT':'NONE',referenceHigh:hi,referenceLow:lo};
  }
  function structure(c){
    if(c.length<10)return {mss:'WAIT',bos:'WAIT'};
    const x=c[c.length-1],prev=c.slice(-8,-1),hi=Math.max(...prev.map(b=>b.h)),lo=Math.min(...prev.map(b=>b.l));
    const bos=x.c>hi?'BULLISH':x.c<lo?'BEARISH':'WAIT';
    const prev2=c.slice(-14,-8),hi2=prev2.length?Math.max(...prev2.map(b=>b.h)):hi,lo2=prev2.length?Math.min(...prev2.map(b=>b.l)):lo;
    const mss=x.c>hi2?'BULLISH':x.c<lo2?'BEARISH':'WAIT';
    return {mss,bos,rangeHigh:hi,rangeLow:lo};
  }
  function row(c,tf,price){
    if(c.length<5)return {tf,ready:false,buyPct:null,sellPct:null,bias:'WAIT',reason:'INSUFFICIENT_CANDLES',bars:c.length};
    const cs=candle(c),pr=pressure(c,cs),liq=liquidity(c),st=structure(c),gaps=fvg(c),a=atr(c),p=n(price??cs.close);
    let buy=pr.buy,sell=pr.sell;
    if(st.bos==='BULLISH'||st.mss==='BULLISH')buy+=8;if(st.bos==='BEARISH'||st.mss==='BEARISH')sell+=8;
    if(liq.side==='SELL_SIDE_SWEPT')buy+=6;if(liq.side==='BUY_SIDE_SWEPT')sell+=6;if(cs.hammer)buy+=5;if(cs.invertedHammer)sell+=3;
    const total=Math.max(1,buy+sell);buy=buy/total*100;sell=100-buy;
    return {tf,ready:true,buyPct:round(buy),sellPct:round(sell),bias:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',price:p,atr:a,barCount:c.length,candle:cs,pressure:pr,liquidity:liq,structure:st,fvg:gaps};
  }
  function analyze(raw){
    const a=raw?.analysis||raw?.data||raw||{},price=n(a?.price??a?.livePrice??a?.quote?.price??a?.mt5?.price),rows={};let wb=0,wt=0;
    for(const tf of TFS){const r=row(getBars(a,tf),tf,price);rows[tf]=r;if(r.ready){wb+=r.buyPct*WEIGHTS[tf];wt+=100*WEIGHTS[tf];}}
    const buy=wt?round(wb/wt*100):null,sell=buy==null?null:round(100-buy),bias=buy==null?'WAIT':buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const core=TFS.map(tf=>rows[tf]).filter(x=>x.ready),last=rows.M15,allFvg=core.flatMap(x=>x.fvg.map(g=>({...g,tf:x.tf}))).slice(-6),preScore=buy==null?0:Math.round(50+Math.min(45,Math.abs(buy-sell))),forecast=last?.bias||bias;
    return {success:true,symbol:'XAUUSD',price,bias,buyStrengthPct:buy,sellStrengthPct:sell,preCandleForecast:{direction:forecast,confidence:preScore,stage:'BEFORE_CURRENT_CANDLE_OPEN'},timeframes:rows,signals:{liquidity:core.some(x=>x.liquidity.status==='PASS'),mss:core.some(x=>x.structure.mss!=='WAIT'),bos:core.some(x=>x.structure.bos!=='WAIT'),fvg:allFvg.length>0,hammer:core.some(x=>x.candle.hammer),buyerSellerBalanced:core.some(x=>x.pressure.side==='BALANCED')},activeFvg:allFvg,workflow:{stage:'PRE_CANDLE_STRUCTURE',sequence:['CLOSED_CANDLE','WICK','BUYER_SELLER_PRESSURE','LIQUIDITY','MSS_BOS','FVG_OB','PRE_CANDLE_FORECAST','CANDLE_OPEN','POST_OPEN_CONFIRMATION','FINAL_AUTHORIZATION'],entryAuthorization:false},generatedAt:new Date().toISOString()};
  }
  async function fetchRaw(req){const token=String(req.get('x-vtrade-auth')||''),port=Number(process.env.PORT||10000);const r=await fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{headers:token?{'x-vtrade-auth':token}: {},signal:AbortSignal.timeout(10000)});const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));if(!r.ok||raw?.success===false)throw Object.assign(new Error(raw?.error||'MT5 analysis unavailable'),{status:r.status||502});return raw;}
  async function handler(req,res){res.set('Cache-Control','no-store');try{return res.json(analyze(await fetchRaw(req)));}catch(e){return res.status(Number(e?.status)||502).json({success:false,error:String(e?.message||e)});}}
  app.get('/api/pre-market/intelligence',handler);app.options('/api/pre-market/intelligence',(req,res)=>res.status(204).end());
  console.log('[V-TRADE PRE-MARKET V2] Wick + pressure + hammer + liquidity + MSS/BOS + FVG intelligence ACTIVE');
})(app);
`;
  return source.replace(marker,marker+'\n'+code);
}
Module._extensions['.js']=function(mod,filename){if(path.resolve(filename)!==SERVER_FILE)return previousLoader(mod,filename);const patched=inject(originalRead(filename,'utf8'));const old=fs.readFileSync;fs.readFileSync=function(file,...args){if(path.resolve(String(file))===SERVER_FILE)return patched;return originalRead(file,...args)};try{return previousLoader(mod,filename)}finally{fs.readFileSync=old;}};
