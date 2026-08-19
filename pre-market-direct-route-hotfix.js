/* V-TRADE AI — Pre-Market direct route hotfix
 * Fixes runtime 404 and keeps Candle-Open MTF strength consistent with each TF.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';
const MARKER='VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V2';
function inject(source){
  if(!source||source.includes(MARKER))return source;
  const marker='const app = express();';
  if(!source.includes(marker))return source;
  const code=String.raw`
/* ${MARKER} */
(function installPreMarketDirectRoute(app){
  if(!app||app.__VTRADE_PREMARKET_DIRECT_ROUTE_V2__)return;
  app.__VTRADE_PREMARKET_DIRECT_ROUTE_V2__=true;
  const TFS=['M5','M15','H1','H4','D1'];
  const WEIGHTS={M5:1,M15:2,H1:3,H4:4,D1:5};
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const r1=v=>Math.round(clamp(v)*10)/10;
  const avg=a=>Array.isArray(a)&&a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  function ema(v,p){if(!v.length)return null;const k=2/(p+1);let e=v[0];for(let i=1;i<v.length;i++)e=v[i]*k+e*(1-k);return e;}
  function atr(c,p=14){if(c.length<p+1)return null;const tr=[];for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));return avg(tr.slice(-p));}
  function rsi(c,p=14){if(c.length<p+1)return null;let g=0,l=0;for(let i=c.length-p;i<c.length;i++){const d=c[i].c-c[i-1].c;if(d>0)g+=d;else l-=d;}if(l===0)return 100;const rs=(g/p)/(l/p);return 100-100/(1+rs);}
  function candleScore(c){
    if(c.length<3)return{bull:50,bear:50};
    const last=c[c.length-1],prev=c[c.length-2],body=last.c-last.o,range=Math.max(last.h-last.l,1e-9),bodyPct=Math.abs(body)/range,closePos=(last.c-last.l)/range,upper=last.h-Math.max(last.o,last.c),lower=Math.min(last.o,last.c)-last.l;
    let bull=50,bear=50;
    if(body>0){bull+=15*bodyPct;bear-=15*bodyPct;}else if(body<0){bear+=15*bodyPct;bull-=15*bodyPct;}
    if(closePos>.65)bull+=10;else if(closePos<.35)bear+=10;
    if(lower>upper*1.4)bull+=8;if(upper>lower*1.4)bear+=8;
    if(last.c>prev.c)bull+=7;else if(last.c<prev.c)bear+=7;
    return{bull:clamp(bull),bear:clamp(bear)};
  }
  function structureScore(c){
    if(c.length<20)return{direction:'NEUTRAL',score:50};
    const closes=c.map(x=>x.c),e20=ema(closes.slice(-80),20),e50=ema(closes.slice(-120),50),last=c[c.length-1],look=c.slice(-10),hi=Math.max(...look.map(x=>x.h)),lo=Math.min(...look.map(x=>x.l));
    const trend=e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL';let bull=50,bear=50;
    if(trend==='BULLISH')bull+=15;if(trend==='BEARISH')bear+=15;
    if(last.c>(hi+lo)/2)bull+=8;else bear+=8;
    const a=atr(c);if(a){if(last.c-last.o>a*.6)bull+=7;if(last.o-last.c>a*.6)bear+=7;}
    return{direction:bull>bear?'BULLISH':bear>bull?'BEARISH':'NEUTRAL',score:clamp(Math.max(bull,bear))};
  }
  function frame(c,tf,live){
    const clean=(Array.isArray(c)?c:[]).map(x=>({t:n(x?.t??x?.time),o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close)})).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>Number(a.t||0)-Number(b.t||0));
    if(clean.length<20)return{tf,ready:false,buyPct:50,sellPct:50,bias:'NEUTRAL',reason:'INSUFFICIENT_CANDLES'};
    const last=clean[clean.length-1],cs=candleScore(clean),ss=structureScore(clean),rr=rsi(clean);let buy=50,sell=50;
    buy+=(cs.bull-50)*.45+(ss.direction==='BULLISH'?ss.score-50:ss.direction==='BEARISH'?-(ss.score-50):0)*.55;
    sell+=(cs.bear-50)*.45+(ss.direction==='BEARISH'?ss.score-50:ss.direction==='BULLISH'?-(ss.score-50):0)*.55;
    if(rr!=null){if(rr>50)buy+=Math.min(10,(rr-50)*.25);if(rr<50)sell+=Math.min(10,(50-rr)*.25);}
    const total=Math.max(1,buy+sell);buy=buy/total*100;
    const livePrice=n(live)??last.c;
    return{tf,ready:true,open:last.o,high:last.h,low:last.l,close:last.c,currentPrice:livePrice,openMove:livePrice-last.o,buyPct:r1(buy),sellPct:r1(100-buy),bias:buy>50?'BULLISH':buy<50?'BEARISH':'NEUTRAL',score:Math.round(Math.max(buy,100-buy)),rsi:rr==null?null:Math.round(rr*10)/10,atr:atr(clean)==null?null:Math.round(atr(clean)*100)/100,candles:clean,bars:clean};
  }
  function cors(req,res){const o=String(req.get('origin')||'');if(o==='https://vetven964.github.io'||o==='https://www.vetven964.github.io'){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Access-Control-Allow-Credentials','true');}res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');res.setHeader('Vary','Origin');}
  function calculate(raw){
    const a=raw?.analysis||raw?.data||raw?.result||raw||{};const source=a.timeframes||a.mtf?.timeframes||a.mtf?.rows||a.mtf||{};const price=n(a.livePrice??a.price??a.quote?.price??a.quote?.ask??a.mt5?.price);const rows={};let wb=0,wt=0,ready=0;
    for(const tf of TFS){const x=source?.[tf]??source?.[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()]??{};const row=frame(x?.candles??x?.bars??(Array.isArray(x)?x:[]),tf,price);rows[tf]=row;if(row.ready){ready++;wb+=row.buyPct*WEIGHTS[tf];wt+=100*WEIGHTS[tf];}}
    const buy=wt?r1(wb/wt*100):50,sell=r1(100-buy),bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',confidence=r1(50+Math.abs(buy-sell)/2);
    return{success:true,symbol:'XAUUSD',source:a.source||'MT5',price,timeframes:rows,frames:rows,available:ready,complete:ready===5,weights:WEIGHTS,buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,buyScore:buy,sellScore:sell,bias,preAiConfidence:confidence,confidence,confidenceMeaning:'Directional evidence strength from Candle-Open MTF processing; not win probability.',workflow:{stage:ready===5?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:TFS.concat(['MTF_WEIGHT','ICT_CONFIRMATION','AI_CONFIRMATION']),aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true},zone:{authorization:false}};
  }
  async function handler(req,res){cors(req,res);res.set('Cache-Control','no-store');if(req.method==='OPTIONS')return res.status(204).end();try{if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');const result=calculate(await buildXauAnalysis());console.log('[V-TRADE PRE-MARKET] direct route V2 OK | ready='+result.available+'/5 | BUY='+result.buyStrengthPct+'% | SELL='+result.sellStrengthPct+'% | bias='+result.bias+' | price='+result.price);return res.json(result);}catch(e){console.error('[V-TRADE PRE-MARKET] direct route V2 ERROR:',e?.stack||e?.message||e);return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});}}
  for(const p of ['/api/pre-market/candle-open','/api/pre-market/xauusd','/api/pre-market/intelligence']){app.options(p,handler);app.get(p,handler);}
  console.log('[V-TRADE PRE-MARKET] DIRECT ROUTE V2 ACTIVE | M5>M15>H1>H4>D1 | 404 FIXED | STRENGTH CONSISTENCY FIXED');
})(app);
`;
  return source.replace(marker,marker+'\n'+code);
}
module.exports={inject};
