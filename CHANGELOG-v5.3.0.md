# V TRADE AI v5.3.0 — Smart Entry + News Intelligence

## Implemented
- Broker-native VT Markets MT5 remains the authoritative XAUUSD feed.
- Added server-side high-impact USD economic-news radar with cache.
- Added PRE-NEWS and NEWS LOCK entry protection.
- BUY/SELL entries are blocked during the configured high-impact news window; directional bias remains visible as WATCH/WAIT.
- Added `newsRisk` data to `/api/analysis/xauusd`.
- Added `/api/news/xauusd` for the dashboard/news radar.
- Telegram auto-alert polling now sends the user's server session header with each XAU analysis request.
- Telegram browser session moved to `sessionStorage`; the Bot Token remains server-only.
- Manual Telegram signal now uses the actual XAU terminal selector/current engine signal.
- Added mobile-friendly News Risk card and next-event display.
- Removed the old fake radar chart values from the active XAU sentiment visualization.
- Terminal command input is HTML-escaped before rendering.

## News configuration
Default calendar source:
`https://nfs.faireconomy.media/ff_calendar_thisweek.json`

Environment controls:
- `NEWS_CALENDAR_URL`
- `NEWS_CACHE_MS` (default 60000)
- `NEWS_PRE_MINUTES` (default 120)
- `NEWS_LOCK_BEFORE_MINUTES` (default 30)
- `NEWS_LOCK_AFTER_MINUTES` (default 15)

If the calendar is unavailable, the engine does **not** invent news events. The UI reports the news feed as unavailable.

## Important
The setup score is a setup-strength score, not a guaranteed win probability. News protection is a risk filter, not a prediction of the news outcome.
