require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

// Telegram is user-configurable. Tokens are never sent to the browser and are kept
// only in server memory for the active session. Optional env credentials remain
// supported for owner/admin fallback deployments.
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

// Per-user Telegram connections. The bot token is server-side only.
// Render restarts clear this in-memory map; users can reconnect from Telegram Setup.
const telegramSessions = new Map();
const telegramAlertKeys = new Map();
const MAX_TELEGRAM_SESSIONS = 1000;

function sessionIdFrom(req) {
  const id = String(req.get('x-vtrade-session') || '').trim();
  return /^[a-f0-9]{48,96}$/i.test(id) ? id : null;
}

function createSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function getSessionConfig(req) {
  const sid = sessionIdFrom(req);
  return sid ? telegramSessions.get(sid) || null : null;
}

function setSessionConfig(sid, config) {
  if (telegramSessions.size >= MAX_TELEGRAM_SESSIONS && !telegramSessions.has(sid)) {
    const oldest = telegramSessions.keys().next().value;
    if (oldest) telegramSessions.delete(oldest);
  }
  telegramSessions.set(sid, config);
}

function maskChatId(chatId) {
  const s = String(chatId || '');
  return s.length <= 4 ? '••••' : `${s.slice(0, 2)}••••${s.slice(-2)}`;
}

function activeTelegramConfig(req) {
  const session = getSessionConfig(req);
  if (session) return session;
  if (bot && TELEGRAM_CHAT_ID) {
    return { bot, chatId: TELEGRAM_CHAT_ID, botUsername: 'ENV_CONFIGURED', session: false };
  }
  return null;
}

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
const newsCache = { at: 0, data: null };
const NEWS_CACHE_MS = Number(process.env.NEWS_CACHE_MS || 60000);
const NEWS_URL = process.env.NEWS_CALENDAR_URL || 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

function newsStateLabel(state) {
  return state === 'LOCK' ? 'NEWS LOCK' : state === 'CAUTION' ? 'CAUTION' : state === 'POST_NEWS' ? 'POST-NEWS' : state === 'CLEAR' ? 'CLEAR' : 'UNAVAILABLE';
}

async function fetchXauNews() {
  const now = Date.now();
  if (newsCache.data && now - newsCache.at < NEWS_CACHE_MS) return newsCache.data;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(NEWS_URL, { headers: { 'User-Agent': 'VTRADE-AI-NewsRadar/5.3' }, signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`news http ${r.status}`);
    const items = await r.json();
    const list = Array.isArray(items) ? items : [];
    const usd = list.filter(x => String(x.currency || '').toUpperCase() === 'USD' && String(x.impact || '').toLowerCase() === 'high');
    const upcoming = usd.map(x => ({
      title: String(x.title || x.event || 'USD High Impact News'),
      currency: 'USD', impact: 'HIGH',
      timestamp: Number(x.timestamp) ? Number(x.timestamp) * 1000 : Date.parse(x.date || x.datetime || ''),
      forecast: x.forecast ?? null, previous: x.previous ?? null
    })).filter(x => Number.isFinite(x.timestamp)).sort((a,b)=>a.timestamp-b.timestamp);
    const next = upcoming.find(x => x.timestamp >= now) || null;
    const previous = [...upcoming].reverse().find(x => x.timestamp < now) || null;
    const deltaMin = next ? (next.timestamp-now)/60000 : Infinity;
    const sincePreviousMin = previous ? (now-previous.timestamp)/60000 : Infinity;
    const state = next ? (deltaMin <= 15 ? 'LOCK' : deltaMin <= 60 ? 'CAUTION' : 'CLEAR') : (sincePreviousMin <= 15 ? 'POST_NEWS' : 'CLEAR');
    const data = { available:true, state, label:newsStateLabel(state), next, previous, deltaMin:Number.isFinite(deltaMin)?Math.round(deltaMin):null, sincePreviousMin:Number.isFinite(sincePreviousMin)?Math.round(sincePreviousMin):null, windowMinutes:15, source:NEWS_URL, updatedAt:new Date(now).toISOString() };
    newsCache.at=now; newsCache.data=data; return data;
  } catch (e) {
    const data={available:false,state:'UNAVAILABLE',label:'UNAVAILABLE',next:null,deltaMin:null,windowMinutes:15,source:NEWS_URL,updatedAt:new Date(now).toISOString(),error:e.message};
    newsCache.at=now; newsCache.data=data; return data;
  }
}

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
  return arr.map(x => {
    let t = Number(x.t ?? x.time);
    // Accept Unix seconds or milliseconds from MT5 bridge.
    if (Number.isFinite(t) && t > 0 && t < 1e12) t *= 1000;
    return {
      t,
      o: Number(x.o ?? x.open),
      h: Number(x.h ?? x.high),
      l: Number(x.l ?? x.low),
      c: Number(x.c ?? x.close)
    };
  }).filter(x => [x.t,x.o,x.h,x.l,x.c].every(Number.isFinite))
    .sort((a,b)=>a.t-b.t);
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

function zoneContains(price, zone) {
  return !!zone && Number.isFinite(price) && price >= zone.low && price <= zone.high;
}

function zoneDistance(price, zone) {
  if (!zone || !Number.isFinite(price)) return Infinity;
  if (price < zone.low) return zone.low - price;
  if (price > zone.high) return price - zone.high;
  return 0;
}

function candleDisplacement(candles) {
  if (!candles || candles.length < 20) return {confirmed:false, direction:'NONE', ratio:0};
  const last=candles[candles.length-1];
  const ranges=candles.slice(-21,-1).map(x=>x.h-x.l).filter(x=>x>0);
  const avgRange=avg(ranges) || 0;
  const body=Math.abs(last.c-last.o);
  const ratio=avgRange ? body/avgRange : 0;
  const bullish=last.c>last.o && ratio>=1.25;
  const bearish=last.c<last.o && ratio>=1.25;
  return {confirmed:bullish||bearish,direction:bullish?'BULLISH':bearish?'BEARISH':'NONE',ratio:round2(ratio)};
}

function nearestTarget(entry, direction, candles) {
  const s=swings(candles,2);
  const highs=s.highs.map(x=>x.price).filter(x=>x>entry);
  const lows=s.lows.map(x=>x.price).filter(x=>x<entry);
  if(direction==='BULLISH') return highs.length ? Math.min(...highs) : null;
  if(direction==='BEARISH') return lows.length ? Math.max(...lows) : null;
  return null;
}

async function buildXauAnalysis() {
  const m5=parseBrokerCandles('M5');
  const m15=parseBrokerCandles('M15');
  const h1=parseBrokerCandles('H1');
  const h4=parseBrokerCandles('H4');
  const live=brokerLivePrice();
  if (!live || !m5 || !m15 || !h1 || !h4) throw new Error('VT Markets MT5 feed not ready');

  const feedMode='VT Markets MT5';
  const tfs={M5:analyzeTF(m5),M15:analyzeTF(m15),H1:analyzeTF(h1),H4:analyzeTF(h4)};
  const exec=tfs.M5;
  const f=fvg(m5);
  const ob=orderBlock(m5, exec.structure.bias==='BULLISH'?'BULLISH':exec.structure.bias==='BEARISH'?'BEARISH':'NONE');
  const a=exec.atr || 5;
  const candleAgeSec=m5.length ? Math.max(0,(Date.now()-m5[m5.length-1].t)/1000) : Infinity;
  const candlesFresh=candleAgeSec<=15*60;

  const h4Bias=tfs.H4.structure.bias;
  const h1Bias=tfs.H1.structure.bias;
  const m15Bias=tfs.M15.structure.bias;
  const m5Bias=tfs.M5.structure.bias;
  const bullHTF=[h4Bias,h1Bias,m15Bias].filter(x=>x==='BULLISH').length;
  const bearHTF=[h4Bias,h1Bias,m15Bias].filter(x=>x==='BEARISH').length;
  const macroBias=bullHTF>bearHTF?'BULLISH':bearHTF>bullHTF?'BEARISH':'NEUTRAL';
  const mtfCount = Math.max(bullHTF, bearHTF);

  const sweep=exec.sweep;
  const displacement=candleDisplacement(m5);
  const bullishMSS=exec.structure.mss==='BULLISH' || exec.structure.bos==='BULLISH';
  const bearishMSS=exec.structure.mss==='BEARISH' || exec.structure.bos==='BEARISH';

  const candidates=[];
  if(f.found) candidates.push({type:'FVG',low:Number(f.low),high:Number(f.high),bias:f.type});
  if(ob.found) candidates.push({type:'OB',low:Number(ob.low),high:Number(ob.high),bias:ob.type});

  const alignedZones=candidates.filter(z=>z.bias===macroBias);
  let entryZone=null;
  if(alignedZones.length){
    alignedZones.sort((x,y)=>zoneDistance(live.price,x)-zoneDistance(live.price,y));
    const z=alignedZones[0];
    entryZone={low:round2(z.low),high:round2(z.high),type:z.type,bias:z.bias};
  }

  const zoneIsNear=entryZone ? zoneDistance(live.price,entryZone)<=Math.max(a*3,12) : false;
  const inZone=zoneContains(live.price,entryZone);
  const directionConfirmed = macroBias==='BULLISH'
    ? bullHTF>=2 && sweep.bias==='BULLISH' && bullishMSS && candlesFresh
    : macroBias==='BEARISH'
      ? bearHTF>=2 && sweep.bias==='BEARISH' && bearishMSS && candlesFresh
      : false;

  const score={bull:0,bear:0,items:[]};
  const add=(side,pts,label)=>{score[side]+=pts;score.items.push({side,points:pts,label});};
  if(h4Bias==='BULLISH') add('bull',15,'H4 bullish bias'); else if(h4Bias==='BEARISH') add('bear',15,'H4 bearish bias');
  if(h1Bias==='BULLISH') add('bull',15,'H1 bullish structure'); else if(h1Bias==='BEARISH') add('bear',15,'H1 bearish structure');
  if(m15Bias==='BULLISH') add('bull',15,'M15 bullish structure'); else if(m15Bias==='BEARISH') add('bear',15,'M15 bearish structure');
  if(sweep.bias==='BULLISH') add('bull',15,'Sell-side liquidity swept'); else if(sweep.bias==='BEARISH') add('bear',15,'Buy-side liquidity swept');
  if(bullishMSS) add('bull',10,'M5 bullish MSS/BOS'); else if(bearishMSS) add('bear',10,'M5 bearish MSS/BOS');
  if(displacement.direction==='BULLISH') add('bull',10,'Bullish displacement'); else if(displacement.direction==='BEARISH') add('bear',10,'Bearish displacement');
  if(f.found && f.type==='BULLISH') add('bull',5,'Bullish FVG'); else if(f.found && f.type==='BEARISH') add('bear',5,'Bearish FVG');
  if(ob.found && ob.type==='BULLISH') add('bull',5,'Bullish order block'); else if(ob.found && ob.type==='BEARISH') add('bear',5,'Bearish order block');

  const direction=score.bull>score.bear?'BULLISH':score.bear>score.bull?'BEARISH':'NEUTRAL';
  let actionable=direction==='BULLISH'?'BUY':direction==='BEARISH'?'SELL':'NO TRADE';
  let status='NO TRADE';
  let signal='WAIT';
  let entry=null,sl=null,tp=[];
  let trigger='Wait for a confirmed liquidity/structure setup';

  if(candlesFresh && directionConfirmed && direction===macroBias){
    const side=direction;
    const hasAlignedZone=!!entryZone && zoneIsNear;
    if(hasAlignedZone && Math.max(score.bull, score.bear) >= 65){
      const zoneMid=(entryZone.low+entryZone.high)/2;
      entry=round2(inZone ? live.price : zoneMid);
      const buffer=Math.max(a*0.35,0.8);
      sl=side==='BULLISH' ? round2(entryZone.low-buffer) : round2(entryZone.high+buffer);
      const risk=Math.max(Math.abs(entry-sl),0.5);
      const structureTarget=nearestTarget(entry,side,m5);
      const minTp1=side==='BULLISH'?entry+risk*2:entry-risk*2;
      const target1=structureTarget && (side==='BULLISH'?structureTarget>minTp1:structureTarget<minTp1) ? structureTarget : minTp1;
      tp=[round2(target1),round2(side==='BULLISH'?entry+risk*3:entry-risk*3),round2(side==='BULLISH'?entry+risk*4:entry-risk*4)];
      trigger=side==='BULLISH' ? 'M5 bullish MSS + retest of FVG/OB' : 'M5 bearish MSS + retest of FVG/OB';
      if(inZone && ((side==='BULLISH' && (bullishMSS||sweep.bias==='BULLISH')) || (side==='BEARISH' && (bearishMSS||sweep.bias==='BEARISH')))) {
        signal=side==='BULLISH'?'BUY':'SELL';
        status=signal==='BUY'?'ENTRY CONFIRMED':'ENTRY CONFIRMED';
      } else {
        signal=side==='BULLISH'?'WAIT':'WAIT';
        status=side==='BULLISH'?'WAIT FOR BUY ENTRY':'WAIT FOR SELL ENTRY';
      }
    } else {
      status=side==='BULLISH'?'WAIT FOR BUY ZONE':'WAIT FOR SELL ZONE';
      trigger=side==='BULLISH'?'Wait for price to return to bullish FVG/OB':'Wait for price to return to bearish FVG/OB';
    }
  } else if(direction==='BULLISH' || direction==='BEARISH') {
    status=direction==='BULLISH'?'WATCH BUY':'WATCH SELL';
    trigger=direction==='BULLISH'?'Need bullish liquidity sweep/MSS confirmation':'Need bearish liquidity sweep/MSS confirmation';
  }

  const maxScore=90;
  const rawScore=Math.max(score.bull,score.bear);
  const swingHigh=exec.structure.swingHigh, swingLow=exec.structure.swingLow;
  const mid=(Number.isFinite(swingHigh)&&Number.isFinite(swingLow))?(swingHigh+swingLow)/2:live.price;
  const premiumDiscount=live.price>mid?'PREMIUM':'DISCOUNT';
  const news = await fetchXauNews();
  // News is a risk gate, not a directional predictor. If unavailable, do not invent a score.
  const newsPenalty = news.state === 'LOCK' ? 20 : news.state === 'CAUTION' ? 10 : news.state === 'POST_NEWS' ? 5 : 0;
  const confidence = Math.max(0, Math.min(100, Math.round((rawScore / maxScore) * 100) - newsPenalty));
  const setupGrade = confidence>=85?'HIGH CONFLUENCE':confidence>=75?'STRONG':confidence>=60?'VALID SETUP':confidence>=40?'WATCH':'WEAK';
  if (news.state === 'LOCK' && (signal === 'BUY' || signal === 'SELL')) {
    signal='WAIT'; status='NEWS LOCK — WAIT AFTER NEWS'; entry=null; sl=null; tp=[];
    trigger='High-impact USD news is within the protection window; wait for post-news liquidity sweep + MSS/BOS';
  } else if (news.state === 'POST_NEWS' && !directionConfirmed) {
    signal='WAIT'; status='POST-NEWS — WAIT CONFIRMATION'; entry=null; sl=null; tp=[];
    trigger='Post-news reaction detected; wait for liquidity sweep + MSS/BOS before entry';
  }

  return {
    symbol:'XAUUSD',feedMode,brokerConnected:brokerFeedFresh(),bid:live.bid,ask:live.ask,spread:live.spread,
    livePrice:live.price,source:live.source,sourceDetail:live.sourceDetail,priceAsOf:live.priceAsOf,priceAgeSec:live.ageSec,stalePrice:live.stale,
    candleAgeSec:Math.round(candleAgeSec),timestamp:Date.now(),signal,bias:direction,confidence,setupGrade,status,actionable,
    entry,entryZone,stopLoss:sl,takeProfit:tp,trigger,executionTimeframe:'M5',macroBias,
    score:{bull:score.bull,bear:score.bear,confidence,grade:setupGrade,items:score.items},
    setupScore:confidence,
    confirmations:{liquiditySweep:sweep,displacement,bullishMSS,bearishMSS,inZone,zoneIsNear,mtfCount},
    ict:{liquiditySweep:sweep,mss:exec.structure.mss,bos:exec.structure.bos,fvg:f,orderBlock:ob,premiumDiscount},
    news,
    timeframes:tfs,
    riskNote:'Indicative market analysis only. XAUUSD broker quotes, spread and CFD/spot feeds can differ. Verify the broker price before any order.'
  };
}

function telegramText(a) {
  const icon=a.signal==='BUY'?'🟢':a.signal==='SELL'?'🔴':a.status?.includes('BUY')?'🟡':a.status?.includes('SELL')?'🟠':'⚪';
  const zone=a.entryZone ? `${a.entryZone.low}–${a.entryZone.high} (${a.entryZone.type})` : '—';
  const tp=a.takeProfit?.length ? a.takeProfit.map((x,i)=>`TP${i+1}: ${x}`).join('\n') : 'TP: —';
  return `${icon} *V TRADE AI — XAUUSD ICT RADAR*\n\n`+
    `Live: *${a.livePrice}*\nSignal: *${a.signal}*\nStatus: *${a.status}*\nBias: *${a.bias}*\nSetup Score: *${a.confidence}/100 (${a.setupGrade})*\nMTF Alignment: *${a.confirmations?.mtfCount ?? 0}/3*\n\n`+
    `H4: ${a.timeframes.H4.structure.bias} | H1: ${a.timeframes.H1.structure.bias} | M15: ${a.timeframes.M15.structure.bias} | M5: ${a.timeframes.M5.structure.bias}\n`+
    `Liquidity: ${a.ict.liquiditySweep.detail}\nMSS: ${a.ict.mss}\nBOS: ${a.ict.bos}\n`+
    `FVG: ${a.ict.fvg.found ? a.ict.fvg.type+' '+a.ict.fvg.low+'–'+a.ict.fvg.high : 'Not confirmed'}\n`+
    `OB: ${a.ict.orderBlock.found ? a.ict.orderBlock.type+' '+a.ict.orderBlock.low+'–'+a.ict.orderBlock.high : 'Not confirmed'}\n\n`+
    `Entry Zone: *${zone}*\nEntry: *${a.entry ?? 'WAIT'}*\nSL: *${a.stopLoss ?? '—'}*\n${tp}\n\n`+
    `Trigger: ${a.trigger}\nExecution: ${a.executionTimeframe}\n\n⚠️ ${a.riskNote}`;
}

async function maybeTelegramAlert(a, tg, sessionId) {
  if (!tg || !tg.bot || !tg.chatId) return false;
  // Default: alert only confirmed BUY/SELL entries. This prevents WAIT/WATCH spam.
  // Set TELEGRAM_AUTO_ALERT_LEVEL=SETUP to also alert WATCH/WAIT-FOR-ENTRY states.
  const level = String(process.env.TELEGRAM_AUTO_ALERT_LEVEL || 'ENTRY_ONLY').toUpperCase();
  const actionable = level === 'SETUP'
    ? (['BUY','SELL'].includes(a.signal) || /WAIT FOR (BUY|SELL) ENTRY|WAIT FOR (BUY|SELL) ZONE|WATCH (BUY|SELL)/.test(a.status || ''))
    : ['BUY','SELL'].includes(a.signal) && a.status === 'ENTRY CONFIRMED';
  if(!actionable || Number(a.confidence || 0) < Number(process.env.TELEGRAM_MIN_SCORE || 65)) return false;
  const key=`${a.signal}:${a.status}:${a.entryZone?.low ?? '-'}:${a.entryZone?.high ?? '-'}:${a.entry ?? '-'}:${a.stopLoss ?? '-'}:${(a.takeProfit||[]).join(',')}`;
  const dedupeKey=sessionId || `env:${tg.chatId}`;
  if(telegramAlertKeys.get(dedupeKey)===key) return false;
  telegramAlertKeys.set(dedupeKey,key);
  await tg.bot.sendMessage(tg.chatId,telegramText(a));
  return true;
}

app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/api/health',(req,res)=>{
  const tg = activeTelegramConfig(req);
  res.json({
    ok:true,
    telegramConfigured:!!tg,
    telegramMode:getSessionConfig(req)?'user-session':(bot&&TELEGRAM_CHAT_ID?'env-fallback':'not-configured'),
    ictEngine:'mtf-v3-smart-entry-radar-vtmarkets-mt5',
    dataFeed:'VT Markets MT5 bridge (broker-native, authoritative for XAUUSD signals)',
    mt5Connected:brokerFeedFresh(),
    mt5AgeSec:brokerFeed.quote ? Math.round((Date.now()-brokerFeed.receivedAt)/1000) : null,
    render:!!process.env.RENDER
  });
});

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
    const bid=Number(q.bid), ask=Number(q.ask), last=Number(q.last), serverTimeRaw=Number(q.serverTime);
    const serverTime = Number.isFinite(serverTimeRaw) && serverTimeRaw > 0 ? (serverTimeRaw < 1e12 ? serverTimeRaw*1000 : serverTimeRaw) : Date.now();
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

app.get('/api/news/xauusd', async (_req,res)=>{
  const news=await fetchXauNews();
  res.set('Cache-Control','no-store');
  res.json({success:true,...news});
});

app.get('/api/analysis/xauusd',async(req,res)=>{
  try {
    const a=await buildXauAnalysis();
    const tg = activeTelegramConfig(req);
    const sid = sessionIdFrom(req);
    res.json({success:true,...a,telegramConfigured:!!tg});
    maybeTelegramAlert(a, tg, sid).catch(e=>console.error('Telegram alert:',e.message));
  } catch(e) {
    console.error('ICT analysis:',e.message);
    res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});
  }
});

app.get('/api/telegram/session',(req,res)=>{
  const sid = sessionIdFrom(req) || createSessionId();
  res.set('Cache-Control','no-store');
  res.json({success:true,sessionId:sid,connected:!!telegramSessions.get(sid)});
});

app.get('/api/telegram/status',async(req,res)=>{
  const sid=sessionIdFrom(req);
  const tg=getSessionConfig(req);
  if (!tg) {
    return res.json({success:true,connected:false,configured:!!(bot&&TELEGRAM_CHAT_ID),mode:(bot&&TELEGRAM_CHAT_ID)?'env-fallback':'not-configured'});
  }
  res.json({success:true,connected:true,mode:'user-session',botUsername:tg.botUsername,chatId:maskChatId(tg.chatId),connectedAt:tg.connectedAt});
});

app.post('/api/telegram/connect',async(req,res)=>{
  try {
    const token=String(req.body?.token||'').trim();
    const chatId=String(req.body?.chatId||'').trim();
    if (!token || !chatId) return res.status(400).json({success:false,error:'Bot Token and Chat ID are required'});
    if (token.length < 20 || token.length > 200) return res.status(400).json({success:false,error:'Invalid Telegram bot token format'});

    const testBot=new TelegramBot(token,{polling:false});
    const me=await testBot.getMe();
    if (!me?.is_bot) throw new Error('The provided token is not a Telegram bot token');
    const chat=await testBot.getChat(chatId);
    if (!chat?.id) throw new Error('Chat not found. Open the bot and press Start, or add the bot to the group/channel first.');

    const sid=sessionIdFrom(req) || createSessionId();
    setSessionConfig(sid,{
      bot:testBot,
      chatId,
      botUsername:me.username || me.first_name || 'Telegram Bot',
      connectedAt:new Date().toISOString()
    });
    res.set('Cache-Control','no-store');
    res.json({success:true,sessionId:sid,connected:true,botUsername:me.username||me.first_name||'Telegram Bot',chatId:maskChatId(chatId)});
  } catch(e) {
    console.error('Telegram connect:',e.message);
    res.status(400).json({success:false,error:e.message||'Telegram connection failed'});
  }
});

app.post('/api/telegram/test',async(req,res)=>{
  try {
    const tg=activeTelegramConfig(req);
    if(!tg) return res.status(400).json({success:false,error:'Telegram is not connected. Enter your Bot Token and Chat ID first.'});
    await tg.bot.sendMessage(tg.chatId,'✅ V TRADE AI Telegram test — connection OK.');
    res.json({success:true,message:'Test message sent'});
  } catch(e){
    console.error('Telegram test:',e.message);
    res.status(500).json({success:false,error:'Telegram test failed. Check that the bot token is valid and the bot can message this chat.'});
  }
});

app.post('/api/telegram/disconnect',(req,res)=>{
  const sid=sessionIdFrom(req);
  if(sid) {
    telegramSessions.delete(sid);
    telegramAlertKeys.delete(sid);
  }
  res.json({success:true,connected:false});
});

app.post('/api/v5/signal',async(req,res)=>{
  try {
    const tg = activeTelegramConfig(req);
    if(!tg) return res.status(400).json({success:false,error:'Telegram is not connected. Enter your Bot Token and Chat ID first.'});
    const a = await buildXauAnalysis();
    const requested = String(req.body?.type || '').toUpperCase();
    if (requested && requested !== 'WAIT' && requested !== a.signal) {
      return res.status(409).json({success:false,error:`Current engine signal is ${a.signal}, not ${requested}`,analysis:a});
    }
    await tg.bot.sendMessage(tg.chatId, telegramText(a));
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
    try { const a=await buildXauAnalysis(); await bot.sendMessage(msg.chat.id,telegramText(a)); }
    catch(_){ await bot.sendMessage(msg.chat.id,'⚠️ ICT analysis unavailable.'); }
  });
  bot.onText(/^\/status$/,msg=>bot.sendMessage(msg.chat.id,'🟢 V TRADE AI online — MTF ICT engine active.'));
  if(process.env.RENDER && APP_BASE_URL && TELEGRAM_WEBHOOK_SECRET){
    bot.setWebHook(`${APP_BASE_URL}/telegram/webhook`,{secret_token:TELEGRAM_WEBHOOK_SECRET})
      .catch(e=>console.error('Webhook setup:',e.message));
  }
}

app.listen(PORT,HOST,()=>console.log(`V TRADE AI v5.2.2 Smart Entry PRO server listening on ${HOST}:${PORT}`));
