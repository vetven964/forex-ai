let tvWidgetInstance = null;
        let sentimentChartInstance = null;
        let activeOtpCode = "998877";
        let currentCurrency = "USD";
        let baseUsdBalance = 1250.00;

        let usersListDB = [
            { name: "VET VEN (Owner)", email: "vetven@vtrade.ai", level: "Admin", security: "Protected v5.7 (DDoS ON)", date: "2026-08-09" },
            { name: "Sokha Chan", email: "sokha@vtrade.ai", level: "VIP Pro", security: "Protected v5.7 (DDoS ON)", date: "2026-08-08" },
            { name: "Dara Pich", email: "dara@vtrade.ai", level: "Standard", security: "Protected v5.7 (DDoS ON)", date: "2026-08-07" }
        ];

        let mockMarketData = {
            "BTC/USDT": { direction: "STRONG BUY", winRate: "94.8%", entry: "$65,057.90", sl: "$64,100.00", tp: "$66,500 / $68,200", fvg: "BULLISH FVG", fvgZone: "0.5 - 0.618 Fib", sentiment: "88% BULLISH", rsi: "68.4 (Strong Buy)", macd: "Bullish Divergence", orderbook: "64% Buy Orders" },
            "XAU/USD": { direction: "STRONG BUY", winRate: "92.5%", entry: "$2,650.40", sl: "$2,620.00", tp: "$2,680 / $2,720", fvg: "BULLISH FVG", fvgZone: "0.618 Fib Support", sentiment: "86% BULLISH", rsi: "64.2 (Bullish Momentum)", macd: "Positive Histogram", orderbook: "72% Buy Orders" },
            "EUR/USD": { direction: "SELL / SHORT", winRate: "89.5%", entry: "$1.0850", sl: "$1.0910", tp: "$1.0780 / $1.0720", fvg: "BEARISH FVG", fvgZone: "Premium Array 4H", sentiment: "76% BEARISH", rsi: "34.2 (Oversold Imminent)", macd: "Bearish Crossover", orderbook: "68% Sell Orders" },
            "ETH/USDT": { direction: "BUY / LONG", winRate: "92.4%", entry: "$1,919.60", sl: "$1,880.00", tp: "$1,980 / $2,050", fvg: "BULLISH FVG", fvgZone: "Order Block 15M", sentiment: "85% BULLISH", rsi: "65.0 (Bullish Momentum)", macd: "Bullish Cross", orderbook: "61% Buy Orders" }
        };

        document.addEventListener("DOMContentLoaded", () => {
            const savedUser = localStorage.getItem('vtrade_logged_user');
            if (savedUser) {
                const authBtn = document.getElementById('btnAuth');
                if (authBtn) authBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> <span>${savedUser}</span>`;
            }

            fetchMarketPrices();
            setInterval(fetchMarketPrices, 30000);
            initSentimentRadarChart();
            runAIAnalysis();
            renderAdminTable(usersListDB);
            updateMarketSessionsTimer();
            setInterval(updateMarketSessionsTimer, 1000);
            updateLiveClock();
            setInterval(updateLiveClock, 1000);
        });

        async function fetchMarketPrices() {
            try {
                let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether-gold&vs_currencies=usd');
                if (!res.ok) throw new Error("API Network Response Error");
                let data = await res.json();
                
                const elBtc = document.getElementById('tickerBtc');
                const elEth = document.getElementById('tickerEth');
                const elXau = document.getElementById('tickerXau');

                if (elBtc && data.bitcoin) elBtc.innerText = `$${data.bitcoin.usd.toLocaleString()}`;
                if (elEth && data.ethereum) elEth.innerText = `$${data.ethereum.usd.toLocaleString()}`;
                if (elXau && data['tether-gold']) elXau.innerText = `$${data['tether-gold'].usd.toLocaleString()}`;
            } catch (error) {
                console.warn("Using fallback mock data due to API limit or network issue:", error);
            }
        }

        function updateLiveClock() {
            const now = new Date();
            const dateStr = now.toLocaleDateString('km-KH');
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
            
            const dateEl = document.getElementById('liveDate');
            const clockEl = document.getElementById('liveClock');
            if (dateEl) dateEl.innerText = dateStr;
            if (clockEl) clockEl.innerText = timeStr;
        }

        function initSentimentRadarChart() {
            const canvas = document.getElementById('sentimentChartCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (sentimentChartInstance) sentimentChartInstance.destroy();
            
            sentimentChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['RSI Momentum', 'MACD Trend', 'Orderbook', 'Sentiment', 'FVG Strength'],
                    datasets: [{
                        label: 'Market Consensus',
                        data: [85, 90, 75, 88, 92],
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: '#3b82f6',
                        borderWidth: 2,
                        pointBackgroundColor: '#60a5fa'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { display: false }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        function runAIAnalysis() {
            const pairSelect = document.getElementById('terminalPairSelect');
            if (!pairSelect) return;
            const selectedPair = pairSelect.value;
            const data = mockMarketData[selectedPair] || mockMarketData["BTC/USDT"];

            const spinner = document.getElementById('btnRefreshSpinner');
            const icon = document.getElementById('btnRefreshIcon');
            if (spinner) spinner.style.display = 'inline-block';
            if (icon) icon.style.display = 'none';

            setTimeout(() => {
                if (spinner) spinner.style.display = 'none';
                if (icon) icon.style.display = 'inline-block';

                document.getElementById('signal-direction').innerText = data.direction;
                document.getElementById('signal-entry').innerText = data.entry;
                document.getElementById('win-rate-val').innerText = data.winRate;
                document.getElementById('win-rate-bar').style.width = data.winRate;
                document.getElementById('fvg-confidence').innerText = data.fvg;
                document.getElementById('fvg-zone').innerText = data.fvgZone;
                document.getElementById('sentiment-score').innerText = data.sentiment;
                
                document.getElementById('rsiVal').innerText = data.rsi;
                document.getElementById('macdVal').innerText = data.macd;
                document.getElementById('orderbookVal').innerText = data.orderbook;

                document.getElementById('tblAsset').innerText = selectedPair;
                document.getElementById('tblSignalBadge').innerText = data.direction;
                document.getElementById('tblEntry').innerText = data.entry;
                document.getElementById('tblSL').innerText = data.sl;
                document.getElementById('tblTP').innerText = data.tp;

                appendTerminalLog(`[AI ENGINE] Successfully scanned ${selectedPair}. Signal generated: ${data.direction} (${data.winRate} Win Rate).`);
            }, 600);
        }

        function appendTerminalLog(message) {
            const logsBox = document.getElementById('terminal-logs');
            if (!logsBox) return;
            const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false });
            const logLine = document.createElement('div');
            logLine.innerHTML = `<span class="text-gray-500">[${timeNow}]</span> <span class="text-teal-400">[EXEC]</span> ${message}`;
            logsBox.appendChild(logLine);
            logsBox.scrollTop = logsBox.scrollHeight;
        }

        function clearTerminalLogs() {
            const logsBox = document.getElementById('terminal-logs');
            if (logsBox) logsBox.innerHTML = '';
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            const target = document.getElementById('tab-' + tabId);
            if (target) target.classList.add('active');
        }

        function renderAdminTable(dataArray) {
            const tbody = document.getElementById('adminUserTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            dataArray.forEach((user, idx) => {
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-900 transition">
                        <td class="p-3.5 font-bold text-white">${user.name}<br><span class="text-gray-500 text-[10px] font-normal">${user.email}</span></td>
                        <td class="p-3.5"><span class="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold text-[11px]">${user.level}</span></td>
                        <td class="p-3.5 text-emerald-400">${user.security}</td>
                        <td class="p-3.5 text-gray-400">${user.date}</td>
                        <td class="p-3.5 text-center">
                            <button onclick="alert('Editing user: ${user.name}')" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer">Edit</button>
                        </td>
                    </tr>
                `;
            });
        }

        function updateMarketSessionsTimer() {
            const now = new Date();
            const utcHour = now.getUTCHours();

            // Tokyo: 00:00 - 08:00 UTC (07:00 - 15:00 ICT)
            const isTokyoOpen = utcHour >= 0 && utcHour < 8;
            updateSessionBadge('badgeAsian', 'timerAsian', isTokyoOpen);

            // London: 08:00 - 16:00 UTC (15:00 - 23:00 ICT)
            const isLondonOpen = utcHour >= 8 && utcHour < 16;
            updateSessionBadge('badgeLondon', 'timerLondon', isLondonOpen);

            // New York: 13:00 - 21:00 UTC (20:00 - 04:00 ICT)
            const isNyOpen = utcHour >= 13 && utcHour < 21;
            updateSessionBadge('badgeNy', 'timerNy', isNyOpen);
        }

        function updateSessionBadge(badgeId, timerId, isOpen) {
            const badge = document.getElementById(badgeId);
            const timer = document.getElementById(timerId);
            if (!badge || !timer) return;
            if (isOpen) {
                badge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 animate-pulse";
                badge.innerText = "OPEN (កំពុងបើក)";
                timer.innerText = "ស្ថានភាព៖ កំពុងដំណើរការជួញដូរ";
            } else {
                badge.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
                badge.innerText = "CLOSED (បិទ)";
                timer.innerText = "ស្ថានភាព៖ រង់ចាំម៉ោងបើកទីផ្សារ";
            }
        }
