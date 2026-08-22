/* V TRADE AI — PHONE CONTROLS V10
 * PHONE ONLY: one timeframe selector + Analyze AI.
 * Desktop/trading logic untouched.
 * V10: deterministic removal of the floating VET VEN / Administrator identity card.
 */
(()=>{
'use strict';
if(!window.matchMedia||!matchMedia('(max-width:900px)').matches||window.__VTRADE_PHONE_CONTROLS_V10__)return;
window.__VTRADE_PHONE_CONTROLS_V10__=true;
const style=document.createElement('style');style.id='vtrade-phone-controls-v10-style';style.textContent=`
@media(max-width:900px){
 .top>.tfs,#vtradePreMarket .v91a{display:none!important}
 .vtrade-phone-tf-controls{display:flex!important;gap:8px!important;width:100%!important;max-width:100%!important;align-items:stretch!important;margin:8px 0 0!important;box-sizing:border-box!important}
 .vtrade-phone-tf-select{flex:1 1 auto!important;min-width:0!important;width:100%!important;height:48px!important;padding:0 12px!important;border:1px solid #1d2c44!important;border-radius:12px!important;background:#09111e!important;color:#f5f8ff!important;font-weight:800!important;font-size:15px!important;outline:none!important;box-sizing:border-box!important}
 .vtrade-phone-tf-button{flex:0 0 132px!important;width:132px!important;height:48px!important;border:1px solid #8050ff!important;border-radius:12px!important;background:linear-gradient(135deg,#5523c9,#7136e8)!important;color:#fff!important;font-weight:900!important;font-size:14px!important;box-sizing:border-box!important}
 .vtrade-phone-hide-admin{display:none!important;visibility:hidden!important;pointer-events:none!important}
}
@media(min-width:901px){#vtradePhoneTfHost{display:none!important}}
`;
document.head.appendChild(style);
const isPhone=()=>matchMedia('(max-width:900px)').matches;
const isTerminal=()=>{const p=(location.pathname.split('/').pop()||'').toLowerCase();return /(?:premium-dashboard-live|premium-dashboard-v4|premium-dashboard|dashboard)\\.html$/i.test(p)||!!document.getElementById('vtradePreMarket')};
function hide(el){if(!el||el===document.body||el.id==='side'||el.id==='vtradeMobileBar'||el.closest('.side'))return false;el.classList.add('vtrade-phone-hide-admin');el.setAttribute('data-vtrade-phone-admin-hidden','1');el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('pointer-events','none','important');return true}
function hideAdminCard(){
 if(!isPhone())return;
 const vw=window.innerWidth,vh=window.innerHeight;
 const textOf=el=>(el.innerText||el.textContent||'').replace(/\\s+/g,' ').trim();
 const isIdentity=t=>/\\bVET\\s+VEN\\b/i.test(t)&&/\\bAdministrator\\b/i.test(t);
 // First pass: exact card-sized containers containing BOTH identity strings.
 const cards=[];
 for(const el of document.querySelectorAll('body *')){
  if(el===document.body||el.id==='side'||el.id==='vtradeMobileBar'||el.closest('.side'))continue;
  if(el.hasAttribute('data-vtrade-phone-admin-hidden'))continue;
  const t=textOf(el);if(!isIdentity(t))continue;
  const r=el.getBoundingClientRect();
  if(r.width<220||r.width>vw*0.96||r.height<55||r.height>240)continue;
  const cs=getComputedStyle(el);
  const floating=['fixed','absolute','sticky'].includes(cs.position);
  const right=r.left>vw*0.30;
  const visible=r.bottom>0&&r.right>0&&r.left<vw&&r.top<vh;
  if(!visible)continue;
  cards.push({el,r,score:(floating?100:0)+(right?50:0)+(r.width>=250?20:0)+(r.height<=140?15:0)});
 }
 if(cards.length){cards.sort((a,b)=>b.score-a.score);hide(cards[0].el);return}
 // Second pass: find either text fragment and climb until the nearest card-sized ancestor contains both strings.
 const starts=[...document.querySelectorAll('body *')].filter(el=>{const t=textOf(el);return /\\bVET\\s+VEN\\b/i.test(t)||/\\bAdministrator\\b/i.test(t)});
 for(const start of starts){
  let p=start;
  for(let i=0;i<10&&p&&p!==document.body;i++,p=p.parentElement){
   if(p.id==='side'||p.closest('.side'))break;
   const t=textOf(p);if(!isIdentity(t))continue;
   const r=p.getBoundingClientRect();
   if(r.width>=220&&r.width<=vw*0.96&&r.height>=55&&r.height<=240&&r.left>vw*0.25){hide(p);return}
  }
 }
 // Third pass: if the identity is rendered by a shadow/custom element, hide the nearest visible host by text.
 for(const el of document.querySelectorAll('body *')){
  const t=textOf(el);if(!isIdentity(t))continue;
  const r=el.getBoundingClientRect();
  if(r.width>=180&&r.height>=45&&r.left>vw*0.25){hide(el);return}
 }
}
function wireTimeframe(){
 if(!isPhone()||!isTerminal())return false;
 const pre=document.getElementById('vtradePreMarket');if(!pre)return false;
 const row=pre.querySelector('.v91a');if(!row)return false;
 let host=document.getElementById('vtradePhoneTfHost');
 if(!host){
  host=document.createElement('div');host.id='vtradePhoneTfHost';host.className='vtrade-phone-tf-controls';
  const select=document.createElement('select');select.className='vtrade-phone-tf-select';select.setAttribute('aria-label','Timeframe');
  ['M5','M15','H1','D1'].forEach(tf=>{const o=document.createElement('option');o.value=tf;o.textContent=tf;select.appendChild(o)});
  const button=document.createElement('button');button.type='button';button.className='vtrade-phone-tf-button';button.textContent='Analyze AI';
  select.addEventListener('change',()=>row.querySelector(`[data-v91tf="${select.value}"]`)?.click());
  button.addEventListener('click',()=>{row.querySelector(`[data-v91tf="${select.value}"]`)?.click();setTimeout(()=>{const a=pre.querySelector('#v91Analyze')||[...pre.querySelectorAll('button,a')].find(x=>/analy[sz]e\\s*ai/i.test(x.textContent||''));a?.click()},120)});
  host.append(select,button);
 }
 const parent=pre.querySelector('.v91h')||pre;if(host.parentElement!==parent)parent.appendChild(host);
 const active=row.querySelector('.v91b.on')?.getAttribute('data-v91tf');const select=host.querySelector('select');if(active&&['M5','M15','H1','D1'].includes(active))select.value=active;
 return true;
}
let tries=0;const run=()=>{if(!isPhone())return;hideAdminCard();wireTimeframe();if(tries++<160)setTimeout(run,300)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>{if(isPhone()){hideAdminCard();wireTimeframe()}}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(run,50));
})();
