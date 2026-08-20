/* V TRADE AI — Server-authoritative RBAC + responsive navigation */
(() => {
  if (window.__VTRADE_RBAC_GUARD__) return;
  window.__VTRADE_RBAC_GUARD__ = true;

  const BACKEND = 'https://forexai-6xw6.onrender.com';
  const file = String(location.pathname.split('/').pop() || '').toLowerCase();
  const isAdminPage = file === 'admin-dashboard.html';
  const isUserPage = file === 'premium-dashboard-live.html';
  if (!isAdminPage && !isUserPage) return;

  const token = () => window.VTRADE_CONNECTION?.token?.() ||
    sessionStorage.getItem('vtrade_auth_token') || sessionStorage.getItem('vtrade_auth') ||
    localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth') || '';

  const login = () => location.replace('connection.html?required=login');
  const user = () => location.replace('premium-dashboard-live.html?v=20260820-rbac');

  function installAdminNavigation() {
    if (!isAdminPage || document.getElementById('vtradeAdminSidebar')) return;
    const style = document.createElement('style');
    style.id = 'vtradeAdminNavStyle';
    style.textContent = `
      body.vtrade-admin-nav{padding-left:268px}
      body.vtrade-admin-nav .shell{max-width:1600px;margin:0 auto}
      #vtradeAdminSidebar{position:fixed;left:12px;top:12px;bottom:12px;width:238px;z-index:1000;display:flex;flex-direction:column;padding:16px 12px;border:1px solid #233552;border-radius:18px;background:linear-gradient(180deg,#0a1322f7,#060b14f7);box-shadow:0 20px 60px #0009;backdrop-filter:blur(18px)}
      .vta-brand{display:flex;align-items:center;gap:10px;padding:4px 6px 16px;border-bottom:1px solid #17253a;margin-bottom:10px}
      .vta-logo{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:22px;font-weight:950;background:linear-gradient(135deg,#5120ff,#aa72ff);box-shadow:0 0 26px #693cff55}
      .vta-name{font-weight:900;font-size:14px}.vta-sub{display:block;color:#8d9bb0;font-size:10px;margin-top:3px}
      .vta-nav{display:grid;gap:5px;overflow:auto}.vta-nav a{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 11px;border:1px solid transparent;border-radius:11px;color:#b8c4d6;text-decoration:none;font-weight:700;font-size:12px}.vta-nav a:hover{background:#101b2d;border-color:#233552;color:#fff}.vta-nav a.active{background:#24104f;border-color:#7041ee;color:#fff;box-shadow:inset 3px 0 #8c63ff}.vta-icon{width:20px;text-align:center;font-size:15px}.vta-bottom{margin-top:auto;padding-top:10px;border-top:1px solid #17253a}.vta-live{display:flex;align-items:center;gap:8px;padding:10px 8px;color:#22e58a;font-size:10px;font-weight:800}.vta-dot{width:7px;height:7px;border-radius:50%;background:#22e58a;box-shadow:0 0 10px #22e58a}
      #vtradeAdminMenuBtn{display:none;border:1px solid #233552;background:#0b1423;color:#fff;border-radius:11px;width:46px;height:42px;font-size:21px;cursor:pointer}
      #vtradeAdminDrawer,#vtradeAdminBottomNav,.bn-brand{display:none}
      @media(max-width:700px){
        body.vtrade-admin-nav{padding:7px;padding-bottom:92px}.top{flex-direction:row!important;align-items:center!important;min-height:62px;padding:10px 11px!important}
        body.vtrade-admin-nav .shell{width:100%;margin:0}.brand{min-width:0;flex:1}.top>.actions{display:none!important}.top #vtradeAdminMenuBtn{display:block;flex:0 0 auto}.top .brand .logo{display:none}
        #vtradeAdminSidebar{display:none}.vta-overlay{position:fixed;inset:0;background:#0008;z-index:1090;opacity:0;pointer-events:none;transition:.18s}.vta-overlay.open{opacity:1;pointer-events:auto}
        #vtradeAdminDrawer{position:fixed;top:0;right:0;bottom:0;width:min(84vw,330px);z-index:1100;display:flex;flex-direction:column;padding:18px 14px;background:#07101df9;border-left:1px solid #233552;box-shadow:-18px 0 55px #000b;transform:translateX(105%);transition:transform .2s ease;backdrop-filter:blur(18px)}
        #vtradeAdminDrawer.open{transform:translateX(0)}.vtd-head{display:flex;align-items:center;justify-content:space-between;padding:4px 5px 14px;border-bottom:1px solid #17253a}.vtd-title{font-weight:900}.vtd-close{border:1px solid #233552;background:#0b1423;color:#fff;border-radius:10px;width:40px;height:38px;font-size:20px}.vtd-nav{display:grid;gap:6px;margin-top:12px;overflow:auto}.vtd-nav a{display:flex;align-items:center;gap:11px;min-height:46px;padding:0 12px;border:1px solid #17253a;border-radius:11px;background:#09111e;color:#dbe4f3;text-decoration:none;font-weight:700}.vtd-nav a:active{background:#24104f;border-color:#7041ee}.vtd-live{margin-top:auto;padding:12px;color:#22e58a;border-top:1px solid #17253a;font-size:11px;font-weight:800}
        #vtradeAdminBottomNav{position:fixed;left:7px;right:7px;bottom:7px;height:68px;z-index:1050;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px;background:#07101df5;border:1px solid #233552;border-radius:18px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
        #vtradeAdminBottomNav a,#vtradeAdminBottomNav button{appearance:none;border:0;background:transparent;color:#9eabc0;text-decoration:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;font-weight:800;cursor:pointer}.bn-active{background:#24104f!important;color:#c6b4ff!important}.bn-brand{display:none!important}
      }
    `;
    document.head.appendChild(style);
    const sideNav=[['⌂','Admin Home','admin-dashboard.html'],['▣','Live Terminal','premium-dashboard-live.html'],['◈','Account Terminal','account-terminal.html'],['♟','Profile','profile.html']];
    const sideLinks=sideNav.map(([i,t,h])=>`<a href="${h}" class="${h==='admin-dashboard.html'?'active':''}"><span class="vta-icon">${i}</span><span>${t}</span></a>`).join('');
    const html=`<aside id="vtradeAdminSidebar"><div class="vta-brand"><div class="vta-logo">V</div><div><div class="vta-name">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div></div><nav class="vta-nav">${sideLinks}</nav><div class="vta-bottom"><div class="vta-live"><span class="vta-dot"></span> MT5 BACKEND LIVE</div></div></aside><div id="vtradeAdminOverlay" class="vta-overlay"></div><aside id="vtradeAdminDrawer"><div class="vtd-head"><div><div class="vtd-title">V TRADE AI</div><span class="vta-sub">Admin Control Center</span></div><button id="vtradeAdminClose" class="vtd-close">×</button></div><nav class="vtd-nav">${sideLinks}<a href="javascript:void(0)" id="vtradeAdminRefresh"><span>↻</span><span>Refresh</span></a><a href="javascript:void(0)" id="vtradeAdminLogout"><span>⇥</span><span>Sign out</span></a></nav><div class="vtd-live">● MT5 BACKEND LIVE</div></aside><nav id="vtradeAdminBottomNav"><a href="admin-dashboard.html"><span class="bn-icon">⌂</span><span>Home</span></a><a href="premium-dashboard-live.html"><span class="bn-icon">▣</span><span>Terminal</span></a><a href="premium-dashboard-live.html#signals"><span class="bn-icon">◈</span><span>Signals</span></a><a href="premium-dashboard-live.html#ai"><span class="bn-icon">✦</span><span>AI</span></a><button id="vtradeBottomMore"><span class="bn-icon">☰</span><span>More</span></button></nav>`;
    document.body.insertAdjacentHTML('afterbegin',html);
    const top=document.querySelector('.top'); if(top) top.insertAdjacentHTML('beforeend','<button id="vtradeAdminMenuBtn" type="button" aria-label="Open menu">☰</button>');
    const drawer=document.getElementById('vtradeAdminDrawer'),overlay=document.getElementById('vtradeAdminOverlay');
    const open=()=>{drawer.classList.add('open');overlay.classList.add('open')},close=()=>{drawer.classList.remove('open');overlay.classList.remove('open')};
    document.getElementById('vtradeAdminMenuBtn')?.addEventListener('click',open);document.getElementById('vtradeBottomMore')?.addEventListener('click',open);document.getElementById('vtradeAdminClose')?.addEventListener('click',close);overlay?.addEventListener('click',close);
    document.getElementById('vtradeAdminRefresh')?.addEventListener('click',()=>{close();document.getElementById('refresh')?.click()});document.getElementById('vtradeAdminLogout')?.addEventListener('click',()=>{close();document.getElementById('logout')?.click()});
  }

  function installTerminalResponsive(){
    if(!isUserPage || document.getElementById('vtradeTerminalResponsive')) return;
    const style=document.createElement('style'); style.id='vtradeTerminalResponsive';
    style.textContent=`
      html,body{width:100%;max-width:100%;min-width:0;overflow-x:hidden!important}*{box-sizing:border-box}.app{min-width:0!important;width:100%!important}.main{min-width:0!important;max-width:100vw!important}
      @media(max-width:900px){
        body{padding-bottom:env(safe-area-inset-bottom)!important}.top{min-height:0!important;padding:9px 10px!important;display:grid!important;grid-template-columns:42px minmax(0,1fr)!important;gap:7px!important;align-items:start!important}
        .mobile{grid-column:1;grid-row:1 / span 3!important;width:42px!important;height:42px!important;margin-top:1px!important}.pair{grid-column:2;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:4px 8px!important;align-items:center!important}.pair>div{min-width:0}.pair .price{font-size:clamp(23px,7vw,30px)!important;line-height:1!important}.pair .live{font-size:10px!important;white-space:nowrap}.backend{font-size:8px!important;padding:5px 7px!important;justify-self:end}
        .tfs{grid-column:2!important;grid-row:2!important;margin:4px 0 0!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important;width:100%!important;overflow:visible!important}.tfs button{min-width:0!important;width:100%!important;min-height:42px!important;padding:8px 4px!important;font-size:11px!important}
        .lang-row{grid-column:2!important;grid-row:3!important;display:flex!important;gap:6px!important;margin-top:3px!important}.lang-row .lang-btn{min-width:64px!important;min-height:40px!important;padding:7px 12px!important;font-size:11px!important}
        .wrap{padding:10px!important;max-width:100%!important;overflow:hidden!important}.toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) 92px!important;gap:7px!important}.api{min-width:0!important;width:100%!important}.toolbar .btn{min-width:0!important;padding:8px 10px!important}
        .cards,.radar,.gategrid,.mainrow{grid-template-columns:1fr!important}.card{min-width:0!important;padding:14px!important}.news-top,.news-grid{grid-template-columns:1fr!important}
      }
      @media(max-width:520px){
        .top{padding:8px!important}.pair{grid-template-columns:minmax(0,1fr) auto!important}.tfs{display:flex!important;overflow-x:auto!important;scrollbar-width:none!important}.tfs::-webkit-scrollbar{display:none}.tfs button{flex:1 0 54px!important}.lang-row{display:none!important}
        .wrap{padding:8px!important}.section-title h2{font-size:16px!important}.huge{font-size:30px!important}.signal-state{font-size:28px!important}
        .mobile{width:40px!important;height:40px!important}
      }
      @media(max-width:380px){
        .top{grid-template-columns:38px minmax(0,1fr)!important}.mobile{width:38px!important;height:38px!important}.pair .price{font-size:22px!important}.pair .live{font-size:9px!important}.backend{font-size:7px!important;padding:4px 6px!important}.tfs{gap:4px!important}.tfs button{flex-basis:52px!important;min-height:40px!important;font-size:10px!important}.wrap{padding:6px!important}
      }
      @media(min-width:901px){.side{width:245px!important}}
    `; document.head.appendChild(style);

    const tfs=document.querySelector('.tfs');
    if(tfs && !tfs.querySelector('[data-mobile-tf-select]')){
      const buttons=[...tfs.querySelectorAll('button')];
      const select=document.createElement('select');select.setAttribute('data-mobile-tf-select','1');select.className='vt-tf-select';
      buttons.forEach((b,i)=>{const o=document.createElement('option');o.value=b.textContent.trim();o.textContent=b.textContent.trim();o.selected=b.classList.contains('active');select.appendChild(o);});
      tfs.parentElement?.appendChild(select);
      select.addEventListener('change',()=>{const b=buttons.find(x=>x.textContent.trim()===select.value);b?.click()});
      const sync=()=>{const a=buttons.find(x=>x.classList.contains('active'));if(a)select.value=a.textContent.trim()}; new MutationObserver(sync).observe(tfs,{subtree:true,attributes:true,attributeFilter:['class']}); sync();
      const s=document.createElement('style');s.textContent=`.vt-tf-select{display:none;border:1px solid #1d2c44;background:#09111e;color:#fff;border-radius:11px;min-height:44px;padding:0 12px;font-weight:800}.vt-tf-select:focus{outline:2px solid #8050ff}@media(max-width:520px){.vt-tf-select{display:block;width:100%;margin-top:5px}.tfs{display:none!important}}`;document.head.appendChild(s);
    }

    const lang=document.querySelector('.lang-row');
    if(lang && !lang.querySelector('[data-mobile-lang-select]')){
      const buttons=[...lang.querySelectorAll('.lang-btn')]; const select=document.createElement('select');select.setAttribute('data-mobile-lang-select','1');select.className='vt-lang-select';
      buttons.forEach(b=>{const o=document.createElement('option');o.value=b.textContent.trim();o.textContent=b.textContent.trim();o.selected=b.classList.contains('active');select.appendChild(o)});
      lang.parentElement?.appendChild(select);select.addEventListener('change',()=>buttons.find(b=>b.textContent.trim()===select.value)?.click());
      const sync=()=>{const a=buttons.find(b=>b.classList.contains('active'));if(a)select.value=a.textContent.trim()};new MutationObserver(sync).observe(lang,{subtree:true,attributes:true,attributeFilter:['class']});sync();
      const s=document.createElement('style');s.textContent=`.vt-lang-select{display:none;border:1px solid #1d2c44;background:#09111e;color:#fff;border-radius:11px;min-height:40px;padding:0 12px;font-weight:800}@media(max-width:520px){.vt-lang-select{display:block;width:100%;margin-top:5px}}`;document.head.appendChild(s);
    }
  }

  async function verify(){
    const t=token(); if(!t) return login();
    try{
      const r=await fetch(BACKEND+'/api/auth/session',{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json','x-vtrade-auth':t}});
      const d=await r.json().catch(()=>({})); if(!r.ok||!d.user) return login();
      const role=String(d.user.role||'user').toLowerCase(); const language=localStorage.getItem('vtrade_lang')==='km'?'km':'en';
      sessionStorage.setItem('vtrade_user',JSON.stringify(d.user));localStorage.setItem('vtrade_lang',language);document.documentElement.lang=language;document.documentElement.dataset.role=role;
      if(isAdminPage && role!=='admin' && role!=='administrator') return user();
      if(isAdminPage) installAdminNavigation();
      if(isUserPage) installTerminalResponsive();
      window.dispatchEvent(new CustomEvent('vtrade:rbac-ready',{detail:{user:d.user,role,language}}));
    }catch(error){console.error('[V-TRADE RBAC] session verification failed:',error);login()}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',verify,{once:true}); else verify();
})();
