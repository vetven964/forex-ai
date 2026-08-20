# V-TRADE AI — Probability V3

## Purpose
Historical closed-candle evidence is kept separate from the deterministic MTF/ICT execution gates.

## Components
- `core/historicalProbabilityEngine.js` — similarity scan over closed candles and UP/DOWN/RANGE outcomes.
- `core/probabilityEngine.js` — fuses historical evidence with current-market directional evidence.
- `server-fixed-mtf-v2.js` from the V3 package is the prepared full-server baseline and imports `./core/probabilityEngine`.

## Safety
Historical probability is evidence only. It must not independently trigger BUY/SELL. Existing ICT/MTF/risk gates remain authoritative until walk-forward validation proves a useful threshold.

## Deployment note
The V3 server baseline is intentionally kept as a separate file until the live `server.js` integration is validated. This prevents an untested full-server replacement from breaking the current Render startup flow.
