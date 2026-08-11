require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN) {
  console.warn('⚠️ TELEGRAM_TOKEN is not set. Telegram bot will be disabled.');
}

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: true }) : null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 150 });
app.use('/api/', limiter);

const users = {
  [TELEGRAM_CHAT_ID || 'unknown']: { vipStatus: true, balance: 0 }
};
let signalsHistory = [];
let cachedGold = { price: null, source: null, timestamp: 0 };

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getXauUsd() {
  // Prefer Twelve Data when an API key is configured.
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      const data = await fetchJson(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`);
      const price = Number(data.price);
      if (Number.isFinite(price)) {
        cachedGold = { price, source: 'Twelve Data', timestamp: Date.now() };
        return cachedGold;
      }
    } catch (e) {
      console.warn('Twelve Data failed:', e.message);
    }
  }

  // Public Yahoo Finance chart feed fallback. This is a market-data fallback,
  // not a broker execution price; spreads can differ by broker.
  try {
    const data = await fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?range=1d&interval=1m');
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice ?? result?.indicators?.quote?.[0]?.close?.filter(Number.isFinite).at(-1));
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
    `💰 *Price:* ${price ?? 'N/A'}\n` +
    `📊 *Signal:* *${type}*\n` +
    `🌐 *Market:* ${marketState}\n` +
    `⏱ *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}\n\n` +
    `⚠️ For analysis only — manage risk carefully.`;
}

async function sendTelegram(text, chatId = TELEGRAM_CHAT_ID) {
  if (!bot) throw new Error('Telegram bot is not configured');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not configured');
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, telegramConfigured: !!bot, chatConfigured: !!TELEGRAM_CHAT_ID });
});

app.get('/api/market/xauusd', async (_req, res) => {
  try {
    const market = await getXauUsd();
    res.json({ success: true, symbol: 'XAUUSD', ...market });
  } catch (error) {
    res.status(503).json({ success: false, symbol: 'XAUUSD', error: error.message });
  }
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body || {};
  res.json({ success: true, reply: `🤖 V Trade AI: បានទទួលសារ${message ? ` “${String(message).slice(0, 80)}”` : ''}។` });
});

app.post('/api/telegram/test', async (_req, res) => {
  try {
    await sendTelegram('✅ *V TRADE AI*: Telegram Bot connection test successful.');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v5/signal', async (req, res) => {
  try {
    const body = req.body || {};
    let price = body.price;
    if (!price && (!body.symbol || body.symbol === 'XAUUSD' || body.symbol === 'XAU/USD')) {
      try { price = (await getXauUsd()).price; } catch (_) {}
    }
    const signal = {
      symbol: body.symbol || 'XAUUSD',
      price: Number.isFinite(Number(price)) ? Number(price).toFixed(2) : 'N/A',
      type: String(body.type || 'WAIT').toUpperCase(),
      marketState: body.marketState || 'Real-time'
    };
    const text = formatSignal(signal);
    signalsHistory.unshift({ ...signal, timestamp: Date.now() });
    signalsHistory = signalsHistory.slice(0, 100);
    await sendTelegram(text);
    res.json({ success: true, message: 'Signal sent to Telegram', signal });
  } catch (error) {
    console.error('Telegram signal error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v5/analytics', (_req, res) => {
  res.json({ winRate: '—', totalSignalsToday: signalsHistory.length, marketSentiment: 'Live' });
});

app.get('/api/signals', (_req, res) => res.json({ success: true, signals: signalsHistory }));

app.post('/api/khqr/generate', (req, res) => res.json({ success: true, qrString: '000201...' }));
app.get('/api/referral/:chatId', (req, res) => res.json({ success: true, earnings: 0 }));

if (bot) {
  bot.on('polling_error', (error) => console.error('Telegram polling error:', error.message));
  bot.on('callback_query', (query) => bot.answerCallbackQuery(query.id).catch(() => {}));

  bot.onText(/^\/start(?:\s+.*)?$/i, async (msg) => {
    const name = msg.from?.first_name || 'Trader';
    await bot.sendMessage(msg.chat.id,
      `សួស្តី ${name} 👋\n\n` +
      `🤖 *V TRADE AI Bot*\n` +
      `💰 XAUUSD Live Market\n\n` +
      `Commands:\n` +
      `/price — តម្លៃ Gold បច្ចុប្បន្ន\n` +
      `/signal — ផ្ញើ market signal\n` +
      `/status — ពិនិត្យ Bot`,
      { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/price$/i, async (msg) => {
    try {
      const market = await getXauUsd();
      await bot.sendMessage(msg.chat.id, `🟡 *XAUUSD LIVE*\n\n💰 Price: *$${market.price.toFixed(2)}*\n📡 Source: ${market.source}${market.stale ? ' (cached)' : ''}\n⏱ ${new Date(market.timestamp).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}`, { parse_mode: 'Markdown' });
    } catch (e) {
      await bot.sendMessage(msg.chat.id, `⚠️ មិនអាចទាញ XAUUSD បានទេ៖ ${e.message}`);
    }
  });

  bot.onText(/^\/signal$/i, async (msg) => {
    try {
      const market = await getXauUsd();
      // This command reports price only. A BUY/SELL signal must come from the strategy engine.
      const text = formatSignal({ price: market.price.toFixed(2), type: 'WAIT', marketState: 'Live — strategy not triggered' });
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    } catch (e) {
      await bot.sendMessage(msg.chat.id, `⚠️ ${e.message}`);
    }
  });

  bot.onText(/^\/status$/i, async (msg) => {
    await bot.sendMessage(msg.chat.id, `🟢 *V TRADE AI Bot Online*\n📡 Telegram: Connected\n🟡 XAUUSD: Live feed available\n🌐 Server: Online`, { parse_mode: 'Markdown' });
  });
}

app.listen(PORT, () => {
  console.log(`🟢 V TRADE AI server running on port ${PORT}`);
  console.log(`Telegram: ${bot ? 'configured' : 'disabled'}`);
});
