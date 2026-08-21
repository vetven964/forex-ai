/* V TRADE AI — Pre-Market MTF v6
 * Frontend mapping hotfix:
 * - Uses the real /api/pre-market/xauusd endpoint.
 * - Loads M5/M15/H1/H4/D1 independently and aggregates them with M5=1,M15=2,H1=3,H4=4,D1=5.
 * - Never fabricates 50/50 when backend data is missing.
 * - AI remains confirmation-only; Telegram remains independent.
 */
(() => {
  if (window.__VTRADE_PREMARKET_V6__) return;
  window.__VTRADE_PREMARKET_V6__ = true;

  const TFS = ['M5','M15','H1','H4','D1'];
  const WEIGHTS = {M5:1,M15:2,H1:3,H4:4,D1:5};
  const state = {tf:'M15', rows:{}, raw:null, ai:null, news:null, busy:false, aiBusy:false};
  const $ = id => document.getElementById(id);
  const n = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => n(v)==null ? '—' : Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct = v => n(v)==null ? null : Math.max(0,Math.min(100,Math.round(Number(v))));
  const lang = () => localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en';
  const tr = (en,km) => lang()==='km' ? km : en;
  const val = (o,keys) => { for(const k of keys){ if(o?.[k]!==undefined && o?.[k]!==null && o?.[k]!=='') return o[k]; } return null; };
  const biasOf = v => { const s=String(v??'').toUpperCase(); return /BULL|BUY/.test(s)?'BULLISH':/BEAR|SELL/.test(s)?'BEARISH':'NEUTRAL'; };
  const bool = v => v===true || v===1 || String(v).toLowerCase()==='true' || String(v).toUpperCase()==='PASS';

  function api(path){
    const c=window.VTRADE_CONNECTION;
    if(!c?.fetch) throw new Error('Backend connection layer unavailable');
    return c.fetch(c.api(path),{credentials:'include',cache:'no-store'}).then(async r=>{
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d?.error||`HTTP ${r.status}`);
      return d;
    });
  }

  function style(){
    if($('vtradePreMarketV6Css')) return;
    const s=document.createElement('style'); s.id='vtradePreMarketV6Css'; s.textContent=`
#vtradePreMarket{margin-top:12px}.v6-card{background:linear-gradient(145deg,#0b1423f5,#070c15f5);border:1px solid #1d2c44;border-radius:16px;padding:16px;box-shadow:0 20px 60px #0008}.v6-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.v6-title{font-size:20px;font-weight:950}.v6-sub{color:#8493ab;font-size:11px;line-height:1.45;margin-top:4px}.v6-actions{display:flex;gap:7px;overflow:auto}.v6-btn{border:1px solid #1d2c44;background:#09111e;border-radius:10px;padding:9px 12px;min-height:42px;color:#cbd5e5;font-weight:800;white-space:nowrap}.v6-btn.active,.v6-btn.primary{background:#5827d2;border-color:#8050ff;color:#fff}.v6-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v6-box{border:1px solid #1d2c44;border-radius:13px;background:#080f1b;padding:13px;min-width:0}.v6-label{font-size:9px;color:#8493ab;text-transform:uppercase;letter-spacing:.1em}.v6-score{font-size:31px;font-weight:950;margin-top:6px}.v6-row{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:11px;align-items:flex-start}.v6-row b{text-align:right}.v6-buy{color:#22e58a}.v6-sell{color:#ff5968}.v6-neutral,.v6-wait{color:#f2c94c}.v6-pass{color:#22e58a}.v6-error{color:#ff5968}.v6-bar{height:7px;background:#18253b;border-radius:99px;overflow:hidden;margin-top:7px}.v6-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#6570ff,#35d8ff,#22e58a)}.v6-mtf{display:grid;gap:7px;margin-top:10px}.v6-mtf-row{display:grid;grid-template-columns:46px minmax(0,1fr) 78px 92px;gap:8px;align-items:center;border:1px solid #1d2c44;border-radius:10px;padding:9px;background:#080f1b;font-size:10px}.v6-mini{font-size:9px;color:#8493ab;margin-top:4px}.v6-dir{font-weight:900}.v6-gates{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.v6-gate{border:1px solid #1d2c44;border-radius:10px;padding:10px;background:#080f1b;font-size:10px}.v6-gate b{display:block;margin-top:5px}.v6-candle{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.v6-metric{border:1px solid #1d2c44;border-radius:10px;background:#080f1b;padding:10px}.v6-metric span{display:block;color:#8493ab;font-size:9px;text-transform:uppercase}.v6-metric b{display:block;font-size:13px;margin-top:6px}.v6-note{margin-top:10px;color:#8493ab;font-size:10px;line-height:1.55}.v6-news{margin-top:12px}.v6-news-list{display:grid;gap:8px;margin-top:9px}.v6-news-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:10px;padding:10px;border:1px solid #1d2c44;border-radius:10px;background:#080f1b}.v6-impact{width:8px;height:8px;border-radius:50%;margin-top:5px;background:#69788f}.v6-impact.high{background:#ff5968}.v6-impact.medium{background:#f2c94c}.v6-chip{padding:4px 7px;border:1px solid #1d2c44;border-radius:8px;font-size:9px;color:#9fb0c7;height:max-content}.v6-status{padding:10px;border:1px solid #1d2c44;border-radius:10px;background:#080f1b;color:#a9b6c9;font-size:10px;line-height:1.5}@media(max-width:900px){.v6-card{padding:14px}.v6-head{align-items:flex-start;flex-direction:column}.v6-actions{width:100%}.v6-grid{grid-template-columns:1fr}.v6-gates{grid-template-columns:repeat(2,1fr)}.v6-candle{grid-template-columns:repeat(2,1fr)}.v6-mtf-row{grid-template-columns:42px minmax(0,1fr) 62px 72px}.v6-title{font-size:18px}}@media(max-width:520px){.v6-gates{grid-template-columns:1fr 1fr}.v6-mtf-row{grid-template-columns:38px minmax(0,1fr);gap:6px}.v6-mtf-row .v6-dir,.v6-mtf-row .v6-weight{grid-column:2}.v6-candle{grid-template-columns:1fr 1fr}}
`;
    document.head.appendChild(s);
  }

  function shell(){
    style(); let host=$('vtradePreMarket'); if(host) return host;
    host=document.createElement('section'); host.id='vtradePreMarket';
    host.innerHTML=`<div class="v6-card"><div class="v6-head"><div><div class="v6-title">Pre-Market Zone Analysis</div><div class="v6-sub">${tr('Live MTF mapping · M5 → M15 → H1 → H4 → D1 · AI confirmation only · Telegram independent','Live MTF mapping · M5 → M15 → H1 → H4 → D1 · AI បញ្ជាក់ប៉ុណ្ណោះ · Telegram ដាច់ដោយឡែក')}</div></div><div class="v6-actions">${TFS.map(tf=>`<button class="v6-btn ${tf===state.tf?'active':''}" data-v6-tf="${tf}">${tf}</button>`).join('')}<button class="v6-btn primary" id="v6Analyze">Analyze AI</button></div></div><div id="v6Body"></div><div class="v6-news" id="v6News"></div></div>`;
    const wrap=document.querySelector('.wrap')||document.querySelector('.main'); if(wrap) wrap.prepend(host); else document.body.prepend(host);
    host.querySelectorAll('[data-v6-tf]').forEach(b=>b.onclick=async()=>{state.tf=b.dataset.v6Tf;host.querySelectorAll('[data-v6-tf]').forEach(x=>x.classList.toggle('active',x===b));await loadPM();});
    host.querySelector('#v6Analyze').onclick=async()=>{await loadPM();if(state.complete)await loadAI();};
    return host;
  }

  function extractNode(raw,tf){
    const root=raw?.analysis||raw?.data||raw||{}; const mtf=root.mtf||root.multiTimeframe||root.timeframes||{};
    return mtf[tf]||mtf[tf.toLowerCase()]||root[tf]||root[tf.toLowerCase()]||{};
  }
  function normalize(tf,d,rawNode){
    const x=rawNode||d?.analysis?.[tf]||{};
    const buy=pct(val(x,['buyScore','buyPct','buyStrengthPct','buyerPower','longScore','buyProbability']));
    const sell=pct(val(x,['sellScore','sellPct','sellStrengthPct','sellerPower','shortScore','sellProbability']));
    const score=pct(val(x,['directionScore','setupScore','score','confidence']));
    const bias=biasOf(val(x,['bias','direction','trend']));
    const c=x?.lastCandle||x?.candle||x?.latestCandle||(Array.isArray(x?.candles)?x.candles.at(-1):null)||(Array.isArray(x?.bars)?x.bars.at(-1):null)||{};
    const open=n(c.open??c.o??x.open),high=n(c.high??c.h??x.high),low=n(c.low??c.l??x.low),close=n(c.close??c.c??x.close??x.currentPrice??d?.price);
    const gates=x.gates||x.confirmations||d.gates||{};
    return {...d,tf,buyScore:buy,sellScore:sell,directionScore:score,bias,buyPct:buy,sellPct:sell,open,high,low,close,currentPrice:n(x.currentPrice??x.price??close),candles:Array.isArray(x.candles)?x.candles:Array.isArray(x.bars)?x.bars:[],gates};
  }

  async function loadPM(){
    if(state.busy)return; state.busy=true; state.ai=null;
    try{
      const results=await Promise.all(TFS.map(async tf=>({tf,d:await api(`/api/pre-market/xauusd?tf=${tf}`)})));
      const rows={}; for(const r of results) rows[r.tf]=normalize(r.tf,r.d,extractNode(state.raw,r.tf));
      state.rows=rows; state.complete=TFS.every(tf=>rows[tf] && rows[tf].success!==false && n(rows[tf].price)!=null);
      try{state.raw=await api('/api/analysis/xauusd'); for(const tf of TFS) rows[tf]=normalize(tf,rows[tf],extractNode(state.raw,tf));}catch(_){}
      const weighted=TFS.reduce((a,tf)=>{const r=rows[tf],w=WEIGHTS[tf],b=r?.buyScore,s=r?.sellScore;if(b!=null)a.buy+=b*w,a.bw+=w;if(s!=null)a.sell+=s*w,a.sw+=w;return a},{buy:0,sell:0,bw:0,sw:0});
      state.buy=weighted.bw?Math.round(weighted.buy/weighted.bw):null; state.sell=weighted.sw?Math.round(weighted.sell/weighted.sw):null;
      state.bias=state.buy==null&&state.sell==null?'NEUTRAL':state.buy>state.sell?'BULLISH':state.sell>state.buy?'BEARISH':'NEUTRAL';
      renderPM(); loadNews();
    }catch(e){state.complete=false;renderPM(`Pre-market mapping failed: ${String(e?.message||e)}`);}finally{state.busy=false;}
  }

  function candleStats(r){if(r?.open==null||r?.high==null||r?.low==null||r?.close==null)return null;const range=Math.max(0,r.high-r.low),body=Math.abs(r.close-r.open),upper=Math.max(0,r.high-Math.max(r.open,r.close)),lower=Math.max(0,Math.min(r.open,r.close)-r.low);const bp=range?body/range*100:0,up=range?upper/range*100:0,lo=range?lower/range*100:0;let pattern='NORMAL';if(bp<=30&&lo>=55&&up<=25)pattern='HAMMER / REJECTION';else if(bp<=30&&up>=55&&lo<=25)pattern='SHOOTING STAR / REJECTION';else if(bp<=12&&up>=35&&lo>=35)pattern='DOJI / INDECISION';else if(bp>=65)pattern=r.close>r.open?'STRONG BULLISH BODY':'STRONG BEARISH BODY';return{body,upper,lower,bp,up,lo,pattern};}
  function gate(label,v){const ok=bool(v);return `<div class="v6-gate"><span>${label}</span><b class="${ok?'v6-pass':'v6-wait'}">${ok?'PASS':'WAIT'}</b></div>`;}
  function zone(z){if(Array.isArray(z)&&z.length>=2)return `${fmt(Math.min(n(z[0]),n(z[1])))} – ${fmt(Math.max(n(z[0]),n(z[1])))}`;if(z&&n(z.low)!=null&&n(z.high)!=null)return `${fmt(Math.min(z.low,z.high))} – ${fmt(Math.max(z.low,z.high))}`;return '—';}

  function renderPM(msg=''){
    const body=$('v6Body');if(!body)return;const rows=state.rows||{},r=rows[state.tf]||{},cs=candleStats(r),g=r.gates||{};
    const buy=state.buy,sell=state.sell,bias=state.bias||'NEUTRAL';
    const bzone=val(r,['buyZone'])||r.zone?.buyZone,szone=val(r,['sellZone'])||r.zone?.sellZone;
    const mtf=TFS.map(tf=>{const x=rows[tf]||{},bp=x.buyScore,sp=x.sellScore,dir=x.bias||'NEUTRAL',ready=x.success!==false&&n(x.price)!=null;return `<div class="v6-mtf-row"><b>${tf}</b><div><div class="v6-bar"><i style="width:${bp==null?0:bp}%"></i></div><div class="v6-mini">${ready?`Price ${fmt(x.price??x.currentPrice)} · Score ${x.directionScore==null?'—':x.directionScore}`:'DATA NOT READY'}</div></div><span class="v6-dir ${dir==='BULLISH'?'v6-buy':dir==='BEARISH'?'v6-sell':'v6-neutral'}">${dir}</span><span class="v6-weight">BUY ${bp==null?'—':bp}%<br>SELL ${sp==null?'—':sp}%</span></div>`;}).join('');
    const candle=cs?`<div class="v6-candle"><div class="v6-metric"><span>Body</span><b>${fmt(cs.body)} (${Math.round(cs.bp)}%)</b></div><div class="v6-metric"><span>Upper Wick</span><b>${fmt(cs.upper)} (${Math.round(cs.up)}%)</b></div><div class="v6-metric"><span>Lower Wick</span><b>${fmt(cs.lower)} (${Math.round(cs.lo)}%)</b></div><div class="v6-metric"><span>Pattern</span><b>${esc(cs.pattern)}</b></div></div>`:`<div class="v6-status">${tr('OHLC will appear when the analysis payload exposes the selected candle. MT5 feed is mapped separately and no synthetic candle is created.','OHLC នឹងបង្ហាញពេល analysis payload ផ្ដល់ selected candle។ MT5 feed ត្រូវបាន map ដាច់ដោយឡែក ហើយមិនបង្កើត candle សិប្បនិម្មិតទេ។')}</div>`;
    const allReady=state.complete===true;
    body.innerHTML=`<div class="v6-grid"><div class="v6-box"><div class="v6-label">Pre-Market MTF Direction Strength</div><div class="v6-grid" style="margin-top:8px"><div><div class="v6-score v6-buy">${buy==null?'—':buy+'%'}</div><div class="v6-bar"><i style="width:${buy??0}%"></i></div><div class="v6-row"><span>BUY Strength</span><b class="v6-buy">${buy==null?'—':buy+'%'}</b></div></div><div><div class="v6-score v6-sell">${sell==null?'—':sell+'%'}</div><div class="v6-bar"><i style="width:${sell??0}%"></i></div><div class="v6-row"><span>SELL Strength</span><b class="v6-sell">${sell==null?'—':sell+'%'}</b></div></div></div><div class="v6-row"><span>MTF Bias</span><b class="${bias==='BULLISH'?'v6-buy':bias==='BEARISH'?'v6-sell':'v6-neutral'}">${bias}</b></div><div class="v6-row"><span>MTF processing</span><b class="${allReady?'v6-pass':'v6-wait'}">${allReady?'ALL 5 READY':'WAIT — MTF data'}</b></div><div class="v6-note">${tr('Strength is weighted directional evidence, not a win probability.','Strength គឺជាភស្តុតាងទិសដៅដែលមានទម្ងន់ មិនមែនជាភាគរយឈ្នះទេ។')}</div></div><div class="v6-box"><div class="v6-label">BUY ZONE / SELL ZONE</div><div class="v6-grid" style="margin-top:8px"><div><div class="v6-label">BUY ZONE</div><div class="v6-score v6-buy" style="font-size:22px">${zone(bzone)}</div><div class="v6-row"><span>Entry area</span><b class="v6-buy">BELOW PRICE</b></div></div><div><div class="v6-label">SELL ZONE</div><div class="v6-score v6-sell" style="font-size:22px">${zone(szone)}</div><div class="v6-row"><span>Entry area</span><b class="v6-sell">ABOVE PRICE</b></div></div></div><div class="v6-row"><span>Buyer / Seller</span><b>${buy==null||sell==null?'—':`${buy}% / ${sell}%`}</b></div><div class="v6-note">${tr('Zones come from the backend mapping. No fake 50/50 fallback is used. ICT execution gates remain authoritative.','Zone មកពី backend mapping។ មិនប្រើ fallback 50/50 សិប្បនិម្មិតទេ។ ICT execution gates នៅតែជាអ្នកសម្រេចចម្បង។')}</div></div><div class="v6-box v6-mtf"><div class="v6-label">Candle-Open MTF Processing</div>${mtf}</div><div class="v6-box"><div class="v6-label">CANDLE / WICK / PATTERN</div><div class="v6-row"><span>Selected TF</span><b>${state.tf}</b></div><div class="v6-row"><span>Wick</span><b>${cs?(cs.up>50||cs.lo>50?'LONG WICK':cs.up>25||cs.lo>25?'MEDIUM WICK':'SHORT WICK'):'—'}</b></div><div class="v6-row"><span>Pattern</span><b>${esc(cs?.pattern||'—')}</b></div>${candle}</div><div class="v6-box"><div class="v6-row"><span>Current Price</span><b>${fmt(r.price??r.currentPrice)}</b></div><div class="v6-row"><span>Execution</span><b class="v6-wait">WAIT · ${tr('Pre-market only until ICT gates pass','Pre-market ប៉ុណ្ណោះ រហូតដល់ ICT gates ជាប់')}</b></div><div class="v6-row"><span>Workflow</span><b>M5 → M15 → H1 → H4 → D1 → ICT → AI</b></div></div><div class="v6-gates">${gate('Liquidity Sweep',val(g,['liquiditySweep','liquidity','sweep']))}${gate('MSS',val(g,['mss','marketStructureShift']))}${gate('BOS',val(g,['bos','breakOfStructure']))}${gate('Displacement',val(g,['displacement','directionalDisplacement']))}${gate('FVG',val(g,['fvg','freshFvg']))}${gate('Order Block',val(g,['orderBlock','freshOb','ob']))}${gate('Premium / Discount',val(g,['premiumDiscountOk','premiumDiscount']))}${gate('Execution Zone',val(g,['executionZone','inZone','retest']))}${gate('Momentum',val(g,['technicalMomentumOk','momentum']))}${gate('Spread',val(g,['spreadOk']))}</div><div class="v6-note">${msg?`<span class="v6-error">${esc(msg)}</span><br>`:''}${tr('AI is optional confirmation after complete MTF processing. It cannot authorize an order and Telegram remains independent.','AI គ្រាន់តែជា confirmation បន្ទាប់ពី MTF ទាំង 5 Ready។ វាមិនអាចអនុញ្ញាត order បានទេ ហើយ Telegram នៅដាច់ដោយឡែក។')}</div>${state.ai?`<div class="v6-box" style="margin-top:10px;border-color:#5d3fc4"><b>AI Pre-Market Confirmation</b><div class="v6-row"><span>Decision</span><b>${esc(state.ai.decision||state.ai.verdict||'WAIT')}</b></div><div class="v6-row"><span>Confidence</span><b>${pct(state.ai.confidence??state.ai.confidence_0_100)??'—'}/100</b></div><div class="v6-row"><span>Agreement</span><b>${esc(state.ai.agreement||'NEUTRAL')}</b></div></div>`:''}`;
  }

  async function loadAI(){if(state.aiBusy||!state.complete)return;state.aiBusy=true;try{const d=await api(`/api/pre-market/ai?tf=${state.tf}`);if(d?.success===false)throw new Error(d.error||'AI confirmation unavailable');state.ai=d.ai||d;renderPM(tr('AI confirmation loaded after complete MTF processing.','AI Confirm បន្ទាប់ពី MTF ទាំង 5 Ready។'));}catch(e){state.ai={decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[String(e.message||e)]};renderPM(`AI confirmation unavailable: ${String(e.message||e)}`);}finally{state.aiBusy=false;}}
  async function loadNews(){try{state.news=await api('/api/market-news');const host=$('v6News');if(!host)return;const items=(state.news.items||[]).slice(0,8);host.innerHTML=`<div class="v6-box"><div class="v6-row"><div><b>${tr('60-Minute Macro & Breaking News','ព័ត៌មាន Macro និង Breaking News 60 នាទី')}</b><div class="v6-sub">XAUUSD impact scan · separate from Telegram</div></div><b class="v6-buy">${state.news.highImpactCount??0} HIGH</b></div><div class="v6-news-list">${items.length?items.map(x=>`<div class="v6-news-item"><span class="v6-impact ${String(x.impact||'').toLowerCase()}"></span><div><b>${esc(x.title)}</b><div class="v6-mini">${esc(x.source||'News')}</div></div><span class="v6-chip">${esc(x.impact||'LOW')}</span></div>`).join(''):`<div class="v6-note">${tr('No fresh items in the last 60 minutes.','មិនមានព័ត៌មានថ្មីក្នុង 60 នាទីចុងក្រោយ។')}</div>`}</div>`;}catch(_){} }

  function boot(){if(!/premium-dashboard-live\.html$/i.test(location.pathname))return;shell();setTimeout(()=>loadPM(),300);setInterval(()=>{if(!state.busy)loadPM();},5000);document.addEventListener('click',e=>{const b=e.target.closest('.tfs button');if(!b)return;const tf=String(b.textContent||'').trim().toUpperCase();if(TFS.includes(tf)){state.tf=tf;document.querySelectorAll('[data-v6-tf]').forEach(x=>x.classList.toggle('active',x.dataset.v6Tf===tf));setTimeout(loadPM,50);}});window.addEventListener('storage',e=>{if(e.key==='vtrade_lang')renderPM();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
