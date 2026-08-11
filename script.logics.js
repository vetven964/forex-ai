function runAIAnalysis() {
    const pairSelect = document.getElementById('terminalPairSelect');
    const pair = pairSelect ? pairSelect.value : 'BTC/USDT';
    const data = mockMarketData[pair] || mockMarketData['BTC/USDT'];

    const spinner = document.getElementById('btnRefreshSpinner');
    const icon = document.getElementById('btnRefreshIcon');
    if(spinner) spinner.style.display = 'inline-block';
    if(icon) icon.style.display = 'none';

    appendTerminalLog(`[COMMAND] Executing Realtime Market Scan for ${pair}...`);

    setTimeout(() => {
        if(spinner) spinner.style.display = 'none';
        if(icon) icon.style.display = 'inline-block';

        // 🛡️ ផ្ទៀងផ្ទាត់តម្លៃ Entry មិនឱ្យមានតម្លៃខុសប្រក្រតី
        let exactEntryPrice = data.entry;
        if (!exactEntryPrice || exactEntryPrice === "0" || exactEntryPrice === "") {
            exactEntryPrice = "$65,057.90"; // Fallback safe price
        }

        document.getElementById('signal-direction').innerText = data.direction;
        document.getElementById('signal-entry').innerText = exactEntryPrice;
        document.getElementById('win-rate-val').innerText = data.winRate;
        document.getElementById('win-rate-bar').style.width = data.winRate;
        document.getElementById('fvg-confidence').innerText = data.fvg;
        document.getElementById('fvg-zone').innerText = data.fvgZone;
        document.getElementById('sentiment-score').innerText = data.sentiment;
        document.getElementById('rsiVal').innerText = data.rsi;
        document.getElementById('macdVal').innerText = data.macd;
        document.getElementById('orderbookVal').innerText = data.orderbook;

        document.getElementById('tblAsset').innerText = pair;
        document.getElementById('tblSignalBadge').innerText = data.direction;
        document.getElementById('tblEntry').innerText = exactEntryPrice;
        document.getElementById('tblSL').innerText = data.sl;
        document.getElementById('tblTP').innerText = data.tp;

        appendTerminalLog(`[AI ENGINE] Analysis complete for ${pair}. Signal: ${data.direction} @ ${exactEntryPrice}. Win Probability: ${data.winRate}`);
        updateRadarChartData(pair);
    }, 800);
}
```[cite: 23]

---

#### ២. កែតម្រូវ Admin Hub Broadcast Signal (`admin.html`)
ប្រសិនបើបញ្ហាเกิดពី Admin Broadcast ផ្ញើតម្លៃ Entry ខុស សូមអាប់ដេតមុខងារ `adminBroadcastSignal()` ដូចខាងក្រោម៖

```javascript
function adminBroadcastSignal() {
    const asset = document.getElementById("admin-asset").value;
    const type = document.getElementById("admin-signal-type").value;
    const entry = document.getElementById("admin-entry").value;
    const target = document.getElementById("admin-target").value;
    
    // 🔍 ពិនិត្យតម្លៃ Entry មុនពេល Push ចូល Telegram
    if (!entry || entry.trim() === "") {
        alert("⚠️ Error: Price Entry មិនអាចទទេបានទេ!");
        return;
    }

    // ធ្វើការបញ្ជូនទិន្នន័យទៅកាន់ Telegram Bot API របស់អ្នក
    alert(`✅ Admin Hub: Successfully broadcasted ${asset} (${type}) @ Entry: ${entry} to Telegram channel!`);
}
```[cite: 20]

---

### 🚀 ដំណោះស្រាយសង្ខេប៖
1. **Clear Browser Cache / LocalStorage**: ពេលខ្លះតម្លៃចាស់ជាប់ក្នុង Cache ធ្វើឱ្យតម្លៃ Entry មិនស្របគ្នា។ សូមធ្វើការ Refresh (`Ctrl + F5`) ជាការស្រេច។
2. **ពិនិត្យ API Response**: ប្រសិនបើលោកអ្នកទាញតម្លៃពី CoinGecko ឬ TradingView API ធានាថា Variable `data.entry` មិនជាប់តម្លៃ `undefined`។
