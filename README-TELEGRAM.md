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
