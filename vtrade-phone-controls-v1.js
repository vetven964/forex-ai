/* V TRADE AI — PHONE CONTROLS V4
 * Phone-only UX: one timeframe dropdown + Analyze AI button.
 * Hides duplicated header timeframe buttons and removes the VET VEN admin profile card.
 * Desktop layout and trading logic are untouched.
 */
(()=>{
'use strict';
if(!matchMedia('(max-width:900px)').matches||window.__VTRADE_PHONE_CONTROLS_V4__)return;
window.__VTRADE_PHONE_CONTROLS_V4__=true;

const style=document.createElement('style');
style.id='vtrade-phone-controls-v4-style';
style.textContent=`
@media(max-width:900px){
  .top>.tfs{display:none!important}
  .top{grid-template-rows:58px 42px!important;grid-template-areas:"menu pair price" "menu pair status"!important;min-height:112px!important;height:auto!important;padding-bottom:10px!important}
  .vtrade-phone-tf-controls{display:flex!important;gap:8px!important;width:100%!important;align-items:stretch!important;margin-top:8px!important}
  .vtrade-phone-tf-select{flex:1 1 auto!important;min-width:0!important;height:48px!important;padding:0 14px!important;border:1px solid #1d2c44!important;border-radius:12px!important;background:#09111e!important;color:#f5f8ff!important;font-weight:800!important;outline:none!important;appearance:auto!important}
  .vtrade-phone-tf-select:focus{border-color:#8050ff!important;box-shadow:0 0 0 2px #8050ff22!important}
  .vtrade-phone-tf-button{flex:0 0 132px!important;height:48px!important;border:1px solid #8050ff!important;border-radius:12px!important;background:linear-gradient(135deg,#5523c9,#7136e8)!important;color:#fff!important;font-weight:900!important}
  .vtrade-phone-tf-button:active{transform:scale(.98)!important}
  .top>.lang-row{display:none!important}
  .vtrade-phone-hide-admin{display:none!important;visibility:hidden!important;pointer-events:none!important}
  #vtradePhoneTfHost{display:block!important}
}
@media(min-width:901px){#vtradePhoneTfHost{display:none!important}}
`;
document.head.appendChild(style);

const isTerminal=()=>/premium-dashboard-live\.html$/i.test(location.pathname.split('/').pop()||'');
if(!isTerminal())return;

function hideAdminCard(){
  const top=document.querySelector('.top');
  document.querySelectorAll('body *').forEach(el=>{
    if(el===document.body||el===top||el.id==='vtradeMobileBar'||el.id==='side')return;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text.length<10||text.length>120)return;
    if(!/VET\s+VEN/i.test(text)||!/(Administrator|Admin)/i.test(text))return;
    const r=el.getBoundingClientRect();
    if(r.width<80||r.height<35)return;
    if(el.closest('.side'))return;
    if(el.classList.contains('vtrade-phone-hide-admin'))return;
    el.classList.add('vtrade-phone-hide-admin');
    el.setAttribute('data-vtrade-phone-admin-hidden','1');
  });
}

function wireTimeframe(){
  const pre=document.getElementById('vtradePreMarket');
  if(!pre)return false;
  const row=pre.querySelector('.v91a');
  if(!row)return false;
  let host=document.getElementById('vtradePhoneTfHost');
  if(!host){
    host=document.createElement('div');
    host.id='vtradePhoneTfHost';
    host.className='vtrade-phone-tf-controls';
    const select=document.createElement('select');
    select.className='vtrade-phone-tf-select';
    select.setAttribute('aria-label','Timeframe');
    ['M5','M15','H1','H4','D1'].forEach(tf=>{
      const o=document.createElement('option');o.value=tf;o.textContent=tf;select.appendChild(o);
    });
    const active=row.querySelector('.v91b.on')?.getAttribute('data-v91tf')||'M15';
    select.value=active;
    const button=document.createElement('button');
    button.type='button';button.className='vtrade-phone-tf-button';button.textContent='Analyze AI';
    button.addEventListener('click',()=>{
      const tf=select.value;
      const currentRow=document.querySelector('#vtradePreMarket .v91a');
      const target=currentRow?.querySelector(`[data-v91tf="${tf}"]`);
      if(target)target.click();
      setTimeout(()=>document.querySelector('#vtradePreMarket #v91Analyze')?.click(),100);
    });
    select.addEventListener('change',()=>{
      const tf=select.value;
      const currentRow=document.querySelector('#vtradePreMarket .v91a');
      const target=currentRow?.querySelector(`[data-v91tf="${tf}"]`);
      if(target)target.click();
    });
    host.append(select,button);
  }
  if(host.parentElement!==row.parentElement)pre.querySelector('.v91h')?.appendChild(host);
  row.style.setProperty('display','none','important');
  const active=row.querySelector('.v91b.on')?.getAttribute('data-v91tf');
  const select=host.querySelector('select');
  if(active&&select)select.value=active;
  return true;
}

let tries=0;
const run=()=>{if(!matchMedia('(max-width:900px)').matches)return;hideAdminCard();wireTimeframe();if(tries++<40)setTimeout(run,250)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>{hideAdminCard();wireTimeframe()}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(run,50));
})();