# V-TRADE AI v5.1.1

## VT Markets MT5 + Render
- Added broker-native MT5 bridge for XAUUSD.
- Added authenticated `/api/v5/mt5/quote` ingestion.
- Added `/api/v5/mt5/status`.
- Added Render deployment blueprint `render.yaml`.
- Added Render deployment guide `RENDER-DEPLOY.md`.
- **Changed signal engine to strict VT Markets MT5 mode:** no silent Yahoo/XAUS fallback for ICT signals.
- `/api/market/xauusd` now reports only the broker-native quote.
- Stale/offline MT5 feed blocks analysis instead of producing a potentially wrong signal.
