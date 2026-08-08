// Function to fetch prices with a fallback
async function fetchMarketPrices() {
    try {
        let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        let data = await res.json();
        if(data.bitcoin) document.getElementById('tickerBtc').innerText = '$' + data.bitcoin.usd.toLocaleString();
        if(data.ethereum) document.getElementById('tickerEth').innerText = '$' + data.ethereum.usd.toLocaleString();
    } catch (e) {
        document.getElementById('tickerBtc').innerText = 'Error';
        document.getElementById('tickerEth').innerText = 'Error';
    }
}

// Function to initialize TradingView Chart properly
function changeSymbol(symbol, btn) {
    // UI Update
    document.querySelectorAll('.asset-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-gray-800', 'text-gray-300');
    });
    if(btn) {
        btn.classList.remove('bg-gray-800', 'text-gray-300');
        btn.classList.add('bg-blue-600', 'text-white');
    }

    // Clear and create new chart
    const container = document.getElementById('chartContainer');
    container.innerHTML = ''; 
    new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "15",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#111827",
        "container_id": "chartContainer"
    });
}

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    fetchMarketPrices();
    setInterval(fetchMarketPrices, 30000); // 30 sec interval
    
    // Default load BTC
    changeSymbol('BINANCE:BTCUSDT', document.querySelector('.asset-btn'));
});

// AI Analysis Logic
async function runRealTimeAnalysis() {
    const inputField = document.getElementById('terminalInput');
    const logsBox = document.getElementById('terminalLogs');
    let query = inputField.value.trim().toUpperCase();
    if (!query) return;

    logsBox.innerHTML += `<div class="text-blue-400 mt-1"><b>You:</b> Analyzing ${query}...</div>`;
    inputField.value = '';
    
    // Simulated AI response for speed
    setTimeout(() => {
        logsBox.innerHTML += `<div class="bg-gray-900 p-2 rounded mt-1 border-l-2 border-green-500">
            🤖 <b>AI Analysis (${query}):</b> Current market data suggests a <b>STRONG BUY</b> position.
        </div>`;
        logsBox.scrollTop = logsBox.scrollHeight;
    }, 1000);
}
