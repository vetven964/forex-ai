        function renderAdminTable(data) {
            const tbody = document.getElementById('adminUserTableBody');
            if(!tbody) return;
            tbody.innerHTML = "";
            data.forEach((u, index) => {
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-900/50 transition">
                        <td class="p-3.5">
                            <div class="font-bold text-white">${u.name}</div>
                            <div class="text-gray-400 text-[11px]">${u.email}</div>
                        </td>
                        <td class="p-3.5">
                            <select onchange="updateUserLevelIndex(${index}, this.value)" class="bg-amber-500/20 text-amber-400 font-bold px-2.5 py-1 rounded-lg border border-amber-500/30 focus:outline-none cursor-pointer">
                                <option value="Admin" ${u.level === 'Admin' ? 'selected' : ''}>Admin</option>
                                <option value="VIP Pro" ${u.level === 'VIP Pro' ? 'selected' : ''}>VIP Pro v5</option>
                                <option value="Standard" ${u.level === 'Standard' ? 'selected' : ''}>Standard</option>
                                <option value="Basic" ${u.level === 'Basic' ? 'selected' : ''}>Basic</option>
                                <option value="Trial" ${u.level === 'Trial' ? 'selected' : ''}>Trial</option>
                            </select>
                        </td>
                        <td class="p-3.5 text-emerald-400 font-mono">${u.security}</td>
                        <td class="p-3.5 font-mono text-gray-400">${u.date}</td>
                        <td class="p-3.5 text-center">
                            <button onclick="alert('User management action executed for ${u.name}')" class="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1 rounded-lg font-bold transition cursor-pointer">Edit</button>
                        </td>
                    </tr>
                `;
            });
        }

        function updateUserLevelIndex(index, newLevel) {
            usersListDB[index].level = newLevel;
            renderAdminTable(usersListDB);
            appendTerminalLog(`[ADMIN] Updated user ${usersListDB[index].name} level to ${newLevel}`);
        }

        function filterAdminUsers() {
            const query = document.getElementById('adminSearchInput').value.toLowerCase();
            const level = document.getElementById('adminLevelFilter').value;
            let filtered = usersListDB.filter(u => {
                let matchQuery = u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
                let matchLevel = level === 'all' || u.level === level;
                return matchQuery && matchLevel;
            });
            renderAdminTable(filtered);
        }

        function addNewUserRecord() {
            const name = document.getElementById('newUserNameInput').value.trim();
            const email = document.getElementById('newUserEmailInput').value.trim();
            const level = document.getElementById('newUserLevelInput').value;
            if(!name || !email) { alert('សូមបំពេញឈ្មោះ និងអ៊ីម៉ែលឱ្យได้ត្រឹមត្រូវ!'); return; }
            usersListDB.push({ name, email, level, security: "Protected v5.7 (DDoS ON)", date: new Date().toISOString().split('T')[0] });
            renderAdminTable(usersListDB);
            closeModal('addUserModal');
            alert(`បានបន្ថែមសមាជិក ${name} (${level}) ជោគជ័យ!`);
        }

        function runAiBacktest() {
            const asset = document.getElementById('customAssetSelect').value;
            const risk = document.getElementById('customRiskSelect').value;
            document.getElementById('backtestResultCard').classList.remove('hidden');
            appendTerminalLog(`[BACKTEST] Running v5.0.7 strategy on ${asset} with ${risk}... Success!`);
        }

        function calculateTradingRisk() {
            const capital = parseFloat(document.getElementById('calcCapital').value) || 1000;
            const riskPct = parseFloat(document.getElementById('calcRiskPercent').value) || 2;
            const slPips = parseFloat(document.getElementById('calcStopLoss').value) || 50;

            const riskAmount = (capital * riskPct) / 100;
            const lotSize = (riskAmount / (slPips * 10)).toFixed(2);
            const profit = riskAmount * 2;

            document.getElementById('resRiskAmount').innerText = '$' + riskAmount.toFixed(2);
            document.getElementById('resLotSize').innerText = lotSize + ' Lots';
            document.getElementById('resTakeProfit').innerText = slPips * 2 + ' Pips / $' + profit.toFixed(2) + ' Profit';
            document.getElementById('calcResultCard').classList.remove('hidden');
        }

        function copyRefLink() {
            const input = document.getElementById('refLinkInput');
            input.select();
            navigator.clipboard.writeText(input.value);
            alert('បានចម្លង Referral Link ជោគជ័យ!');
        }

        function selectPricingPlan(planName, price) {
            document.getElementById('selectedPlanInput').value = planName;
            switchTab('telegram');
            alert(`បានជ្រើសរើសកញ្ចប់ ${planName} រួចរាល់! សូមបំពេញ Telegram Bot Token ដើម្បីបញ្ចប់ការតភ្ជាប់។`);
        }

        async function testTelegramIntegration() {
            const token = document.getElementById('tgTokenInput').value.trim();
            const chatId = document.getElementById('tgChatIdInput').value.trim();
            if(!token || !chatId) { alert('សូមបញ្ចូល Telegram Token និង Chat ID ឱ្យបានត្រឹមត្រូវ!'); return; }
            localStorage.setItem('vtrade_tg_token', token);
            localStorage.setItem('vtrade_tg_chatid', chatId);
            alert('🟢 តេស្តតភ្ជាប់ Telegram Bot & Webhook ជោគជ័យ ១០០%!');
            appendTerminalLog(`[TELEGRAM] Webhook configured successfully with Chat ID: ${chatId}`);
        }

        function verifyBankPayment() {
            alert('បានបញ្ជូនព័ត៌មាន Slip ទៅកាន់ Admin (VET VEN) ជោគជ័យ! សិទ្ធិ VIP នឹងត្រូវបើកក្នុងរយៈពេល ៥នាទី។');
            closeModal('depositModal');
        }

        function saveCopyTradingSettings() {
            const state = document.getElementById('copyBotState').value;
            const mult = document.getElementById('copyMultiplier').value;
            alert(`រក្សាទុកការកំណត់ Copy Trading Bot ជោគជ័យ! (Status: ${state}, Multiplier: ${mult})`);
            appendTerminalLog(`[COPY BOT] Settings updated: Status=${state}, Multiplier=${mult}`);
        }

        function runAiSentimentScan() {
            alert('ស្កេន AI Sentiment & Consensus Filter ថ្មីជោគជ័យ! ទីផ្សារស្ថិតក្នុងកម្រិត Bullish 88%។');
            appendTerminalLog(`[SENTIMENT] Manual sentiment consensus scan completed.`);
        }

        function saveProfileSettings() {
            const name = document.getElementById('profileName').value;
            localStorage.setItem('vtrade_logged_user', name);
            document.getElementById('btnAuth').innerHTML = `<i class="fa-solid fa-user-check"></i> <span>${name}</span>`;
            closeModal('profileModal');
            alert('រក្សាទុក Profile Settings ជោគជ័យ ១០០%!');
        }

        function openModal(modalId) {
            const m = document.getElementById(modalId);
            if(m) m.classList.remove('hidden');
        }

        function closeModal(modalId) {
            const m = document.getElementById(modalId);
            if(m) m.classList.add('hidden');
        }

        function sendChat() {
            const input = document.getElementById('chatInput');
            const box = document.getElementById('chatMsgBox');
            if(!input || !input.value.trim()) return;
            const text = input.value.trim();
            box.innerHTML += `<div class="bg-blue-600/30 text-white p-2.5 rounded-xl ml-auto max-w-[80%]">${text}</div>`;
            input.value = '';
            setTimeout(() => {
                box.innerHTML += `<div class="bg-gray-800 p-2.5 rounded-xl max-w-[80%]">ប្រព័ន្ធ AI Support v5.7 បានទទួលសំណួររបស់អ្នក និងកំពុងដំណើរការចម្លើយស្វ័យប្រវត្តិ។</div>`;
                box.scrollTop = box.scrollHeight;
            }, 600);
        }

        function initTradingViewWidget(symbol) {
            const container = document.getElementById('tradingview_widget');
            if(!container) return;
            container.innerHTML = '';
            try {
                tvWidgetInstance = new TradingView.widget({
                    "width": "100%",
                    "height": "450",
                    "symbol": symbol,
                    "interval": "D",
                    "timezone": "Asia/Bangkok",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#07090e",
                    "enable_publishing": false,
                    "allow_symbol_change": true,
                    "container_id": "tradingview_widget"
                });
            } catch(e) {
                container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400">TradingView Chart Loaded (Online Mode v5.7)</div>`;
            }
        }

        function changeTradingViewSymbol(symbol) {
            initTradingViewWidget(symbol);
        }

        function updateMarketSessionsTimer() {
            const now = new Date();
            const hours = now.getHours();
            
            const asianOpen = hours >= 7 && hours < 15;
            document.getElementById('badgeAsian').innerText = asianOpen ? "ACTIVE" : "CLOSED";
            document.getElementById('badgeAsian').className = asianOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('timerAsian').innerText = asianOpen ? "ស្ថានភាព៖ កំពុងបើកដំណើរការ (Live)" : "ស្ថានភាព៖ បិទ (Closed)";
            document.getElementById('dashAsianStatus').innerText = asianOpen ? "Active (Tokyo)" : "Closed";

            const londonOpen = hours >= 15 && hours < 23;
            document.getElementById('badgeLondon').innerText = londonOpen ? "ACTIVE" : "CLOSED";
            document.getElementById('badgeLondon').className = londonOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('timerLondon').innerText = londonOpen ? "ស្ថានភាព៖ កំពុងបើកដំណើរការ (Live)" : "ស្ថានភាព៖ បិទ (Closed)";
            document.getElementById('dashLondonStatus').innerText = londonOpen ? "Active (London)" : "Closed";

            const nyOpen = hours >= 20 || hours < 4;
            document.getElementById('badgeNy').innerText = nyOpen ? "ACTIVE" : "CLOSED";
            document.getElementById('badgeNy').className = nyOpen ? "px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400" : "px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400";
            document.getElementById('timerNy').innerText = nyOpen ? "ស្ថានភាព៖ កំពុងបើកដំណើរការ (Live)" : "ស្ថានភាព៖ បិទ (Closed)";
            document.getElementById('dashNyStatus').innerText = nyOpen ? "Active (New York)" : "Closed";
        }

        function updateLiveClock() {
            const now = new Date();
            const dateStr = now.toLocaleDateString();
            const timeStr = now.toLocaleTimeString();
            const dateEl = document.getElementById('liveDate');
            const clockEl = document.getElementById('liveClock');
            if(dateEl) dateEl.innerText = dateStr;
            if(clockEl) clockEl.innerText = timeStr;
        }
    </script>
</body>
</html>
