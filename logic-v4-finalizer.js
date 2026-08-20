// V-TRADE AI — Logic V4 runtime patch
// Historical candle-pattern scan + range/edge execution assistant.
// Evidence only: empirical directional frequency is not a guaranteed win rate.
'use strict';

const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.join(__dirname, 'server.js');
const MARKER = 'VTRADE_LOGIC_V4_HISTORICAL_RANGE_ENGINE';

function n(v){ return Number.isFinite(Number(v)) ? Number(v) : null; }
function clamp(v,lo=0,hi=100){ return Math.max(lo,Math.min(hi,Number(v)||0)); }
function side(v){ const s=String(v||'').toUpperCase(); return /BUY|BULL|LONG/.test(s)?'BULLISH':/SELL|BEAR|SHORT/.test(s)?'BEARISH':'NEUTRAL'; }
function bars(node){
  if(Array.isArray(node)) return node;
  if(Array.isArray(node?.candles)) return node.candles;
  if(Array.isArray(node?.bars)) return node.bars;
  if(Array.isArray(node?.history)) return node.history;
  return [];
}
function norm(x){ return {o:n(x?.o??x?.open),h:n(x?.h??x?.high),l:n(x?.l??x?.low),c:n(x?.c??x?.close),t:n(x?.t??x?.time??x?.timestamp)}; }
function getNode(a,tf){
  const groups=[a?.timeframes,a?.frames,a?.mtf,a?.multiTimeframe];
  for(const g of groups){ if(!g||typeof g!=='object') continue; const x=g[tf]??g[tf.toLowerCase()]; if(x!=null) return x; }
  return a?.[tf]??a?.[tf.toLowerCase()]??null;
}
function getCandles(a,tf){ return bars(getNode(a,tf)).map(norm).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>(a.t||0)-(b.t||0)); }
function atr(c,p=14){
  if(c.length<p+1) return null;
  const tr=[]; for(let i=1;i<c.length;i++) tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
  return tr.slice(-p).reduce((a,b)=>a+b,0)/p;
}
function sign(x){ return x.c>x.o?1:x.c<x.o?-1:0; }
function bodyBucket(x){ const r=Math.max(x.h-x.l,1e-9); const b=Math.abs(x.c-x.o)/r; return b<.2?'S':b<.55?'M':'L'; }
function patternKey(c,i,len=3){ return c.slice(i-len+1,i+1).map(x=>`${sign(x)}${bodyBucket(x)}`).join('|'); }
function historicalScan(c){
  const len=3, minIndex=30, end=c.length-4;
  if(c.length<minIndex+8) return {ready:false,sample:0,bullish:0,bearish:0,neutral:0,directionalProbability:null,side:'NEUTRAL',expectedMove:null,pattern:null};
  const key=patternKey(c,c.length-1,len); const matches=[];
  for(let i=minIndex;i<=end;i++) if(patternKey(c,i,len)===key){
    const base=c[i].c, future=c[i+3].c-base, move=Math.abs(future);
    if(move<=0) continue;
    matches.push({future,move});
  }
  const sample=matches.length;
  if(!sample) return {ready:true,sample:0,bullish:0,bearish:0,neutral:0,directionalProbability:null,side:'NEUTRAL',expectedMove:null,pattern:key};
  const bullish=matches.filter(x=>x.future>0).length;
  const bearish=matches.filter(x=>x.future<0).length;
  const pBull=bullish/sample*100, pBear=bearish/sample*100;
  const dominant=pBull>pBear?'BULLISH':pBear>pBull?'BEARISH':'NEUTRAL';
  const prob=Math.max(pBull,pBear);
  const expected=matches.map(x=>x.move).sort((a,b)=>a-b)[Math.floor(sample/2)];
  return {ready:true,sample,bullish,bearish,neutral:sample-bullish-bearish,directionalProbability:Number(prob.toFixed(1)),bullProbability:Number(pBull.toFixed(1)),bearProbability:Number(pBear.toFixed(1)),side:dominant,expectedMove:Number(expected.toFixed(2)),pattern:key};
}
function buildRegime(c,price){
  if(c.length<24) return {type:'UNKNOWN',rangeHigh:null,rangeLow:null,position:null,width:null,atr:null,edge:null};
  const a=atr(c); const w=c.slice(-24); const hi=Math.max(...w.map(x=>x.h)), lo=Math.min(...w.map(x=>x.l));
  const width=hi-lo; const pos=width>0?(price-lo)/width:null; const ratio=a?width/a:null;
  const type=ratio!=null&&ratio<=10?'RANGE':ratio!=null&&ratio>=18?'TREND':'TRANSITION';
  const edge=pos!=null?(pos<=.25?'LOW':pos>=.75?'HIGH':'MID'):'UNKNOWN';
  return {type,rangeHigh:hi,rangeLow:lo,position:pos==null?null:Number(pos.toFixed(3)),width:Number(width.toFixed(2)),atr:a==null?null:Number(a.toFixed(2)),widthAtrRatio:ratio==null?null:Number(ratio.toFixed(2)),edge};
}
function rangeDecision(a){
  const price=n(a?.price??a?.livePrice??a?.mt5?.price); const c=getCandles(a,'M5');
  if(!Number.isFinite(price)||c.length<40) return {ready:false};
  const regime=buildRegime(c,price), hist=historicalScan(c), last=c[c.length-1];
  const m15=side(getNode(a,'M15')?.structure?.bias??getNode(a,'M15')?.resolvedBias??getNode(a,'M15')?.trend);
  const h1=side(getNode(a,'H1')?.structure?.bias??getNode(a,'H1')?.resolvedBias??getNode(a,'H1')?.trend);
  const mtfBull=m15==='BULLISH'||h1==='BULLISH', mtfBear=m15==='BEARISH'||h1==='BEARISH';
  const rejectionBull=last.c>last.o || (last.c-last.l)>(last.h-last.c)*1.4;
  const rejectionBear=last.c<last.o || (last.h-last.c)>(last.c-last.l)*1.4;
  const buyEvidence=regime.type==='RANGE'&&regime.edge==='LOW'&&hist.side==='BULLISH'&&hist.directionalProbability>=60&&rejectionBull&&!mtfBear;
  const sellEvidence=regime.type==='RANGE'&&regime.edge==='HIGH'&&hist.side==='BEARISH'&&hist.directionalProbability>=60&&rejectionBear&&!mtfBull;
  const earlySide=buyEvidence?'BUY':sellEvidence?'SELL':'WAIT';
  return {ready:true,regime,historical:hist,earlySide,rangeEdgeConfirmed:buyEvidence||sellEvidence,reason:buyEvidence?'RANGE_LOW + HISTORICAL_BULLISH + REJECTION':sellEvidence?'RANGE_HIGH + HISTORICAL_BEARISH + REJECTION':'NO_RANGE_EDGE_SETUP'};
}
function applyV4(a){
  if(!a||typeof a!=='object') return a;
  const out={...a};
  const range=rangeDecision(out);
  out.logicVersion='7.6.0-LOGIC-V4';
  out.historicalPatternScan=range.historical||{ready:false};
  out.marketRegime=range.regime||{type:'UNKNOWN'};
  out.workflow={...(out.workflow||{}),logicVersion:'V4',historicalScan:'M5 last 3-candle pattern against prior history',rangeMode:range.regime?.type==='RANGE',entryPolicy:'TREND_GATED_OR_RANGE_EDGE',confidenceMeaning:'Evidence strength; historical directional frequency is not a guaranteed win rate.'};
  if(range.ready && range.rangeEdgeConfirmed){
    const sideNow=range.earlySide;
    const conf=Number(out.confidence);
    const spreadOk=out?.confirmations?.spreadOk!==false;
    const feedOk=out?.feedReady!==false && out?.mt5?.ready!==false;
    const newsBlocked=['LIVE','LOCK','POST_NEWS'].includes(String(out?.news?.state||'').toUpperCase());
    const rr=Number(out?.bestOpportunity?.riskReward??out?.riskReward);
    const rrOk=!Number.isFinite(rr)||rr>=1.3;
    const safe=feedOk&&spreadOk&&!newsBlocked&&rrOk;
    if(safe){
      out.signal=sideNow;
      out.status='ENTRY CONFIRMED — RANGE EDGE';
      out.directionBand=sideNow==='BUY'?'BULLISH':'BEARISH';
      out.bias=sideNow==='BUY'?'BULLISH':'BEARISH';
      out.entryMode='RANGE_EDGE_EARLY';
      out.tradeAuthorized=true;
      out.confirmations={...(out.confirmations||{}),allGatesPassed:true,logicV4RangeEdge:true,historicalProbabilityOk:true,executionZoneOk:true};
      out.workflow={...(out.workflow||{}),entryAuthorization:true,authorizationMode:'RANGE_EDGE',blockers:[]};
      if(!Number.isFinite(conf)||conf<60) out.confidence=60;
    }
  }
  return out;
}
function install(){
  if(!fs.existsSync(SERVER_FILE)) throw new Error('server.js not found');
  let source=fs.readFileSync(SERVER_FILE,'utf8');
  if(source.includes(MARKER)) return;
  const marker='const app = express();';
  if(!source.includes(marker)) throw new Error('server app marker not found');
  const injected=`\n// ${MARKER}\n(function(){\n  const __vtradeOriginalBuild = buildXauAnalysis;\n  buildXauAnalysis = async function(){\n    const base = await __vtradeOriginalBuild();\n    return (${applyV4.toString()})(base);\n  };\n  console.log('[V-TRADE LOGIC V4] Historical candle scan + RANGE/TREND execution logic active');\n})();\n`;
  source=source.replace(marker,marker+injected);
  fs.writeFileSync(SERVER_FILE,source,'utf8');
  console.log('[V-TRADE LOGIC V4] server.js patched');
}

module.exports={install,applyV4};
