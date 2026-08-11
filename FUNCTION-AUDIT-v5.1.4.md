# V TRADE AI v5.1.4 — Function & File Audit

## Runtime path verified

`Browser → Render Node/Express → VT Markets MT5 bridge → XAUUSD MTF ICT engine → Telegram`

### Core files

| File | Status | Notes |
|---|---|---|
| `server.js` | ✅ Active / patched | MT5 quote ingestion, MTF analysis, ICT signal, health, XAUUSD API, Telegram per-user setup/test/disconnect, optional owner fallback |
| `index.html` | ✅ Active / patched | Uses live XAUUSD API, relative API URLs, Telegram setup UI, no Telegram token localStorage |
| `xauusd-ict.html` | ✅ Active / patched | Uses live `/api/analysis/xauusd`, relative API path, MT5 freshness display |
| `render.yaml` | ✅ Active | Render Node service + health check + MT5 environment |
| `.env.example` | ✅ Updated | Telegram env vars are optional fallback |
| `README-TELEGRAM.md` | ✅ Updated | End-user BotFather/Chat ID setup |
| `RENDER-DEPLOY.md` | ✅ Updated | Render + user Telegram flow |

## MT5 / ICT functions checked

- `/api/v5/mt5/quote` — authenticated XAUUSD quote + MTF candle ingestion
- `/api/v5/mt5/status` — live/stale state
- `/api/market/xauusd` — broker-native live price
- `/api/analysis/xauusd` — M5/M15/H1/H4 → liquidity sweep → structure/MSS/BOS → FVG/OB → entry/SL/TP
- Stale feed protection — enabled
- XAU-only symbol protection — enabled
- Broker-native-only signal path — enabled
- Telegram alert deduplication — per session
- Manual Telegram signal — uses the same canonical analysis

## Telegram functions checked

- User Bot Token input — enabled
- User Chat ID input — enabled
- Token validation via Telegram `getMe` — enabled
- Chat validation via `getChat` — enabled
- Test message — enabled
- Connect/disconnect — enabled
- Token not stored in localStorage — enabled
- Optional owner/admin environment fallback — preserved
- Render restart behavior — documented: reconnect is required for in-memory user sessions

## Legacy / UI-only files

`app.js`, `script.logics.js`, `profile.html`, `login.html`, `admin-dashboard.html`, `ai-desk.html`, and `webapp.html` contain older/demo UI logic and some mock/demo actions. They are not part of the active MT5 → Render → ICT runtime path used by the current terminal. They should not be treated as authoritative trading or authentication engines.

## Important limitation

This patch makes Telegram easy and safer for individual users without adding a database. Because user Telegram credentials are held only in server memory, a Render restart clears them. A future multi-user production release should add encrypted persistent storage (for example PostgreSQL + application encryption key) and real server-side authentication before storing long-lived user integrations.

## Trading safety

BUY/SELL outputs are analytical signals, not guaranteed execution prices. The terminal should remain in WAIT when the strict MTF confirmation rules are not satisfied.
