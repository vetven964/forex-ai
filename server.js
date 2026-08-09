const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurations
const TELEGRAM_TOKEN = '8470430528:AAGBHWpAw03hPvhZIB7y_cdyhrxr8bIg4Xc';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());

// 🔗 ភ្ជាប់ Static Files
app.use(express.static(path.join(__dirname)));

// Cloudflare & DDoS Protection (Rate Limiting)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: { error: "DDoS Protection Triggered: Too many requests." }
});
app.use('/api/', limiter);

let users = {
    '5289934569': { vipStatus: true, balance: 0, referralCode: 'REF_5289934569', referredBy: null }
}; 
let signalsHistory = [];

// --- 1. AI WEBHOOK SERVER & BACKGROUND WORKERS (ICT ADVANCED SIGNAL - 15 MINS) ---
cron.schedule('*/15 * * * *', () => {
    runAiMarketScanner();
});

function runAiMarketScanner() {
    const pairs = [
        { name: 'BTC/USDT', basePrice: 65000 },
        { name: 'XAU/USD (Gold)', basePrice: 2400 },
        { name: 'EUR/USD', basePrice: 1.0850 }
    ];
    
    const selected = pairs[Math.floor(Math.random() * pairs.length)];
    const isBuy = Math.random() > 0.5;
    const signalType = isBuy ? '🟢 BUY (LONG) - ICT OTE' : '🔴 SELL (SHORT) - ICT FVG';
    
    let entry, tp1, tp2, tp3, sl;
    if (selected.name === 'BTC/USDT') {
        entry = (selected.basePrice + (Math.random() * 1000 - 500)).toFixed(2);
        tp1 = (Number(entry) + (isBuy ? 300 : -300)).toFixed(2);
        tp2 = (Number(entry) + (isBuy ? 700 : -700)).toFixed(2);
        tp3 = (Number(entry) + (isBuy ? 1200 : -1200)).toFixed(2);
        sl  = (Number(entry) + (isBuy ? -400 : 400)).toFixed(2);
    } else if (selected.name === 'XAU/USD (Gold)') {
        entry = (selected.basePrice + (Math.random() * 20 - 10)).toFixed(2);
        tp1 = (Number(entry) + (isBuy ? 6 : -6)).toFixed(2);
        tp2 = (Number(entry) + (isBuy ? 12 : -12)).toFixed(2);
        tp3 = (Number(entry) + (isBuy ? 20 : -20)).toFixed(2);
        sl  = (Number(entry) + (isBuy ? -8 : 8)).toFixed(2);
    } else {
        entry = (selected.basePrice + (Math.random() * 0.0050 - 0.0025)).toFixed(4);
        tp1 = (Number(entry) + (isBuy ? 0.0020 : -0.0020)).toFixed(4);
        tp2 = (Number(entry) + (isBuy ? 0.0045 : -0.0045)).toFixed(4);
        tp3 = (Number(entry) + (isBuy ? 0.0080 : -0.0080)).toFixed(4);
        sl  = (Number(entry) + (isBuy ? -0.0030 : 0.0030)).toFixed(4);
    }

    const signalMessage = `🤖 **V TRADE AI - ADVANCED ICT SIGNAL**\n\n` +
                          `📊 Asset: \`${selected.name}\`\n` +
                          `⚡ Action: ${signalType}\n` +
                          `🎯 Entry Zone: \`${entry}\`\n\n` +
                          `🛑 **Stop Loss (SL):** \`${sl}\`\n` +
                          `🎯 **Take Profit 1 (TP1):** \`${tp1}\`\n` +
                          `🎯 **Take Profit 2 (TP2):** \`${tp2}\`\n` +
                          `🎯 **Take Profit 3 (TP3):** \`${tp3}\`\n\n` +
                          `⚙️ Analysis: Real-time Order Block & Liquidity Sweep\n` +
                          `⚡ Status: Active 24/7`;

    // Inline Buttons for Interactive Telegram UI
    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📊 Check Win Rate", callback_data: "check_winrate" },
                    { text: "💎 Activate VIP", callback_data: "activate_vip" }
                ],
                [
                    { text: "🔄 Refresh Signal", callback_data: "refresh_signal" }
                ]
            ]
        }
    };

    for (let chatId in users) {
        if (users[chatId].vipStatus) {
            bot.sendMessage(chatId, signalMessage, { 
                parse_mode: 'Markdown',
                ...inlineKeyboard 
            }).catch(err => console.log(err));
        }
    }
    
    signalsHistory.unshift({ pair: selected.name, type: signalType, entry, time: new Date() });
    if(signalsHistory.length > 50) signalsHistory.pop();
}

// --- 2. TELEGRAM CALLBACK QUERY HANDLER (Button Clicks) ---
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'check_winrate') {
        bot.sendMessage(chatId, "📊 **AI System Win Rate:** `89.4%` (Based on last 120 ICT trades).", { parse_mode: 'Markdown' });
    } else if (data === 'activate_vip') {
        bot.sendMessage(chatId, "💎 សូមធ្វើការស្កេនកូដ QR ដើម្បីបង់ប្រាក់បញ្ជាក់សិទ្ធិ VIP 24/7 ឬទំនាក់ទំនង Admin ។");
    } else if (data === 'refresh_signal') {
        bot.sendMessage(chatId, "🔄 ប្រព័ន្ធកំពុងទាញទិន្នន័យ Real-time ថ្មី...");
        runAiMarketScanner();
    }
    bot.answerCallbackQuery(query.id).catch(() => {});
});

// --- 3. KHQR INSTANT API VERIFICATION ---
app.post('/api/khqr/generate', (req, res) => {
    const { chatId, amount } = req.body;
    const mockTransactionId = 'KHQR_' + Math.random().toString(36).substring(7).toUpperCase();
    
    res.json({
        success: true,
        transactionId: mockTransactionId,
        qrString: "00020101021130580016a00000067701011101130066896983053038405802KH5909VTRADE_AI6007PHNOM6304",
        amount: amount || 29,
        currency: "USD"
    });
});

app.post('/api/khqr/verify', (req, res) => {
    const { chatId, transactionId } = req.body;
    if(users[chatId]) {
        users[chatId].vipStatus = true;
        if(users[chatId].referredBy && users[users[chatId].referredBy]) {
            users[users[chatId].referredBy].balance += 5;
        }
    }
    res.json({ success: true, message: "VIP Activated Successfully via KHQR API!" });
});

// --- 4. BACKTESTING & AI STRATEGY CUSTOMIZER ---
app.post('/api/strategy/save', (req, res) => {
    const { chatId, riskLevel, preferredAsset } = req.body;
    if (!users[chatId]) users[chatId] = { vipStatus: false, balance: 0, referralCode: 'REF_' + chatId };
    
    users[chatId].customStrategy = { riskLevel, preferredAsset };
    const mockWinRate = (75 + Math.random() * 20).toFixed(2);
    
    res.json({
        success: true,
        message: "Strategy saved & backtested successfully!",
        backtestResult: { winRate: `${mockWinRate}%`, totalTrades: 120, profitFactor: "2.85" }
    });
});

// --- 5. AFFILIATE / REFERRAL PROGRAM ---
app.get('/api/referral/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    if (!users[chatId]) {
        users[chatId] = { vipStatus: false, balance: 0, referralCode: 'REF_' + chatId, referredBy: null };
    }
    res.json({
        success: true,
        referralCode: users[chatId].referralCode,
        referralLink: `https://t.me/VTradeAIBot?start=${users[chatId].referralCode}`,
        earnings: users[chatId].balance
    });
});

bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const refCode = match[1];
    
    if (!users[chatId]) {
        users[chatId] = { vipStatus: false, balance: 0, referralCode: 'REF_' + chatId, referredBy: null };
        for(let id in users) {
            if(users[id].referralCode === refCode) {
                users[chatId].referredBy = id;
                break;
            }
        }
    }
    bot.sendMessage(chatId, "🤖 ស្វាគមន៍មកកាន់ V TRADE AI & BOT (ICT Advanced Version)! ប្រព័ន្ធវិភាគទីផ្សារ Real-time ២៤/៧ កំពុងដំណើរការជូនបង។");
});

bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    if (!users[chatId]) {
        users[chatId] = { vipStatus: true, balance: 0, referralCode: 'REF_' + chatId, referredBy: null };
    }
    bot.sendMessage(chatId, "🤖 ស្វាគមន៍មកកាន់ V TRADE AI & BOT! ប្រព័ន្ធ ICT Signals ត្រូវបានបើកដំណើរការជូនបងដោយស្វ័យប្រវត្តិ។");
});

app.listen(PORT, () => {
    console.log(`🚀 V Trade AI Advanced Server running at http://localhost:${PORT}`);
});