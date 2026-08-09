<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V TRADE AI & BOT - Advanced Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans" x-data="{ activeTab: 'dashboard', chatId: '123456', qrData: null, strategyResult: null }">

    <div class="flex h-screen overflow-hidden">
        <!-- Sidebar -->
        <div class="w-64 bg-slate-950 border-r border-slate-800 p-5 flex flex-col justify-between">
            <div>
                <h1 class="text-xl font-bold text-cyan-400 mb-8">⚡ V TRADE AI v3.0</h1>
                <nav class="space-y-2">
                    <button @click="activeTab = 'dashboard'" :class="activeTab === 'dashboard' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'" class="w-full text-left px-4 py-2.5 rounded-lg font-medium transition">📊 Dashboard & Signals</button>
                    <button @click="activeTab = 'payment'" :class="activeTab === 'payment' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'" class="w-full text-left px-4 py-2.5 rounded-lg font-medium transition">💳 KHQR Auto Payment</button>
                    <button @click="activeTab = 'strategy'" :class="activeTab === 'strategy' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'" class="w-full text-left px-4 py-2.5 rounded-lg font-medium transition">⚙️ AI Strategy Customizer</button>
                    <button @click="activeTab = 'affiliate'" :class="activeTab === 'affiliate' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'" class="w-full text-left px-4 py-2.5 rounded-lg font-medium transition">🔗 Affiliate Program</button>
                </nav>
            </div>
            <div class="text-xs text-slate-500 bg-slate-900 p-3 rounded-lg border border-slate-800">
                🛡️ Cloudflare Protected<br>🟢 Background Worker: Online
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col overflow-y-auto p-8">
            
            <!-- 1 & 5. Dashboard & Real-Time Signals -->
            <div x-show="activeTab === 'dashboard'" class="space-y-6">
                <h2 class="text-2xl font-bold">Real-Time AI Background Worker Signals</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p class="text-slate-400 text-sm">System Status</p>
                        <h3 class="text-2xl font-bold text-emerald-400 mt-1">100% Active (24/7)</h3>
                    </div>
                    <div class="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p class="text-slate-400 text-sm">VIP Membership</p>
                        <h3 class="text-2xl font-bold text-cyan-400 mt-1">Active / Verified</h3>
                    </div>
                    <div class="bg-slate-800 p-5 rounded-xl border border-slate-700">
                        <p class="text-slate-400 text-sm">Security Level</p>
                        <h3 class="text-2xl font-bold text-indigo-400 mt-1">DDoS Shield ON</h3>
                    </div>
                </div>
            </div>

            <!-- 2. KHQR Auto Payment -->
            <div x-show="activeTab === 'payment'" class="space-y-6">
                <h2 class="text-2xl font-bold">KHQR Instant API Payment</h2>
                <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md">
                    <p class="mb-4 text-slate-300">ទិញកញ្ចប់ VIP ក្នុងតម្លៃពិសេស $29/ខែ ស្កេនរួចបើកសិទ្ធិស្វ័យប្រវត្តិ។</p>
                    <button @click="alert('KHQR Generated! Scan with Mobile Banking')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition">Generate KHQR Code</button>
                </div>
            </div>

            <!-- 3. Strategy Customizer & Backtesting -->
            <div x-show="activeTab === 'strategy'" class="space-y-6">
                <h2 class="text-2xl font-bold">AI Backtesting & Strategy Customizer</h2>
                <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-lg space-y-4">
                    <div>
                        <label class="block text-sm text-slate-400 mb-1">Preferred Asset</label>
                        <select class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white">
                            <option>BTC/USDT</option>
                            <option>XAU/USD (Gold)</option>
                            <option>EUR/USD</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-slate-400 mb-1">Risk Level</label>
                        <input type="range" class="w-full accent-cyan-500" min="1" max="5" value="3">
                    </div>
                    <button @click="strategyResult = {winRate: '88.4%', trades: 94}" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition">Run Backtest & Save Strategy</button>
                    
                    <template x-if="strategyResult">
                        <div class="mt-4 p-4 bg-slate-900 rounded-lg border border-emerald-500/30 text-emerald-400">
                            <p>✅ Backtest Successful!</p>
                            <p>Estimated Win Rate: <span x-text="strategyResult.winRate" class="font-bold"></span></p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 4. Affiliate Program -->
            <div x-show="activeTab === 'affiliate'" class="space-y-6">
                <h2 class="text-2xl font-bold">Affiliate & Referral Program</h2>
                <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md space-y-4">
                    <p class="text-slate-300">ចែករំលែកតំណភ្ជាប់របស់អ្នកដើម្បីទទួលបានកម្រៃជើងសារពីមិត្តភក្តិដែលចូលរួម។</p>
                    <div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                        <span class="text-cyan-400 text-sm truncate">https://t.me/VTradeAIBot?start=REF_123456</span>
                        <button @click="alert('Copied Link!')" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs">Copy</button>
                    </div>
                </div>
            </div>

        </div>
    </div>

</body>
</html>