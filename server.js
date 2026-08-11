require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const APP_BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || APP_BASE_URL || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const bot = TELEGRAM_TOKEN
  ? new TelegramBot(TELEGRAM_TOKEN, { polling: process.env.RENDER ? false : true })
  : null;

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false, // TradingView/Tailwind CDN are used by the existing frontend.
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  }
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname)));

let signalsHistory = [];
let cachedGold = { price: null, source: null, timestamp: 0 };

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': 'V-Trade-AI/5.0.7' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getXauUsd() {
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      const data = await fetchJson(
        `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`
      );
      const price = Number(data.price);
      if (Number.isFinite(price)) {
        cachedGold = { price, source: 'Twelve Data', timestamp: Date.now() };
        return cachedGold;
      }
    } catch (e) {
      console.warn('Twelve Data failed:', e.message);
    }
  }

  try {
    const data = await fetchJson(
      'https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?range=1d&interval=1m'
    );
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const lastClose = [...closes].reverse().find(Number.isFinite);
    const price = Number(meta?.regularMarketPrice ?? lastClose);

    if (Number.isFinite(price)) {
      cachedGold = { price, source: 'Yahoo Finance', timestamp: Date.now() };
      return cachedGold;
    }
  } catch (e) {
    console.warn('Yahoo Finance failed:', e.message);
  }

  if (cachedGold.price) return { ...cachedGold, stale: true };
  throw new Error('No XAUUSD market price available');
}

function formatSignal({ symbol = 'XAUUSD', price, type = 'WAIT', marketState = 'Live market' }) {
  const emoji = type === 'BUY' ? '🟢' : type === 'SELL' ? '🔴' : '🟡';
  return `${emoji} *V TRADE AI — XAUUSD SIGNAL*\n\n` +
    `🔹 *Symbol:* ${symbol}\n` +
    `💰 *Live Price:* ${price ?? 'N/A'}\n` +
    `📊 *Signal:* *${type}*\n` +
    `🌐 *Market:* ${marketState}\n` +
    `⏱ *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}\n\n` +
    `⚠️ Analysis only. Broker entry may differ because of spread/liquidity.`;
}

async function sendTelegram(text, chatId = TELEGRAM_CHAT_ID) {
  if (!bot) throw new Error('Telegram bot is not configured');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

function maskAccount(value) {
  if (!value) return null;
  const s = String(value).replace(/\s+/g, '');
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(2, s.length - 4))}${s.slice(-4)}`;
}

/* Keep /health extremely cheap for Render health checks. */
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    environment: process.env.RENDER ? 'render' : 'local',
    telegramConfigured: !!bot,
    marketDataConfigured: !!process.env.TWELVE_DATA_API_KEY
  });
});

app.get('/api/market/xauusd', async (_req, res) => {
  try {
    const market = await getXauUsd();
    res.json({
      success: true,
      symbol: 'XAUUSD',
      price: Number(market.price.toFixed(2)),
      source: market.source,
      timestamp: market.timestamp,
      stale: !!market.stale
    });
  } catch (error) {
    res.status(503).json({ success: false, symbol: 'XAUUSD', error: error.message });
  }
});

/*
 * IMPORTANT:
 * This endpoint intentionally returns WAIT until a real ICT engine is connected.
 * It must not manufacture a fake entry/win-rate/SL/TP from stale hardcoded values.
 */
app.get('/api/analysis/xauusd', async (_req, res) => {
  try {
    const market = await getXauUsd();
    res.json({
      success: true,
      symbol: 'XAUUSD',
      livePrice: Number(market.price.toFixed(2)),
      source: market.source,
      timestamp: market.timestamp,
      signal: 'WAIT',
      entry: null,
      stopLoss: null,
      takeProfit: [],
      confidence: null,
      ict: {
        marketStructure: 'PENDING_OHLC',
        liquidity: 'PENDING_OHLC',
        orderBlock: 'PENDING_OHLC',
        fairValueGap: 'PENDING_OHLC',
        premiumDiscount: 'PENDING_OHLC',
        note: 'Connect a multi-timeframe OHLC feed before generating a real ICT setup.'
      }
    });
  } catch (error) {
    res.status(503).json({ success: false, symbol: 'XAUUSD', error: error.message });
  }
});

app.get('/api/payment-info', (_req, res) => {
  // Public UI receives only masked account numbers.
  res.json({
    success: true,
    bankName: process.env.BANK_NAME || 'Configured Bank',
    khrAccountMasked: maskAccount(process.env.BANK_ACCOUNT_KHR),
    usdAccountMasked: maskAccount(process.env.BANK_ACCOUNT_USD),
    note: 'Full payment details should only be shown inside an authenticated member area.'
  });
});

app.post('/api/chat', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  res.json({
    success: true,
    reply: `🤖 V Trade AI: បានទទួលសារ${message ? ` “${message.slice(0, 80)}”` : ''}។`
  });
});

app.post('/api/telegram/test', async (_req, res) => {
  try {
    await sendTelegram('✅ *V TRADE AI*: Telegram connection test successful.');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Telegram test failed' });
  }
});

app.post('/api/v5/signal', async (req, res) => {
  try {
    const body = req.body || {};
    let price = body.price;

    if (!price && (!body.symbol || body.symbol === 'XAUUSD' || body.symbol === 'XAU/USD')) {
      try { price = (await getXauUsd()).price; } catch (_) {}
    }

    const numericPrice = Number(price);
    const signal = {
      symbol: body.symbol || 'XAUUSD',
      price: Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : 'N/A',
      type: ['BUY', 'SELL', 'WAIT'].includes(String(body.type || '').toUpperCase())
        ? String(body.type).toUpperCase()
        : 'WAIT',
      marketState: body.marketState || 'Real-time'
    };

    signalsHistory.unshift({ ...signal, timestamp: Date.now() });
    signalsHistory = signalsHistory.slice(0, 100);

    if (signal.type !== 'WAIT') {
      await sendTelegram(formatSignal(signal));
    }

    res.json({ success: true, signal });
  } catch (error) {
    console.error('Signal error:', error.message);
    res.status(500).json({ success: false, error: 'Signal processing failed' });
  }
});

/* Telegram webhook for Render; local development can still use polling. */
app.post('/telegram/webhook', async (req, res) => {
  if (!bot) return res.status(503).json({ ok: false });
  if (TELEGRAM_WEBHOOK_SECRET &&
      req.get('x-telegram-bot-api-secret-token') !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error.message);
    res.sendStatus(200);
  }
});

if (bot) {
  bot.onText(/^\/start$/, msg => {
    bot.sendMessage(msg.chat.id,
      '🤖 V TRADE AI v5.0.7\\n/price — XAUUSD live price\\n/signal — current signal state\\n/status — server status'
    );
  });

  bot.onText(/^\/price$/, async msg => {
    try {
      const m = await getXauUsd();
      await bot.sendMessage(msg.chat.id, `💰 XAUUSD: ${m.price.toFixed(2)}\\nSource: ${m.source}`);
    } catch {
      await bot.sendMessage(msg.chat.id, '⚠️ XAUUSD price unavailable.');
    }
  });

  bot.onText(/^\/signal$/, async msg => {
    try {
      const m = await getXauUsd();
      await bot.sendMessage(msg.chat.id,
        formatSignal({ symbol: 'XAUUSD', price: m.price.toFixed(2), type: 'WAIT', marketState: 'Waiting for confirmed ICT setup' }),
        { parse_mode: 'Markdown' }
      );
    } catch {
      await bot.sendMessage(msg.chat.id, '⚠️ XAUUSD signal unavailable.');
    }
  });

  bot.onText(/^\/status$/, msg => {
    bot.sendMessage(msg.chat.id, `🟢 V TRADE AI server online\\nTelegram: connected\\nTime: ${new Date().toISOString()}`);
  });

  if (process.env.RENDER && APP_BASE_URL && TELEGRAM_WEBHOOK_SECRET) {
    bot.setWebHook(`${APP_BASE_URL}/telegram/webhook`, {
      secret_token: TELEGRAM_WEBHOOK_SECRET
    }).catch(err => console.error('Webhook setup failed:', err.message));
  }
}

app.listen(PORT, HOST, () => {
  console.log(`V TRADE AI listening on http://${HOST}:${PORT}`);
});
