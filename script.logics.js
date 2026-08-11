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

        // កែសម្រួលទិន្នន័យសញ្ញា និងតម្លៃ Entry ឱ្យមានភាពច្បាស់លាស់ និងត្រឹមត្រូវ
        let mockMarketData = {
           "XAU/USD": { direction: "STRONG BUY", winRate: "92.5%", entry: "$4,426.40", sl: "$4,226.00", tp: "$4,480 / $4,490", fvg: "BULLISH FVG", fvgZone: "0.618 Fib Support", sentiment: "86% BULLISH", rsi: "64.2 (Bullish Momentum)", macd: "Positive Histogram", orderbook: "72% Buy Orders" },
            "BTC/USDT": { direction: "STRONG BUY", winRate: "94.8%", entry: "$65,057.90", sl: "$64,100.00", tp: "$66,500 / $68,200", fvg: "BULLISH FVG", fvgZone: "0.5 - 0.618 Fib", sentiment: "88% BULLISH", rsi: "68.4 (Strong Buy)", macd: "Bullish Divergence", orderbook: "64% Buy Orders" },
            "EUR/USD": { direction: "SELL / SHORT", winRate: "89.5%", entry: "$1.0850", sl: "$1.0910", tp: "$1.0780 / $1.0720", fvg: "BEARISH FVG", fvgZone: "Premium Array 4H", sentiment: "76% BEARISH", rsi: "34.2 (Oversold Imminent)", macd: "Bearish Crossover", orderbook: "68% Sell Orders" },
            "ETH/USDT": { direction: "BUY / LONG", winRate: "92.4%", entry: "$1,919.60", sl: "$1,880.00", tp: "$1,980 / $2,050", fvg: "BULLISH FVG", fvgZone: "Order Block 15M", sentiment: "85% BULLISH", rsi: "65.0 (Bullish Momentum)", macd: "Bullish Cross", orderbook: "61% Buy Orders" }
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

        // មុខងារទាញយកតម្លៃបច្ចុប្បន្នដោយសុវត្ថិភាព និងមិនឱ្យ Error Entry Price
        async function fetchMarketPrices() {
            try {
                let res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd');
                let data = await res.json();
                if (data.bitcoin) {
                    let btcPrice = data.bitcoin.usd.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
                    document.getElementById('tickerBtc').innerText = btcPrice;
                }
                if (data.ethereum) {
                    let ethPrice = data.ethereum.usd.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
                    document.getElementById('tickerEth').innerText = ethPrice;
                }
            } catch (e) {
                console.log("Using cached fallback prices for stability.");
            }
        }

        function updateLiveClock() {
            const now = new Date();
            document.getElementById('liveClock').innerText = now.toTimeString().split(' ')[0];
            document.getElementById('liveDate').innerText = now.toLocaleDateString();
        }

        // មុខងារវិភាគ AI តាម Asset Pair ដែលបានរើស
        function runAIAnalysis() {
            const spinner = document.getElementById('btnRefreshSpinner');
            const icon = document.getElementById('btnRefreshIcon');
            spinner.style.display = 'inline-block';
            icon.style.display = 'none';

            setTimeout(() => {
                spinner.style.display = 'none';
                icon.style.display = 'inline-block';

                const pair = document.getElementById('terminalPairSelect').value;
                const info = mockMarketData[pair] || mockMarketData["XAU/USD"];

                document.getElementById('signal-direction').innerText = info.direction;
                document.getElementById('signal-entry').innerText = info.entry;
                document.getElementById('win-rate-val').innerText = info.winRate;
                document.getElementById('win-rate-bar').style.width = info.winRate;
                document.getElementById('fvg-confidence').innerText = info.fvg;
                document.getElementById('fvg-zone').innerText = info.fvgZone;
                document.getElementById('sentiment-score').innerText = info.sentiment;

                document.getElementById('rsiVal').innerText = info.rsi;
                document.getElementById('macdVal').innerText = info.macd;
                document.getElementById('orderbookVal').innerText = info.orderbook;

                // Update Table
                document.getElementById('tblAsset').innerText = pair;
                document.getElementById('tblSignalBadge').innerText = info.direction;
                document.getElementById('tblEntry').innerText = info.entry;
                document.getElementById('tblSL').innerText = info.sl;
                document.getElementById('tblTP').innerText = info.tp;

                logToTerminal(`[AI ENGINE] Scanned ${pair} successfully. Signal: ${info.direction} | Entry: ${info.entry}`);
            }, 600);
        }

        function logToTerminal(msg) {
            const logs = document.getElementById('terminal-logs');
            const timeStr = new Date().toTimeString().split(' ')[0];
            logs.innerHTML += `<div><span class="text-gray-500">[${timeStr}]</span> ${msg}</div>`;
            logs.scrollTop = logs.scrollHeight;
        }

        function clearTerminalLogs() {
            document.getElementById('terminal-logs').innerHTML = `<div><span class="text-gray-500">[SYSTEM]</span> Terminal logs cleared. Ready for execution...</div>`;
        }

        function executeTerminalCommand() {
            const input = document.getElementById('terminalCmdInput');
            if(input.value.trim() !== '') {
                logToTerminal(`<span class="text-white">[COMMAND]</span> ${input.value}`);
                logToTerminal(`<span class="text-emerald-400">[SUCCESS]</span> Command executed by VET VEN.`);
                input.value = '';
            }
        }

        function dispatchTelegramSignal() {
            const pair = document.getElementById('tblAsset').innerText;
            const entry = document.getElementById('tblEntry').innerText;
            alert(`✅ បានផ្ញើ Signal របស់ ${pair} (Entry: ${entry}) ចូល Telegram Channel ដោយជោគជ័យ!`);
            logToTerminal(`[TELEGRAM] Broadcasted signal for ${pair} at Entry ${entry}`);
        }

        function initSentimentRadarChart() {
            const ctx = document.getElementById('sentimentChartCanvas').getContext('2d');
            sentimentChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['RSI Momentum', 'MACD Trend', 'Orderbook', 'News Sentiment', 'ICT FVG', 'Volume'],
                    datasets: [{
                        label: 'Market Score',
                        data: [85, 90, 78, 88, 92, 80],
                        backgroundColor: 'rgba(168, 85, 247, 0.2)',
                        borderColor: '#a855f7',
                        borderWidth: 2,
                        pointBackgroundColor: '#a855f7'
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

        function updateMarketSessionsTimer() {
            const now = new Date();
            const hours = now.getHours();
            
            // Asian Session (7:00 - 15:00)
            const asianOpen = hours >= 7 && hours < 15;
            document.getElementById('badgeAsian').className = asianOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('badgeAsian').innerText = asianOpen ? "OPEN" : "CLOSED";
            document.getElementById('timerAsian').innerText = asianOpen ? "ស្ថានភាព៖ កំពុងដំណើរការ (Active)" : "ស្ថានភាព៖ បិទ (Closed)";
            if(document.getElementById('dashAsianStatus')) document.getElementById('dashAsianStatus').innerText = asianOpen ? "🟢 Open (Active)" : "🔴 Closed";

            // London Session (15:00 - 23:00)
            const londonOpen = hours >= 15 && hours < 23;
            document.getElementById('badgeLondon').className = londonOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('badgeLondon').innerText = londonOpen ? "OPEN" : "CLOSED";
            document.getElementById('timerLondon').innerText = londonOpen ? "ស្ថានភាព៖ កំពុងដំណើរការ (Active)" : "ស្ថានភាព៖ បិទ (Closed)";
            if(document.getElementById('dashLondonStatus')) document.getElementById('dashLondonStatus').innerText = londonOpen ? "🟢 Open (Active)" : "🔴 Closed";

            // New York Session (20:00 - 4:00)
            const nyOpen = hours >= 20 || hours < 4;
            document.getElementById('badgeNy').className = nyOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('badgeNy').innerText = nyOpen ? "OPEN" : "CLOSED";
            document.getElementById('timerNy').innerText = nyOpen ? "ស្ថានភាព៖ កំពុងដំណើរការ (Active)" : "ស្ថានភាព៖ បិទ (Closed)";
            if(document.getElementById('dashNyStatus')) document.getElementById('dashNyStatus').innerText = nyOpen ? "🟢 Open (High Volatility)" : "🔴 Closed";
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            const target = document.getElementById('tab-' + tabId);
            if(target) target.classList.add('active');

            if (tabId === 'tvchart' && !tvWidgetInstance) {
                setTimeout(() => {
                    tvWidgetInstance = new TradingView.widget({
                        "width": "100%",
                        "height": 450,
                        "symbol": "BINANCE:BTCUSDT",
                        "interval": "D",
                        "timezone": "Etc/UTC",
                        "theme": "dark",
                        "style": "1",
                        "locale": "en",
                        "toolbar_bg": "#f1f3f6",
                        "enable_publishing": false,
                        "allow_symbol_change": true,
                        "container_id": "tradingview_widget"
                    });
                }, 200);
            }
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobileMenuOverlay');
            menu.classList.toggle('hidden');
        }

        function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
        function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

        function renderAdminTable(data) {
            const tbody = document.getElementById('adminUserTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            data.forEach((u, index) => {
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-900/50">
                        <td class="p-3.5 font-bold text-white">${u.name}<br><span class="text-[10px] text-gray-500 font-normal">${u.email}</span></td>
                        <td class="p-3.5"><span class="badge bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded font-bold">${u.level}</span></td>
                        <td class="p-3.5 text-emerald-400">${u.security}</td>
                        <td class="p-3.5 text-gray-400">${u.date}</td>
                        <td class="p-3.5 text-center">
                            <button onclick="editUser(${index})" class="text-teal-400 hover:text-teal-300 font-bold px-2 py-1 bg-teal-500/10 rounded mr-1">Edit</button>
                            <button onclick="deleteUser(${index})" class="text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded">Lock</button>
                        </td>
                    </tr>
                `;
            });
        }

        function filterAdminUsers() {
            const query = document.getElementById('adminSearchInput').value.toLowerCase();
            const level = document.getElementById('adminLevelFilter').value;
            const filtered = usersListDB.filter(u => {
                const matchQuery = u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
                const matchLevel = level === 'all' || u.level.includes(level);
                return matchQuery && matchLevel;
            });
            renderAdminTable(filtered);
        }

        function addNewUserRecord() {
            const name = document.getElementById('newUserNameInput').value;
            const email = document.getElementById('newUserEmailInput').value;
            const level = document.getElementById('newUserLevelInput').value;
            if(name && email) {
                usersListDB.push({ name, email, level, security: "Protected v5.7", date: new Date().toISOString().split('T')[0] });
                renderAdminTable(usersListDB);
                closeModal('addUserModal');
                alert('បានបន្ថែមសមាជិកថ្មីដោយជោគជ័យ!');
            } else {
                alert('សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់!');
            }
        }

        function editUser(index) {
            alert(`កែសម្រួលសមាជិក៖ ${usersListDB[index].name}`);
        }

        function deleteUser(index) {
            if(confirm(`តើអ្នកពិតជាចង់ចាក់សោរ (Lock) គណនីរបស់ ${usersListDB[index].name} មែនទេ?`)) {
                usersListDB.splice(index, 1);
                renderAdminTable(usersListDB);
            }
        }

        function proceedTo2FAStep() {
            document.getElementById('loginFormSection').classList.add('hidden');
            document.getElementById('otpVerificationSection').classList.remove('hidden');
        }

        function verifyOtpAndLogin() {
            const code = document.getElementById('otpInputCode').value;
            if(code === activeOtpCode) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('vtrade_logged_user', 'VET VEN');
                alert('🎉 Login និងផ្ទៀងផ្ទាត់ 2FA ជោគជ័យ ១០០%!');
                closeModal('authModal');
                location.reload();
            } else {
                alert('លេខកូដ OTP មិនត្រឹមត្រូវ! សូមព្យាយាមម្តងទៀត (កូដគឺ 998877)');
            }
        }

        function showForgotPasswordForm() {
            document.getElementById('loginFormSection').classList.add('hidden');
            document.getElementById('forgotPasswordSection').classList.remove('hidden');
            document.getElementById('authModalTitle').innerText = "Reset Password (v5.7)";
        }

        function backToLoginForm() {
            document.getElementById('forgotPasswordSection').classList.add('hidden');
            document.getElementById('loginFormSection').classList.remove('hidden');
            document.getElementById('authModalTitle').innerText = "Login / Sign In (Cloudflare v5.7 Secured)";
        }

        function submitForgotPassword() {
            const email = document.getElementById('forgotEmailInput').value;
            if(email) {
                alert(`បានផ្ញើ Reset Link ទៅកាន់អ៊ីម៉ែល ${email} រួចរាល់ហើយ!`);
                backToLoginForm();
            } else {
                alert('សូមបញ្ចូលអ៊ីម៉ែលរបស់អ្នក!');
            }
        }

        function loginWithGoogle() {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('vtrade_logged_user', 'VET VEN');
            alert('🟢 Sign In with Google ជោគជ័យ!');
            closeModal('authModal');
            location.reload();
        }

        function togglePasswordVisibility(fieldId, iconId) {
            const field = document.getElementById(fieldId);
            const icon = document.getElementById(iconId);
            if (field.type === "password") {
                field.type = "text";
                icon.className = "fa-solid fa-eye";
            } else {
                field.type = "password";
                icon.className = "fa-solid fa-eye-slash";
            }
        }

        function saveProfileSettings() {
            const name = document.getElementById('profileName').value;
            localStorage.setItem('vtrade_logged_user', name);
            alert('រក្សាទុកការកំណត់ Profile ជោគជ័យ!');
            closeModal('profileModal');
            location.reload();
        }

        function copyAccountInfo(accNum, type) {
            navigator.clipboard.writeText(accNum);
            alert(`បាន Copy លេខគណនី ${type} (${accNum}) ជូន VET VEN ជោគជ័យ!`);
        }

        function verifyBankPayment() {
            alert('✅ បានផ្ញើព័ត៌មានទូទាត់ជូន Admin (VET VEN) រួចរាល់! ប្រព័ន្ធនឹងបើកសិទ្ធិ VIP ជូនក្នុងរយៈពេល ៥នាទី។');
            closeModal('depositModal');
        }

        function selectPricingPlan(planName, price) {
            document.getElementById('selectedPlanInput').value = planName;
            openModal('depositModal');
        }

        async function testTelegramIntegration() {
            try {
                const response = await fetch('https://forexai-6xw6.onrender.com/api/telegram/test', { method: 'POST' });
                const data = await response.json();
                if (data.success) alert('✅ Telegram Bot & Webhook ភ្ជាប់ជោគជ័យ!');
                else alert('❌ Telegram Error: ' + (data.error || 'Unknown error'));
            } catch (error) {
                alert('❌ Server មិនអាចភ្ជាប់ Telegram បានទេ។');
            }
        }

        function saveCopyTradingSettings() {
            alert('✅ រក្សាទុកការកំណត់ Copy Trading Bot ជោគជ័យ!');
        }

        function runAiSentimentScan() {
            alert('✅ AI Sentiment & Consensus Scan ថ្មីទទួលបានលទ្ធផល៖ BULLISH (82%)!');
        }

        function runAiBacktest() {
            document.getElementById('backtestResultCard').classList.remove('hidden');
        }

        function calculateTradingRisk() {
            const capital = parseFloat(document.getElementById('calcCapital').value) || 1000;
            const riskPct = parseFloat(document.getElementById('calcRiskPercent').value) || 2;
            const riskAmount = (capital * riskPct) / 100;
            document.getElementById('resRiskAmount').innerText = `$${riskAmount.toFixed(2)}`;
            document.getElementById('calcResultCard').classList.remove('hidden');
        }

        function copyRefLink() {
            const linkInput = document.getElementById('refLinkInput');
            linkInput.select();
            navigator.clipboard.writeText(linkInput.value);
            alert('✅ បាន Copy តំណភ្ជាប់ Referral ជោគជ័យ!');
        }

        function changeCurrency(curr) {
            currentCurrency = curr;
            const disp = document.getElementById('userBalanceDisplay');
            if (curr === 'KHR') {
                disp.innerText = `៛ ${(baseUsdBalance * 4100).toLocaleString()}`;
            } else if (curr === 'EUR') {
                disp.innerText = `€ ${(baseUsdBalance * 0.92).toFixed(2)}`;
            } else {
                disp.innerText = `$${baseUsdBalance.toFixed(2)}`;
            }
        }

        function changeLanguage(lang) {
            const t = translations[lang] || translations['en'];
            document.getElementById('txtBrandTitle').innerText = t.brand;
            document.getElementById('txtHeaderStatus').innerText = t.headerStatus;
            document.getElementById('btnDeposit').innerText = t.deposit;
            document.getElementById('btnAuth').innerHTML = `<i class="fa-solid fa-user-shield"></i><span>${t.auth}</span>`;
            document.getElementById('menuDashboard').innerText = t.dash;
            document.getElementById('menuSessions').innerText = t.sessions;
            document.getElementById('menuNews').innerText = t.news;
            document.getElementById('menuPricing').innerText = t.pricing;
            document.getElementById('menuTelegram').innerText = t.telegram;
            document.getElementById('menuChart').innerText = t.chart;
            document.getElementById('menuSecurity').innerText = t.security;
            document.getElementById('menuSupport').innerText = t.support;
        }

        function changeTradingViewSymbol(sym) {
            if (tvWidgetInstance) {
                tvWidgetInstance.setSymbol(sym, 'D', () => {});
            }
        }

        function sendChat() {
            const input = document.getElementById('chatInput');
            const box = document.getElementById('chatMsgBox');
            if(input.value.trim() !== '') {
                box.innerHTML += `<div class="bg-blue-600 text-white p-2.5 rounded-xl max-w-[80%] ml-auto">${input.value}</div>`;
                box.innerHTML += `<div class="bg-gray-800 p-2.5 rounded-xl max-w-[80%]">🤖 V Trade AI v5.7: បានទទួលសំណួររបស់អ្នកហើយ កំពុងដំណើរការឆ្លើយតបជូន ២៤ម៉ោង។</div>`;
                input.value = '';
                box.scrollTop = box.scrollHeight;
            }
        }
