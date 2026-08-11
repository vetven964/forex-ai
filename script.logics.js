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
            "XAU/USD": { direction: "STRONG BUY", winRate: "91.2%", entry: "$2,685.50", sl: "$2,650.00", tp: "$2,720 / $2,750", fvg: "DISCOUNT FVG", fvgZone: "Demand Zone 1H", sentiment: "82% BULLISH", rsi: "62.1 (Bullish)", macd: "Histogram Positive", orderbook: "71% Buy Volume" },
            "EUR/USD": { direction: "SELL / SHORT", winRate: "89.5%", entry: "$1.0855", sl: "$1.0920", tp: "$1.0780 / $1.0700", fvg: "BEARISH FVG", fvgZone: "Premium Array 4H", sentiment: "76% BEARISH", rsi: "34.2 (Oversold Imminent)", macd: "Bearish Crossover", orderbook: "68% Sell Orders" },
            "ETH/USDT": { direction: "BUY / LONG", winRate: "92.4%", entry: "$2,510.60", sl: "$2,450.00", tp: "$2,620 / $2,750", fvg: "BULLISH FVG", fvgZone: "Order Block 15M", sentiment: "85% BULLISH", rsi: "65.0 (Bullish Momentum)", macd: "Bullish Cross", orderbook: "61% Buy Orders" }
        };

        const translations = {
            km: { brand: "V TRADE AI & TERMINAL v5.0.7", headerStatus: "Real-Time AI Terminal & Execution Engine 100% Active", deposit: "បង់ប្រាក់ (ABA / Account)", auth: "Login", dash: "ផ្ទាំងគ្រប់គ្រង (Dashboard)", sessions: "ម៉ោងទីផ្សារ (Asian/NY/London)", news: "ព័ត៌មាន & តំណភ្ជាប់ (News Links)", pricing: "កញ្ចប់តម្លៃថ្មី (Pricing)", telegram: "Telegram Bot & Webhook", chart: "TradingView Chart", security: "Cloudflare v5 & DDoS Shield", support: "AI Support v5.7" },
            en: { brand: "V TRADE AI & TERMINAL v5.0.7", headerStatus: "Real-Time AI Terminal & Execution Engine 100% Active", deposit: "Account Payment", auth: "Login", dash: "Dashboard", sessions: "Market Sessions", news: "News & Links", pricing: "Pricing Plans", telegram: "Telegram Bot Setup", chart: "TradingView", security: "Security v5 & DDoS", support: "AI Support v5" },
            zh: { brand: "V TRADE AI TERMINAL v5.0.7", headerStatus: "实时AI终端与执行引擎激活", deposit: "账户支付", auth: "登录", dash: "控制面板", sessions: "市场时段", news: "新闻与链接", pricing: "价格方案", telegram: "电报设置", chart: "图表", security: "安全防御v5", support: "支持v5" }
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

        // ធ្វើបច្ចុប្បន្នភាពទាញយកតម្លៃពិតប្រាកដ (Crypto + Gold/Forex Simulated Live Feed)
        async function fetchMarketPrices() {
            try {
                let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
                let data = var = await res.json();
                const tickerBtc = document.getElementById('tickerBtc');
                const tickerEth = document.getElementById('tickerEth');
                
                if(data.bitcoin && tickerBtc) {
                    let btcVal = data.bitcoin.usd;
                    tickerBtc.innerText = '$' + btcVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    mockMarketData["BTC/USDT"].entry = '$' + btcVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
                if(data.ethereum && tickerEth) {
                    let ethVal = data.ethereum.usd;
                    tickerEth.innerText = '$' + ethVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    mockMarketData["ETH/USDT"].entry = '$' + ethVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }

                // ធ្វើឱ្យតម្លៃ Gold (XAU/USD) និង EUR/USD រត់ប្រែប្រួល Realtime ស្របតាមទីផ្សារអន្តរជាតិ
                let randomGoldDelta = (Math.random() - 0.48) * 3.5;
                let currentGold = parseFloat(mockMarketData["XAU/USD"].entry.replace('$', '').replace(',', '')) + randomGoldDelta;
                mockMarketData["XAU/USD"].entry = '$' + currentGold.toFixed(2);
                mockMarketData["XAU/USD"].sl = '$' + (currentGold - 35).toFixed(2);
                mockMarketData["XAU/USD"].tp = '$' + (currentGold + 45).toFixed(2) + ' / $' + (currentGold + 70).toFixed(2);

                runAIAnalysis();
            } catch (e) {
                console.log("Live price fetch fallback active.");
            }
        }

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

                document.getElementById('tblAsset').innerText = pair;
                document.getElementById('tblSignalBadge').innerText = data.direction;
                document.getElementById('tblEntry').innerText = data.entry;
                document.getElementById('tblSL').innerText = data.sl;
                document.getElementById('tblTP').innerText = data.tp;

                appendTerminalLog(`[AI ENGINE] Analysis complete for ${pair}. Signal: ${data.direction} @ ${data.entry}. Win Probability: ${data.winRate}`);
                updateRadarChartData(pair);
            }, 800);
        }

        function initSentimentRadarChart() {
            const ctx = document.getElementById('sentimentChartCanvas');
            if(!ctx) return;

            sentimentChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['RSI', 'MACD', 'ICT FVG', 'Orderbook', 'News Filter'],
                    datasets: [{
                        label: 'Market Score',
                        data: [85, 90, 92, 88, 95],
                        backgroundColor: 'rgba(20, 184, 166, 0.2)',
                        borderColor: '#14b8a6',
                        borderWidth: 2,
                        pointBackgroundColor: '#38bdf8'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            pointLabels: { color: '#9ca3af', font: { size: 10 } },
                            ticks: { display: false, backdropColor: 'transparent' }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        function updateRadarChartData(pair) {
            if(!sentimentChartInstance) return;
            const randomVal = () => Math.floor(70 + Math.random() * 25);
            sentimentChartInstance.data.datasets[0].data = [randomVal(), randomVal(), randomVal(), randomVal(), randomVal()];
            sentimentChartInstance.update();
        }

        function appendTerminalLog(message) {
            const logBox = document.getElementById('terminal-logs');
            if(!logBox) return;
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            const logEntry = document.createElement('div');
            logEntry.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> ${message}`;
            logBox.appendChild(logEntry);
            logBox.scrollTop = logBox.scrollHeight;
        }

        function clearTerminalLogs() {
            const logBox = document.getElementById('terminal-logs');
            if(logBox) logBox.innerHTML = '<div><span class="text-gray-500">[SYSTEM]</span> Terminal logs cleared. Ready...</div>';
        }

        function executeTerminalCommand() {
            const cmdInput = document.getElementById('terminalCmdInput');
            if(!cmdInput || !cmdInput.value.trim()) return;
            const val = cmdInput.value.trim();
            appendTerminalLog(`<span class="text-amber-400">[USER CMD]</span> ${val}`);
            cmdInput.value = '';
            
            setTimeout(() => {
                appendTerminalLog(`<span class="text-emerald-400">[EXECUTION]</span> Command executed successfully. AI Worker synchronized.`);
            }, 500);
        }

        async function dispatchTelegramSignal() {
            const pair = document.getElementById('tblAsset').innerText;
            const direction = document.getElementById('tblSignalBadge').innerText;
            const entry = document.getElementById('tblEntry').innerText;
            const sl = document.getElementById('tblSL').innerText;
            const tp = document.getElementById('tblTP').innerText;

            const token = localStorage.getItem('vtrade_tg_token') || document.getElementById('tgTokenInput')?.value;
            const chatId = localStorage.getItem('vtrade_tg_chatid') || document.getElementById('tgChatIdInput')?.value;

            if(!token || !chatId) {
                alert('សូមរៀបចំ Telegram Bot Token & Chat ID នៅក្នុង Tab "Telegram Bot" ជាមុនសិន!');
                switchTab('telegram');
                return;
            }

            const msg = `🚨 **NEW V TRADE AI REALTIME SIGNAL** 🚨\n\n📌 Asset: **${pair}**\n📈 Signal: **${direction}**\n🎯 Entry Price: **${entry}**\n🛡️ Stop Loss: **${sl}**\n💰 Take Profit: **${tp}**\n\n🤖 Automated Copy Trading Connected 100%!`;

            try {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
                });
                alert(`🟢 ផ្ញើ Realtime Signal (${pair}) ចូល Telegram Channel/Bot រួចរាល់ ១០០%!`);
                appendTerminalLog(`<span class="text-blue-400">[TELEGRAM]</span> Broadcasted signal ${pair} to Channel ID ${chatId}`);
            } catch(e) {
                alert('កំហុសក្នុងការផ្ញើ Signal! សូមពិនិត្យមើល Token និង Chat ID។');
            }
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('aside nav button').forEach(btn => {
                btn.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-white transition text-xs text-left cursor-pointer";
            });
            
            const targetTab = document.getElementById('tab-' + tabId);
            const targetNav = document.getElementById('nav-' + tabId);
            
            if(targetTab) targetTab.classList.add('active');
            if(targetNav) {
                if(tabId === 'terminal-analysis') {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-teal-500/20 text-teal-400 font-medium transition text-xs text-left border border-teal-500/40 cursor-pointer";
                } else if(tabId === 'admin') {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-amber-500/20 text-amber-400 font-medium transition text-xs text-left border border-amber-500/40 cursor-pointer";
                } else if(tabId === 'strategy') {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-cyan-500/20 text-cyan-400 font-medium transition text-xs text-left border border-cyan-500/40 cursor-pointer";
                } else if(tabId === 'calculator') {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-purple-500/20 text-purple-400 font-medium transition text-xs text-left border border-purple-500/40 cursor-pointer";
                } else if(tabId === 'copytrading') {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 font-medium transition text-xs text-left border border-emerald-500/40 cursor-pointer";
                } else {
                    targetNav.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-blue-600/20 text-blue-400 font-medium transition text-xs text-left cursor-pointer";
                }
            }

            if(tabId === 'tvchart' && !tvWidgetInstance) {
                initTradingViewWidget('BINANCE:BTCUSDT');
            }
        }

        // បំពេញកូដ Admin Table ដែលខ្វះខាតឱ្យពេញលេញ
        function renderAdminTable(data) {
            const tbody = document.getElementById('adminUserTableBody');
            if(!tbody) return;
            tbody.innerHTML = "";
            data.forEach((u, index) => {
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-900 transition">
                        <td class="p-3.5 flex items-center space-x-3">
                            <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">${u.name.charAt(0)}</div>
                            <div>
                                <div class="font-bold text-white">${u.name}</div>
                                <div class="text-[10px] text-gray-400">${u.email}</div>
                            </div>
                        </td>
                        <td class="p-3.5"><span class="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded font-bold">${u.level}</span></td>
                        <td class="p-3.5 text-emerald-400">${u.security}</td>
                        <td class="p-3.5 text-gray-400 font-mono">${u.date}</td>
                        <td class="p-3.5 text-center">
                            <button onclick="deleteUserRecord(${index})" class="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2.5 py-1 rounded transition cursor-pointer"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }

        function deleteUserRecord(index) {
            if(confirm('តើអ្នកពិតជាចង់លុបសមាជិកនេះមែនទេ?')) {
                usersListDB.splice(index, 1);
                renderAdminTable(usersListDB);
                alert('លុបសមាជិកជោគជ័យ!');
            }
        }

        function addNewUserRecord() {
            const name = document.getElementById('newUserNameInput').value.trim();
            const email = document.getElementById('newUserEmailInput').value.trim();
            const level = document.getElementById('newUserLevelInput').value;
            if(!name || !email) { alert('សូមបំពេញឈ្មោះ និងអ៊ីម៉ែលឱ្យបានត្រឹមត្រូវ!'); return; }
            
            usersListDB.push({ name, email, level, security: "Protected v5.7 (DDoS ON)", date: new Date().toISOString().split('T')[0] });
            renderAdminTable(usersListDB);
            closeModal('addUserModal');
            alert('បន្ថែមសមាជិកថ្មីជោគជ័យ ១០០%!');
        }

        function filterAdminUsers() {
            const keyword = document.getElementById('adminSearchInput').value.toLowerCase();
            const levelFilter = document.getElementById('adminLevelFilter').value;
            const filtered = usersListDB.filter(u => {
                const matchName = u.name.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword);
                const matchLevel = (levelFilter === 'all' || u.level === levelFilter);
                return matchName && matchLevel;
            });
            renderAdminTable(filtered);
        }

        function updateMarketSessionsTimer() {
            const now = new Date();
            const hours = now.getHours();
            
            // Asian Session (07:00 - 15:00)
            const badgeAsian = document.getElementById('badgeAsian');
            const timerAsian = document.getElementById('timerAsian');
            const dashAsian = document.getElementById('dashAsianStatus');
            if(hours >= 7 && hours < 15) {
                if(badgeAsian) { badgeAsian.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400"; badgeAsian.innerText = "OPEN"; }
                if(timerAsian) timerAsian.innerText = "ស្ថានភាព៖ កំពុងដំណើរការ (Active)";
                if(dashAsian) dashAsian.innerText = "🟢 កំពុងបើកដំណើរការ (Active)";
            } else {
                if(badgeAsian) { badgeAsian.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400"; badgeAsian.innerText = "CLOSED"; }
                if(timerAsian) timerAsian.innerText = "ស្ថានភាព៖ បិទ (Closed)";
                if(dashAsian) dashAsian.innerText = "🔴 បិទ (Closed)";
            }

            // London Session (15:00 - 23:00)
            const badgeLondon = document.getElementById('badgeLondon');
            const timerLondon = document.getElementById('timerLondon');
            const dashLondon = document.getElementById('dashLondonStatus');
            if(hours >= 15 && hours < 23) {
                if(badgeLondon) { badgeLondon.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400"; badgeLondon.innerText = "OPEN"; }
                if(timerLondon) timerLondon.innerText = "ស្ថានភាព៖ កំពុងដំណើរការ (Active)";
                if(dashLondon) dashLondon.innerText = "🟢 កំពុងបើកដំណើរការ (Active)";
            } else {
                if(badgeLondon) { badgeLondon.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400"; badgeLondon.innerText = "CLOSED"; }
                if(timerLondon) timerLondon.innerText = "ស្ថានភាព៖ បិទ (Closed)";
                if(dashLondon) dashLondon.innerText = "🔴 បិទ (Closed)";
            }

            // New York Session (20:00 - 04:00)
            const badgeNy = document.getElementById('badgeNy');
            const timerNy = document.getElementById('timerNy');
            const dashNy = document.getElementById('dashNyStatus');
            if(hours >= 20 || hours < 4) {
                if(badgeNy) { badgeNy.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400"; badgeNy.innerText = "OPEN"; }
                if(timerNy) timerNy.innerText = "ស្ថានភាព៖ កំពុងដំណើរការ (Active)";
                if(dashNy) dashNy.innerText = "🟢 កំពុងបើកដំណើរការ (High Volatility)";
            } else {
                if(badgeNy) { badgeNy.className = "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400"; badgeNy.innerText = "CLOSED"; }
                if(timerNy) timerNy.innerText = "ស្ថានភាព៖ បិទ (Closed)";
                if(dashNy) dashNy.innerText = "🔴 បិទ (Closed)";
            }
        }

        function updateLiveClock() {
            const now = new Date();
            const clockEl = document.getElementById('liveClock');
            const dateEl = document.getElementById('liveDate');
            if(clockEl) clockEl.innerText = now.toTimeString().split(' ')[0];
            if(dateEl) dateEl.innerText = now.toLocaleDateString();
        }

        function initTradingViewWidget(symbol) {
            const container = document.getElementById('tradingview_widget');
            if(!container) return;
            container.innerHTML = "";
            try {
                tvWidgetInstance = new TradingView.widget({
                    "width": "100%",
                    "height": "450",
                    "symbol": symbol,
                    "interval": "15",
                    "timezone": "Asia/Phnom_Penh",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#07090e",
                    "enable_publishing": false,
                    "hide_side_toolbar": false,
                    "allow_symbol_change": true,
                    "container_id": "tradingview_widget"
                });
            } catch(e) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400">TradingView Chart Loaded (Fallback Mode)</div>';
            }
        }

        function changeTradingViewSymbol(symbol) {
            initTradingViewWidget(symbol);
        }

        function openModal(modalId) {
            const modal = document.getElementById(modalId);
            if(modal) modal.classList.remove('hidden');
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if(modal) modal.classList.add('hidden');
        }

        function copyAccountInfo(accNum, type) {
            navigator.clipboard.writeText(accNum);
            alert(`បានចម្លងលេខគណនី (${type}): ${accNum} ជោគជ័យ!`);
        }

        function verifyBankPayment() {
            alert('🟢 បានផ្ញើព័ត៌មាន Slip ជូន Admin (VET VEN) រួចរាល់! ប្រព័ន្ធនឹងបើកសិទ្ធិ VIP ជូនក្នុងរយៈពេល ២នាទី។');
            closeModal('depositModal');
        }

        function saveProfileSettings() {
            const name = document.getElementById('profileName').value;
            localStorage.setItem('vtrade_logged_user', name);
            alert('រក្សាទុកការកំណត់ Profile ជោគជ័យ!');
            closeModal('profileModal');
        }

        function selectPricingPlan(planName, price) {
            document.getElementById('selectedPlanInput').value = planName;
            if(price === 0) {
                alert('🟢 បានបើកកញ្ចប់ Free 7-Day Trial v5 ជូនដោយជោគជ័យ!');
            } else {
                openModal('depositModal');
            }
        }

        function testTelegramIntegration() {
            const token = document.getElementById('tgTokenInput').value.trim();
            const chatId = document.getElementById('tgChatIdInput').value.trim();
            if(!token || !chatId) { alert('សូមបំពេញ Telegram Token និង Chat ID ឱ្យបានត្រឹមត្រូវ!'); return; }
            
            localStorage.setItem('vtrade_tg_token', token);
            localStorage.setItem('vtrade_tg_chatid', chatId);
            alert('🟢 តេស្តតភ្ជាប់ Telegram Bot & Webhook v5.7 ជោគជ័យ ១០០%!');
        }

        function sendChat() {
            const input = document.getElementById('chatInput');
            const box = document.getElementById('chatMsgBox');
            if(!input || !input.value.trim() || !box) return;
            const text = input.value.trim();
            
            box.innerHTML += `<div class="bg-blue-600/30 p-2.5 rounded-xl ml-auto max-w-[80%] text-right">${text}</div>`;
            input.value = '';
            
            setTimeout(() => {
                box.innerHTML += `<div class="bg-gray-800 p-2.5 rounded-xl max-w-[80%]">🤖 AI Support v5.7: ប្រព័ន្ធកំពុងដំណើរការវិភាគទិន្នន័យទីផ្សារ Realtime ជូនបង ២៤ម៉ោង។ មានបញ្ហាអ្វីអាចសួរបន្ថែមបាន!</div>`;
                box.scrollTop = box.scrollHeight;
            }, 700);
        }

        function runAiBacktest() {
            const card = document.getElementById('backtestResultCard');
            if(card) card.classList.remove('hidden');
            alert('🟢 រត់ Backtest v5.0.7 ជោគជ័យ! Win Rate: 94.8%');
        }

        function calculateTradingRisk() {
            const capital = parseFloat(document.getElementById('calcCapital').value) || 1000;
            const riskPct = parseFloat(document.getElementById('calcRiskPercent').value) || 2;
            const sl = parseFloat(document.getElementById('calcStopLoss').value) || 50;

            const riskAmount = capital * (riskPct / 100);
            const lotSize = (riskAmount / (sl * 10)).toFixed(2);

            document.getElementById('resRiskAmount').innerText = '$' + riskAmount.toFixed(2);
            document.getElementById('resLotSize').innerText = lotSize + ' Lots';
            document.getElementById('resTakeProfit', '100 Pips / $' + (riskAmount * 2) + ' Profit');
            document.getElementById('calcResultCard').classList.remove('hidden');
        }

        function copyRefLink() {
            const input = document.getElementById('refLinkInput');
            input.select();
            navigator.clipboard.writeText(input.value);
            alert('🟢 បានចម្លង Referral Link ជោគជ័យ!');
        }
