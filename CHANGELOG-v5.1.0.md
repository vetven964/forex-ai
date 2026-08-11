# V TRADE AI v5.1.0
## XAUUSD Live Price Accuracy Upgrade
- Canonical live XAU/USD spot quote with source + freshness metadata.
- Fallback chain: XAUS -> Gold-API -> Yahoo Finance.
- No hard-coded XAUUSD price is used for the live dashboard.
- MTF ICT analysis is now the source of truth for XAUUSD signal/entry/SL/TP.
- Reject stale M5 candles (>15 minutes) for new setups.
- Reject distant FVG entries; fall back to current live price when the FVG is not near market.
- Dashboard Telegram action now calls `/api/v5/signal`.
- Dedicated XAUUSD ICT page displays price source/freshness.
- Version bumped to 5.1.0.
