/* V-TRADE AI — Pre-Market UI truth hotfix V4 */
'use strict';
const fs=require('fs');
const path=require('path');

const FILE=path.join(__dirname,'terminal-pre-market.js');
const MARK='VTRADE_PREMARKET_UI_TRUTH_HOTFIX_V4';

if(!fs.existsSync(FILE)){
  console.warn('[V-TRADE PRE-MARKET UI V4] terminal-pre-market.js not found; skipping safely');
}else{
  let s=fs.readFileSync(FILE,'utf8');
  if(!s.includes(MARK)){
    /*
     * V4 fixes a UI-truth bug: bias alone must NEVER create an entry label.
     * A directional entry label requires a real buy/sell zone and, for
     * ENTRY READY, an explicit backend executionStatus=READY.
     */
    const zoneAnchor="const bzone=val(r,['buyZone'])||r.zones?.buyZone,szone=val(r,['sellZone'])||r.zones?.sellZone;";
    const zoneReplacement=`/* ${MARK} */
    const z=r.zone||r.zones||{};
    const bzone=val(r,['buyZone'])||z.buyZone;
    const szone=val(r,['sellZone'])||z.sellZone;
    const executionStatus=String(r.executionStatus||'WAIT').toUpperCase();
    const executionReason=String(r.executionReason||'').trim();
    const hasBuyZone=bzone!=null && zone(bzone)!=='—';
    const hasSellZone=szone!=null && zone(szone)!=='—';
    const entryLabel=executionStatus==='READY' && ((bias==='BULLISH'&&hasBuyZone)||(bias==='BEARISH'&&hasSellZone))
      ? 'ENTRY READY'
      : bias==='BULLISH' && hasBuyZone
        ? 'WAIT — BUY RETEST BELOW PRICE'
        : bias==='BEARISH' && hasSellZone
          ? 'WAIT — SELL RETEST ABOVE PRICE'
          : 'WAIT — NO VALID DIRECTIONAL ZONE';`;

    if(s.includes(zoneAnchor)){
      s=s.replace(zoneAnchor,zoneReplacement);
    }else{
      console.warn('[V-TRADE PRE-MARKET UI V4] zone anchor already changed or missing; continuing safely');
    }

    const entryRegex=/<div class="v7-row"><span>Entry area<\/span><b>[^<]*<\/b><\/div>/;
    const entryReplacement=`<div class="v7-row"><span>Entry area</span><b>\${r.price==null?'—':entryLabel}</b></div><div class="v7-row"><span>Execution</span><b class="\${executionStatus==='READY'?'v7-pass':'v7-wait'}">\${executionStatus}\${executionReason?\` · \${esc(executionReason)}\` : ''}</b></div>`;

    if(entryRegex.test(s)){
      s=s.replace(entryRegex,entryReplacement);
    }else{
      console.warn('[V-TRADE PRE-MARKET UI V4] entry UI anchor missing; leaving existing entry UI untouched');
    }

    fs.writeFileSync(FILE,s,'utf8');
    console.log('[V-TRADE PRE-MARKET UI] directional zone truth V4 applied');
  }
}
