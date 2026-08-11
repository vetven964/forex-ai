# V TRADE AI v5.2.1 — Smart Entry PRO

## Signal quality
- XAUUSD uses VT Markets MT5 broker-native feed as the authoritative source.
- Setup Score is strength, not a win-rate/probability guarantee.
- BUY/SELL confirmation now requires:
  - at least 2 of H4/H1/M15 aligned,
  - matching M5 liquidity sweep,
  - matching M5 MSS/BOS,
  - fresh broker candle data,
  - aligned FVG/OB zone,
  - score >= 65/100,
  - price inside the entry zone for confirmed entry.
- Otherwise the engine stays in WAIT/WATCH/WAIT FOR ZONE states.

## Mobile
- Compact mobile header.
- MT5/XAU/live-clock strip.
- Improved signal cards and confirmation grid.
- Mobile bottom navigation safe-area spacing.
- Dynamic sentiment detail instead of a static institutional-support claim.

## Reliability
- MT5 candle timestamps accept seconds or milliseconds and are sorted chronologically.
- MT5 quote server timestamps accept seconds or milliseconds.
- Telegram remains per-user session based; tokens are not stored in localStorage.
