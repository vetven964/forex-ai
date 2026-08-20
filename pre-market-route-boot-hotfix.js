/* V-TRADE AI — Pre-Market route boot hotfix V3
 * Installs the V5 direct MT5-feed route before legacy Pre-Market aliases.
 * The direct route uses brokerFeed.timeframes first and parseBrokerCandles()
 * as the authoritative MT5 candle fallback. Legacy routes remain compatibility-only.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const MARKER = 'VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V3';

if (fs.existsSync(SERVER)) {
  let source = fs.readFileSync(SERVER, 'utf8');

  try {
    const direct = require('./pre-market-direct-route-hotfix.js');
    source = direct.inject(source);
    console.log('[V-TRADE PRE-MARKET] DIRECT MT5-FEED V5 injected before legacy routes');
  } catch (e) {
    console.error('[V-TRADE PRE-MARKET] DIRECT V5 injection failed:', e.stack || e.message);
    throw e;
  }

  if (!source.includes(MARKER)) {
    const anchor = 'const app = express();';
    const patch = `
/* ${MARKER} */
// Legacy compatibility layer only. V5 direct route above is authoritative.
try {
  require('./pre-market-candle-open-engine')(app);
  console.log('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ENGINE LOADED');
} catch (e) {
  console.error('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ERROR:', e.stack || e.message);
}

for (const alias of ['/api/pre-market/xauusd', '/api/pre-market/intelligence']) {
  app.get(alias, async (req, res) => {
    try {
      if (typeof buildXauAnalysis !== 'function') throw new Error('Canonical XAUUSD analysis function unavailable');
      const out = await buildXauAnalysis();
      res.set('Cache-Control', 'no-store');
      res.json(out);
    } catch (e) {
      res.status(502).json({ success:false, error:String(e?.message || e) });
    }
  });
}
`;
    if (!source.includes(anchor)) throw new Error('server app marker not found');
    source = source.replace(anchor, anchor + patch);
    console.log('[V-TRADE PRE-MARKET] ROUTE BOOT HOTFIX V3 APPLIED');
  }

  fs.writeFileSync(SERVER, source, 'utf8');
}
