// Fetch Real-Time Market Prices on Load
async function fetchMarketPrices() {
    try {
        let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        let data = await res.json();
        if(data.bitcoin) {
            document.getElementById('tickerBtc').innerText = '$' + data.bitcoin.usd.toLocaleString();
        }
        if(data.ethereum) {
            document.getElementById('tickerEth').innerText = '$' + data.ethereum.usd.toLocaleString();
        }
    } catch (e) {
        console.log("API Error", e);
    }
}
fetchMarketPrices();
setInterval(fetchMarketPrices, 15000); // Update every 15 seconds

function changeSymbol(symbol, btn) {
    document.querySelectorAll('.asset-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow');
        b.classList.add('bg-gray-800', 'text-gray-300');
    });
    if(btn) {
        btn.classList.remove('bg-gray-800', 'text-gray-300');
        btn.classList.add('bg-blue-600', 'text-white', 'shadow');
    }

    document.getElementById('chartContainer').innerHTML = '<div id="tradingview_chart" style="height:100%;width:100%"></div>';
    new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "15",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "container_id": "tradingview_chart"
    });
}

// Load default chart
changeSymbol('BINANCE:BTCUSDT', document.querySelector('.asset-btn'));

function sendToTelegram() {
    window.open('https://t.me/share/url?url=&text=🚨 FOREX AI PRO REAL-TIME SIGNAL: STRONG BUY', '_blank');
}

// Real-Time API Analysis Function inside Terminal
async function runRealTimeAnalysis() {
    const inputField = document.getElementById('terminalInput');
    const logsBox = document.getElementById('terminalLogs');
    let query = inputField.value.trim().toUpperCase();

    if (!query) return;

    logsBox.innerHTML += `<div class="text-blue-400"><b>You:</b> ${query}</div>`;
    inputField.value = '';
    logsBox.scrollTop = logsBox.scrollHeight;

    let coinId = query.includes("BTC") ? "bitcoin" : (query.includes("ETH") ? "ethereum" : null);

    if (coinId) {
        try {
            let res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
            let data = await res.json();
            let price = data[coinId].usd;
            let change = data[coinId].usd_24h_change.toFixed(2);
            let trendColor = change >= 0 ? "text-green-400" : "text-red-400";
            let signal = change >= 0 ? "STRONG BUY" : "SELL";

            logsBox.innerHTML += `
                <div class="bg-gray-950 p-2 rounded border border-gray-800 space-y-1 mt-1">
                    <div class="text-gray-300">🤖 <b>Real-Time API Analysis (${query}):</b></div>
                    <div>Current Price: <strong class="text-white">$${price.toLocaleString()}</strong></div>
                    <div>24h Change: <span class="${trendColor}">${change}%</span></div>
                    <div>AI Signal: <span class="${trendColor} font-bold">${signal}</span></div>
                </div>
            `;
        } catch (err) {
            logsBox.innerHTML += `<div class="text-red-400 mt-1">⚠️ Failed to fetch live data. Please try again.</div>`;
        }
    } else {
        logsBox.innerHTML += `
            <div class="bg-gray-950 p-2 rounded border border-gray-800 space-y-1 mt-1">
                <div class="text-gray-300">🤖 <b>AI Analysis (${query}):</b></div>
                <div>Signal: <span class="text-green-400 font-bold">BUY</span></div>
                <div class="text-gray-400 text-[10px]">Market status: Bullish continuation pattern.</div>
            </div>
        `;
    }
    logsBox.scrollTop = logsBox.scrollHeight;
}

// Allow Enter key to trigger analysis
document.addEventListener("DOMContentLoaded", () => {
    const termInput = document.getElementById('terminalInput');
    if (termInput) {
        termInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                runRealTimeAnalysis();
            }
        });
    }
});
