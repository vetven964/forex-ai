# V TRADE AI v5.0.7 — Security / XAUUSD audit

## Fixed in this patch
- XAUUSD entry is no longer a hardcoded fake price; frontend reads `/api/analysis/xauusd`.
- `/health` is added for Render health checks.
- Express now binds to `0.0.0.0` and respects Render `PORT`.
- Helmet security headers enabled.
- CORS is allow-listed with `ALLOWED_ORIGINS`.
- Telegram token is server-only; browser localStorage is no longer used for the bot token by the backend.
- Render uses Telegram webhook mode when `RENDER`, `APP_BASE_URL`, and `TELEGRAM_WEBHOOK_SECRET` are configured.
- Bank account numbers are removed from public HTML and moved to server environment variables.
- Fake 92%+ win-rate / fake SL / TP values are no longer presented as live XAUUSD data.
- ICT fields return `PENDING_OHLC` until a genuine multi-timeframe OHLC engine is connected.

## Important remaining work before real auto-trading
1. Add real user authentication with server-side sessions/JWT + password hashing (Argon2/bcrypt).
2. Add a database (Postgres) for users, subscriptions, audit logs, payment slips, and Telegram connections.
3. Never store broker credentials or Telegram tokens in localStorage.
4. Add a real broker/execution adapter only after explicit risk controls, idempotency, max daily loss, position limits, and manual kill switch.
5. Add multi-timeframe OHLC (1m/5m/15m/1H/4H/D1) and implement ICT rules server-side:
   MSS/BOS, liquidity sweep, displacement, FVG, order block, premium/discount, session filter.
6. Do not call a setup “AI” or publish a win-rate unless it is backed by a defined model/backtest dataset.
7. Payment verification must be server-side and should not unlock VIP from a browser-only `alert()`.

## Render variables
Set these in Render Environment, never in Git:
`APP_BASE_URL`, `ALLOWED_ORIGINS`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`,
`TELEGRAM_WEBHOOK_SECRET`, `TWELVE_DATA_API_KEY`, `BANK_NAME`,
`BANK_ACCOUNT_KHR`, `BANK_ACCOUNT_USD`.

Render recommends environment variables/secrets for credentials, and HTTP health checks can use `/health`.
