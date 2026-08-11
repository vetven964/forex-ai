# V-TRADE AI v5.1.4

## Telegram user setup + runtime hardening

- Added per-user Telegram Bot Token + Chat ID connection from the website.
- Added Telegram `connect`, `status`, `test`, `disconnect`, and session endpoints.
- Validates Telegram bot token with `getMe` and destination chat with `getChat`.
- Removed the old fake Telegram test behavior that wrote the token to browser `localStorage`.
- Telegram tokens are kept server-side only in active session memory.
- Preserved optional Render environment Telegram credentials as an owner/admin fallback.
- XAUUSD Telegram alerts use the same broker-native VT Markets MT5 MTF ICT analysis engine.
- Added per-session Telegram alert deduplication.
- Updated frontend API calls to use relative `/api/...` paths instead of a hard-coded Render hostname.
- Updated user-facing Telegram setup instructions and function audit.
