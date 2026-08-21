/* V TRADE AI — Analyze AI button hardening V2
 * Selected TF flow: selected candle OHLC -> AI/local confirmation -> render.
 * No race, no mandatory pre-call to a second MTF endpoint.
 * AI is confirmation-only and never authorizes an order.
 */
(() => {
  if (window.__VTRADE_AI_BUTTON_HOTFIX_V2__) return;
  window.__VTRADE_AI_BUTTON_HOTFIX_V2__ = true;

  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => n === null || n === undefined || n === '' || !Number.isFinite(Number(n)) ? null : Math.max(0, Math.min(100, Math.round(Number(n))));
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const conn = () => window.VTRADE_CONNECTION;

  async function request(path) {
    const c = conn();
    if (!c?.fetch || !c?.api) throw new Error('Backend connection layer unavailable');
    try {
      const r = await c.fetch(c.api(path), { credentials:'omit', cache:'no-store', mode:'cors' });
      let data = null;
      try { data = await r.json(); } catch {}
      if (!r.ok || data?.success === false) {
        const err = new Error(data?.error || `HTTP ${r.status}`);
        err.status = r.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      if (e?.backend && e?.message) throw e;
      throw e;
    }
  }

  function button() { return document.getElementById('vpmAnalyze'); }
  function selectedTF() {
    const active = document.querySelector('#vtradePreMarket [data-pm-tf].active');
    return active?.dataset?.pmTf || 'M15';
  }

  function ensureStatus() {
    let el = document.getElementById('vtradeAiRunStatus');
    if (el) return el;
    const host = document.getElementById('vtradePreMarket');
    if (!host) return null;
    el = document.createElement('div');
    el.id = 'vtradeAiRunStatus';
    el.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid #263650;border-radius:11px;background:#080f1b;color:#a9b6c9;font-size:10px;line-height:1.5;';
    host.querySelector('.vpm-card')?.appendChild(el);
    return el;
  }

  function renderAI(data, tf) {
    const ai = data?.ai || {};
    const pm = data?.preMarket || {};
    const engine = data?.engine || {};
    const status = ensureStatus();
    const decision = String(ai.decision || ai.signal || 'WAIT').toUpperCase();
    const confidence = pct(ai.confidence);
    const confidenceText = confidence == null ? 'N/A' : `${confidence}/100`;
    const agreement = String(ai.agreement || 'NEUTRAL').toUpperCase();
    const reasons = Array.isArray(ai.reasons) ? ai.reasons : (Array.isArray(ai.key_drivers) ? ai.key_drivers : []);
    const color = decision.includes('BUY') ? '#22e58a' : decision.includes('SELL') ? '#ff5968' : '#f2c94c';
    if (status) {
      status.style.borderColor = decision.includes('WAIT') || decision.includes('UNAVAILABLE') ? '#745313' : '#5d3fc4';
      status.innerHTML = `<b style="color:${color};font-size:14px">AI CONFIRMATION · ${esc(decision)}</b>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px"><span>Timeframe</span><b>${esc(tf)}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>Confidence</span><b>${confidenceText}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>Agreement</span><b>${esc(agreement)}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>Selected Candle</span><b>${esc(data?.candle?.direction || '—')}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>OHLC</span><b>${fmt(data?.candle?.open)} · ${fmt(data?.candle?.high)} · ${fmt(data?.candle?.low)} · ${fmt(data?.candle?.close)}</b></div>`+
        (reasons.length ? `<div style="margin-top:7px">${reasons.map(x=>`• ${esc(x)}`).join('<br>')}</div>` : '')+
        `<div style="margin-top:7px;color:#8493ab">AI/local confirmation only. No order is authorized by this button.</div>`;
    }

    const body = document.getElementById('vpmBody');
    if (body) {
      let box = document.getElementById('vtradeAiResult');
      if (!box) {
        box = document.createElement('div');
        box.id = 'vtradeAiResult';
        box.className = 'vpm-box vpm-ai';
        box.style.marginTop = '10px';
        body.appendChild(box);
      }
      box.innerHTML = `<strong>AI Pre-Market Confirmation</strong>`+
        `<div class="vpm-row"><span>Decision</span><b style="color:${color}">${esc(decision)}</b></div>`+
        `<div class="vpm-row"><span>Confidence</span><b>${confidenceText}</b></div>`+
        `<div class="vpm-row"><span>Agreement</span><b>${esc(agreement)}</b></div>`+
        `<div class="vpm-row"><span>Selected TF</span><b>${esc(tf)}</b></div>`+
        `<div class="vpm-row"><span>Candle</span><b>${esc(data?.candle?.direction || '—')}</b></div>`+
        `<div class="vpm-row"><span>Engine Signal</span><b>${esc(ai.gate?.engineSignal || ai.engineSignal || engine?.signal || 'WAIT')}</b></div>`+
        `<div class="vpm-note">${reasons.length ? reasons.map(x=>esc(x)).join(' · ') : 'Confirmation completed.'}</div>`;
    }
  }

  async function run(btn) {
    if (btn.dataset.aiBusy === '1') return;
    btn.dataset.aiBusy = '1';
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Analyzing…';
    const status = ensureStatus();
    const tf = selectedTF();
    if (status) status.innerHTML = `<b style="color:#35d8ff">ANALYZING ${esc(tf)}…</b><div style="margin-top:5px">Validating the selected ${esc(tf)} candle OHLC, then running confirmation…</div>`;

    try {
      const result = await request(`/api/pre-market/ai?tf=${encodeURIComponent(tf)}&_=${Date.now()}`);
      renderAI(result, tf);
      if (status) status.scrollIntoView({behavior:'smooth',block:'nearest'});
    } catch (e) {
      const data = e?.data;
      if (status) {
        status.style.borderColor = '#7c2532';
        status.innerHTML = `<b style="color:#ff5968">AI ANALYSIS FAILED</b>`+
          `<div style="margin-top:5px">${esc(e?.message || e)}</div>`+
          (data?.candle ? `<div style="margin-top:5px">${esc(tf)} OHLC: ${fmt(data.candle.open)} / ${fmt(data.candle.high)} / ${fmt(data.candle.low)} / ${fmt(data.candle.close)}</div>` : '')+
          `<div style="margin-top:5px;color:#8493ab">No trade is authorized. Check the backend route only if this message persists.</div>`;
      }
      console.error('[VTRADE AI BUTTON V2]', e);
    } finally {
      btn.dataset.aiBusy = '0';
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function install() {
    const btn = button();
    if (!btn || btn.dataset.aiHotfixInstalledV2 === '1') return;
    btn.dataset.aiHotfixInstalledV2 = '1';
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      run(btn);
    }, true);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  install();
  window.addEventListener('load', install);

  // LIVE TERMINAL WATCHDOG V1: keep the dashboard connection state truthful.
  // It never fabricates market data; it only checks the backend health endpoint.
  async function watchdog() {
    const c = conn();
    const badge = document.getElementById('backend');
    const status = document.getElementById('status');
    if (!c?.status || !badge) return;
    try {
      const h = await c.status();
      if (h.ok) {
        badge.textContent = 'BACKEND LIVE';
        badge.className = 'backend';
        if (status && /connection failed|backend offline|connecting/i.test(status.textContent || '')) {
          status.className = 'notice success';
          status.textContent = 'Live Backend connected. Waiting for the latest MT5/ICT analysis.';
        }
      } else {
        badge.textContent = 'BACKEND OFFLINE';
        badge.className = 'backend';
        if (status) {
          status.className = 'notice';
          status.textContent = 'Backend is offline or waking up. No market data is fabricated.';
        }
      }
    } catch (e) {
      badge.textContent = 'BACKEND OFFLINE';
      if (status) status.textContent = 'Backend connection unavailable. No market data is fabricated.';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchdog, {once:true}); else watchdog();
  setInterval(watchdog, 15000);
})();
