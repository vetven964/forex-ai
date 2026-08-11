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
const APP_BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || APP_BASE_URL)
  .split(',').map(s => s.trim()).filter(Boolean);

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

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'V-Trade-AI/5.0.7' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function fetchYahooCandles(symbol, interval, range = '5d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No candle data for ${symbol} ${interval}`);
  const q = result.indicators?.quote?.[0];
  const ts = result.timestamp || [];
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const o = Number(q?.open?.[i]), h = Number(q?.high?.[i]), l = Number(q?.low?.[i]), c = Number(q?.close?.[i]);
    if ([o,h,l,c].every(Number.isFinite)) candles.push({ t: ts[i] * 1000, o, h, l, c });
  }
  return candles;
}

async function getXauPrice() {
  try {
    const d = await fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?range=1d&interval=1m');
    const r = d?.chart?.result?.[0];
    const p = Number(r?.meta?.regularMarketPrice);
    if (Number.isFinite(p)) return { price: p, source: 'Yahoo Finance' };
  } catch (_) {}
  throw new Error('XAUUSD price unavailable');
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
  const [m5,m15,h1,h4] = await Promise.all([
    fetchYahooCandles('XAUUSD=X','5m','5d'),
    fetchYahooCandles('XAUUSD=X','15m','10d'),
    fetchYahooCandles('XAUUSD=X','1h','1mo'),
    fetchYahooCandles('XAUUSD=X','4h','3mo')
  ]);
  const live = await getXauPrice();

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

  // Conservative execution model: only emit a setup when M15/H1/H4 agree.
  const htfBull=[tfs.M15,tfs.H1,tfs.H4].filter(x=>x.structure.bias==='BULLISH').length;
  const htfBear=[tfs.M15,tfs.H1,tfs.H4].filter(x=>x.structure.bias==='BEARISH').length;
  const confirmedBull=bias==='BULLISH' && htfBull>=2 && exec.sweep.bias==='BULLISH';
  const confirmedBear=bias==='BEARISH' && htfBear>=2 && exec.sweep.bias==='BEARISH';

  let signal='WAIT', entry=null, sl=null, tp=[];
  if (confirmedBull) {
    signal='BUY';
    entry=round2(f.found && f.type==='BULLISH' ? (f.low+f.high)/2 : live.price);
    sl=round2(entry-Math.max(a*1.25,2.5));
    const r=entry-sl; tp=[round2(entry+r),round2(entry+r*2),round2(entry+r*3)];
  } else if (confirmedBear) {
    signal='SELL';
    entry=round2(f.found && f.type==='BEARISH' ? (f.low+f.high)/2 : live.price);
    sl=round2(entry+Math.max(a*1.25,2.5));
    const r=sl-entry; tp=[round2(entry-r),round2(entry-r*2),round2(entry-r*3)];
  }

  return {
    symbol:'XAUUSD',
    livePrice:round2(live.price),
    source:live.source,
    timestamp:Date.now(),
    signal,
    bias,
    confidence:Math.round((Math.max(score.bull,score.bear)/(4*2))*100),
    entry, stopLoss:sl, takeProfit:tp,
    ict:{
      liquiditySweep:exec.sweep,
      mss:exec.structure.mss,
      bos:exec.structure.bos,
      fvg:f,
      orderBlock:ob,
      premiumDiscount: live.price > avg([exec.structure.swingHigh||live.price,exec.structure.swingLow||live.price]) ? 'PREMIUM' : 'DISCOUNT'
    },
    timeframes:tfs,
    riskNote:'Educational/analysis signal. Verify broker price, spread, session and risk before any order.'
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
  ok:true, telegramConfigured:!!bot, ictEngine:'mtf-v1',
  dataFeed:'Yahoo XAUUSD=X', render:!!process.env.RENDER
}));

app.get('/api/market/xauusd',async(_req,res)=>{
  try { const p=await getXauPrice(); res.json({success:true,symbol:'XAUUSD',price:round2(p.price),source:p.source,timestamp:Date.now()}); }
  catch(e){ res.status(503).json({success:false,error:'XAUUSD market data unavailable'}); }
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

app.post('/telegram/webhook',async(req,res)=>{
  if(!bot) return res.sendStatus(503);
  if(TELEGRAM_WEBHOOK_SECRET && req.get('x-telegram-bot-api-secret-token')!==TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  try { await bot.processUpdate(req.body); } catch(e){ console.error(e.message); }
  res.sendStatus(200);
});

if(bot){
  bot.onText(/^\/price$/,async msg=>{
    try { const p=await getXauPrice(); await bot.sendMessage(msg.chat.id,`💰 XAUUSD live: ${p.price.toFixed(2)}\nSource: ${p.source}`); }
    catch(_){ await bot.sendMessage(msg.chat.id,'⚠️ XAUUSD price unavailable.'); }
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
