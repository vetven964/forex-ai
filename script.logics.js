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

function changeAsset(symbol, labelName, btnElement) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    
    const labelEl = document.getElementById("current-asset-label");
    if(labelEl) {
        labelEl.innerText = labelName;
    }

    document.querySelectorAll('.asset-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-success', 'text-black', 'border-success');
        btn.classList.add('text-white');
    });
    btnElement.classList.remove('text-white');
    btnElement.classList.add('active', 'bg-success', 'text-black', 'fw-bold');
}

function switchTab(tabName, btnElement) {
    const parentContainer = btnElement.parentElement;
    parentContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('text-warning', 'fw-bold', 'active-tab');
        btn.classList.add('text-muted');
    });
    
    btnElement.classList.remove('text-muted');
    btnElement.classList.add('text-warning', 'fw-bold', 'active-tab');
}

document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
});
