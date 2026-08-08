let currentSymbol = "BINANCE:BTCUSD";
let currentTimeframe = "15";
let tvWidget = null;

// Initialize TradingView Widget dynamically
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
        "toolbar_bg": "#121824",
        "enable_publishing": false,
        "allow_symbol_change": false,
        "container_id": "tradingview_widget"
    });
}

// Switch Asset Function
function changeAsset(symbol, name) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    
    // Update active button UI
    document.querySelectorAll('.asset-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// Switch Timeframe Function
function changeTimeframe(tf) {
    currentTimeframe = tf;
    initTradingView(currentSymbol, currentTimeframe);
    
    // Update active button UI
    document.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// Calculate Active Session based on strict UTC
function updateActiveSession() {
    const now = new Date();
    const utcHours = now.getUTCHours();
    
    let sessionName = "ASIAN Session 🇯🇵";
    
    if (utcHours >= 0 && utcHours < 8) {
        sessionName = "ASIAN Session 🇯🇵";
    } else if (utcHours >= 8 && utcHours < 13) {
        sessionName = "London Session 🇬🇧";
    } else if (utcHours >= 13 && utcHours < 21) {
        sessionName = "New York / London 🇺🇸🇬🇧";
    } else {
        sessionName = "Pacific / Off-Hours 🇦🇺";
    }

    const sessionElement = document.getElementById("active-session");
    if (sessionElement) {
        sessionElement.innerText = sessionName;
    }
}

// Run on page load
document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
    updateActiveSession();
    setInterval(updateActiveSession, 60000);
});