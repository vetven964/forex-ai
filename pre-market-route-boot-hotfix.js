/* V-TRADE AI — Pre-Market route boot hotfix V1
 * Fixes the production 404 by ensuring the Candle-Open MTF engine is
 * installed on the SAME Express app before server.js is required.
 * Also exposes compatibility aliases used by older dashboard builds.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const MARKER = 'VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V1';

if (fs.existsSync(SERVER)) {
  let source = fs.readFileSync(SERVER, 'utf8');
  if (!source.includes(MARKER)) {
    const anchor = "const app = express();";
    const patch = `
/* ${MARKER} */
// Install the Candle-Open MTF route before server.js continues registering
// the rest of its API. This route consumes the canonical /api/analysis/xauusd
// MT5-backed candles and returns M5/M15/H1/H4/D1 Pre-Market data.
try {
  require('./pre-market-candle-open-engine')(app);
  console.log('[V-TRADE PRE-MARKET] CANDLE-OPEN ROUTE BOOTSTRAPPED | /api/pre-market/candle-open');
} catch (e) {
  console.error('[V-TRADE PRE-MARKET] CANDLE-OPEN BOOT ERROR:', e.stack || e.message);
}

// Compatibility aliases for dashboard versions that still request the older
// Pre-Market paths. They delegate to the canonical Candle-Open route.
for (const alias of ['/api/pre-market/xauusd', '/api/pre-market/intelligence']) {
  app.get(alias, async (req, res) => {
    try {
      const host = String(process.env.INTERNAL_HOST || '127.0.0.1');
      const port = Number(process.env.PORT || 10000);
      const token = String(req.get('x-vtrade-auth') || '');
      const r = await fetch('http://' + host + ':' + port + '/api/pre-market/candle-open', {
        headers: token ? {'x-vtrade-auth': token} : {},
        signal: AbortSignal.timeout(10000)
      });
      const data = await r.json().catch(() => ({success:false,error:'Invalid Pre-Market response'}));
      return res.status(r.status).json(data);
    } catch (e) {
      console.error('[V-TRADE PRE-MARKET] alias ERROR:', e.stack || e.message);
      return res.status(502).json({success:false,error:String(e.message || e)});
    }
  });
}
`;
    if (!source.includes(anchor)) {
      throw new Error('server.js Express app anchor not found; refusing unsafe patch');
    }
    source = source.replace(anchor, anchor + patch);
    fs.writeFileSync(SERVER, source, 'utf8');
    console.log('[V-TRADE PRE-MARKET] ROUTE BOOT HOTFIX V1 APPLIED');
  }
}

module.exports = { MARKER };
