# V TRADE AI v5.3.2

## Persistent Database / Storage
- Added a storage adapter with two modes:
  - PostgreSQL when `DATABASE_URL` is configured.
  - Local JSON persistence when no database is configured, so the small 1 vCPU / 2 GB deployment does not require a paid database.
- Stores throttled VT Markets MT5 XAUUSD quote snapshots.
- Stores changed AI signal states with entry/SL/TP and news state.
- Added `/api/storage/status` and `/api/storage/history`.
- Quote persistence is throttled by `VTRADE_QUOTE_STORE_MS` (default 10 seconds) to reduce disk/database writes.
- PostgreSQL pool is intentionally small for low-resource servers.

## Safety / Reliability
- Storage failure does not block the live MT5 feed or signal engine.
- Database connection failure automatically falls back to local JSON storage.
