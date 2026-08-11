# V TRADE AI — Telegram + XAUUSD setup

## Render Environment Variables
Add these under Render → Service → Environment:

- `TELEGRAM_TOKEN` = your Telegram bot token
- `TELEGRAM_CHAT_ID` = your private chat/group/channel ID
- `TWELVE_DATA_API_KEY` = optional; if set, it is preferred for XAU/USD price

Do NOT put the Telegram token in HTML, JavaScript served to browsers, Git, or the ZIP file.

## Telegram commands
- `/start` — welcome + command list
- `/price` — current XAUUSD price
- `/signal` — current XAUUSD signal state (WAIT until a strategy triggers BUY/SELL)
- `/status` — bot/server status

## Web API
- `GET /api/market/xauusd`
- `POST /api/v5/signal`
- `GET /api/health`

Example signal POST body:

```json
{
  "symbol": "XAUUSD",
  "type": "BUY",
  "marketState": "Breakout"
}
```

The server fetches the current XAUUSD price if `price` is omitted, then sends the alert to `TELEGRAM_CHAT_ID`.


## v5.1.0 — XAUUSD price accuracy upgrade

- Removed hard-coded XAUUSD dashboard prices from the live path.
- XAUUSD spot price source order: XAUS → Gold-API → Yahoo Finance.
- Every live quote carries source/freshness metadata; stale quotes are rejected for signal generation.
- XAUUSD dashboard and the dedicated MTF ICT page now consume `/api/analysis/xauusd`.
- FVG entry is used only when it is close enough to the current live price; otherwise the engine uses the live price.
- Added `/api/v5/signal` so the Telegram dashboard button uses the same live ICT engine.
- Telegram alerts and manual dashboard signals use one canonical XAUUSD analysis result.

Important: XAUUSD is a broker/CFD instrument, so the exact executable bid/ask can differ from an indicative spot feed. For execution-grade matching, connect the terminal to the same broker feed used for orders.
