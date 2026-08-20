// V-TRADE AI — Logic V4/V4.2 runtime patch
// Historical candles + similarity-based multi-horizon probability + RANGE/TREND state.
// Probability is evidence, never a guaranteed win rate.
'use strict';
const fs=require('fs'); const path=require('path');
const SERVER_FILE=path.join(__dirname,'server.js');
const MARKER='VTRADE_LOGIC_V4_HISTORICAL_RANGE_ENGINE';
function n(v){return Number.isFinite(Number(v))?Number(v):null;}
function side(v){const s=String(v||'').toUpperCase();return /BUY|BULL|LONG/.test(s)?'BULLISH':/SELL|BEAR|SHORT/.test(s)?'BEARISH':'NEUTRAL';}
function bars(node){if(Array.isArray(node))return node;if(Array.isArray(node?.candles))return node.candles;if(Array.isArray(node?.bars))return node.bars;if(Array.isArray(node?.history))return node.history;return [];}
function norm(x){return{o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),t:n(x?.t??x?.time??x?.timestamp)};}
function getNode(a,tf){for(const g of [a?.timeframes,a?.frames,a?.mtf,a?.multiTimeframe]){if(!g||typeof g!=='object')continue;const x=g[tf]??g[tf.toLowerCase()];if(x!=null)return x;}return a?.[tf]??a?.[tf.toLowerCase()]??null;}
function candles(a,tf){return bars(getNode(a,tf)).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>(a.t||0)-(b.t||0));}
function atr(c,p=14){if(c.length<p+1)return null;const tr=[];for(let i=1;i<c.length;i++)tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));return tr.slice(-p).reduce((a,b)=>a+b,0)/p;}
function sign(x){return x.c>x.o?1:x.c<x.o?-1:0;}
function bucket(x){const r=Math.max(x.h-x.l,1e-9),b=Math.abs(x.c-x.o)/r;return b<.2?'S':b<.55?'M':'L';}
function candleFeature(x){const r=Math.max(x.h-x.l,1e-9),body=Math.abs(x.c-x.o)/r,closePos=(x.c-x.l)/r;return{sign:sign(x),bucket:bucket(x),body,closePos,range:r};}
function key(c,i,len=3){return c.slice(i-len+1,i+1).map(x=>`${sign(x)}${bucket(x)}`).join('|');}

// Similarity scan deliberately uses only candles that existed before the forecast point.
// It is less brittle than exact 3-candle matching, so 299 broker candles can produce a
// useful sample instead of collapsing to 2-3 matches.
function patternSimilarity(c,i,current,len=3){
  if(i-len+1<0||!current?.length)return 0;
  let score=0;
  for(let j=0;j<len;j++){
    const a=candleFeature(c[i-len+1+j]),b=current[j];
    if(a.sign===b.sign)score+=1.0;
    if(a.bucket===b.bucket)score+=0.7;
    if(Math.abs(a.body-b.body)<=.18)score+=0.35;
    if(Math.abs(a.closePos-b.closePos)<=.18)score+=0.35;
  }
  return score/(len*2.4);
}
function horizonScan(c,h){
  const min=35,end=c.length-h-1;
  if(c.length<min+h+4)return{sample:0,bull:0,bear:0,prob:null,side:'NEUTRAL',move:null,similarity:0};
  const current=c.slice(-3).map(candleFeature),m=[];
  for(let i=min;i<=end;i++){
    const sim=patternSimilarity(c,i,current,3);
    // Require a strong 3-candle resemblance but allow different wick sizes.
    if(sim>=.62){const d=c[i+h].c-c[i].c;if(Math.abs(d)>0)m.push({d,sim});}
  }
  if(!m.length)return{sample:0,bull:0,bear:0,prob:null,side:'NEUTRAL',move:null,similarity:0};
  let bullW=0,bearW=0,totalW=0;
  for(const x of m){const w=.5+.5*x.sim;totalW+=w;if(x.d>0)bullW+=w;else bearW+=w;}
  const pb=bullW/totalW*100,ps=bearW/totalW*100;
  const s=pb>ps?'BULLISH':ps>pb?'BEARISH':'NEUTRAL';
  const moves=m.map(x=>Math.abs(x.d)).sort((a,b)=>a-b);
  const median=moves[Math.floor(moves.length/2)];
  return{sample:m.length,bull:m.filter(x=>x.d>0).length,bear:m.filter(x=>x.d<0).length,prob:Number(Math.max(pb,ps).toFixed(1)),bullProbability:Number(pb.toFixed(1)),bearProbability:Number(ps.toFixed(1)),side:s,move:Number(median.toFixed(2)),similarity:Number((m.reduce((a,x)=>a+x.sim,0)/m.length).toFixed(3))};
}
function historicalScan(c){
  const out={ready:c.length>=40,pattern:c.length>=3?key(c,c.length-1,3):null,horizons:{}};
  for(const h of [1,3,6,12])out.horizons['M5_'+h]=horizonScan(c,h);
  const hs=[out.horizons.M5_3,out.horizons.M5_6,out.horizons.M5_12].filter(x=>x.prob!=null&&x.sample>=5);
  if(!hs.length){out.sample=0;out.side='NEUTRAL';out.directionalProbability=null;out.confluence=0;out.confirmed=false;return out;}
  const score={BULLISH:0,BEARISH:0};
  for(const h of hs){const w=Math.min(h.sample,20)*Math.max(h.prob,50)/100;score[h.side]=(score[h.side]||0)+w;}
  out.side=score.BULLISH>score.BEARISH?'BULLISH':score.BEARISH>score.BULLISH?'BEARISH':'NEUTRAL';
  const same=hs.filter(x=>x.side===out.side);
  const total=hs.reduce((a,x)=>a+x.sample,0);
  const weightedProb=total?hs.reduce((a,x)=>a+x.prob*x.sample,0)/total:null;
  const h3=out.horizons.M5_3;
  out.sample=total;
  out.bullish=hs.reduce((a,x)=>a+x.bull,0);
  out.bearish=hs.reduce((a,x)=>a+x.bear,0);
  out.bullProbability=h3.bullProbability??null;
  out.bearProbability=h3.bearProbability??null;
  out.directionalProbability=weightedProb==null?null:Number(weightedProb.toFixed(1));
  out.expectedMove=h3.move??hs[0].move??null;
  out.confluence=Number((same.length/hs.length*100).toFixed(1));
  // Do not treat a tiny sample as a strong forecast. Minimum 8 historical matches.
  out.confirmed=out.side!=='NEUTRAL'&&out.sample>=8&&out.directionalProbability>=60&&out.confluence>=66.7;
  out.confidence=Number(Math.min(95,Math.max(0,(out.directionalProbability||0)*.65+Math.min(out.sample,20)*1.2+out.confluence*.18)).toFixed(1));
  return out;
}
function regime(c,price){if(c.length<30)return{type:'UNKNOWN',edge:'UNKNOWN'};const a=atr(c),w=c.slice(-24),hi=Math.max(...w.map(x=>x.h)),lo=Math.min(...w.map(x=>x.l)),width=hi-lo,pos=width?(price-lo)/width:null,ratio=a?width/a:null,type=ratio!=null&&ratio<=10?'RANGE':ratio!=null&&ratio>=18?'TREND':'TRANSITION',edge=pos==null?'UNKNOWN':pos<=.25?'LOW':pos>=.75?'HIGH':'MID';return{type,rangeHigh:hi,rangeLow:lo,position:pos==null?null:Number(pos.toFixed(3)),width:Number(width.toFixed(2)),atr:a==null?null:Number(a.toFixed(2)),widthAtrRatio:ratio==null?null:Number(ratio.toFixed(2)),edge};}
function rangeDecision(a){
  const price=n(a?.price??a?.livePrice??a?.mt5?.price),c=candles(a,'M5');
  if(!Number.isFinite(price)||c.length<40)return{ready:false};
  const rg=regime(c,price),hist=historicalScan(c),last=c[c.length-1],r=Math.max(last.h-last.l,1e-9);
  const rejBull=last.c>last.o||((last.c-last.l)/r)>=.58,rejBear=last.c<last.o||((last.h-last.c)/r)>=.58;
  const m15=side(getNode(a,'M15')?.structure?.bias??getNode(a,'M15')?.resolvedBias??getNode(a,'M15')?.trend),h1=side(getNode(a,'H1')?.structure?.bias??getNode(a,'H1')?.resolvedBias??getNode(a,'H1')?.trend);
  const mtfBull=m15==='BULLISH'||h1==='BULLISH',mtfBear=m15==='BEARISH'||h1==='BEARISH';
  const buy=rg.type==='RANGE'&&rg.edge==='LOW'&&hist.side==='BULLISH'&&hist.confirmed&&rejBull&&!mtfBear;
  const sell=rg.type==='RANGE'&&rg.edge==='HIGH'&&hist.side==='BEARISH'&&hist.confirmed&&rejBear&&!mtfBull;
  return{ready:true,regime:rg,historical:hist,earlySide:buy?'BUY':sell?'SELL':'WAIT',rangeEdgeConfirmed:buy||sell,forecast:hist.side,forecastProbability:hist.directionalProbability,forecastConfidence:hist.confidence,reason:buy?'RANGE_LOW + HISTORICAL_CONFLUENCE + REJECTION':sell?'RANGE_HIGH + HISTORICAL_CONFLUENCE + REJECTION':hist.sample<8?'HISTORICAL_SAMPLE_TOO_SMALL':'NO_ENTRY_EDGE'};
}
function applyV4(a){
  if(!a||typeof a!=='object')return a;
  const out={...a},r=rangeDecision(out);
  out.logicVersion='7.6.2-LOGIC-V4.2';
  out.historicalPatternScan=r.historical||{ready:false};
  out.marketRegime=r.regime||{type:'UNKNOWN'};
  out.earlyForecast={side:r.forecast||'NEUTRAL',probability:r.forecastProbability??null,confidence:r.forecastConfidence??null,entryAuthorized:false,source:'M5 similarity historical multi-horizon'};
  out.workflow={...(out.workflow||{}),logicVersion:'V4.2',historicalScan:'M5 similarity pattern + 1/3/6/12-bar forward outcomes',rangeMode:r.regime?.type==='RANGE',entryPolicy:'TREND_GATED_OR_RANGE_EDGE',forecastPolicy:'Forecast may exist without trade authorization',confidenceMeaning:'Evidence strength; probability is historical frequency, not a guarantee.'};
  if(r.ready&&r.rangeEdgeConfirmed){
    const s=r.earlySide,spreadOk=out?.confirmations?.spreadOk!==false,feedOk=out?.feedReady!==false&&out?.mt5?.ready!==false,newsBlocked=['LIVE','LOCK','POST_NEWS'].includes(String(out?.news?.state||'').toUpperCase()),rr=Number(out?.bestOpportunity?.riskReward??out?.riskReward),rrOk=!Number.isFinite(rr)||rr>=1.3;
    if(feedOk&&spreadOk&&!newsBlocked&&rrOk){
      out.signal=s;out.status='ENTRY CONFIRMED — RANGE EDGE';out.directionBand=s==='BUY'?'BULLISH':'BEARISH';out.bias=out.directionBand;out.entryMode='RANGE_EDGE_EARLY';out.tradeAuthorized=true;
      out.confirmations={...(out.confirmations||{}),allGatesPassed:true,logicV4RangeEdge:true,historicalProbabilityOk:true,executionZoneOk:true};
      out.workflow={...(out.workflow||{}),entryAuthorization:true,authorizationMode:'RANGE_EDGE',blockers:[]};
      if(!Number.isFinite(Number(out.confidence))||Number(out.confidence)<60)out.confidence=60;
    }
  }
  return out;
}
function install(){if(!fs.existsSync(SERVER_FILE))throw new Error('server.js not found');let source=fs.readFileSync(SERVER_FILE,'utf8');if(source.includes(MARKER))return;const marker='const app = express();';if(!source.includes(marker))throw new Error('server app marker not found');const injected=`\n// ${MARKER}\n(function(){const __vtradeOriginalBuild=buildXauAnalysis;buildXauAnalysis=async function(){const base=await __vtradeOriginalBuild();return (${applyV4.toString()})(base);};console.log('[V-TRADE LOGIC V4] Historical similarity + multi-horizon + RANGE/TREND logic active');})();\n`;source=source.replace(marker,marker+injected);fs.writeFileSync(SERVER_FILE,source,'utf8');console.log('[V-TRADE LOGIC V4] server.js patched');}
module.exports={install,applyV4};