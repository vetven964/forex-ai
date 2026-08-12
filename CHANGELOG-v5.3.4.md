# V-TRADE AI v5.3.4 — Real-Time Decision Safety Fix

- Separates market bias from actionable BUY/SELL signal.
- Unconfirmed bullish/bearish conditions now display WAIT only.
- Added strict final entry gate requiring fresh liquidity sweep, MSS/BOS, aligned FVG/OB, price inside zone, fresh candles, and score >= 65.
- Frontend no longer converts status text containing BUY/SELL into an apparent directional signal.
- Existing server, database, MT5 bridge, and Telegram architecture preserved.
