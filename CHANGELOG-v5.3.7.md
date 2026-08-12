# V TRADE AI v5.3.7

## Stability + News Radar Fixes
- Fixed ForexFactory JSON field compatibility (`country`/`currency`) so USD high-impact events are detected correctly.
- Added a CDN fallback calendar source and configurable news cache.
- Added authenticated MT5 bridge endpoint `POST /api/v5/news/calendar` for broker-side calendar/event pushes.
- Added deterministic pre-news research metadata and scenario guidance without pretending to predict the release.
- Added `MIDWAY` phase for setups that have directional bias but do not yet meet all entry gates.
- Preserved closed-candle ICT calculations; live quote remains execution price.
- Fixed duplicate health route and version reporting.
- Dashboard now polls XAUUSD analysis every 15 seconds without overlapping requests.
- Dashboard wording no longer claims every subsystem is 100% active when News or MT5 is unavailable.
- No fake real-time candles or synthetic XAUUSD prices were added.
