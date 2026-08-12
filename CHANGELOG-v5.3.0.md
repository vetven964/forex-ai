# V TRADE AI v5.3.0 — Smart Entry + News Intelligence

## Fixed / Improved
- Unified the mobile MT5 live strip to one authoritative status line.
- Added USD high-impact Economic News Radar with CLEAR / CAUTION / NEWS LOCK / POST-NEWS states.
- Added server-side `/api/news/xauusd` endpoint with 60-second cache and safe UNAVAILABLE fallback.
- News is a risk gate, not a directional predictor; the engine never invents missing news data.
- NEWS LOCK blocks BUY/SELL entry around high-impact USD news and waits for post-news liquidity/structure confirmation.
- Added post-news confirmation mode after a recent high-impact event.
- Setup score is normalized as setup strength, with grades: WEAK, WATCH, VALID SETUP, STRONG, HIGH CONFLUENCE.
- Improved Khmer signal labels: រង់ចាំ, តាមដាន BUY/SELL, ចូល BUY/SELL.
- Radar chart now uses real engine states instead of hard-coded market scores.
- Signal table labels are more mobile-friendly and include TP1/TP2/TP3.
- Telegram auto-alert remains ENTRY ONLY by default and does not spam WAIT/WATCH states.

## Risk note
Setup score is a confluence score, not a guaranteed win rate. XAUUSD broker quotes, spreads and CFD/spot feeds can differ.
