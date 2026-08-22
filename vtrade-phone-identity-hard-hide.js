/* V TRADE AI — PHONE IDENTITY HARD HIDE V1
 * Definitive phone-only removal of the floating VET VEN / Administrator identity card.
 * Does not touch desktop, sidebar, trading data, MT5, or RBAC.
 */
(()=>{
'use strict';
if(window.__VTRADE_PHONE_IDENTITY_HARD_HIDE_V1__)return;
if(!window.matchMedia?.('(max-width:900px)').matches)return;
window.__VTRADE_PHONE_IDENTITY_HARD_HIDE_V1__=true;
const isTerminal=()=>/premium-dashboard-live\.html$/i.test(location.pathname.split('/').pop()||'');
const norm=e=>(e?.textContent||'').replace(/\s+/g,' ').trim();
const isIdentity=e=>{const t=norm(e);return /\bVET\s+VEN\b/i.test(t)&&/\bAdministrator\b/i.test(t)};
const hide=e=>{if(!e||e===document.body||e===document.documentElement||e.id==='side'||e.closest?.('.side'))return false;e.setAttribute('data-vtrade-phone-identity-hard-hidden','1');for(const p of ['display','visibility','pointer-events'])e.style.setProperty(p,p==='display'?'none':'hidden','important');return true};
function roots(root=document){const out=[];const walk=(r)=>{for(const e of r.querySelectorAll?.('*')||[]){out.push(e);if(e.shadowRoot)walk(e.shadowRoot)}};walk(root);return out}
function scan(){
 if(!isTerminal())return;
 const vw=innerWidth,vh=innerHeight;
 const all=roots();
 const matches=all.filter(e=>!e.hasAttribute('data-vtrade-phone-identity-hard-hidden')&&isIdentity(e));
 const candidates=[];
 for(const e of matches){
  if(e.id==='side'||e.closest?.('.side'))continue;
  const r=e.getBoundingClientRect?.();if(!r)continue;
  const visible=r.width>0&&r.height>0&&r.bottom>0&&r.right>0;
  if(!visible||r.width>vw*0.98||r.height>vh*0.7)continue;
  if(r.left<vw*.20||r.top<vh*.15)continue;
  const cs=getComputedStyle(e);
  const floating=['fixed','absolute','sticky'].includes(cs.position);
  const score=(floating?100:0)+(r.left>vw*.45?40:0)+(r.top>vh*.35?30:0)+Math.min(25,r.width/20);
  candidates.push({e,r,score});
 }
 if(candidates.length){
  candidates.sort((a,b)=>b.score-a.score);
  hide(candidates[0].e);
  return;
 }
 // If the card is split across elements, hide the nearest useful ancestor around the identity text.
 for(const start of matches){
  let p=start;
  for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){
   if(p.id==='side'||p.closest?.('.side'))break;
   if(!isIdentity(p))continue;
   const r=p.getBoundingClientRect?.();
   if(r&&r.width>=180&&r.width<=vw*.98&&r.height>=45&&r.height<=vh*.7&&r.left>vw*.20){hide(p);return}
  }
 }
}
const run=()=>{scan();setTimeout(scan,50);setTimeout(scan,200);setTimeout(scan,600);setTimeout(scan,1200)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>scan()).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',run,{passive:true});
})();