# V TRADE AI v5.1.6 — Telegram Auto Alert Fix

- Fixed frontend API helper compatibility (`ok`, `status`, `json()`, `text()`).
- Fixed stale Telegram session handling after a Render restart.
- Enabled state-change based Telegram auto-alerts for `WAIT`, `BUY`, and `SELL`.
- `WAIT` alerts are deduplicated and will not repeat every 30 seconds unless the signal state/levels change.
- Existing 30-second market polling triggers the server analysis endpoint while the dashboard is open.
- Added visible `AUTO ALERT: ON` indicator.

## Important limitation
Browser-driven auto-alerts require the dashboard tab to remain open. A true 24/7 alert service when the browser is closed requires server-side scheduling plus persistent encrypted storage for per-user Telegram credentials.
