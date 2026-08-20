/* V-TRADE AI — Pre-Market route boot hotfix V2
 * FIX: install the direct MT5-feed Pre-Market route BEFORE legacy aliases.
 * The authoritative brokerFeed.timeframes populated by the MT5 bridge is used
 * for M5/M15/H1/H4; D1 remains optional/diagnostic.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const MARKER = 'VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V2';

if (fs.existsSync(SERVER)) {
  let source = fs.readFileSync(SERVER, 'utf8');

  // IMPORTANT: V4 must be injected before the legacy V1 routes are registered.
  // Express uses first-match routing, so installing V4 after V1 would leave the
  // dashboard on the old /api/pre-market/candle-open implementation.
  try {
    const direct = require('./pre-market-direct-route-hotfix.js');
    source = direct.inject(source);
    console.log('[V-TRADE PRE-MARKET] DIRECT MT5-FEED V4 injected before legacy routes');
  } catch (e) {
    console.error('[V-TRADE PRE-MARKET] DIRECT V4 injection failed:', e.stack || e.message);
    throw e;
  }

  if (!source.includes(MARKER)) {
    const anchor = "const app = express();";
    const patch = `
/* ${MARKER} */
// Legacy compatibility layer. The V4 direct route above is authoritative.
// These aliases are retained only for older dashboard builds.
try {
  require('./pre-market-candle-open-engine')(app);
  console.log('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ENGINE LOADED');
} catch (e) {
  console.error('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ERROR:', e.stack || e.message);
}

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
    console.log('[V-TRADE PRE-MARKET] ROUTE BOOT HOTFIX V2 APPLIED');
  } else {
    fs.writeFileSync(SERVER, source, 'utf8');
  }
}

module.exports = { MARKER };
