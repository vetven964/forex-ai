let currentSymbol = "BINANCE:BTCUSD";
let currentTimeframe = "15";
let tvWidget = null;

// Initialize TradingView Widget
function initTradingView(symbol, timeframe) {
    document.getElementById("tradingview_widget").innerHTML = "";
    tvWidget = new TradingView.widget({
        "width": "100%",
        "height": "100%",
        "symbol": symbol,
        "interval": timeframe,
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "container_id": "tradingview_widget"
    });
    // Update Analysis whenever chart changes
    analyzeMarket(symbol);
}

// AI Analysis Logic
function analyzeMarket(symbol) {
    // ចំលងប្រព័ន្ធ AI វិភាគ (Simulation)
    const confidence = (Math.random() * (99.9 - 85.5) + 85.5).toFixed(1);
    const actions = ["STRONG BUY", "BUY", "NEUTRAL", "SELL", "STRONG SELL"];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    
    document.getElementById("ai-signal-text").innerText = randomAction;
    document.getElementById("ai-confidence").innerText = "AI Confidence: " + confidence + "%";
    
    // Update Status Color
    const signalBox = document.querySelector(".ai-signal-box");
    signalBox.style.borderLeft = randomAction.includes("BUY") ? "5px solid #22c55e" : "5px solid #ef4444";
    document.getElementById("ai-signal-text").style.color = randomAction.includes("BUY") ? "#22c55e" : "#ef4444";
}

function changeAsset(symbol, name) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    document.querySelectorAll('.asset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function changeTimeframe(tf) {
    currentTimeframe = tf;
    initTradingView(currentSymbol, currentTimeframe);
    document.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function updateActiveSession() {
    const utcHours = new Date().getUTCHours();
    let sessionName = (utcHours >= 0 && utcHours < 8) ? "ASIAN Session 🇯🇵" : 
                      (utcHours >= 8 && utcHours < 13) ? "London Session 🇬🇧" : 
                      (utcHours >= 13 && utcHours < 21) ? "New York / London 🇺🇸🇬🇧" : "Pacific / Off-Hours 🇦🇺";
    document.getElementById("active-session").innerText = sessionName;
}

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
    updateActiveSession();
    setInterval(updateActiveSession, 60000);
});