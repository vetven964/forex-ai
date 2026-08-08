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

// Change Asset Function (ពេលចុចប៊ូតុង BTC, EUR, GBP, GOLD)
function changeAsset(symbol, labelName, btnElement) {
    currentSymbol = symbol;
    initTradingView(currentSymbol, currentTimeframe);
    
    // ប្ដូរអត្ថបទឈ្មោះ Asset នៅផ្នែកខាងលើ
    const labelEl = document.getElementById("current-asset-label");
    if(labelEl) {
        labelEl.innerText = labelName;
    }

    // ផ្លាស់ប្តូរ Active State របស់ប៊ូតុង
    document.querySelectorAll('.asset-btn').forEach(btn => {
        btn.classList.remove('active', 'btn-success');
        btn.classList.add('btn-outline-light');
    });
    btnElement.classList.remove('btn-outline-light');
    btnElement.classList.add('active', 'btn-success');
}

// Switch Floating AI Panel Tabs (Analysis, Bot, History, News)
function switchTab(tabName, btnElement) {
    // ដក active ចេញពីប៊ូតុងទាំងអស់ក្នុង Panel
    const parentContainer = btnElement.parentElement;
    parentContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('text-warning', 'fw-bold', 'active-tab');
        btn.classList.add('text-muted');
    });
    
    // ใส่ active ឱ្យប៊ូតុងដែលកំពុងចុច
    btnElement.classList.remove('text-muted');
    btnElement.classList.add('text-warning', 'fw-bold', 'active-tab');
}

// Run on page load
document.addEventListener("DOMContentLoaded", () => {
    initTradingView(currentSymbol, currentTimeframe);
});
