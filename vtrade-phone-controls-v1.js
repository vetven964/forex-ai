/* V TRADE AI — PHONE CONTROLS V8
 * PHONE ONLY: one timeframe selector + Analyze AI.
 * Requested: M5, M15, H1, D1. Desktop/trading logic untouched.
 */
(()=>{
'use strict';
if(!window.matchMedia||!matchMedia('(max-width:900px)').matches||window.__VTRADE_PHONE_CONTROLS_V8__)return;
window.__VTRADE_PHONE_CONTROLS_V8__=true;

const style=document.createElement('style');style.id='vtrade-phone-controls-v8-style';style.textContent=`
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
const isTerminal=()=>{const p=(location.pathname.split('/').pop()||'').toLowerCase();return /(?:premium-dashboard-live|premium-dashboard-v4|premium-dashboard|dashboard)\.html$/i.test(p)||!!document.getElementById('vtradePreMarket')};

function hideAdminCard(){
 if(!isPhone())return;
 const nodes=[...document.querySelectorAll('body *')];
 nodes.forEach(el=>{
  if(el===document.body||el.id==='vtradeMobileBar'||el.id==='side'||el.classList?.contains('vtrade-phone-hide-admin'))return;
  const text=(el.textContent||'').replace(/\s+/g,' ').trim();
  if(!/VET\s+VEN/i.test(text)||!/(Administrator|Admin)/i.test(text))return;
  if(el.closest('.side'))return;
  const r=el.getBoundingClientRect();
  if(r.width<120||r.height<45)return;
  const parent=el.parentElement;
  const own=(el.innerText||'').replace(/\s+/g,' ').trim();
  const childMatch=[...el.children].some(c=>{const t=(c.innerText||c.textContent||'').replace(/\s+/g,' ').trim();return /VET\s+VEN/i.test(t)&&/(Administrator|Admin)/i.test(t)});
  if(!childMatch && own.length<=140){el.classList.add('vtrade-phone-hide-admin');return;}
  const candidates=[el,parent,parent?.parentElement].filter(Boolean).filter(x=>!x.closest('.side'));
  const target=candidates.find(x=>{const t=(x.innerText||x.textContent||'').replace(/\s+/g,' ').trim();const q=x.getBoundingClientRect();return /VET\s+VEN/i.test(t)&&/(Administrator|Admin)/i.test(t)&&q.width>=120&&q.height>=45&&q.width<=window.innerWidth*0.9});
  if(target)target.classList.add('vtrade-phone-hide-admin');
 });
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
  button.addEventListener('click',()=>{row.querySelector(`[data-v91tf="${select.value}"]`)?.click();setTimeout(()=>{const a=pre.querySelector('#v91Analyze')||[...pre.querySelectorAll('button,a')].find(x=>/analy[sz]e\s*ai/i.test(x.textContent||''));a?.click()},120)});
  host.append(select,button);
 }
 const parent=pre.querySelector('.v91h')||pre;if(host.parentElement!==parent)parent.appendChild(host);
 const active=row.querySelector('.v91b.on')?.getAttribute('data-v91tf');const select=host.querySelector('select');if(active&&['M5','M15','H1','D1'].includes(active))select.value=active;
 return true;
}

let tries=0;
const run=()=>{if(!isPhone())return;hideAdminCard();wireTimeframe();if(tries++<120)setTimeout(run,300)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>{if(isPhone()){hideAdminCard();wireTimeframe()}}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(run,50));
})();