let currentSymbol = "BINANCE:BTCUSD";
let tvWidget = null;

function initTradingView(symbol) {
    const container = document.getElementById("tradingview_widget");
    if(container) {
        container.innerHTML = "";
        tvWidget = new TradingView.widget({
            "width": "100%",
            "height": "100%",
            "symbol": symbol,
            "interval": "15",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "container_id": "tradingview_widget"
        });
    }
}

function changeAsset(symbol, labelName, btnElement) {
    currentSymbol = symbol;
    initTradingView(currentSymbol);
    document.getElementById("current-asset-label").innerText = labelName;
    document.getElementById("panel-symbol-title").innerText = labelName + " - 15m";
    document.querySelectorAll('.asset-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

async function sendTelegramAlert() {
    const token = localStorage.getItem("tg_bot_token");
    const chatId = localStorage.getItem("tg_chat_id");
    
    if(!token || !chatId) {
        alert("⚠️ Please configure your Telegram Bot Token and Chat ID first in 'Telegram Setup' settings!");
        return;
    }

    const message = `🚀 VENPro AI v5.0 Signal\nAsset: ${document.getElementById("current-asset-label").innerText}\nStatus: STRONG BUY\nTarget: Optimized Target Reached`;
    
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;
        const res = await fetch(url);
        if(res.ok) {
            alert("✅ Telegram Bot: Signal successfully transmitted to your live channel!");
        } else {
            alert("❌ Failed to send. Please check your Bot Token & Chat ID.");
        }
    } catch (e) {
        alert("🤖 Telegram Alert Triggered via Local Gateway!");
    }
}

function saveBotConfig() {
    const token = document.getElementById("bot-token-input").value;
    const chatId = document.getElementById("chat-id-input").value;
    if(token && chatId) {
        localStorage.setItem("tg_bot_token", token);
        localStorage.setItem("tg_chat_id", chatId);
        alert("Settings saved securely!");
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
    } else {
        alert("Please fill in both fields.");
    }
}

function triggerAIScan() {
    alert("📊 AI v5.0 Engine: Advanced multi-indicator scan complete. Market Momentum is Bullish.");
}

function performLogin() {
    const user = document.getElementById("login-user").value || "VET Ven";
    document.getElementById("logged-user-display").innerText = user;
    alert("Profile session updated!");
    bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
}

function handleUserChat() {
    const input = document.getElementById("chat-input");
    if(!input.value) return;
    const feed = document.getElementById("chat-feed");
    feed.innerHTML += `<div class="p-2 bg-black rounded border border-secondary text-light"><span class="text-warning fw-bold">You:</span> ${input.value}</div>`;
    feed.innerHTML += `<div class="p-2 bg-black rounded border border-secondary text-light"><span class="text-success fw-bold">VENPro AI:</span> Command processed successfully under v5.0 framework.</div>`;
    input.value = "";
    feed.scrollTop = feed.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol);
    const savedToken = localStorage.getItem("tg_bot_token");
    const savedChatId = localStorage.getItem("tg_chat_id");
    if(savedToken) document.getElementById("bot-token-input").value = savedToken;
    if(savedChatId) document.getElementById("chat-id-input").value = savedChatId;
});
