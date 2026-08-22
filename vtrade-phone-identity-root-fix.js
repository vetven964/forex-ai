/* V TRADE AI — PHONE IDENTITY ROOT FIX V1
 * Root-level suppression for the floating VET VEN / Administrator card.
 * Phone only. Desktop and trading logic untouched.
 */
(()=>{
'use strict';
if(!matchMedia?.('(max-width:900px)').matches||window.__VTRADE_PHONE_IDENTITY_ROOT_V1__)return;
window.__VTRADE_PHONE_IDENTITY_ROOT_V1__=true;
const terminal=()=>/premium-dashboard-live\.html$/i.test(location.pathname.split('/').pop()||'');
const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
const identity=t=>/\bVET\s+VEN\b/i.test(t)&&/\bAdministrator\b/i.test(t);
const hide=e=>{if(!e||e===document.body||e===document.documentElement||e.id==='side'||e.closest('.side'))return false;e.dataset.vtradePhoneIdentityHidden='1';e.style.setProperty('display','none','important');e.style.setProperty('visibility','hidden','important');e.style.setProperty('pointer-events','none','important');return true};
function scan(){
 if(!terminal())return;
 const w=innerWidth,h=innerHeight;
 // Known account/profile containers.
 for(const e of document.querySelectorAll('[id*="profile" i],[class*="profile" i],[id*="account" i],[class*="account" i]')){
  if(identity(text(e))){const r=e.getBoundingClientRect();if(r.width>=180&&r.height>=45&&r.left>w*.2&&r.top>h*.2){if(hide(e))return;}}
 }
 // Start from the exact visible lower-right region shown on phone and climb to card root.
 for(const [x,y] of [[w-12,h-95],[w-20,h-135],[w-65,h-85],[w-110,h-120]]){
  for(const e of document.elementsFromPoint?.(x,y)||[]){
   let p=e;
   for(let i=0;i<14&&p&&p!==document.body;i++,p=p.parentElement){
    if(p.id==='side'||p.closest('.side'))break;
    const r=p.getBoundingClientRect();
    if(r.width<180||r.width>w*.99||r.height<45||r.height>h*.5||r.left<w*.15||r.top<h*.15)continue;
    if(identity(text(p))&&hide(p))return;
   }
  }
 }
 // Fallback: scan all visible elements for the identity and prefer the largest lower-right card.
 let best=null;
 for(const e of document.querySelectorAll('body *')){
  if(e.dataset.vtradePhoneIdentityHidden||e.id==='side'||e.closest('.side'))continue;
  if(!identity(text(e)))continue;
  const r=e.getBoundingClientRect();
  if(r.width<180||r.width>w*.99||r.height<45||r.height>h*.5||r.left<w*.15||r.top<h*.15)continue;
  const cs=getComputedStyle(e);const score=(/fixed|absolute|sticky/.test(cs.position)?100:0)+(r.left>w*.35?50:0)+(r.top>h*.3?30:0)+Math.min(20,r.width/20);
  if(!best||score>best.score)best={e,score};
 }
 if(best)hide(best.e);
}
const run=()=>{scan();setTimeout(scan,50);setTimeout(scan,250);setTimeout(scan,700)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>scan()).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',run,{passive:true});
})();