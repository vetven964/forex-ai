// V-TRADE AI — Pre-Market Zone Analysis production hook
// STRICT SEPARATION: analysis-only. No Telegram delivery. No order authorization.
// Fixes the old HTTP loopback dependency that could return 404 during startup.
'use strict';

const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const previousLoader = Module._extensions['.js'];
const originalRead = fs.readFileSync.bind(fs);
const MARKER = 'VTRADE_PREMARKET_DIRECT_CORE_V5';

function inject(source) {
  if (!source || source.includes(MARKER)) return source;
  const marker = 'const app = express();';
  if (!source.includes(marker)) return source;

  const code = String.raw`
/* ${MARKER} */
(function installPreMarketDirectCore(app){
  if(!app || app.__VTRADE_PREMARKET_DIRECT_CORE_V5__) return;
  app.__VTRADE_PREMARKET_DIRECT_CORE_V5__ = true;

  const TFS = ['M5','M15','H1','H4','D1'];
  const WEIGHTS = {M5:1,M15:2,H1:3,H4:4,D1:5};
  const n = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));
  const round1 = v => Math.round(clamp(v) * 10) / 10;
  const side = v => {
    const s = String(v || '').toUpperCase();
    return /BULL|BUY|LONG/.test(s) ? 'BULLISH' : /BEAR|SELL|SHORT/.test(s) ? 'BEARISH' : 'NEUTRAL';
  };

  function cors(req,res){
    const origin = String(req.get('origin') || '');
    if(origin === 'https://vetven964.github.io' || origin === 'https://www.vetven964.github.io'){
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');
    res.setHeader('Vary','Origin');
  }

  function sourceOf(raw){
    return raw?.analysis || raw?.data || raw?.result || raw || {};
  }

  function getTimeframeNode(a,tf){
    const groups = [a?.timeframes,a?.mtf,a?.multiTimeframe,a?.multiTimeFrame,a?.frames];
    for(const g of groups){
      if(!g || typeof g !== 'object') continue;
      const x = g[tf] ?? g[tf.toLowerCase()];
      if(x !== undefined && x !== null) return x;
    }
    return a?.[tf] ?? a?.[tf.toLowerCase()] ?? {};
  }

  function barsFrom(node){
    if(Array.isArray(node)) return node;
    if(Array.isArray(node?.candles)) return node.candles;
    if(Array.isArray(node?.bars)) return node.bars;
    if(Array.isArray(node?.history)) return node.history;
    return [];
  }

  function normalizeBar(x){
    return {
      t:n(x?.t ?? x?.time ?? x?.timestamp ?? x?.timeMs),
      o:n(x?.o ?? x?.open),
      h:n(x?.h ?? x?.high),
      l:n(x?.l ?? x?.low),
      c:n(x?.c ?? x?.close)
    };
  }

  function ema(values,period){
    if(!values.length) return null;
    const k=2/(period+1); let e=values[0];
    for(let i=1;i<values.length;i++) e=values[i]*k+e*(1-k);
    return e;
  }

  function atr(c,period=14){
    if(c.length<period+1) return null;
    const tr=[];
    for(let i=1;i<c.length;i++){
      tr.push(Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c)));
    }
    return tr.slice(-period).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(period,tr.length));
  }

  function candle(c){
    if(c.length<2) return {ready:false};
    const x=c[c.length-1], p=c[c.length-2];
    const range=Math.max(x.h-x.l,1e-9);
    const body=Math.abs(x.c-x.o);
    const upper=Math.max(0,x.h-Math.max(x.o,x.c));
    const lower=Math.max(0,Math.min(x.o,x.c)-x.l);
    const bodyPct=body/range*100;
    const upperPct=upper/range*100;
    const lowerPct=lower/range*100;
    let pattern='NORMAL';
    if(bodyPct<=12 && upperPct>=30 && lowerPct>=30) pattern='DOJI / INDECISION';
    else if(bodyPct<=30 && lowerPct>=55 && upperPct<=25) pattern='HAMMER / BUY REJECTION';
    else if(bodyPct<=30 && upperPct>=55 && lowerPct<=25) pattern='SHOOTING STAR / SELL REJECTION';
    else if(bodyPct>=65) pattern=x.c>x.o?'STRONG BULLISH BODY':'STRONG BEARISH BODY';
    return {
      open:x.o,high:x.h,low:x.l,close:x.c,previousClose:p.c,time:x.t,
      range,body,bodyPct,upperWick:upper,lowerWick:lower,upperPct,lowerPct,
      pattern,bullish:x.c>x.o,bearish:x.c<x.o,
      wick:lowerPct>50||upperPct>50?'LONG WICK':lowerPct>25||upperPct>25?'MEDIUM WICK':'SHORT WICK',
      buyerPressure:Math.round(((x.c-x.l)/range)*100),
      sellerPressure:Math.round(((x.h-x.c)/range)*100)
    };
  }

  function frame(raw,tf,price){
    const node=getTimeframeNode(raw,tf);
    const c=barsFrom(node).map(normalizeBar)
      .filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite))
      .sort((a,b)=>(a.t||0)-(b.t||0));
    if(c.length<5){
      return {tf,ready:false,bars:c.length,buyPct:null,sellPct:null,bias:'WAIT',reason:'INSUFFICIENT_CANDLES'};
    }
    const cs=candle(c);
    const last=c[c.length-1];
    const prev=c[c.length-2];
    const p=n(price) ?? last.c;
    const a=atr(c);
    const range=Math.max(a || (last.h-last.l),1e-9);
    const closes=c.map(x=>x.c);
    const e20=ema(closes.slice(-80),20);
    const e50=ema(closes.slice(-120),50);
    const trend=e20==null||e50==null?'NEUTRAL':e20>e50?'BULLISH':e20<e50?'BEARISH':'NEUTRAL';
    const prior=c.slice(-9,-1);
    const ph=Math.max(...prior.map(x=>x.h));
    const pl=Math.min(...prior.map(x=>x.l));
    const bos=last.c>ph?'BULLISH':last.c<pl?'BEARISH':'WAIT';
    const prevRange=c.slice(-14,-8);
    const ph2=prevRange.length?Math.max(...prevRange.map(x=>x.h)):ph;
    const pl2=prevRange.length?Math.min(...prevRange.map(x=>x.l)):pl;
    const mss=last.c>ph2?'BULLISH':last.c<pl2?'BEARISH':'WAIT';
    const sweepHigh=last.h>ph && last.c<ph;
    const sweepLow=last.l<pl && last.c>pl;
    const displacement=(last.c-last.o)/range;
    const bodyBias=displacement>0?Math.min(15,displacement*10):Math.max(-15,displacement*10);
    let buy=50+bodyBias;
    if(trend==='BULLISH') buy+=8; else if(trend==='BEARISH') buy-=8;
    if(bos==='BULLISH'||mss==='BULLISH') buy+=7;
    if(bos==='BEARISH'||mss==='BEARISH') buy-=7;
    if(sweepLow) buy+=6;
    if(sweepHigh) buy-=6;
    if(cs.lowerPct>cs.upperPct*1.4) buy+=4;
    if(cs.upperPct>cs.lowerPct*1.4) buy-=4;
    if(p>last.o) buy+=Math.min(8,Math.max(-8,(p-last.o)/range*8));
    buy=round1(buy);
    const sell=round1(100-buy);
    return {
      tf,ready:true,bars:c.length,open:last.o,high:last.h,low:last.l,close:last.c,currentPrice:p,
      currentVsOpen:p-last.o,buyPct:buy,sellPct:sell,bias:buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL',
      candle:cs,atr:a,trend,mss,bos,
      liquiditySweep:{status:sweepHigh||sweepLow?'PASS':'WAIT',side:sweepLow?'SELL_SIDE_SWEPT':sweepHigh?'BUY_SIDE_SWEPT':'NONE',high:ph,low:pl},
      displacement:Math.round(displacement*1000)/10,
      structure:{trend,mss,bos}
    };
  }

  function calculate(raw){
    const a=sourceOf(raw);
    const price=n(a?.price ?? a?.livePrice ?? a?.quote?.price ?? a?.quote?.ask ?? a?.mt5?.price ?? raw?.price);
    const rows={}; let weightedBuy=0,weightTotal=0,ready=0;
    for(const tf of TFS){
      const r=frame(a,tf,price); rows[tf]=r;
      if(r.ready){ready++;weightedBuy+=r.buyPct*WEIGHTS[tf];weightTotal+=100*WEIGHTS[tf];}
    }
    const complete=ready===TFS.length;
    const buy=weightTotal?round1(weightedBuy/weightTotal*100):null;
    const sell=buy==null?null:round1(100-buy);
    const bias=buy==null?'WAIT':buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const confidence=buy==null?0:Math.round(50+Math.min(45,Math.abs(buy-sell)));
    const gates=raw?.confirmations||a?.confirmations||raw?.gates||a?.gates||{};
    return {
      success:true,source:'VT Markets MT5',symbol:'XAUUSD',price,
      buyStrengthPct:buy,sellStrengthPct:sell,buyPct:buy,sellPct:sell,bias,
      preAiConfidence:confidence,confidence,
      available:ready,complete,missingTimeframes:TFS.filter(tf=>!rows[tf].ready),
      timeframes:rows,frames:rows,
      gates,confirmations:gates,
      mtf:{weights:WEIGHTS,ready,required:TFS.length,complete,buyPct:buy,sellPct:sell},
      zone:{reference:'PRE-MARKET CANDLE-OPEN',status:complete?'READY':'WAITING',authorization:false},
      workflow:{stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',sequence:TFS.concat(['ICT','AI']),aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true},
      generatedAt:new Date().toISOString()
    };
  }

  async function getCore(req){
    // Prefer the same in-process analysis used by Telegram Auto.
    // This removes the startup race/HTTP-404 loopback dependency.
    if(typeof buildXauAnalysis === 'function'){
      const core=await buildXauAnalysis();
      return calculate(core);
    }
    // Last-resort fallback only if the core function is unavailable.
    const token=String(req.get('x-vtrade-auth')||'');
    const port=Number(process.env.PORT||10000);
    const r=await fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{
      headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(10000)
    });
    const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));
    if(!r.ok||raw?.success===false) throw Object.assign(new Error(raw?.error||'MT5 analysis unavailable'),{status:r.status||502});
    return calculate(raw);
  }

  async function handler(req,res){
    cors(req,res);
    res.set('Cache-Control','no-store');
    if(req.method==='OPTIONS') return res.status(204).end();
    try{
      const result=await getCore(req);
      console.log('[V-TRADE PRE-MARKET] direct core OK | ready='+result.available+'/5 | bias='+result.bias+' | price='+(result.price==null?'—':result.price));
      return res.json(result);
    }catch(e){
      console.error('[V-TRADE PRE-MARKET] direct core ERROR:',e?.stack||e?.message||e);
      return res.status(Number(e?.status)||502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});
    }
  }

  app.options('/api/pre-market/candle-open',handler);
  app.get('/api/pre-market/candle-open',handler);
  app.options('/api/pre-market/xauusd',handler);
  app.get('/api/pre-market/xauusd',handler);
  app.options('/api/pre-market/intelligence',handler);
  app.get('/api/pre-market/intelligence',handler);

  console.log('[V-TRADE PRE-MARKET] DIRECT CORE v5 ACTIVE | M5>M15>H1>H4>D1 | Telegram=INDEPENDENT | startup-404-loop REMOVED');
})(app);
`;

  return source.replace(marker, marker + '\n' + code);
}

Module._extensions['.js'] = function(fileMod, filename){
  if(path.resolve(filename)!==SERVER_FILE) return previousLoader(fileMod,filename);
  const patched=inject(originalRead(filename,'utf8'));
  const old=fs.readFileSync;
  fs.readFileSync=function(file,...args){
    if(path.resolve(String(file))===SERVER_FILE) return patched;
    return originalRead(file,...args);
  };
  try{return previousLoader(fileMod,filename)}finally{fs.readFileSync=old;}
};
