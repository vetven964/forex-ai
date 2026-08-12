// V TRADE AI v5.3.8 shared page helpers.
// This file contains no mock prices, fake win rates, or synthetic BUY/SELL signals.
const VTRADE_API_BASE = window.VTRADE_API_BASE_OVERRIDE || 'https://forexai-6xw6.onrender.com';

async function getLiveXauAnalysis() {
    const response = await fetch(`${VTRADE_API_BASE}/api/analysis/xauusd`, { cache: 'no-store' });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error(`API returned non-JSON (${response.status})`); }
    if (!response.ok || !data.success) throw new Error(data.error || 'VT Markets MT5 analysis unavailable');
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('vtrade_logged_user');
    if (savedUser) {
        const authBtn = document.getElementById('btnAuth');
        if (authBtn) authBtn.innerText = savedUser;
    }

    const analyzeProBtn = document.getElementById('analyze-pro-btn');
    if (analyzeProBtn) analyzeProBtn.addEventListener('click', async () => {
        try {
            const a = await getLiveXauAnalysis();
            showAnalysisResult(a);
        } catch (e) {
            alert(`⚠️ XAUUSD មិនអាចវិភាគបាន៖ ${e.message}`);
        }
    });

    const bestSetupBtn = document.getElementById('best-setup-btn');
    if (bestSetupBtn) bestSetupBtn.addEventListener('click', async () => {
        try {
            const a = await getLiveXauAnalysis();
            showBestSetup(a);
        } catch (e) {
            alert(`⚠️ មិនមាន live setup៖ ${e.message}`);
        }
    });
});

function showAnalysisResult(a) {
    alert(`📊 XAUUSD LIVE ICT Analysis\nSignal: ${a.signal || 'WAIT'}\nStatus: ${a.status || '—'}\nScore: ${a.confidence ?? '—'}/100\nBias: ${a.bias || '—'}\nNews: ${a.news?.label || 'NEWS UNAVAILABLE'}`);
}

function showBestSetup(a) {
    const entry = a.signal === 'BUY' || a.signal === 'SELL' ? (a.entry ?? '—') : 'WAIT — NO CONFIRMED ENTRY';
    const tp = (a.takeProfit || []).join(' / ') || '—';
    alert(`🎯 XAUUSD LIVE SETUP\nSignal: ${a.signal || 'WAIT'}\nEntry: ${entry}\nSL: ${a.stopLoss ?? '—'}\nTP1/TP2/TP3: ${tp}`);
}
