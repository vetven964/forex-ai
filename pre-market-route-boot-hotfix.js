/* V-TRADE AI — Pre-Market route boot hotfix V6 */
'use strict';
const fs=require('fs');const path=require('path');const SERVER=path.join(__dirname,'server.js');const MARKER='VTRADE_PREMARKET_ROUTE_BOOT_HOTFIX_V6';
if(fs.existsSync(SERVER)){
 let source=fs.readFileSync(SERVER,'utf8');
 try{const direct=require('./pre-market-direct-route-hotfix.js');source=direct.inject(source);console.log('[V-TRADE PRE-MARKET] DIRECT MT5-FEED V7 injected before legacy routes');}catch(e){console.error('[V-TRADE PRE-MARKET] DIRECT V7 injection failed:',e.stack||e.message);throw e;}
 try{const authority=require('./pre-market-authority-route-hotfix.js');source=authority.inject(source);console.log('[V-TRADE PRE-MARKET AUTH] authoritative MT5 route injected');}catch(e){console.error('[V-TRADE PRE-MARKET AUTH] injection failed:',e.stack||e.message);throw e;}
 if(!source.includes(MARKER)){
  const anchor='const app = express();';if(!source.includes(anchor))throw new Error('server app marker not found');
  const patch=`
/* ${MARKER} */
try{require('./pre-market-candle-open-engine')(app);console.log('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ENGINE LOADED');}catch(e){console.error('[V-TRADE PRE-MARKET] LEGACY CANDLE-OPEN COMPAT ERROR:',e.stack||e.message);}
for(const alias of ['/api/pre-market/xauusd','/api/pre-market/intelligence']){app.get(alias,async(req,res)=>{try{if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');res.set('Cache-Control','no-store');res.json(await buildXauAnalysis());}catch(e){res.status(502).json({success:false,error:String(e?.message||e)});}});}
`;
  source=source.replace(anchor,anchor+patch);console.log('[V-TRADE PRE-MARKET] ROUTE BOOT HOTFIX V6 APPLIED');
 }
 fs.writeFileSync(SERVER,source,'utf8');
}
