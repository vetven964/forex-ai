# V TRADE AI v5.2.2 — Smart Entry PRO

## Live XAUUSD
- XAU/USD dashboard analysis now calls the broker-native VT Markets MT5 `/api/analysis/xauusd` endpoint instead of displaying mock XAUUSD values.
- BUY/SELL/WAIT state, setup score, entry zone, SL and TP1/TP2/TP3 are rendered from the live server response.
- When the broker feed/API is unavailable or returns non-JSON, the UI falls back to WAIT and records the reason in the terminal log.

## Telegram reliability
- Telegram signal messages are now sent as plain text instead of Telegram Markdown, avoiding formatting/parser failures from broker symbols and dynamic ICT values.
- Per-user Bot Token handling remains server-side; the browser does not persist the token.
- Auto-alert remains ENTRY_ONLY by default and requires the configured minimum setup score.

## Safety / clarity
- Non-XAU pairs shown in the legacy terminal remain clearly labeled as reference data; they are not presented as live broker-native signals.
- Telegram Mini App wording is aligned toward XAUUSD analysis rather than implying direct BTC order execution.

## Version
- UI/server branding updated to v5.2.2.
