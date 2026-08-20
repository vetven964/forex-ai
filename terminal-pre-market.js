/* V TRADE AI — Pre-Market MTF v5
 * Deterministic Candle-Open M5 -> M15 -> H1 -> H4 -> D1 first.
 * AI is confirmation-only and is never allowed to authorize an order.
 * Telegram remains independent.
 */
(() => {
  if (window.__VTRADE_PREMARKET_V5__) return;
  window.__VTRADE_PREMARKET_V5__ = true;

  const TFS = ['M5','M15','H1','H4','D1'];
  const state = { tf:'M15', pm:null, news:null, ai:null, busy:false, aiBusy:false };
  const $ = id => document.getElementById(id);
  const n = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const fmt = v => n(v) == null ? '—' : Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct = v => n(v) == null ? '—' : Math.max(0,Math.min(100,Math.round(Number(v))));
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lang = () => localStorage.getItem('vtrade_lang') === 'km' ? 'km' : 'en';
  const tr = (en,km) => lang()==='km' ? km : en;
  const bool = v => v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v).toUpperCase() === 'PASS';

  function api(path) {
    const c = window.VTRADE_CONNECTION;
    if (!c?.fetch) throw new Error('Backend connection layer unavailable');
    return c.fetch(c.api(path), {credentials:'include',cache:'no-store'}).then(async r => {
      if (!r.ok) {
        let d = null; try { d = await r.json(); } catch (_) {}
        throw new Error(d?.error || `HTTP ${r.status}`);
      }
      return r.json();
    });
  }

  function style() {
    if ($('vtradePreMarketV5Css')) return;
    const s = document.createElement('style');
    s.id = 'vtradePreMarketV5Css';
    s.textContent = `
#vtradePreMarket{margin-top:12px}
.v5-card{background:linear-gradient(145deg,#0b1423f5,#070c15f5);border:1px solid #1d2c44;border-radius:16px;padding:16px;box-shadow:0 20px 60px #0008}
.v5-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.v5-title{font-size:20px;font-weight:950}.v5-sub{color:#8493ab;font-size:11px;line-height:1.45;margin-top:4px}.v5-actions{display:flex;gap:7px;align-items:center;overflow:auto;max-width:100%}.v5-btn{border:1px solid #1d2c44;background:#09111e;border-radius:10px;padding:9px 12px;min-height:42px;color:#cbd5e5;cursor:pointer;font-weight:800;white-space:nowrap}.v5-btn.active,.v5-btn.primary{background:#5827d2;border-color:#8050ff;color:#fff}.v5-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v5-box{border:1px solid #1d2c44;border-radius:13px;background:#080f1b;padding:13px;min-width:0}.v5-label{font-size:9px;color:#8493ab;text-transform:uppercase;letter-spacing:.1em}.v5-score{font-size:31px;font-weight:950;margin-top:6px}.v5-row{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:11px;align-items:flex-start}.v5-row b{text-align:right}.v5-bar{height:7px;background:#18253b;border-radius:99px;overflow:hidden;margin-top:7px}.v5-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#6570ff,#35d8ff,#22e58a)}.v5-buy{color:#22e58a}.v5-sell{color:#ff5968}.v5-neutral{color:#f2c94c}.v5-wait{color:#f2c94c}.v5-pass{color:#22e58a}.v5-error{color:#ff5968}.v5-mtf{display:grid;gap:7px;margin-top:10px}.v5-mtf-row{display:grid;grid-template-columns:46px minmax(0,1fr) 70px 76px;gap:8px;align-items:center;border:1px solid #1d2c44;border-radius:10px;padding:9px;background:#080f1b;font-size:10px}.v5-mini{font-size:9px;color:#8493ab;margin-top:4px}.v5-dir{font-weight:900}.v5-strength{height:6px;background:#18253b;border-radius:99px;overflow:hidden}.v5-strength i{display:block;height:100%;background:linear-gradient(90deg,#6570ff,#35d8ff,#22e58a)}.v5-gates{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.v5-gate{border:1px solid #1d2c44;border-radius:10px;padding:10px;background:#080f1b;font-size:10px}.v5-gate b{display:block;margin-top:5px}.v5-candle{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.v5-metric{border:1px solid #1d2c44;border-radius:10px;background:#080f1b;padding:10px}.v5-metric span{display:block;color:#8493ab;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.v5-metric b{display:block;font-size:13px;margin-top:6px}.v5-ai{margin-top:10px;border-color:#5d3fc4}.v5-ai strong{color:#c6b4ff}.v5-note{margin-top:10px;color:#8493ab;font-size:10px;line-height:1.55}.v5-news{margin-top:12px}.v5-news-list{display:grid;gap:8px;margin-top:9px}.v5-news-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:10px;padding:10px;border:1px solid #1d2c44;border-radius:10px;background:#080f1b}.v5-impact{width:8px;height:8px;border-radius:50%;margin-top:5px;background:#69788f}.v5-impact.high{background:#ff5968}.v5-impact.medium{background:#f2c94c}.v5-chip{padding:4px 7px;border:1px solid #1d2c44;border-radius:8px;font-size:9px;color:#9fb0c7;height:max-content}.v5-status{padding:10px;border-radius:10px;border:1px solid #1d2c44;background:#080f1b;color:#a9b6c9;font-size:10px;line-height:1.5}
@media(max-width:900px){.v5-card{padding:14px}.v5-head{align-items:flex-start;flex-direction:column}.v5-actions{width:100%}.v5-grid{grid-template-columns:1fr}.v5-gates{grid-template-columns:repeat(2,1fr)}.v5-candle{grid-template-columns:repeat(2,1fr)}.v5-mtf-row{grid-template-columns:42px minmax(0,1fr) 58px 64px}.v5-title{font-size:18px}.v5-sub{font-size:10px}}
@media(max-width:520px){.v5-gates{grid-template-columns:1fr 1fr}.v5-mtf-row{grid-template-columns:38px minmax(0,1fr);gap:6px}.v5-mtf-row .v5-dir,.v5-mtf-row .v5-weight{grid-column:2}.v5-candle{grid-template-columns:1fr 1fr}.v5-score{font-size:28px}}
`;
    document.head.appendChild(s);
  }

  function shell() {
    style();
    let host = $('vtradePreMarket');
    if (host) return host;
    host = document.createElement('section');
    host.id = 'vtradePreMarket';
    host.innerHTML = `<div class="v5-card">
      <div class="v5-head"><div><div class="v5-title">Pre-Market Zone Analysis</div><div class="v5-sub">${tr('Candle-Open MTF processing · M5 → M15 → H1 → H4 → D1 · AI confirmation after processing · Telegram independent','Candle-Open MTF processing · M5 → M15 → H1 → H4 → D1 · AI បញ្ជាក់បន្ទាប់ពីដំណើរការ · Telegram ដាច់ដោយឡែក')}</div></div>
      <div class="v5-actions">${TFS.map(tf=>`<button class="v5-btn ${tf===state.tf?'active':''}" data-v5-tf="${tf}">${tf}</button>`).join('')}<button class="v5-btn primary" id="v5Analyze">Analyze AI</button></div></div>
      <div id="v5Body"></div><div class="v5-news" id="v5News"></div>
    </div>`;
    const wrap = document.querySelector('.wrap') || document.querySelector('.main');
    if (wrap) wrap.prepend(host); else document.body.prepend(host);
    host.querySelectorAll('[data-v5-tf]').forEach(b=>b.onclick=async()=>{state.tf=b.dataset.v5Tf;host.querySelectorAll('[data-v5-tf]').forEach(x=>x.classList.toggle('active',x===b));await loadPM();});
    host.querySelector('#v5Analyze').onclick = async () => {
      if (state.aiBusy) return;
      await loadPM();
      if (state.pm?.complete === true) await loadAI();
    };
    return host;
  }

  function getRows(d) { return d?.timeframes || d?.mtf?.rows || d?.mtf?.timeframes || {}; }
  function getCandle(x) {
    const c = x?.lastCandle || x?.candle || x?.latestCandle || (Array.isArray(x?.candles)?x.candles[x.candles.length-1]:null) || (Array.isArray(x?.bars)?x.bars[x.bars.length-1]:null) || {};
    const open=n(c.open??c.o??x?.open), high=n(c.high??c.h??x?.high), low=n(c.low??c.l??x?.low), close=n(c.close??c.c??x?.close??x?.currentPrice);
    if ([open,high,low,close].some(v=>v==null)) return null;
    return {open,high,low,close};
  }
  function candleStats(x) {
    const c=getCandle(x); if(!c) return null;
    const range=Math.max(0,c.high-c.low), body=Math.abs(c.close-c.open), upper=Math.max(0,c.high-Math.max(c.open,c.close)), lower=Math.max(0,Math.min(c.open,c.close)-c.low);
    const bodyPct=range?body/range*100:0, upperPct=range?upper/range*100:0, lowerPct=range?lower/range*100:0;
    const bull=c.close>c.open, bear=c.close<c.open;
    let pattern='NORMAL';
    if(range>0 && bodyPct<=30 && lowerPct>=55 && upperPct<=25) pattern=bull?'HAMMER':'HAMMER / REJECTION';
    else if(range>0 && bodyPct<=30 && upperPct>=55 && lowerPct<=25) pattern=bear?'SHOOTING STAR':'UPPER-WICK REJECTION';
    else if(range>0 && bodyPct<=12 && upperPct>=35 && lowerPct>=35) pattern='DOJI / INDECISION';
    else if(bodyPct>=65) pattern=bull?'STRONG BULLISH BODY':'STRONG BEARISH BODY';
    const pressure=range ? Math.max(0,Math.min(100,(c.close-c.low)/range*100)) : 50;
    return { ...c, range,body,upper,lower,bodyPct,upperPct,lowerPct,bull,bear,pattern,pressure,buyer:pressure,seller:100-pressure };
  }
  function gapInfo(rows,tf) {
    const x=rows?.[tf]||{};
    const arr=Array.isArray(x?.candles)?x.candles:Array.isArray(x?.bars)?x.bars:[];
    if(arr.length<3) return null;
    const a=arr[arr.length-3], b=arr[arr.length-2], c=arr[arr.length-1];
    const ah=n(a.high??a.h), al=n(a.low??a.l), ch=n(c.high??c.h), cl=n(c.low??c.l);
    if([ah,al,ch,cl].some(v=>v==null)) return null;
    if(cl>ah) return {type:'BULLISH FVG',low:ah,high:cl,gap:cl-ah};
    if(ch<al) return {type:'BEARISH FVG',low:ch,high:al,gap:al-ch};
    return {type:'NO FVG',low:null,high:null,gap:0};
  }
  function field(x, names) { for(const k of names){if(x?.[k]!==undefined&&x?.[k]!==null)return x[k];} return null; }
  function zoneRange(z) {
    if (!Array.isArray(z) || z.length < 2) return '—';
    const a=n(z[0]), b=n(z[1]);
    return a==null || b==null ? '—' : `${fmt(Math.min(a,b))} – ${fmt(Math.max(a,b))}`;
  }
  function gate(label,value,detail='') { const ok=bool(value); return `<div class="v5-gate"><span>${label}</span><b class="${ok?'v5-pass':'v5-wait'}">${ok?'PASS':'WAIT'}${detail?` · ${esc(detail)}`:''}</b></div>`; }

  function renderPM(msg='') {
    const d=state.pm||{}, body=$('v5Body'); if(!body) return;
    const rows=getRows(d), buy=pct(field(d,['buyStrengthPct','buyScore','buyerPower'])), sell=pct(field(d,['sellStrengthPct','sellScore','sellerPower'])), bias=String(d.bias||d.direction||'WAIT').toUpperCase();
    const selected=rows[state.tf]||{}; const cs=candleStats(selected); const gap=gapInfo(rows,state.tf);
    const gates=d.gates||d.confirmations||{};
    const liquidity=field(gates,['liquiditySweep','liquidity','sweep']), mss=field(gates,['mss','marketStructureShift']), bos=field(gates,['bos','breakOfStructure']), fvg=field(gates,['fvg','freshFvg']), ob=field(gates,['orderBlock','freshOb']), displacement=field(gates,['displacement','directionalDisplacement']), premium=field(gates,['premiumDiscountOk','premiumDiscount']), execution=field(gates,['executionZone','inZone','retest']), momentum=field(gates,['technicalMomentumOk','momentum']), spread=field(gates,['spreadOk']);
    const allReady=d.complete===true;
    const candleBuyer=pct(field(selected,['buyPct','buyerPower','buyStrengthPct']));
    const candleSeller=pct(field(selected,['sellPct','sellerPower','sellStrengthPct']));
    const buyer=candleBuyer!=='—'?candleBuyer:(cs?Math.round(cs.buyer):buy), seller=candleSeller!=='—'?candleSeller:(cs?Math.round(cs.seller):sell);
    const pattern=String(field(selected,['pattern','candlePattern'])||cs?.pattern||'—');
    const wickLabel=cs ? (cs.upperPct>50||cs.lowerPct>50?'LONG WICK':cs.upperPct>25||cs.lowerPct>25?'MEDIUM WICK':'SHORT WICK') : '—';
    const ai=state.ai;
    const aiBlock=ai?`<div class="v5-box v5-ai"><strong>AI Pre-Market Confirmation</strong><div class="v5-row"><span>${tr('Decision','សេចក្តីសម្រេច')}</span><b>${esc(ai.decision||ai.verdict||'WAIT')}</b></div><div class="v5-row"><span>Confidence</span><b>${pct(ai.confidence??ai.confidence_0_100)}/100</b></div><div class="v5-row"><span>Agreement</span><b>${esc(ai.agreement||'NEUTRAL')}</b></div><div class="v5-row"><span>${tr('Key drivers','កត្តាសំខាន់')}</span><b>${esc((ai.reasons||ai.key_drivers||[]).join(' · ')||'—')}</b></div><div class="v5-note">${esc(ai.summary||ai.verdict||'AI confirmation loaded. Deterministic gates remain authoritative.')}</div></div>`:'';
    const mtfRows=TFS.map(tf=>{const x=rows[tf]||{}, bp=pct(field(x,['buyPct','buyStrengthPct','buyScore','buyerPower'])), sp=pct(field(x,['sellPct','sellStrengthPct','sellScore','sellerPower'])), dir=String(x.bias||x.direction||'WAIT').toUpperCase(), c=candleStats(x), open=n(x.open??c?.open), cur=n(x.currentPrice??x.price??c?.close), move=n(x.openMove??(open!=null&&cur!=null?cur-open:null)); return `<div class="v5-mtf-row"><b>${tf}</b><div><div class="v5-strength"><i style="width:${bp==='—'?0:bp}%"></i></div><div class="v5-mini">${x.ready===false?'DATA NOT READY':`Open ${fmt(open)} · Now ${fmt(cur)} · Δ ${fmt(move)}`}</div></div><span class="v5-dir ${dir.includes('BULL')?'v5-buy':dir.includes('BEAR')?'v5-sell':'v5-neutral'}">${esc(dir)}</span><span class="v5-weight">BUY ${bp}%<br>SELL ${sp}%</span></div>`;}).join('');
    const candleHtml=cs?`<div class="v5-candle"><div class="v5-metric"><span>Body</span><b>${fmt(cs.body)} (${Math.round(cs.bodyPct)}%)</b></div><div class="v5-metric"><span>Upper Wick</span><b>${fmt(cs.upper)} (${Math.round(cs.upperPct)}%)</b></div><div class="v5-metric"><span>Lower Wick</span><b>${fmt(cs.lower)} (${Math.round(cs.lowerPct)}%)</b></div><div class="v5-metric"><span>Pattern</span><b class="${pattern.includes('HAMMER')?'v5-buy':pattern.includes('STAR')?'v5-sell':'v5-neutral'}">${esc(pattern)}</b></div></div>`:`<div class="v5-status">${tr('Selected candle anatomy is waiting for OHLC data from MT5.','កំពុងរង់ចាំ OHLC ពី MT5 សម្រាប់វិភាគ Wick/Body/Candle Pattern។')}</div>`;
    const gapHtml=gap?`${esc(gap.type)}${gap.gap?` · ${fmt(gap.gap)}`:''}`:String(field(selected,['fvgLabel','fvgType'])||field(d,['fvgLabel','fvgType'])||'—');
    body.innerHTML=`<div class="v5-grid"><div class="v5-box"><div class="v5-label">Pre-Market MTF Direction Strength</div><div class="v5-grid" style="margin-top:8px"><div><div class="v5-score v5-buy">${buy}%</div><div class="v5-bar"><i style="width:${buy==='—'?0:buy}%"></i></div><div class="v5-row"><span>BUY Strength</span><b class="v5-buy">${buy}%</b></div></div><div><div class="v5-score v5-sell">${sell}%</div><div class="v5-bar"><i style="width:${sell==='—'?0:sell}%"></i></div><div class="v5-row"><span>SELL Strength</span><b class="v5-sell">${sell}%</b></div></div></div><div class="v5-row"><span>MTF Bias</span><b class="${bias.includes('BULL')?'v5-buy':bias.includes('BEAR')?'v5-sell':'v5-neutral'}">${esc(bias)}</b></div><div class="v5-row"><span>Pre-AI confidence</span><b>${pct(d.preAiConfidence??d.confidence)}/100</b></div><div class="v5-row"><span>MTF processing</span><b class="${allReady?'v5-pass':'v5-wait'}">${allReady?'ALL 5 READY':`WAIT — ${(d.missingTimeframes||[]).join(', ')||'MTF data'}`}</b></div></div><div class="v5-box"><div class="v5-label">${tr('BUY ZONE / SELL ZONE','តំបន់ BUY / SELL')}</div><div class="v5-grid" style="margin-top:8px"><div><div class="v5-label">BUY ZONE</div><div class="v5-score v5-buy" style="font-size:22px">${zoneRange(d.zone?.buyZone)}</div><div class="v5-row"><span>Entry area</span><b class="v5-buy">BELOW PRICE</b></div></div><div><div class="v5-label">SELL ZONE</div><div class="v5-score v5-sell" style="font-size:22px">${zoneRange(d.zone?.sellZone)}</div><div class="v5-row"><span>Entry area</span><b class="v5-sell">ABOVE PRICE</b></div></div></div><div class="v5-row"><span>${tr('Market pressure','សម្ពាធទីផ្សារ')}</span><b class="${buy>sell?'v5-buy':sell>buy?'v5-sell':'v5-neutral'}">${buy>sell?'BUY PRESSURE':sell>buy?'SELL PRESSURE':'BALANCED'}</b></div><div class="v5-row"><span>Buyer / Seller</span><b>${buyer}% / ${seller}%</b></div><div class="v5-note">${tr('Both zones stay visible. Pressure only ranks the current market; it does not remove the opposite setup. Entry requires ICT confirmation gates.','បង្ហាញទាំងពីរតំបន់ជានិច្ច។ Pressure គ្រាន់តែបង្ហាញសម្ពាធបច្ចុប្បន្ន មិនលុប setup ផ្ទុយទេ។ Entry ត្រូវរង់ចាំ ICT confirmation gates។')}</div></div><div class="v5-box v5-mtf"><div class="v5-label">Candle-Open MTF Processing</div>${mtfRows}</div><div class="v5-box"><div class="v5-label">${tr('Candle Anatomy / Wick / Pattern','វិភាគ Candle / Wick / Pattern')}</div><div class="v5-row"><span>Selected TF</span><b>${state.tf}</b></div><div class="v5-row"><span>Wick</span><b>${wickLabel}</b></div><div class="v5-row"><span>Pattern</span><b>${esc(pattern)}</b></div><div class="v5-row"><span>FVG / Gap</span><b class="${String(gapHtml).includes('NO FVG')?'v5-wait':'v5-pass'}">${esc(gapHtml)}</b></div>${candleHtml}</div><div class="v5-box"><div class="v5-row"><span>Current Price</span><b>${fmt(d.price??selected.currentPrice)}</b></div><div class="v5-row"><span>Execution</span><b class="v5-wait">WAIT · ${tr('Pre-market analysis only','វិភាគ Pre-market ប៉ុណ្ណោះ')}</b></div><div class="v5-row"><span>Workflow</span><b>M5 → M15 → H1 → H4 → D1 → ICT → AI</b></div></div><div class="v5-gates">${gate('Liquidity Sweep',liquidity)}${gate('MSS',mss)}${gate('BOS',bos)}${gate('Displacement',displacement)}${gate('FVG',fvg)}${gate('Order Block',ob)}${gate('Premium / Discount',premium)}${gate('Execution Zone',execution)}${gate('Momentum',momentum)}${gate('Spread',spread)}</div><div class="v5-note">${msg?`<span class="${/unavailable|failed|error/i.test(msg)?'v5-error':''}">${esc(msg)}</span><br>`:''}${tr('Pre-market is evidence gathering. A BUY/SELL signal is promoted only after the deterministic ICT execution gates pass.','Pre-market គឺសម្រាប់ប្រមូលភស្តុតាង។ BUY/SELL នឹងត្រូវបានអនុម័តតែពេល ICT execution gates តាមលក្ខខណ្ឌជាប់ប៉ុណ្ណោះ។')}</div>${aiBlock}`;
  }

  function renderNews() {
    const host=$('v5News'); if(!host) return;
    const items=(state.news?.items||[]).slice(0,8);
    host.innerHTML=`<div class="v5-box"><div class="v5-row"><div><b>${tr('60-Minute Macro & Breaking News','ព័ត៌មាន Macro និង Breaking News 60 នាទី')}</b><div class="v5-sub">XAUUSD impact scan · separate from Telegram</div></div><b class="v5-buy">${state.news?.highImpactCount??0} HIGH</b></div><div class="v5-news-list">${items.length?items.map(x=>`<div class="v5-news-item"><span class="v5-impact ${String(x.impact||'').toLowerCase()}"></span><div><b>${esc(x.title)}</b><div class="v5-mini">${esc(x.source||'News')} · ${x.publishedAt?new Date(x.publishedAt).toLocaleTimeString():''} · ${esc(x.relevance||'MACRO')}</div></div><span class="v5-chip">${esc(x.impact||'LOW')}</span></div>`).join(''):`<div class="v5-note">${tr('No fresh items in the last 60 minutes.','មិនមានព័ត៌មានថ្មីក្នុង 60 នាទីចុងក្រោយ។')}</div>`}</div>`;
  }

  async function loadPM() {
    if(state.busy) return state.pm;
    state.busy=true;
    try {
      state.pm=await api(`/api/pre-market/candle-open?tf=${encodeURIComponent(state.tf)}`);
      state.ai=null;
      renderPM(state.pm?.complete===true?tr('All five MTF frames are ready. AI may now confirm.','MTF ទាំង 5 Ready ហើយ។ ឥឡូវ AI អាច Confirm បាន។'):tr('Waiting for complete M5 → M15 → H1 → H4 → D1 processing.','កំពុងរង់ចាំដំណើរការ M5 → M15 → H1 → H4 → D1 ឱ្យរួចរាល់។'));
      return state.pm;
    } catch(e) {
      renderPM(`Pre-market analysis unavailable: ${String(e?.message||e)}`);
      return null;
    } finally { state.busy=false; }
  }

  async function loadAI() {
    if(state.aiBusy || state.pm?.complete!==true) return null;
    state.aiBusy=true;
    try {
      const response=await api(`/api/pre-market/ai?tf=${encodeURIComponent(state.tf)}`);
      if(response?.success===false) throw new Error(response.error||'AI confirmation unavailable');
      state.ai=response?.ai||response;
      renderPM(tr('AI confirmation loaded after complete MTF processing.','AI Confirm បន្ទាប់ពី MTF ទាំង 5 ដំណើរការរួចរាល់។'));
      return state.ai;
    } catch(e) {
      state.ai={decision:'WAIT',confidence:0,agreement:'NEUTRAL',reasons:[String(e?.message||e)]};
      renderPM(`AI confirmation unavailable: ${String(e?.message||e)}`);
      return null;
    } finally { state.aiBusy=false; }
  }

  async function loadNews() {
    try { state.news=await api('/api/market-news'); renderNews(); }
    catch(_) { state.news={items:[],highImpactCount:0}; renderNews(); }
  }

  function boot() {
    if(!/premium-dashboard-live\.html$/i.test(location.pathname)) return;
    shell();
    setTimeout(()=>{loadPM();loadNews();},350);
    setInterval(()=>{if(!state.busy)loadPM();},5000);
    setInterval(loadNews,60000);
    window.addEventListener('storage',e=>{if(e.key==='vtrade_lang')renderPM();});
    document.addEventListener('click',e=>{
      const b=e.target.closest('.tfs button'); if(!b) return;
      const tf=String(b.textContent||'').trim().toUpperCase();
      if(TFS.includes(tf)){state.tf=tf;const pm=document.querySelector(`[data-v5-tf="${tf}"]`);if(pm){document.querySelectorAll('[data-v5-tf]').forEach(x=>x.classList.toggle('active',x===pm));}setTimeout(loadPM,50);}
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
