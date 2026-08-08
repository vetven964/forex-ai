let currentSymbol = "BINANCE:BTCUSD";
let currentTimeframe = "15";
let tvWidget = null;

// Initialize TradingView Widget
function initTradingView(symbol, timeframe) {
    const container = document.getElementById("tradingview_widget");
    if(container) {
        container.innerHTML = "";
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
    }
}

// Switch Page Tabs Function
function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active-page');
    });
    // Remove active class from tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected page
    if(pageId === 'dashboard') {
        document.getElementById('page-dashboard').classList.add('active-page');
        event.target.classList.add('active');
        // Re-initialize chart to fix rendering size bugs
        setTimeout(() => initTradingView(currentSymbol, currentTimeframe), 100);
    } else if(pageId === 'analytics') {
        document.getElementById('page-analytics').classList.add('active-page');
        event.target.classList.add('active');
    }
}

// Change Asset Function
function changeAsset(symbol, btnElement) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    document.querySelectorAll('.asset-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

// Active Session Calculator
function updateActiveSession() {
    const utcHours = new Date().getUTCHours();
    let sessionName = (utcHours >= 0 && utcHours < 8) ? "ASIAN Session 🇯🇵" : 
                      (utcHours >= 8 && utcHours < 13) ? "London Session 🇬🇧" : 
                      (utcHours >= 13 && utcHours < 21) ? "New York / London 🇺🇸🇬🇧" : "Pacific / Off-Hours 🇦🇺";
    
    const sessionEl = document.getElementById("active-session");
    if(sessionEl) {
        sessionEl.innerText = sessionName;
    }
}

// Run on page load
document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
    updateActiveSession();
    setInterval(updateActiveSession, 60000);
});
