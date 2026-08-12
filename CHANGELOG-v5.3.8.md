# V TRADE AI v5.3.8 — Full Runtime Safety Audit

## Fixed
- Removed remaining client-side mock trading prices/signals from legacy helpers.
- XAUUSD analysis buttons now request the live VT Markets MT5 server analysis instead of showing hardcoded demo values.
- Removed fake order-book price/volume values from the profile page.
- Removed fake Telegram Mini App account balance.
- Added configurable API base override to auxiliary pages.
- XAUUSD remains the only live ICT execution engine; unsupported symbols no longer display static trade setups.
- News cache default reduced to 15 seconds so NEWS SOON/LIVE/POST-NEWS transitions are detected faster.
- Added state-change Telegram news alerts for verified high-impact USD events; no per-poll spam.
- Telegram entry alerts remain strict: BUY/SELL only after all confirmation gates pass and score threshold is met.
- Added stale closed-candle reason to WAIT diagnostics.
- Kept live quotes separate from closed-candle ICT calculations; no synthetic candles are generated.
- Kept NEWS CLEAR when the next verified high-impact event is outside the configured caution/lock window, while still showing it in Pre-News Research.

## Validation
- Node syntax check passed for server.js and app.js.
- Inline JavaScript syntax check passed for all HTML pages.
- No node_modules were present in the supplied archive, so a full dependency/network integration test could not be executed in this environment.
