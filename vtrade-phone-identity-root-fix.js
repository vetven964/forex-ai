/* V TRADE AI — PHONE IDENTITY ROOT FIX V2 */
(()=>{
'use strict';
if(!matchMedia?.('(max-width:900px)').matches||window.__VTRADE_PHONE_IDENTITY_ROOT_V2__)return;
window.__VTRADE_PHONE_IDENTITY_ROOT_V2__=true;
const terminal=()=>/premium-dashboard-live\.html$/i.test(location.pathname.split('/').pop()||'');
const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
const identity=t=>/\bVET\s+VEN\b/i.test(t)&&/\bAdministrator\b/i.test(t);
const hide=e=>{if(!e||e===document.body||e===document.documentElement||e.id==='side'||e.closest('.side'))return false;e.setAttribute('data-vtrade-phone-identity-hidden','1');e.style.setProperty('display','none','important');e.style.setProperty('visibility','hidden','important');e.style.setProperty('opacity','0','important');e.style.setProperty('pointer-events','none','important');return true};
function scan(){
 if(!terminal())return;
 const w=innerWidth,h=innerHeight;
 // Find the smallest practical container that owns BOTH visible identity labels.
 const hits=[...document.querySelectorAll('body *')].filter(e=>{if(e===document.body||e.id==='side'||e.closest('.side')||e.hasAttribute('data-vtrade-phone-identity-hidden'))return false;const t=text(e);if(!identity(t))return false;const r=e.getBoundingClientRect();return r.width>=170&&r.width<=w*.98&&r.height>=40&&r.height<=260&&r.left>w*.05&&r.top>h*.08});
 const ranked=hits.map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);const children=e.children?.length||0;return{e,r,score:(/fixed|absolute|sticky/.test(cs.position)?100:0)+(r.left>w*.35?50:0)+(r.top>h*.2?30:0)+(children<=6?25:0)-Math.min(30,children*2)-Math.abs(r.width-w*.72)/20}}).sort((a,b)=>b.score-a.score);
 if(ranked[0]){hide(ranked[0].e);return}
 // Exact text-node/element climb: this catches cards whose wrapper has no profile/account class.
 for(const e of document.querySelectorAll('body *')){
  if(!/^(VET VEN|Administrator)$/i.test(text(e)))continue;
  let p=e;
  for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){
   if(p.id==='side'||p.closest('.side'))break;
   const t=text(p),r=p.getBoundingClientRect();
   if(identity(t)&&r.width>=170&&r.width<=w*.98&&r.height>=40&&r.height<=260&&r.left>w*.05&&r.top>h*.08){hide(p);return}
  }
 }
}
const run=()=>{scan();setTimeout(scan,40);setTimeout(scan,150);setTimeout(scan,400);setTimeout(scan,1000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>scan()).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',run,{passive:true});
})();