# V TRADE AI v5.2.0 — Smart Entry Radar + MTF ICT Signal Engine

- Reworked XAUUSD signal engine into a stateful Smart Entry Radar.
- Added BUY NOW / SELL NOW behavior only when price is inside a valid entry zone and confirmation is present.
- Added WAIT FOR BUY ENTRY / WAIT FOR SELL ENTRY / WAIT FOR BUY ZONE / WAIT FOR SELL ZONE states.
- Added MTF score components for H4, H1, M15, M5, liquidity sweep, MSS/BOS, displacement, FVG and order block.
- Added setup grade A+ / A / B / WATCH / LOW.
- Added explicit entry zone, trigger, execution timeframe and confirmation details.
- Added structure-aware TP calculation with minimum 1:2 risk/reward logic.
- Telegram auto-alert now focuses on actionable state transitions and avoids repeated WAIT spam.
- Kept broker-native VT Markets MT5 data authoritative; no silent fallback to reference feeds.
- Existing per-user Telegram token/session flow is preserved; tokens are not stored in browser localStorage.

## Important
This remains an analytical signal engine, not a guarantee of profitable trades or broker execution. User should verify broker quote, spread and risk before trading.
