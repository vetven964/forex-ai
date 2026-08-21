/* V-TRADE AI — Pre-Market UI truth hotfix V3 */
'use strict';
const fs=require('fs');
const path=require('path');
const FILE=path.join(__dirname,'terminal-pre-market.js');
const MARK='VTRADE_PREMARKET_UI_TRUTH_HOTFIX_V3';
if(fs.existsSync(FILE)){
 let s=fs.readFileSync(FILE,'utf8');
 if(!s.includes(MARK)){
  const oldZone="const bzone=val(r,['buyZone'])||r.zones?.buyZone,szone=val(r,['sellZone'])||r.zones?.sellZone;";
  const newZone=`/* ${MARK} */\n    const z=r.zone||r.zones||{};\n    const bzone=val(r,['buyZone'])||z.buyZone,szone=val(r,['sellZone'])||z.sellZone;\n    const executionStatus=String(r.executionStatus||'WAIT').toUpperCase();\n    const executionReason=String(r.executionReason||'').trim();\n    const entryLabel=executionStatus==='READY'?'ENTRY READY':(bias==='BULLISH'&&bzone?'WAIT — BUY RETEST BELOW PRICE':bias==='BEARISH'&&szone?'WAIT — SELL RETEST ABOVE PRICE':'WAIT — NO VALID DIRECTIONAL ZONE');`;
  if(!s.includes(oldZone))throw new Error('pre-market zone UI anchor not found');
  s=s.replace(oldZone,newZone);
  const oldEntry=`<div class="v7-row"><span>Entry area</span><b>${r.price==null?'—':bias==='BULLISH'?'BELOW PRICE':bias==='BEARISH'?'ABOVE PRICE':'BALANCED'}</b></div>`;
  const newEntry=`<div class="v7-row"><span>Entry area</span><b>${r.price==null?'—':entryLabel}</b></div><div class="v7-row"><span>Execution</span><b class="${executionStatus==='READY'?'v7-pass':'v7-wait'}">${executionStatus}${executionReason?` · ${esc(executionReason)}`:''}</b></div>`;
  if(!s.includes(oldEntry))throw new Error('pre-market entry UI anchor not found');
  s=s.replace(oldEntry,newEntry);
  fs.writeFileSync(FILE,s,'utf8');
  console.log('[V-TRADE PRE-MARKET UI] directional zone + execution status V3 applied');
 }
}
