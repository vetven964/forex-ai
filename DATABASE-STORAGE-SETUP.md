# V TRADE AI — Database / Storage Setup

## Small-server mode (recommended now)
No paid database is required. Leave `DATABASE_URL` empty. The app persists data to:

`./data/vtrade-storage.json`

The app stores throttled VT Markets XAUUSD quote snapshots and changed signal states. This is intentionally lightweight for a 1 vCPU / 2 GB server.

## PostgreSQL mode (when a database is available)
Set:

- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME`
- `DATABASE_SSL=true` for hosted databases that require TLS.

On startup the app creates the required tables automatically:

- `vtrade_quotes`
- `vtrade_signals`
- `vtrade_events` (created on first event write)

If PostgreSQL cannot be reached, the app automatically falls back to local JSON storage instead of taking the trading terminal offline.

## API

- `GET /api/storage/status` — storage mode and record counts
- `GET /api/storage/history?kind=signals&limit=50` — recent signals
- `GET /api/storage/history?kind=quotes&limit=50` — recent quotes

## Resource-saving defaults

`VTRADE_QUOTE_STORE_MS=10000` means the MT5 bridge can continue sending live data every 2 seconds, while persistence writes at most one quote snapshot every 10 seconds.
