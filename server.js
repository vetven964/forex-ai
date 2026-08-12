require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const storage = require('./storage');

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
const APP_VERSION = '5.3.7';
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
const bridgeNews = { items: null, receivedAt: 0, source: null };
const NEWS_CACHE_MS = Number(process.env.NEWS_CACHE_MS || 90000);
const NEWS_URLS = String(process.env.NEWS_CALENDAR_URLS || process.env.NEWS_CALENDAR_URL || 'https://nfs.faireconomy.media/ff_calendar_thisweek.json,https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json')
  .split(',').map(x => x.trim()).filter(Boolean);
const NEWS_BRIDGE_MAX_AGE_MS = Number(process.env.NEWS_BRIDGE_MAX_AGE_MS || 10 * 60 * 1000);
const NEWS_PRELOCK_MIN = Number(process.env.NEWS_PRELOCK_MIN || 15);
const NEWS_CAUTION_MIN = Number(process.env.NEWS_CAUTION_MIN || 60);
const NEWS_LIVE_WINDOW_MIN = Number(process.env.NEWS_LIVE_WINDOW_MIN || 2);
const NEWS_POST_MIN = Number(process.env.NEWS_POST_MIN || 15);

function newsStateLabel(state) {
  return state === 'LIVE' ? 'NEWS LIVE' : state === 'LOCK' ? 'NEWS SOON / LOCK' : state === 'CAUTION' ? 'NEWS SOON' : state === 'POST_NEWS' ? 'POST-NEWS' : state === 'CLEAR' ? 'NEWS CLEAR' : 'NEWS UNAVAILABLE';
}

function normalizeNewsItems(items, now) {
  const list = Array.isArray(items) ? items : (Array.isArray(items?.data) ? items.data : Array.isArray(items?.events) ? items.events : []);
  return list.map(x => {
      const currency = String(x.currency || x.country || x.ccy || '').toUpperCase();
      const impact = String(x.impact || x.importance || x.impactLevel || '').toLowerCase();
      let timestamp = Number(x.timestamp ?? x.ts ?? x.timeUnix);
      if (Number.isFinite(timestamp)) timestamp *= timestamp < 1e12 ? 1000 : 1;
      else timestamp = Date.parse(x.date || x.datetime || x.time || x.releaseTime || '');
      return {
        title: String(x.title || x.event || x.name || 'USD High Impact News'),
        currency, impact: impact === 'high' || impact === '3' || impact === 'red' ? 'HIGH' : String(x.impact || x.importance || 'UNKNOWN').toUpperCase(),
        timestamp,
        forecast: x.forecast ?? x.consensus ?? null, previous: x.previous ?? null, actual: x.actual ?? null
      };
    })
    .filter(x => x.currency === 'USD' && x.impact === 'HIGH')
    .filter(x => Number.isFinite(x.timestamp) && x.timestamp > now - (NEWS_POST_MIN * 60 * 1000) - 60000)
    .sort((a,b)=>a.timestamp-b.timestamp);
}

function newsResearch(event) {
  if (!event) return null;
  const t = event.title.toLowerCase();
  let className = 'MACRO';
  let reaction = 'VOLATILITY HIGH — WAIT FOR PRICE REACTION';
  if (/cpi|inflation|ppi|pce/.test(t)) className='INFLATION';
  else if (/non.?farm|payroll|employment|unemployment|jobless|claims/.test(t)) className='LABOR';
  else if (/fomc|interest rate|fed|powell|central bank/.test(t)) className='CENTRAL_BANK';
  else if (/gdp|retail sales|ism|pmi|consumer confidence/.test(t)) className='GROWTH';
  const scenarios = {
    hot: 'USD strength risk ↑ → Gold downside risk; wait for confirmation',
    inline: 'Initial volatility likely → wait for MSS/BOS + displacement + retest',
    cool: 'USD weakness risk ↑ → Gold upside risk; wait for confirmation'
  };
  return {eventClass:className, reaction, scenarios, methodology:'Rule-based pre-news research from event type/forecast/previous; not a guaranteed directional prediction.'};
}

function newsStateFromItems(items, now) {
  const upcoming = normalizeNewsItems(items, now);
  const next = upcoming.find(x => x.timestamp >= now) || null;
  const previous = [...upcoming].reverse().find(x => x.timestamp < now) || null;
  const deltaMin = next ? (next.timestamp-now)/60000 : Infinity;
  const sincePreviousMin = previous ? (now-previous.timestamp)/60000 : Infinity;
  let state = 'CLEAR';
  if (next && deltaMin <= NEWS_LIVE_WINDOW_MIN && deltaMin >= 0) state = 'LIVE';
  else if (next && deltaMin <= NEWS_PRELOCK_MIN && deltaMin >= 0) state = 'LOCK';
  else if (next && deltaMin <= NEWS_CAUTION_MIN) state = 'CAUTION';
  else if (previous && sincePreviousMin <= NEWS_POST_MIN) state = 'POST_NEWS';
  return {upcoming,next,previous,deltaMin,sincePreviousMin,state};
}

async function fetchNewsSource(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': `VTRADE-AI-NewsRadar/${APP_VERSION}`, 'Accept': 'application/json', 'Cache-Control':'no-cache' }, signal: controller.signal });
    if (!r.ok) throw new Error(`news http ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function fetchXauNews() {
  const now = Date.now();
  if (newsCache.data && now - newsCache.at < NEWS_CACHE_MS) return newsCache.data;

  // Prefer broker/MT5-pushed calendar data when available. This avoids relying on
  // a public feed at the exact moment of a high-impact release.
  if (bridgeNews.items && now - bridgeNews.receivedAt <= NEWS_BRIDGE_MAX_AGE_MS) {
    const st = newsStateFromItems(bridgeNews.items, now);
    const data = {
      available:true, state:st.state, label:newsStateLabel(st.state), next:st.next, previous:st.previous,
      deltaMin:Number.isFinite(st.deltaMin)?Math.max(0,Math.round(st.deltaMin)):null,
      sincePreviousMin:Number.isFinite(st.sincePreviousMin)?Math.max(0,Math.round(st.sincePreviousMin)):null,
      windowMinutes:NEWS_PRELOCK_MIN, postWindowMinutes:NEWS_POST_MIN, source:bridgeNews.source || 'MT5 bridge',
      sourceCount:1, updatedAt:new Date(now).toISOString(), sourceAgeSec:Math.round((now-bridgeNews.receivedAt)/1000),
      researchStatus:st.state==='LIVE'?'NEWS_LIVE':st.state==='POST_NEWS'?'POST_NEWS_REACTION':st.state==='LOCK'||st.state==='CAUTION'?'PRE_NEWS_RESEARCH':'CLEAR',
      research:newsResearch(st.next), upcoming:st.upcoming.slice(0,8)
    };
    newsCache.at=now; newsCache.data=data; return data;
  }

  let lastError = 'No news source available';
  for (const sourceUrl of NEWS_URLS) {
    try {
      const items = await fetchNewsSource(sourceUrl);
      const st = newsStateFromItems(items, now);
      const data = {
        available:true, state:st.state, label:newsStateLabel(st.state), next:st.next, previous:st.previous,
        deltaMin:Number.isFinite(st.deltaMin)?Math.max(0,Math.round(st.deltaMin)):null,
        sincePreviousMin:Number.isFinite(st.sincePreviousMin)?Math.max(0,Math.round(st.sincePreviousMin)):null,
        windowMinutes:NEWS_PRELOCK_MIN, postWindowMinutes:NEWS_POST_MIN, source:sourceUrl, sourceCount:NEWS_URLS.length,
        updatedAt:new Date(now).toISOString(),
        researchStatus:st.state === 'LIVE' ? 'NEWS_LIVE' : st.state === 'POST_NEWS' ? 'POST_NEWS_REACTION' : st.state === 'LOCK' || st.state === 'CAUTION' ? 'PRE_NEWS_RESEARCH' : 'CLEAR',
        research:newsResearch(st.next), upcoming:st.upcoming.slice(0,8)
      };
      newsCache.at=now; newsCache.data=data; return data;
    } catch (e) { lastError = `${sourceUrl}: ${e.message}`; }
  }
  const data={available:false,state:'UNAVAILABLE',label:'NEWS UNAVAILABLE',next:null,previous:null,deltaMin:null,sincePreviousMin:null,windowMinutes:NEWS_PRELOCK_MIN,postWindowMinutes:NEWS_POST_MIN,source:NEWS_URLS[0]||null,sourceCount:NEWS_URLS.length,updatedAt:new Date(now).toISOString(),error:lastError,researchStatus:'UNAVAILABLE',research:null,upcoming:[]};
  newsCache.at=now; newsCache.data=data; return data;
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

function closedCandles(candles, timeframeMinutes) {
  if (!Array.isArray(candles) || !candles.length) return [];
  const tfMs=Number(timeframeMinutes)*60*1000;
  const now=Date.now();
  return candles.filter(x => Number.isFinite(x.t) && (x.t + tfMs) <= (now + 5000));
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

function recentLiquiditySweep(c, lookback=6) {
  if (!c || c.length < 30) return {bias:'NONE', detail:'Insufficient swing history', fresh:false, index:null};
  const start=Math.max(10,c.length-lookback);
  for(let i=c.length-1;i>=start;i--){
    const prior=c.slice(0,i), sw=swings(prior,2); if(sw.highs.length<2||sw.lows.length<2) continue;
    const last=c[i], priorHigh=sw.highs[sw.highs.length-1].price, priorLow=sw.lows[sw.lows.length-1].price;
    if(last.h>priorHigh&&last.c<priorHigh) return {bias:'BEARISH',detail:'Buy-side liquidity swept',level:priorHigh,index:i,fresh:(c.length-1-i)<=2};
    if(last.l<priorLow&&last.c>priorLow) return {bias:'BULLISH',detail:'Sell-side liquidity swept',level:priorLow,index:i,fresh:(c.length-1-i)<=2};
  }
  return {bias:'NONE',detail:'No recent confirmed liquidity sweep',fresh:false,index:null};
}
function executionStructure(c) {
  if(!c||c.length<40) return {bias:'NONE',mss:'PENDING',bos:'PENDING',swingHigh:null,swingLow:null,mssFresh:false,bosFresh:false};
  const sw=swings(c,2); if(sw.highs.length<4||sw.lows.length<4) return {bias:'NONE',mss:'PENDING',bos:'PENDING',swingHigh:null,swingLow:null,mssFresh:false,bosFresh:false};
  const highs=sw.highs.slice(-4), lows=sw.lows.slice(-4), prevHigh=highs[2].price, prevLow=lows[2].price, last=c[c.length-1];
  const bullishTrend=highs[3].price>highs[2].price&&lows[3].price>lows[2].price, bearishTrend=highs[3].price<highs[2].price&&lows[3].price<lows[2].price;
  const mssUp=last.c>prevHigh, mssDown=last.c<prevLow;
  return {bias:bullishTrend?'BULLISH':bearishTrend?'BEARISH':'RANGE',mss:mssUp?'BULLISH':mssDown?'BEARISH':'PENDING',bos:bullishTrend&&mssUp?'BULLISH':bearishTrend&&mssDown?'BEARISH':'PENDING',swingHigh:highs[3].price,swingLow:lows[3].price,mssFresh:mssUp||mssDown,bosFresh:(bullishTrend&&mssUp)||(bearishTrend&&mssDown)};
}
function latestFreshFvg(c,maxAge=12){
  if(!c||c.length<3) return {found:false,reason:'No FVG'};
  for(let i=c.length-1;i>=2&&(c.length-1-i)<=maxAge;i--){
    const a=c[i-2],d=c[i]; let zone=null; if(a.h<d.l) zone={found:true,type:'BULLISH',low:a.h,high:d.l,index:i}; else if(a.l>d.h) zone={found:true,type:'BEARISH',low:d.h,high:a.l,index:i}; if(!zone) continue;
    const after=c.slice(i+1), fullyFilled=zone.type==='BULLISH'?after.some(x=>x.l<=zone.low):after.some(x=>x.h>=zone.high); if(fullyFilled) continue;
    zone.ageBars=c.length-1-i; zone.fresh=zone.ageBars<=maxAge; zone.mitigated=false; return zone;
  }
  return {found:false,reason:'No fresh unmitigated FVG'};
}
function latestAlignedOrderBlock(c,bias,maxAge=20){
  if(!c||!bias||bias==='NEUTRAL') return {found:false};
  for(let i=c.length-2;i>=5&&(c.length-1-i)<=maxAge;i--){const x=c[i],n=c[i+1]; if(bias==='BULLISH'&&x.c<x.o&&n.c>x.h) return {found:true,type:'BULLISH',low:x.l,high:x.h,index:i,ageBars:c.length-1-i}; if(bias==='BEARISH'&&x.c>x.o&&n.c<x.l) return {found:true,type:'BEARISH',low:x.l,high:x.h,index:i,ageBars:c.length-1-i};}
  return {found:false};
}

async function buildXauAnalysis() {
  const rawM5=parseBrokerCandles('M5'),rawM15=parseBrokerCandles('M15'),rawH1=parseBrokerCandles('H1'),rawH4=parseBrokerCandles('H4'); const live=brokerLivePrice();
  if(!live||!rawM5||!rawM15||!rawH1||!rawH4) throw new Error('VT Markets MT5 feed not ready');
  // Structure/ICT decisions use CLOSED candles; live quote remains the execution price.
  const m5=closedCandles(rawM5,5),m15=closedCandles(rawM15,15),h1=closedCandles(rawH1,60),h4=closedCandles(rawH4,240);
  if(m5.length<40||m15.length<30||h1.length<30||h4.length<30) throw new Error('VT Markets MT5 closed-candle history not ready');
  const feedMode='VT Markets MT5',tfs={M5:analyzeTF(m5),M15:analyzeTF(m15),H1:analyzeTF(h1),H4:analyzeTF(h4)},a=tfs.M5.atr||5;
  const candleAgeSec=m5.length?Math.max(0,(Date.now()-m5[m5.length-1].t)/1000):Infinity,candlesFresh=candleAgeSec<=15*60;
  const h4Bias=tfs.H4.structure.bias,h1Bias=tfs.H1.structure.bias,m15Bias=tfs.M15.structure.bias,bullHTF=[h4Bias,h1Bias,m15Bias].filter(x=>x==='BULLISH').length,bearHTF=[h4Bias,h1Bias,m15Bias].filter(x=>x==='BEARISH').length;
  const macroBias=bullHTF>bearHTF?'BULLISH':bearHTF>bullHTF?'BEARISH':'NEUTRAL',mtfCount=Math.max(bullHTF,bearHTF);
  const execStruct=executionStructure(m5),sweep=recentLiquiditySweep(m5,6),displacement=candleDisplacement(m5),f=latestFreshFvg(m5,12),ob=latestAlignedOrderBlock(m5,macroBias,20),side=macroBias;
  const alignedFvg=f.found&&f.type===side,alignedOb=ob.found&&ob.type===side,zoneCandidates=[];
  if(alignedFvg) zoneCandidates.push({type:'FVG',low:Number(f.low),high:Number(f.high),bias:side,ageBars:f.ageBars}); if(alignedOb) zoneCandidates.push({type:'OB',low:Number(ob.low),high:Number(ob.high),bias:side,ageBars:ob.ageBars});
  zoneCandidates.sort((x,y)=>zoneDistance(live.price,x)-zoneDistance(live.price,y)); const candidateZone=zoneCandidates[0]||null,inZone=zoneContains(live.price,candidateZone),zoneIsNear=!!candidateZone&&zoneDistance(live.price,candidateZone)<=Math.max(a*2,8);
  const biasOk=(side==='BULLISH'&&bullHTF>=2)||(side==='BEARISH'&&bearHTF>=2),sweepOk=sweep.bias===side&&sweep.fresh,mssOk=execStruct.mss===side&&execStruct.mssFresh,displacementOk=displacement.confirmed&&displacement.direction===side,retestOk=!!candidateZone&&inZone,structureAgreement=execStruct.mss===side&&execStruct.bos===side;
  const rawScore=(biasOk?20:0)+(sweepOk?20:0)+(mssOk?20:0)+(displacementOk?15:0)+((alignedFvg||alignedOb)?15:0)+(retestOk?10:0),confluenceScore=Math.min(100,rawScore);
  let signal='WAIT',status='WAIT — CONFIRMATION PENDING',entry=null,sl=null,tp=[],trigger=''; const reasons=[];
  if(!biasOk) reasons.push('MTF bias not aligned — need 2/3 H4/H1/M15 agreement'); if(!sweepOk) reasons.push('Fresh liquidity sweep not confirmed'); if(!mssOk) reasons.push('Fresh M5 MSS not confirmed'); if(!displacementOk) reasons.push('Directional displacement not confirmed'); if(!(alignedFvg||alignedOb)) reasons.push('No fresh aligned FVG/OB'); if(!retestOk) reasons.push('Price has not retested the execution zone'); if(!structureAgreement) reasons.push('M5 MSS + BOS confirmation not complete');
  const setupReady=candlesFresh&&biasOk&&sweepOk&&mssOk&&displacementOk&&(alignedFvg||alignedOb)&&retestOk&&structureAgreement&&confluenceScore>=80;
  if(setupReady){
    signal=side==='BULLISH'?'BUY':'SELL'; status='ENTRY CONFIRMED'; const z=candidateZone; entry=round2(live.price); const buffer=Math.max(a*0.35,0.8); sl=side==='BULLISH'?round2(z.low-buffer):round2(z.high+buffer); const risk=Math.max(Math.abs(entry-sl),0.5),structureTarget=nearestTarget(entry,side,m5),minTp1=side==='BULLISH'?entry+risk*2:entry-risk*2,target1=structureTarget&&(side==='BULLISH'?structureTarget>minTp1:structureTarget<minTp1)?structureTarget:minTp1; tp=[round2(target1),round2(side==='BULLISH'?entry+risk*3:entry-risk*3),round2(side==='BULLISH'?entry+risk*4:entry-risk*4)]; trigger=`${side} confirmed: liquidity sweep + MSS + BOS + displacement + ${alignedFvg?'FVG':'OB'} retest`;
  } else { if(side==='NEUTRAL') status='NO TRADE — MARKET NEUTRAL'; else if(side==='BULLISH'&&bullHTF>=2) status='WAIT — BULLISH BIAS, NO ENTRY'; else if(side==='BEARISH'&&bearHTF>=2) status='WAIT — BEARISH BIAS, NO ENTRY'; else status='NO TRADE — MTF CONFLICT'; trigger=reasons.slice(0,4).join('; ')||'No confirmed execution setup'; }
  const news=await fetchXauNews();
  const newsBlocked = !news.available || news.state==='LIVE' || news.state==='LOCK' || news.state==='POST_NEWS';
  if(newsBlocked){
    signal='WAIT'; entry=null; sl=null; tp=[];
    if(!news.available){ status='NEWS UNAVAILABLE — NO ENTRY'; trigger='News feed unavailable; do not trade until USD high-impact calendar is verified'; }
    else if(news.state==='LIVE'){ status='NEWS LIVE — NO ENTRY'; trigger=`${news.next?.title || 'High-impact USD news'} is live; wait for post-news sweep + MSS/BOS + displacement + retest`; }
    else if(news.state==='POST_NEWS'){ status='POST-NEWS — WAIT FOR REACTION'; trigger='High-impact USD news just passed; wait for post-news sweep + MSS/BOS + displacement + retest'; }
    else { status='NEWS LOCK — WAIT AFTER NEWS'; trigger=`${news.next?.title || 'High-impact USD news'} is due soon; wait for post-news confirmation`; }
  }
  let phase='NO_TRADE';
  if(setupReady && !newsBlocked) phase=signal;
  else if(!newsBlocked && (side==='BULLISH'||side==='BEARISH') && confluenceScore>=50) phase='MIDWAY';
  else if(newsBlocked) phase='NEWS_LOCK';

  const setupGrade=confluenceScore>=90?'HIGH CONFLUENCE':confluenceScore>=80?'CONFIRMED CANDIDATE':confluenceScore>=65?'WATCH':'WAIT',swingHigh=execStruct.swingHigh,swingLow=execStruct.swingLow,mid=(Number.isFinite(swingHigh)&&Number.isFinite(swingLow))?(swingHigh+swingLow)/2:live.price,premiumDiscount=live.price>mid?'PREMIUM':'DISCOUNT';
  const confirmations={mtfAligned:biasOk,mtfCount,liquiditySweep:sweepOk,mss:mssOk,bos:execStruct.bos===side,displacement,retest:retestOk,inZone,zoneIsNear,freshFvg:alignedFvg,freshOb:alignedOb,allGatesPassed:setupReady && !newsBlocked};
  return {symbol:'XAUUSD',feedMode,brokerConnected:brokerFeedFresh(),bid:live.bid,ask:live.ask,spread:live.spread,livePrice:live.price,source:live.source,sourceDetail:live.sourceDetail,priceAsOf:live.priceAsOf,priceAgeSec:live.ageSec,stalePrice:live.stale,candleAgeSec:Math.round(candleAgeSec),timestamp:Date.now(),signal,phase,bias:macroBias,confidence:confluenceScore,setupGrade,status,actionable:signal==='BUY'?'BUY':signal==='SELL'?'SELL':'NO TRADE',entry,entryZone:setupReady?{...candidateZone,low:round2(candidateZone.low),high:round2(candidateZone.high)}:null,candidateZone:candidateZone?{...candidateZone,low:round2(candidateZone.low),high:round2(candidateZone.high)}:null,stopLoss:sl,takeProfit:tp,trigger,executionTimeframe:'M5',macroBias,score:{bull:side==='BULLISH'?confluenceScore:0,bear:side==='BEARISH'?confluenceScore:0,confidence:confluenceScore,grade:setupGrade,items:reasons.map(x=>({side:'WAIT',points:0,label:x}))},setupScore:confluenceScore,confirmations,ict:{liquiditySweep:sweep,mss:execStruct.mss,bos:execStruct.bos,fvg:f,orderBlock:ob,premiumDiscount},news,timeframes:tfs,decision:{state:(setupReady && !newsBlocked)?(signal==='BUY'?'CONFIRMED_BUY':'CONFIRMED_SELL'):(side==='NEUTRAL'?'NO_TRADE':'WAIT'),reason:setupReady?trigger:reasons.join(' | '),mandatoryGates:['News verified / not blocked','MTF 2/3','Fresh liquidity sweep','Fresh M5 MSS','Directional displacement','Fresh aligned FVG/OB','Retest','MSS + BOS','Confluence >= 80'],passed:setupReady && !newsBlocked},riskNote:'No system can guarantee profit or prevent losses. This engine blocks entries unless all defined confirmation gates pass. Verify broker price, spread, size and risk before any order.'};
}

function telegramText(a) {
  const icon=a.signal==='BUY'?'🟢':a.signal==='SELL'?'🔴':a.status?.includes('BUY')?'🟡':a.status?.includes('SELL')?'🟠':'⚪';
  const zone=a.entryZone ? `${a.entryZone.low}–${a.entryZone.high} (${a.entryZone.type})` : '—';
  const tp=a.takeProfit?.length ? a.takeProfit.map((x,i)=>`TP${i+1}: ${x}`).join('\n') : 'TP: —';
  return `${icon} *V TRADE AI — XAUUSD ICT RADAR*\n\n`+
    `Live: *${a.livePrice}*\nSignal: *${a.signal}*\nPhase: *${a.phase || 'WAIT'}*\nStatus: *${a.status}*\nBias: *${a.bias}*\nNews: *${a.news?.label || 'UNAVAILABLE'}*\nSetup Score: *${a.confidence}/100 (${a.setupGrade})*\nMTF Alignment: *${a.confirmations?.mtfCount ?? 0}/3*\n\n`+
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
  const actionable = ['BUY','SELL'].includes(a.signal) && a.status === 'ENTRY CONFIRMED' && a.confirmations?.allGatesPassed === true;
  if(!actionable || Number(a.confidence || 0) < Number(process.env.TELEGRAM_MIN_SCORE || 80)) return false;
  const key=`${a.signal}:${a.status}:${a.entryZone?.low ?? '-'}:${a.entryZone?.high ?? '-'}:${a.entry ?? '-'}:${a.stopLoss ?? '-'}:${(a.takeProfit||[]).join(',')}`;
  const dedupeKey=sessionId || `env:${tg.chatId}`;
  if(telegramAlertKeys.get(dedupeKey)===key) return false;
  telegramAlertKeys.set(dedupeKey,key);
  await tg.bot.sendMessage(tg.chatId,telegramText(a));
  return true;
}

app.get('/health',(_req,res)=>res.json({ok:true,version:APP_VERSION,service:'vtrade-ai'}));
app.get('/api/storage/status', async (_req,res)=>{ try { res.json({success:true, ...(await storage.getStatus())}); } catch(e) { res.status(500).json({success:false,error:'Storage status unavailable'}); } });
app.get('/api/storage/history', async (req,res)=>{ try { const type=String(req.query.type||'analysis'); const limit=Number(req.query.limit||50); res.json({success:true,type,items:await storage.getHistory({type,limit})}); } catch(e) { res.status(500).json({success:false,error:'Storage history unavailable'}); } });
app.get('/api/health',(req,res)=>{
  const tg = activeTelegramConfig(req);
  res.json({
    ok:true,
    version:APP_VERSION,
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

app.post('/api/v5/news/calendar', (req,res) => {
  try {
    if (!MT5_BRIDGE_API_KEY || req.get('x-vtrade-key') !== MT5_BRIDGE_API_KEY) return res.status(401).json({success:false,error:'Unauthorized'});
    const items = req.body?.events || req.body?.items || req.body?.calendar;
    if (!Array.isArray(items)) return res.status(400).json({success:false,error:'events/items/calendar array is required'});
    bridgeNews.items = items.slice(0,500);
    bridgeNews.receivedAt = Date.now();
    bridgeNews.source = String(req.body?.source || 'MT5 News Calendar');
    newsCache.at = 0; newsCache.data = null;
    res.json({success:true,received:bridgeNews.items.length,receivedAt:bridgeNews.receivedAt});
  } catch(e) { res.status(400).json({success:false,error:'Invalid news calendar payload'}); }
});

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
    storage.saveQuote(q).catch(()=>{});
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
    storage.saveAnalysis(a).catch(()=>{});
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

(async()=>{ await storage.initStorage(); setInterval(()=>storage.cleanup().catch(()=>{}), 6*60*60*1000); app.listen(PORT,HOST,()=>console.log(`V TRADE AI v${APP_VERSION} Smart Entry PRO server listening on ${HOST}:${PORT}`)); })();
