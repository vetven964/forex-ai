# XAUUSD MTF ICT v1.1 / v5.1.4

The server now calculates an analysis chain:

XAUUSD live price
→ M5/M15/H1/H4 candles
→ Liquidity Sweep
→ Market Structure Shift (MSS)
→ Break of Structure (BOS)
→ Fair Value Gap (FVG)
→ Order Block (OB)
→ Premium/Discount
→ Entry / SL / TP1 / TP2 / TP3
→ Telegram alert

## Important
- A BUY/SELL alert is emitted only when the higher-timeframe structure agrees on at least 2 of M15/H1/H4 and the M5 sweep agrees.
- Otherwise the result is WAIT.
- Entry/SL/TP are model outputs, not guaranteed market execution prices.
- The Yahoo feed is a public reference feed. For real auto-execution, replace it with the broker's authenticated XAUUSD feed and execution adapter.
- Telegram alerting is enabled; actual broker order placement is deliberately not included in this patch.

## URLs after deployment
- `/xauusd-ict.html`
- `/api/analysis/xauusd`
- `/api/market/xauusd`
- `/api/health`


## Telegram v5.1.4
End users can connect their own Telegram Bot Token and Chat ID from the website Telegram Setup tab. Tokens are not stored in browser localStorage; the server holds the active session credential only in memory. A Render restart clears active connections, so reconnect is required.
