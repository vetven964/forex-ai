/* V-TRADE AI — Pre-Market route boot hotfix V4
 * Installs the V6 direct MT5-feed route before legacy Pre-Market aliases.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER=path.join(__dirname,'server.js');
const MARKER='VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V4';
if(fs.existsSync(SERVER)){
  let source=fs.readFileSync(SERVER,'utf8');
  const direct=require('./pre-market-direct-route-hotfix.js');
  source=direct.inject(source);
  if(!source.includes(MARKER)){
    const anchor='const app = express();';
    if(!source.includes(anchor)) throw new Error('server app marker not found');
    const patch=`
/* ${MARKER} */
// Legacy compatibility layer only. V6 direct route above is authoritative.
try{require('./pre-market-candle-open-engine')(app);console.log('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ENGINE LOADED');}catch(e){console.error('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ERROR:',e.stack||e.message);}
for(const alias of ['/api/pre-market/xauusd','/api/pre-market/intelligence']){
  app.get(alias,async(req,res)=>{try{if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');res.set('Cache-Control','no-store');res.json(await buildXauAnalysis());}catch(e){res.status(502).json({success:false,error:String(e?.message||e)});}});
}
`;
    source=source.replace(anchor,anchor+patch);
    console.log('[V-TRADE PRE-MARKET] ROUTE BOOT HOTFIX V4 APPLIED');
  }
  fs.writeFileSync(SERVER,source,'utf8');
}
