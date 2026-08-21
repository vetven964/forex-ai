const DEFAULT_HORIZONS = [1, 3, 6, 12];
const DEFAULT_LIMIT = 250;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCandles(candles) {
  if (!Array.isArray(candles)) return [];
  return candles.map((x) => ({
    t: num(x.t ?? x.time),
    o: num(x.o ?? x.open),
    h: num(x.h ?? x.high),
    l: num(x.l ?? x.low),
    c: num(x.c ?? x.close),
    v: num(x.v ?? x.volume ?? x.tickVolume) || 0
  })).filter(x => [x.t,x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t);
}

function atr(candles, n=14) {
  if (candles.length < n + 1) return null;
  const tr=[];
  for(let i=1;i<candles.length;i++) {
    const c=candles[i], p=candles[i-1];
    tr.push(Math.max(c.h-c.l, Math.abs(c.h-p.c), Math.abs(c.l-p.c)));
  }
  const a=tr.slice(-n);
  return a.reduce((s,x)=>s+x,0)/a.length;
}

function feature(candles, index) {
  const c=candles[index];
  const a=atr(candles.slice(0,index+1),14) || Math.max(c.h-c.l, 0.01);
  const body=(c.c-c.o)/a;
  const range=Math.max(c.h-c.l,0.00001)/a;
  const upper=(c.h-Math.max(c.o,c.c))/a;
  const lower=(Math.min(c.o,c.c)-c.l)/a;
  const closePos=(c.c-c.l)/Math.max(c.h-c.l,0.00001);
  const prev=candles[Math.max(0,index-1)];
  const delta=(c.c-prev.c)/a;
  return [body,range,upper,lower,closePos,delta];
}

function distance(a,b) {
  let s=0;
  for(let i=0;i<a.length;i++) {
    const d=a[i]-b[i];
    s += d*d;
  }
  return Math.sqrt(s);
}

function classifyOutcome(candles, i, horizon=3, atrValue=null) {
  const base=candles[i].c;
  const end=Math.min(candles.length-1,i+horizon);
  if(end<=i) return 'RANGE';
  const future=candles.slice(i+1,end+1);
  const a=atrValue || atr(candles.slice(0,i+1),14) || Math.max(candles[i].h-candles[i].l,0.01);
  const threshold=Math.max(a*0.35, Math.abs(base)*0.00015);
  const up=Math.max(...future.map(x=>x.h))-base;
  const down=base-Math.min(...future.map(x=>x.l));
  if(up>=threshold && up>down*1.05) return 'UP';
  if(down>=threshold && down>up*1.05) return 'DOWN';
  return 'RANGE';
}

function scanHistorical(candles, options={}) {
  const c=normalizeCandles(candles);
  const limit=Math.max(20,Number(options.limit||DEFAULT_LIMIT));
  const horizons=Array.isArray(options.horizons)&&options.horizons.length ? options.horizons : DEFAULT_HORIZONS;
  if(c.length<40) return {available:false, samples:0, up:0, down:0, range:0, direction:'NEUTRAL', confidence:0, matches:[]};

  const end=c.length-1;
  const target=feature(c,end);
  const candidates=[];
  const minIndex=30;
  for(let i=minIndex;i<end-1;i++) {
    const f=feature(c,i);
    const d=distance(target,f);
    candidates.push({i,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  const selected=candidates.slice(0,Math.min(limit,candidates.length));
  let up=0,down=0,range=0;
  const matches=[];
  for(const m of selected) {
    const horizon=Number(horizons[Math.min(horizons.length-1, Math.floor(m.i%horizons.length))]) || 3;
    const outcome=classifyOutcome(c,m.i,horizon);
    if(outcome==='UP') up++; else if(outcome==='DOWN') down++; else range++;
    matches.push({index:m.i,distance:Number(m.d.toFixed(4)),outcome,horizon});
  }
  const total=up+down+range;
  const probs={up:total?up/total:0,down:total?down/total:0,range:total?range/total:0};
  const direction=probs.up>probs.down && probs.up>probs.range ? 'BULLISH' : probs.down>probs.up && probs.down>probs.range ? 'BEARISH' : 'RANGE';
  const confidence=Math.round(Math.max(probs.up,probs.down,probs.range)*100);
  return {available:true,samples:total,up,down,range,direction,confidence,probability:{up:Math.round(probs.up*100),down:Math.round(probs.down*100),range:Math.round(probs.range*100)},matches:matches.slice(0,20)};
}

module.exports = { scanHistorical, normalizeCandles };
