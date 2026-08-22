/* V-TRADE AI — Pre-Market route boot hotfix V9 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V9';

if(fs.existsSync(SERVER)){
  let source=fs.readFileSync(SERVER,'utf8');

  // Remove legacy V8 boot block if it was previously injected.
  const legacy='/* VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V8 */';
  let start=source.indexOf(legacy);
  while(start>=0){
    const next=source.indexOf('/* VTRADE_PREMARKET_AUTHORITY_ROUTE_V4 */',start);
    if(next>=0) source=source.slice(0,start)+source.slice(next);
    else break;
    start=source.indexOf(legacy);
  }

  // Keep the direct MT5-feed transport layer; it is not an analysis engine.
  try{
    const direct=require('./pre-market-direct-route-hotfix.js');
    source=direct.inject(source);
    console.log('[V-TRADE PRE-MARKET] DIRECT MT5-FEED transport loaded');
  }catch(e){
    console.error('[V-TRADE PRE-MARKET] DIRECT MT5-FEED injection failed:',e.stack||e.message);
    throw e;
  }

  // The V4 authority route is the only canonical pre-market processing engine.
  try{
    const authority=require('./pre-market-authority-route-hotfix.js');
    source=authority.inject(source);
    console.log('[V-TRADE PRE-MARKET AUTH] SINGLE authoritative processing route loaded');
  }catch(e){
    console.error('[V-TRADE PRE-MARKET AUTH] authority injection failed:',e.stack||e.message);
    throw e;
  }

  if(!source.includes(MARKER)){
    const anchor='const app = express();';
    if(!source.includes(anchor))throw new Error('server app marker not found');
    const patch=`
/* ${MARKER} */
// Legacy Candle-Open compatibility engine intentionally disabled.
// /api/pre-market/mt5-authoritative, /api/pre-market/xauusd and
// /api/pre-market/intelligence are all served by Authority V4.
console.log('[V-TRADE PRE-MARKET] ROUTE BOOT V9: legacy processor disabled; authority is canonical');
`;
    source=source.replace(anchor,anchor+patch);
  }

  fs.writeFileSync(SERVER,source,'utf8');
}
