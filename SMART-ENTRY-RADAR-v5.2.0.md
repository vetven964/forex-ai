# Smart Entry Radar v5.2.0

Signal states:
- BUY — entry confirmed inside a valid aligned zone.
- SELL — entry confirmed inside a valid aligned zone.
- WAIT FOR BUY ENTRY — bullish setup exists but price has not confirmed the entry.
- WAIT FOR SELL ENTRY — bearish setup exists but price has not confirmed the entry.
- WAIT FOR BUY ZONE / WAIT FOR SELL ZONE — directional setup exists but price is not near the zone.
- WATCH BUY / WATCH SELL — direction exists but liquidity/structure confirmation is still missing.
- NO TRADE — no sufficiently aligned setup.

The score is a setup-strength score, not a probability guarantee. It combines H4/H1/M15 structure, liquidity sweep, M5 MSS/BOS, displacement, FVG and order block evidence.
