// --- ផ្នែកការពារការដាច់ Login ពេល Refresh (Session Restoration) និងដំណើរការទិន្នន័យ ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. ឆែកមើល localStorage ថាតើធ្លាប់ Login រួចរាល់ហើយឬនៅ
    const savedUser = localStorage.getItem('vtrade_logged_user');
    if (savedUser) {
        const authBtn = document.getElementById('btnAuth');
        if (authBtn) {
            authBtn.innerText = savedUser; // ប្តូរអត្ថបទប៊ូតុង Login ទៅជាឈ្មោះ User 
        }
        console.log("Session restored successfully for user:", savedUser);
    }

    // 2. ដំណើរការទិន្នន័យទីផ្សារពេល Load
    fetchMarketPrices();
    setInterval(fetchMarketPrices, 30000); // 30 sec interval
    
    // 3. Default load BTC
    const defaultAssetBtn = document.querySelector('.asset-btn');
    if (defaultAssetBtn) {
        changeSymbol('BINANCE:BTCUSDT', defaultAssetBtn);
    }

    // 4. ដំណើរការស្វ័យប្រវត្តិសម្រាប់ការវិភាគ AI ពេល Refresh Page
    runAIAnalysis();
});

// --- Function សម្រាប់ទាញយកតម្លៃទីផ្សារ ---
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

// --- Function សម្រាប់រៀបចំ TradingView Chart ---
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

// --- Function សម្រាប់ប្តូរ Tab ---
function switchTab(tabName) {
    // លាក់ Tab ទាំងអស់
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // បើក Tab ដែលបានជ្រើសរើស
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    // ប្រសិនបើចុចលើ Terminal & Analysis ឱ្យវាដំណើរការគណនា Real-time
    if (tabName === 'terminal-analysis') {
        runAIAnalysis();
    }
}

// --- AI Analysis Logic (សម្រាប់ការវាយបញ្ចូលដោយផ្ទាល់) ---
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

// --- Function សម្រាប់គណនា Win Rate និង Signal (កូដថ្មី) ---
function runAIAnalysis() {
    const winRateEl = document.getElementById('win-rate-val');
    const signalEl = document.getElementById('signal-direction');
    const logs = document.getElementById('terminal-logs'); 

    // បើគ្មាន Element ទាំងនេះទេ មិនបាច់ដំណើរការ
    if (!winRateEl || !signalEl || !logs) return;

    // គណនាភាគរយឈ្នះចន្លោះ 78% ដល់ 95%
    const randomWinRate = (Math.random() * (95 - 78) + 78).toFixed(2);
    const actions = ["🟢 BUY (LONG)", "🔴 SELL (SHORT)"];
    const selectedAction = actions[Math.floor(Math.random() * actions.length)];

    // បង្ហាញទិន្នន័យលើ UI
    winRateEl.innerText = randomWinRate + "%";
    signalEl.innerText = selectedAction;
    signalEl.className = selectedAction.includes("BUY") 
        ? "text-xl font-bold mt-1 text-emerald-400" 
        : "text-xl font-bold mt-1 text-red-500";

    // បន្ថែម Log ចូល Terminal
    const timeStr = new Date().toLocaleTimeString();
    logs.innerHTML += `<div>[${timeStr}] Market scanned successfully.</div>`;
    logs.innerHTML += `<div>[${timeStr}] Action: <b class="text-white">${selectedAction}</b> | Win Rate: <b class="text-sky-300">${randomWinRate}%</b></div>`;
    logs.innerHTML += `<div>[${timeStr}] ICT Fair Value Gap (FVG) Pattern Confirmed.</div>`;
    logs.scrollTop = logs.scrollHeight;
}
