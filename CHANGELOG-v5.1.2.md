# V-TRADE AI v5.1.2

## VT Markets MT5 hardening
- XAUUSD signal path remains broker-native VT Markets MT5 only.
- MT5 quote ingestion now accepts `XAUUSD` with a broker suffix when `MT5_SYMBOL=XAUUSD`, while still rejecting non-XAU symbols.
- Telegram `/price` now uses the same broker-native MT5 quote instead of external spot/reference feeds.
- MT5 status exposes feed mode, authoritative flag and configured freshness window.
- Dedicated XAUUSD ICT page now shows bid/ask, spread, feed age and MT5 online/offline state.
- Removed stale-looking hard-coded XAUUSD/BTC/ETH initial dashboard values from the primary display.
