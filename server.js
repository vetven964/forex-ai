require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const MT5_BRIDGE_API_KEY = process.env.MT5_BRIDGE_API_KEY || '';
const MT5_MAX_AGE_MS = Number(process.env.MT5_MAX_AGE_MS || 15000);
const APP_BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
const ALLOWED_ORIGINS = [...new Set([
  ...((process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)),
  ...(APP_BASE_URL ? [APP_BASE_URL] : []),
  'https://vetven964.github.io'
])];

const bot = TELEGRAM_TOKEN
  ? new TelegramBot(TELEGRAM_TOKEN, { polling: process.env.RENDER ? false : true })
  : null;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS origin not allowed'));
  }
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname)));

const cache = new Map();
const brokerFeed = { quote: null, timeframes: null, receivedAt: 0, symbol: null };

function brokerFeedFresh() {
  return !!brokerFeed.quote && (Date.now() - brokerFeed.receivedAt) <= MT5_MAX_AGE_MS;
}

function brokerLivePrice() {
  if (!brokerFeedFresh()) return null;
  const q = brokerFeed.quote;
  const bid = Number(q.bid), ask = Number(q.ask), last = Number(q.last);
  const mid = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
  if (!Number.isFinite(mid) || mid <= 0) return null;
  return {
    price: round2(mid), bid: round2(bid), ask: round2(ask), spread: Number(q.spread) || round2(ask-bid),
    source: 'VT Markets MT5', sourceDetail: brokerFeed.symbol || 'XAUUSD',
    priceAsOf: new Date(Number(q.serverTime || brokerFeed.receivedAt)).toISOString(),
    ageSec: Math.round((Date.now()-brokerFeed.receivedAt)/1000), stale: false
  };
}

function parseBrokerCandles(tf) {
  if (!brokerFeedFresh() || !brokerFeed.timeframes?.[tf]) return null;
  const arr = brokerFeed.timeframes[tf];
  if (!Array.isArray(arr) || arr.length < 30) return null;
  // Accept both the normalized server shape (t/o/h/l/c) and the Python
  // MT5 bridge shape (time/open/high/low/close).
  return arr.map(x => ({
    t: Number(x.t ?? x.time),
    o: Number(x.o ?? x.open),
    h: Number(x.h ?? x.high),
    l: Number(x.l ?? x.low),
    c: Number(x.c ?? x.close)
  })).filter(x => [x.t,x.o,x.h,x.l,x.c].every(Number.isFinite));
}

function avg(a) { return a.length ? a.reduce((x,y)=>x+y,0)/a.length : null; }
function atr(candles, n=14) {
  if (candles.length < n + 1) return null;
  const tr = [];
  for (let i=1;i<candles.length;i++) {
    const x=candles[i], p=candles[i-1];
    tr.push(Math.max(x.h-x.l, Math.abs(x.h-p.c), Math.abs(x.l-p.c)));
  }
  return avg(tr.slice(-n));
}
function ema(values, n) {
  if (!values.length) return null;
  const k=2/(n+1);
  let e=values[0];
  for (let i=1;i<values.length;i++) e=values[i]*k+e*(1-k);
  return e;
}
function swings(c, look=2) {
  const highs=[], lows=[];
  for (let i=look;i<c.length-look;i++) {
    let hi=true, lo=true;
    for (let j=1;j<=look;j++) {
      hi = hi && c[i].h >= c[i-j].h && c[i].h >= c[i+j].h;
      lo = lo && c[i].l <= c[i-j].l && c[i].l <= c[i+j].l;
    }
    if (hi) highs.push({i, price:c[i].h});
    if (lo) lows.push({i, price:c[i].l});
  }
  return {highs,lows};
}

function liquiditySweep(c) {
  const s=swings(c,2);
  if (s.highs.length < 2 || s.lows.length < 2) return {bias:'NONE', detail:'Insufficient swing history'};
  const last=c[c.length-1];
  const priorHigh=s.highs[s.highs.length-2].price;
  const lastHigh=s.highs[s.highs.length-1].price;
  const priorLow=s.lows[s.lows.length-2].price;
  const lastLow=s.lows[s.lows.length-1].price;

  if (last.h > lastHigh && last.c < lastHigh) return {bias:'BEARISH', detail:'Buy-side liquidity sweep', level:lastHigh};
  if (last.l < lastLow && last.c > lastLow) return {bias:'BULLISH', detail:'Sell-side liquidity sweep', level:lastLow};
  return {bias:'NONE', detail:'No confirmed sweep', level:Math.max(priorHigh, lastHigh, priorLow, lastLow)};
}

function structure(c) {
  const s=swings(c,2);
  if (s.highs.length<3 || s.lows.length<3) return {bias:'NONE', mss:'PENDING', bos:'PENDING'};
  const h=s.highs.slice(-3).map(x=>x.price), l=s.lows.slice(-3).map(x=>x.price);
  const bullish=h[2]>h[1] && l[2]>l[1];
  const bearish=h[2]<h[1] && l[2]<l[1];
  const last=c[c.length-1];
  const bosUp=last.c>h[1], bosDown=last.c<l[1];
  return {
    bias: bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'RANGE',
    mss: bosUp ? 'BULLISH' : bosDown ? 'BEARISH' : 'PENDING',
    bos: bosUp ? 'BULLISH' : bosDown ? 'BEARISH' : 'PENDING',
    swingHigh:h[2], swingLow:l[2]
  };
}

function fvg(c) {
  if (c.length<3) return {found:false};
  for (let i=c.length-1;i>=2;i--) {
    const a=c[i-2], b=c[i-1], d=c[i];
    if (a.h < d.l) return {found:true, type:'BULLISH', low:a.h, high:d.l, index:i};
    if (a.l > d.h) return {found:true, type:'BEARISH', low:d.h, high:a.l, index:i};
  }
  return {found:false};
}

function orderBlock(c, bias) {
  for (let i=c.length-2;i>=5;i--) {
    const x=c[i], n=c[i+1];
    if (bias==='BULLISH' && x.c<x.o && n.c>x.h) return {found:true,type:'BULLISH',low:x.l,high:x.h,index:i};
    if (bias==='BEARISH' && x.c>x.o && n.c<x.l) return {found:true,type:'BEARISH',low:x.l,high:x.h,index:i};
  }
  return {found:false};
}

function round2(x) { return Math.round(x*100)/100; }

function analyzeTF(c) {
  const s=structure(c), sweep=liquiditySweep(c), a=atr(c,14);
  const e20=ema(c.slice(-100).map(x=>x.c),20);
  return {structure:s, sweep, atr:a, ema20:e20, last:c[c.length-1]?.c};
}

async function buildXauAnalysis() {
  // Broker-native mode is authoritative for execution signals.
  // Never silently mix VT Markets prices with Yahoo/reference candles.
  const m5=parseBrokerCandles('M5');
  const m15=parseBrokerCandles('M15');
  const h1=parseBrokerCandles('H1');
  const h4=parseBrokerCandles('H4');
  const live=brokerLivePrice();
  if (!live || !m5 || !m15 || !h1 || !h4) {
    throw new Error('VT Markets MT5 feed not ready');
  }
  const feedMode='VT Markets MT5';

  const tfs={M5:analyzeTF(m5),M15:analyzeTF(m15),H1:analyzeTF(h1),H4:analyzeTF(h4)};
  const score={bull:0,bear:0};
  for (const k of Object.keys(tfs)) {
    const x=tfs[k];
    if (x.structure.bias==='BULLISH') score.bull++;
    if (x.structure.bias==='BEARISH') score.bear++;
    if (x.sweep.bias==='BULLISH') score.bull+=2;
    if (x.sweep.bias==='BEARISH') score.bear+=2;
  }

  const bias=score.bull>score.bear?'BULLISH':score.bear>score.bull?'BEARISH':'NEUTRAL';
  const exec=tfs.M5;
  const f=fvg(m5);
  const ob=orderBlock(m5,bias==='BULLISH'?'BULLISH':bias==='BEARISH'?'BEARISH':'NONE');
  const a=exec.atr || 5;

  const htfBull=[tfs.M15,tfs.H1,tfs.H4].filter(x=>x.structure.bias==='BULLISH').length;
  const htfBear=[tfs.M15,tfs.H1,tfs.H4].filter(x=>x.structure.bias==='BEARISH').length;

  // Do not create a setup from stale candles or a distant FVG.
  const candleAgeSec = m5.length ? Math.max(0, (Date.now()-m5[m5.length-1].t)/1000) : Infinity;
  const candlesFresh = candleAgeSec <= 15*60;
  const fvgMid = f.found ? (f.low+f.high)/2 : null;
  const fvgDistanceOk = fvgMid == null || Math.abs(fvgMid-live.price) <= Math.max(a*3, 12);
  const confirmedBull=bias==='BULLISH' && htfBull>=2 && exec.sweep.bias==='BULLISH' && candlesFresh;
  const confirmedBear=bias==='BEARISH' && htfBear>=2 && exec.sweep.bias==='BEARISH' && candlesFresh;

  let signal='WAIT', entry=null, sl=null, tp=[];
  if (confirmedBull) {
    signal='BUY';
    entry=round2(f.found && f.type==='BULLISH' && fvgDistanceOk ? fvgMid : live.price);
    sl=round2(entry-Math.max(a*1.25,2.5));
    const r=entry-sl; tp=[round2(entry+r),round2(entry+r*2),round2(entry+r*3)];
  } else if (confirmedBear) {
    signal='SELL';
    entry=round2(f.found && f.type==='BEARISH' && fvgDistanceOk ? fvgMid : live.price);
    sl=round2(entry+Math.max(a*1.25,2.5));
    const r=sl-entry; tp=[round2(entry-r),round2(entry-r*2),round2(entry-r*3)];
  }

  const maxScore=12;
  const confidence=Math.min(99, Math.round((Math.max(score.bull,score.bear)/maxScore)*100));
  const swingHigh=exec.structure.swingHigh, swingLow=exec.structure.swingLow;
  const mid=(Number.isFinite(swingHigh)&&Number.isFinite(swingLow)) ? (swingHigh+swingLow)/2 : live.price;

  return {
    symbol:'XAUUSD',
    feedMode,
    brokerConnected: brokerFeedFresh(),
    bid: live.bid ?? null,
    ask: live.ask ?? null,
    spread: live.spread ?? null,
    livePrice:live.price,
    source:live.source,
    sourceDetail:live.sourceDetail,
    priceAsOf:live.priceAsOf,
    priceAgeSec:live.ageSec,
    stalePrice:live.stale,
    candleAgeSec:Math.round(candleAgeSec),
    timestamp:Date.now(),
    signal,
    bias,
    confidence,
    entry, stopLoss:sl, takeProfit:tp,
    ict:{
      liquiditySweep:exec.sweep,
      mss:exec.structure.mss,
      bos:exec.structure.bos,
      fvg:f,
      orderBlock:ob,
      premiumDiscount: live.price > mid ? 'PREMIUM' : 'DISCOUNT'
    },
    timeframes:tfs,
    riskNote:'Indicative market analysis only. XAUUSD broker quotes, spread and CFD/spot feeds can differ. Verify the broker price before any order.'
  };
}

function telegramText(a) {
  const icon=a.signal==='BUY'?'🟢':a.signal==='SELL'?'🔴':'🟡';
  const tp=a.takeProfit.length ? a.takeProfit.map((x,i)=>`TP${i+1}: ${x}`).join('\n') : 'TP: —';
  return `${icon} *V TRADE AI — XAUUSD ICT ALERT*\n\n`+
    `Live: *${a.livePrice}*\nSignal: *${a.signal}*\nBias: *${a.bias}*\nConfidence: *${a.confidence}%*\n\n`+
    `Liquidity Sweep: ${a.ict.liquiditySweep.detail}\nMSS: ${a.ict.mss}\nBOS: ${a.ict.bos}\n`+
    `FVG: ${a.ict.fvg.found ? a.ict.fvg.type+' '+a.ict.fvg.low+'–'+a.ict.fvg.high : 'Not confirmed'}\n`+
    `OB: ${a.ict.orderBlock.found ? a.ict.orderBlock.type+' '+a.ict.orderBlock.low+'–'+a.ict.orderBlock.high : 'Not confirmed'}\n\n`+
    `Entry: *${a.entry ?? 'WAIT'}*\nSL: *${a.stopLoss ?? '—'}*\n${tp}\n\n`+
    `⚠️ ${a.riskNote}`;
}

let lastAlertKey='';

async function maybeTelegramAlert(a) {
  if (!bot || !TELEGRAM_CHAT_ID || a.signal==='WAIT') return false;
  const key=`${a.signal}:${a.entry}:${a.stopLoss}:${a.takeProfit.join(',')}`;
  if (key===lastAlertKey) return false;
  lastAlertKey=key;
  await bot.sendMessage(TELEGRAM_CHAT_ID, telegramText(a), {parse_mode:'Markdown'});
  return true;
}

app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/api/health',(_req,res)=>res.json({
  ok:true, telegramConfigured:!!bot, ictEngine:'mtf-v2-vtmarkets-mt5',
  dataFeed:'VT Markets MT5 bridge (broker-native, authoritative for XAUUSD signals)',
  mt5Connected:brokerFeedFresh(),
  mt5AgeSec:brokerFeed.quote ? Math.round((Date.now()-brokerFeed.receivedAt)/1000) : null,
  render:!!process.env.RENDER
}));

function isAllowedXauSymbol(symbol) {
  const incoming = String(symbol || '').trim().toUpperCase();
  const configured = String(process.env.MT5_SYMBOL || 'XAUUSD').trim().toUpperCase();
  // VT Markets may append a suffix (e.g. XAUUSD-STDc). Keep the bridge XAU-only.
  if (!incoming || !incoming.startsWith('XAUUSD')) return false;
  if (configured === 'XAUUSD') return true;
  return incoming === configured;
}

app.post('/api/v5/mt5/quote', (req,res) => {
  try {
    if (!MT5_BRIDGE_API_KEY || req.get('x-vtrade-key') !== MT5_BRIDGE_API_KEY) return res.status(401).json({success:false,error:'Unauthorized'});
    const q=req.body || {};
    if (!isAllowedXauSymbol(q.symbol)) return res.status(400).json({success:false,error:'Unsupported symbol'});
    const bid=Number(q.bid), ask=Number(q.ask), last=Number(q.last), serverTime=Number(q.serverTime);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid<=0 || ask<=0 || ask<bid) return res.status(400).json({success:false,error:'Invalid quote'});
    brokerFeed.quote={bid,ask,last,spread:Number(q.spread)||ask-bid,serverTime:Number.isFinite(serverTime)?serverTime:Date.now()};
    // Python bridge v2 sends MTF candles under `bars`; older builds used `timeframes`.
    brokerFeed.timeframes=q.timeframes || q.bars || {};
    brokerFeed.receivedAt=Date.now();
    brokerFeed.symbol=String(q.symbol);
    res.json({success:true,source:'VT Markets MT5',symbol:brokerFeed.symbol,receivedAt:brokerFeed.receivedAt});
  } catch(e){ res.status(400).json({success:false,error:'Invalid MT5 payload'}); }
});

app.get('/api/v5/mt5/status',(_req,res)=>{
  const q=brokerFeed.quote;
  res.json({
    success:true,
    connected:brokerFeedFresh(),
    feedMode:'VT Markets MT5',
    authoritative:true,
    symbol:brokerFeed.symbol,
    ageSec:q?Math.round((Date.now()-brokerFeed.receivedAt)/1000):null,
    maxAgeMs:MT5_MAX_AGE_MS,
    bid:q?.bid??null,
    ask:q?.ask??null,
    spread:q?.spread??null
  });
});

app.get('/api/market/xauusd',async(_req,res)=>{
  const p=brokerLivePrice();
  if (!p) return res.status(503).json({success:false,error:'VT Markets MT5 feed unavailable or stale'});
  res.json({
    success:true,symbol:'XAUUSD',price:p.price,bid:p.bid,ask:p.ask,spread:p.spread,
    source:p.source,sourceDetail:p.sourceDetail,priceAsOf:p.priceAsOf,
    priceAgeSec:p.ageSec,stale:p.stale,timestamp:Date.now()
  });
});

app.get('/api/analysis/xauusd',async(_req,res)=>{
  try {
    const a=await buildXauAnalysis();
    res.json({success:true,...a});
    maybeTelegramAlert(a).catch(e=>console.error('Telegram alert:',e.message));
  } catch(e) {
    console.error('ICT analysis:',e.message);
    res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});
  }
});

app.post('/api/telegram/test',async(_req,res)=>{
  try {
    if(!bot||!TELEGRAM_CHAT_ID) throw new Error('Telegram not configured');
    await bot.sendMessage(TELEGRAM_CHAT_ID,'✅ V TRADE AI Telegram test — connection OK.');
    res.json({success:true});
  } catch(e){ res.status(500).json({success:false,error:'Telegram test failed'}); }
});
app.post('/api/v5/signal',async(req,res)=>{
  try {
    if(!bot || !TELEGRAM_CHAT_ID) throw new Error('Telegram not configured');
    const a = await buildXauAnalysis();
    const requested = String(req.body?.type || '').toUpperCase();
    if (requested && requested !== 'WAIT' && requested !== a.signal) {
      return res.status(409).json({success:false,error:`Current engine signal is ${a.signal}, not ${requested}`,analysis:a});
    }
    await bot.sendMessage(TELEGRAM_CHAT_ID, telegramText(a), {parse_mode:'Markdown'});
    res.json({success:true,analysis:a});
  } catch(e) {
    console.error('Manual Telegram signal:', e.message);
    res.status(500).json({success:false,error:e.message || 'Telegram send failed'});
  }
});

app.post('/telegram/webhook',async(req,res)=>{
  if(!bot) return res.sendStatus(503);
  if(TELEGRAM_WEBHOOK_SECRET && req.get('x-telegram-bot-api-secret-token')!==TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  try { await bot.processUpdate(req.body); } catch(e){ console.error(e.message); }
  res.sendStatus(200);
});

if(bot){
  bot.onText(/^\/price$/,async msg=>{
    try {
      const p=brokerLivePrice();
      if (!p) throw new Error('VT Markets MT5 feed unavailable or stale');
      await bot.sendMessage(msg.chat.id,`💰 XAUUSD live: ${p.price.toFixed(2)}\nBid: ${p.bid.toFixed(2)} | Ask: ${p.ask.toFixed(2)}\nSource: VT Markets MT5 | Age: ${p.ageSec}s`);
    } catch(_) {
      await bot.sendMessage(msg.chat.id,'⚠️ XAUUSD MT5 feed unavailable/stale.');
    }
  });
  bot.onText(/^\/signal$/,async msg=>{
    try { const a=await buildXauAnalysis(); await bot.sendMessage(msg.chat.id,telegramText(a),{parse_mode:'Markdown'}); }
    catch(_){ await bot.sendMessage(msg.chat.id,'⚠️ ICT analysis unavailable.'); }
  });
  bot.onText(/^\/status$/,msg=>bot.sendMessage(msg.chat.id,'🟢 V TRADE AI online — MTF ICT engine active.'));
  if(process.env.RENDER && APP_BASE_URL && TELEGRAM_WEBHOOK_SECRET){
    bot.setWebHook(`${APP_BASE_URL}/telegram/webhook`,{secret_token:TELEGRAM_WEBHOOK_SECRET})
      .catch(e=>console.error('Webhook setup:',e.message));
  }
}

app.listen(PORT,HOST,()=>console.log(`V TRADE AI MTF ICT server listening on ${HOST}:${PORT}`));
