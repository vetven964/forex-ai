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

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol);
});
