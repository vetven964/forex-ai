# V TRADE AI v5.3.1 — Khmer Signal Localization & Live Data Fixes

## Fixed
- Added Khmer labels for BUY / SELL / WAIT / WATCH BUY / WATCH SELL and readiness states.
- Localized confirmation states: MTF, Liquidity, MSS/BOS, FVG/OB and Displacement.
- Localized News Risk states and fallback messages.
- Telegram XAUUSD alerts now use Khmer-first wording while retaining English trading terms in parentheses.
- Fixed dashboard signal badge/mobile signal to use the live XAUUSD analysis instead of mock data.
- Fixed FVG, sentiment, SL and TP cards to prefer live XAUUSD analysis data when available.
- Hid the duplicate secondary MT5 LIVE ticker row on mobile.
- Kept ICT terminology (FVG, OB, MSS, BOS, MTF) visible for clarity.

## Validation
- server.js: Node syntax check PASS.
- index.html JavaScript blocks: Node syntax check PASS.
