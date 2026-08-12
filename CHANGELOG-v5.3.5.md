# V-TRADE AI v5.3.5 — Strict Real-Time Decision Engine

- Separates MTF market bias from executable BUY/SELL signals.
- Requires fresh liquidity sweep, fresh M5 MSS, directional displacement, aligned fresh FVG/OB, retest, 2/3 MTF alignment, MSS+BOS and confluence >= 80 before entry.
- Hides entry/SL/TP until an entry is actually confirmed.
- Uses recent/unmitigated FVG detection.
- Telegram auto-alert is locked to confirmed entries and all mandatory gates.
- Labels the score as Confluence, not win probability.
- Adds explicit decision reasons.

No trading system can guarantee profit or prevent losses.
