let currentSymbol = "BINANCE:BTCUSD";
let currentTimeframe = "15";
let tvWidget = null;

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

function switchPage(pageId) {
    const dashboardPage = document.getElementById('page-dashboard');
    const analyticsPage = document.getElementById('page-analytics');
    const dashBtn = document.getElementById('tab-dashboard-btn');
    const anaBtn = document.getElementById('tab-analytics-btn');

    if(pageId === 'dashboard') {
        dashboardPage.classList.remove('d-none');
        analyticsPage.classList.add('d-none');
        dashBtn.classList.add('active', 'btn-primary');
        dashBtn.classList.remove('btn-outline-primary');
        anaBtn.classList.remove('active', 'btn-primary');
        anaBtn.classList.add('btn-outline-primary');
        setTimeout(() => initTradingView(currentSymbol, currentTimeframe), 100);
    } else if(pageId === 'analytics') {
        dashboardPage.classList.add('d-none');
        analyticsPage.classList.remove('d-none');
        anaBtn.classList.add('active', 'btn-primary');
        anaBtn.classList.remove('btn-outline-primary');
        dashBtn.classList.remove('active', 'btn-primary');
        dashBtn.classList.add('btn-outline-primary');
    }
}

function changeAsset(symbol, btnElement) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    document.querySelectorAll('.asset-btn').forEach(btn => {
        btn.classList.remove('active', 'btn-success');
        btn.classList.add('btn-secondary');
    });
    btnElement.classList.remove('btn-secondary');
    btnElement.classList.add('active', 'btn-success');
}

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

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
    updateActiveSession();
    setInterval(updateActiveSession, 60000);
});
