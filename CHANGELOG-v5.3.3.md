# V-TRADE AI v5.3.3

## Storage + Mobile UI Fix
- Optional PostgreSQL storage through `DATABASE_URL`.
- Automatic local JSONL fallback when no database is configured.
- Stores throttled MT5 XAUUSD quote snapshots (default every 10s).
- Stores AI analysis/signal history.
- Added `/api/storage/status` and `/api/storage/history`.
- Added storage status badge to mobile/desktop header.
- Added Noto Sans Khmer fallback for cleaner Khmer rendering.
- Clarified offline news-feed state instead of presenting it as an AI result.
- Kept MT5 broker-native feed and Telegram architecture intact.
