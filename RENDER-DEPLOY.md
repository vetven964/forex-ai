# V-TRADE AI v5.1.4 — Render + VT Markets MT5

## 1) Deploy to Render
- Create a new **Web Service** from this repository/ZIP contents.
- Build: `npm install`
- Start: `npm start`
- Health: `/health`
- Render sets `PORT` automatically; the server listens on `0.0.0.0`.

## 2) Required Render Environment Variables
- `APP_BASE_URL` = your Render URL, e.g. `https://your-service.onrender.com`
- `ALLOWED_ORIGINS` = same Render URL (comma-separated if needed)
- `MT5_BRIDGE_API_KEY` = long random secret (must match the MT5 EA input)
- `MT5_SYMBOL` = `XAUUSD` (change to your exact VT Markets symbol if your account uses a suffix)
- `MT5_MAX_AGE_MS` = `15000`
- `TELEGRAM_TOKEN` = optional owner/admin fallback bot token
- `TELEGRAM_CHAT_ID` = optional owner/admin fallback chat ID
- `TELEGRAM_WEBHOOK_SECRET` = optional; used only for the owner/admin webhook mode

### End-user Telegram
End users do **not** need to edit Render Environment Variables. They can enter their own Bot Token + Chat ID in the website's Telegram Setup tab. The token is kept server-side in memory for that active session and is never stored in browser localStorage.

## 3) MT5 WebRequest
In MT5: Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL. Add the exact Render URL.

EA URL: `https://YOUR-RENDER-SERVICE.onrender.com/api/v5/mt5/quote`

## 4) Important behavior
- VT Markets MT5 is the authoritative feed for XAUUSD price and candles.
- The ICT signal endpoint does **not** silently fall back to Yahoo/reference data.
- If the MT5 bridge is offline/stale/missing a timeframe, analysis returns `503` until the broker feed is ready.
- This prevents mixed-feed signals and stale Gold prices.

## 5) Check connection
Open:
- `/health`
- `/api/health`
- `/api/v5/mt5/status`
- `/api/market/xauusd`
- `/api/analysis/xauusd`

`/api/v5/mt5/status` should show `connected: true`.
