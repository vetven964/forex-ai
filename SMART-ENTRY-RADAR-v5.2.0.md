# Smart Entry Radar v5.2.2

Signal states:
- BUY — entry confirmed inside a valid aligned zone.
- SELL — entry confirmed inside a valid aligned zone.
- WAIT FOR BUY ENTRY — bullish setup exists but price has not confirmed the entry.
- WAIT FOR SELL ENTRY — bearish setup exists but price has not confirmed the entry.
- WAIT FOR BUY ZONE / WAIT FOR SELL ZONE — directional setup exists but price is not near the zone.
- WATCH BUY / WATCH SELL — direction exists but liquidity/structure confirmation is still missing.
- NO TRADE — no sufficiently aligned setup.

The score is a setup-strength score, not a probability guarantee. It combines H4/H1/M15 structure, liquidity sweep, M5 MSS/BOS, displacement, FVG and order block evidence.

## v5.2.2 confirmation gate
For a confirmed BUY/SELL entry, the server requires fresh MT5 data, at least 2/3 aligned H4/H1/M15 structures, matching M5 liquidity sweep, matching M5 MSS/BOS, an aligned nearby FVG/OB zone, and a setup score of at least 65/100. Price must be inside the zone before the state becomes ENTRY CONFIRMED. The score is setup strength, not a win-rate guarantee.
