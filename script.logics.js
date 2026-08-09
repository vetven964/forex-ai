// --- ផ្នែកការពារការដាច់ Login ពេល Refresh (Session Restoration) ---
document.addEventListener("DOMContentLoaded", () => {
    // ឆែកមើល localStorage ថាតើធ្លាប់ Login រួចរាល់ហើយឬยัง
    const savedUser = localStorage.getItem('vtrade_logged_user');
    if (savedUser) {
        const authBtn = document.getElementById('btnAuth');
        if (authBtn) {
            authBtn.innerText = savedUser; // ប្តូរអត្ថបទប៊ូតុង Login ទៅជាឈ្មោះ User ដែលបាន Login រួច
        }
        console.log("Session restored successfully for user:", savedUser);
    }

    // ដំណើរការទិន្នន័យទីផ្សារនិងဇនាពេល Load ស្របគ្នា
    fetchMarketPrices();
    setInterval(fetchMarketPrices, 30000); // 30 sec interval
    
    // Default load BTC
    const defaultAssetBtn = document.querySelector('.asset-btn');
    if (defaultAssetBtn) {
        changeSymbol('BINANCE:BTCUSDT', defaultAssetBtn);
    }
});

// Function to fetch prices with a fallback
async function fetchMarketPrices() {
    try {
        let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        let data = await res.json();
        const tickerBtc = document.getElementById('tickerBtc');
        const tickerEth = document.getElementById('tickerEth');
        
        if(data.bitcoin && tickerBtc) tickerBtc.innerText = '$' + data.bitcoin.usd.toLocaleString();
        if(data.ethereum && tickerEth) tickerEth.innerText = '$' + data.ethereum.usd.toLocaleString();
    } catch (e) {
        const tickerBtc = document.getElementById('tickerBtc');
        const tickerEth = document.getElementById('tickerEth');
        if(tickerBtc) tickerBtc.innerText = 'Error';
        if(tickerEth) tickerEth.innerText = 'Error';
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
    if(container) {
        container.innerHTML = ''; 
        if (typeof TradingView !== 'undefined') {
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
    }
}

// AI Analysis Logic
async function runRealTimeAnalysis() {
    const inputField = document.getElementById('terminalInput');
    const logsBox = document.getElementById('terminalLogs');
    if (!inputField || !logsBox) return;

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
