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

/* VTRADE_PHONE_IDENTITY_LABEL_KILL_V2
 * Phone UI only: remove the visible VET VEN / Administrator identity card.
 * Never changes auth, RBAC, session, account, MT5, or trading state.
 */
const DASHBOARD=path.join(__dirname,'premium-dashboard-live.html');
const PHONE_MARK='VTRADE_PHONE_IDENTITY_LABEL_KILL_V2';
if(fs.existsSync(DASHBOARD)){
  let d=fs.readFileSync(DASHBOARD,'utf8');
  if(!d.includes(PHONE_MARK)){
    const js=`
<script id="${PHONE_MARK}">
(()=>{
'use strict';
if(!window.matchMedia?.('(max-width:900px)').matches)return;
const norm=e=>(e?.textContent||'').replace(/\\s+/g,' ').trim();
const isIdentity=e=>{const t=norm(e);return /\\bVET\\s+VEN\\b/i.test(t)&&/\\bAdministrator\\b/i.test(t)};
const hide=e=>{if(!e||e===document.body||e===document.documentElement||e.id==='side'||e.closest?.('.side'))return false;e.setAttribute('data-vtrade-phone-identity-label-hidden','1');e.style.setProperty('display','none','important');e.style.setProperty('visibility','hidden','important');e.style.setProperty('opacity','0','important');e.style.setProperty('pointer-events','none','important');return true};
function scan(){
  if(!window.matchMedia?.('(max-width:900px)').matches)return;
  const w=innerWidth,h=innerHeight;
  const direct=document.getElementById('profileAdminLink');
  if(direct&&!direct.closest?.('.side'))hide(direct);
  const all=[...document.querySelectorAll('body *')].filter(e=>e.id!=='side'&&!e.closest?.('.side')&&!e.hasAttribute('data-vtrade-phone-identity-label-hidden'));
  const hits=all.filter(e=>isIdentity(e));
  const candidates=[];
  for(const e of hits){
    const r=e.getBoundingClientRect?.();if(!r)continue;
    if(r.width<140||r.width>w*.98||r.height<38||r.height>280||r.left<w*.04||r.top<h*.06)continue;
    const cs=getComputedStyle(e);
    const parent=e.parentElement;
    const ptxt=norm(parent);
    const local=parent&&isIdentity(parent);
    const positioned=/^(fixed|absolute|sticky)$/.test(cs.position);
    const inTop=!!e.closest?.('.top');
    const score=(positioned?100:0)+(inTop?70:0)+(local?50:0)+(r.left>w*.35?35:0)-Math.min(40,Math.abs(r.width-260)/8);
    candidates.push({e,score,area:r.width*r.height});
  }
  candidates.sort((a,b)=>b.score-a.score||a.area-b.area);
  if(candidates[0]){hide(candidates[0].e);return;}
  // Exact-label fallback: climb from either text label to the smallest card that contains both labels.
  for(const e of all){
    const t=norm(e);
    if(!/^VET\\s+VEN$/i.test(t)&&!/^Administrator$/i.test(t))continue;
    let p=e;
    for(let i=0;i<8&&p&&p!==document.body;i++,p=p.parentElement){
      if(p.id==='side'||p.closest?.('.side'))break;
      if(!isIdentity(p))continue;
      const r=p.getBoundingClientRect?.();
      if(r&&r.width>=140&&r.width<=w*.98&&r.height>=38&&r.height<=280&&r.left>w*.04&&r.top>h*.06){hide(p);return;}
    }
  }
}
const run=()=>{scan();setTimeout(scan,80);setTimeout(scan,300);setTimeout(scan,800);setTimeout(scan,1500)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',run,{passive:true});
})();
</script>
`;
    d=d.replace('</head>',js+'</head>');
    fs.writeFileSync(DASHBOARD,d,'utf8');
    console.log('[V-TRADE PHONE] VET VEN / Administrator label card hidden on phone only');
  }
}
