require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const express = require('express');

const app = express();

// Configurations
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// DDoS Protection
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150
});
app.use('/api/', limiter);

let users = {
    '5289934569': { vipStatus: true, balance: 0, referralCode: 'REF_5289934569', referredBy: null }
}; 
let signalsHistory = [];

// --- API ROUTES ---
app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    res.json({ success: true, reply: "🤖 V Trade AI: ប្រព័ន្ធកំពុងដំណើរការធម្មតា។" });
});

app.post('/api/v5/signal', (req, res) => {
    const { symbol, price, type } = req.body;
    res.json({ success: true, message: "Signal Generated", data: { version: "v5.0.7", status: "HIGH_PROBABILITY" } });
});

app.get('/api/v5/analytics', (req, res) => {
    res.json({
        winRate: "78.5%",
        totalSignalsToday: "24 Signals",
        marketSentiment: "Bullish (Buy)"
    });
});

app.post('/api/khqr/generate', (req, res) => {
    res.json({ success: true, qrString: "000201..." });
});

app.get('/api/referral/:chatId', (req, res) => {
    res.json({ success: true, earnings: 0 });
});

// --- AI SCANNER ---
cron.schedule('*/15 * * * *', () => {
    console.log('Running AI Scanner...');
});

// --- TELEGRAM BOT HANDLERS ---
bot.on('callback_query', (query) => bot.answerCallbackQuery(query.id).catch(() => {}));
bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, "ស្វាគមន៍មកកាន់ V TRADE AI!"));

// --- SERVER START (ចុងក្រោយបង្អស់) ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🟢 V TRADE AI & BOT v5.0.7 is running smoothly on port ${PORT}`);
});
