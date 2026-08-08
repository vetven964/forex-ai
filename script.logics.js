document.getElementById('analyzeBtn').addEventListener('click', function() {
    const selectedPair = document.getElementById('currencyPair').value;
    const selectedTimeframe = document.getElementById('timeframe').value;
    
    // Refresh TradingView Chart dynamically when user clicks analyze
    if (typeof loadTradingViewChart === 'function') {
        loadTradingViewChart(selectedPair, selectedTimeframe);
    }

    // Dynamic UI feedback effect
    const signalText = document.getElementById('signalText');
    const signals = ['STRONG BUY', 'BUY SETUP', 'ACCUMULATION PHASE', 'BULLISH CONTINUATION'];
    const randomSignal = signals[Math.floor(Math.random() * signals.length)];
    signalText.innerText = randomSignal;
});