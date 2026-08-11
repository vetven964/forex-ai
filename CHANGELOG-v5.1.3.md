# V-TRADE AI v5.1.3 — VT Markets MT5 MTF Fix

- Fixed Render ICT analysis not receiving MTF candles from the Python bridge.
- Server now accepts both `bars` (Python Bridge v2) and `timeframes` payloads.
- Server candle parser accepts both `time/open/high/low/close` and `t/o/h/l/c` formats.
- XAUUSD analysis remains broker-native and does not mix reference feeds.
- Dashboard logging/branding updated to v5.1.3.
