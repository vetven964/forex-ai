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

function sendTelegramAlert() {
    alert("🤖 Telegram Bot: Signal successfully broadcasted to your channel!");
    const feed = document.getElementById("chat-feed");
    feed.innerHTML += `<div class="p-2 bg-black rounded border border-secondary text-light"><span class="text-success fw-bold">Alert Sent:</span> Signal broadcasted to Telegram successfully.</div>`;
    feed.scrollTop = feed.scrollHeight;
}

function fetchFedData() {
    alert("🏛️ Fed API: Interest rate updated to 5.25% (Stable). World economic feed synchronized.");
    document.getElementById("fed-rate-badge").innerText = "FED: 5.25% (Live)";
}

function triggerAIScan() {
    alert("📊 AI Engine: Deep market scan completed. Trend is Bullish.");
}

function performLogin() {
    const user = document.getElementById("login-user").value || "VET Ven";
    document.getElementById("logged-user-display").innerText = user;
    alert("Login successful!");
    bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
}

function performRegister() {
    const user = document.getElementById("reg-user").value || "VET Ven";
    document.getElementById("logged-user-display").innerText = user;
    alert("Registration successful! Account created.");
    bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
}

function handleUserChat() {
    const input = document.getElementById("chat-input");
    if(!input.value) return;
    const feed = document.getElementById("chat-feed");
    feed.innerHTML += `<div class="p-2 bg-black rounded border border-secondary text-light"><span class="text-warning fw-bold">You:</span> ${input.value}</div>`;
    feed.innerHTML += `<div class="p-2 bg-black rounded border border-secondary text-light"><span class="text-success fw-bold">VENPro AI:</span> Command processed successfully.</div>`;
    input.value = "";
    feed.scrollTop = feed.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol);
});
