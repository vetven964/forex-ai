/* V TRADE AI — Analyze AI button hardening V1
 * Fixes the race in terminal-pre-market.js where Analyze AI starts loadPM()
 * without awaiting it, then immediately calls loadAI().
 * This layer owns the button click and runs the sequence deterministically:
 *   candle-open MTF -> AI confirmation -> render result.
 */
(() => {
  if (window.__VTRADE_AI_BUTTON_HOTFIX__) return;
  window.__VTRADE_AI_BUTTON_HOTFIX__ = true;

  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : 0;
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const conn = () => window.VTRADE_CONNECTION;

  async function request(path) {
    const c = conn();
    if (!c?.fetch || !c?.api) throw new Error('Backend connection layer unavailable');
    const r = await c.fetch(c.api(path), { credentials:'include', cache:'no-store' });
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok || data?.success === false) {
      const err = new Error(data?.error || `HTTP ${r.status}`);
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
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
    const agreement = String(ai.agreement || 'NEUTRAL').toUpperCase();
    const reasons = Array.isArray(ai.reasons) ? ai.reasons : (Array.isArray(ai.key_drivers) ? ai.key_drivers : []);
    const color = decision.includes('BUY') ? '#22e58a' : decision.includes('SELL') ? '#ff5968' : '#f2c94c';
    if (status) {
      status.style.borderColor = decision.includes('WAIT') ? '#745313' : '#5d3fc4';
      status.innerHTML = `<b style="color:${color};font-size:14px">AI CONFIRMATION · ${esc(decision)}</b>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px"><span>Timeframe</span><b>${esc(tf)}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>Confidence</span><b>${confidence}/100</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>Agreement</span><b>${esc(agreement)}</b></div>`+
        `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:5px"><span>MTF</span><b>${esc(pm.bias || 'WAIT')} · ${pct(pm.sellStrengthPct)}% SELL / ${pct(pm.buyStrengthPct)}% BUY</b></div>`+
        (reasons.length ? `<div style="margin-top:7px">${reasons.map(x=>`• ${esc(x)}`).join('<br>')}</div>` : '')+
        `<div style="margin-top:7px;color:#8493ab">AI confirmation only. No order is authorized by this button.</div>`;
    }

    const body = document.getElementById('vpmBody');
    if (body && !document.getElementById('vtradeAiResult')) {
      const box = document.createElement('div');
      box.id = 'vtradeAiResult';
      box.className = 'vpm-box vpm-ai';
      box.style.marginTop = '10px';
      box.innerHTML = `<strong>AI Pre-Market Confirmation</strong>`+
        `<div class="vpm-row"><span>Decision</span><b style="color:${color}">${esc(decision)}</b></div>`+
        `<div class="vpm-row"><span>Confidence</span><b>${confidence}/100</b></div>`+
        `<div class="vpm-row"><span>Agreement</span><b>${esc(agreement)}</b></div>`+
        `<div class="vpm-row"><span>Engine Signal</span><b>${esc(ai.gate?.engineSignal || ai.engineSignal || engine?.signal || 'WAIT')}</b></div>`+
        `<div class="vpm-note">${reasons.length ? reasons.map(x=>esc(x)).join(' · ') : 'AI confirmation completed.'}</div>`;
      body.appendChild(box);
    }
  }

  async function run(btn) {
    if (btn.dataset.aiBusy === '1') return;
    btn.dataset.aiBusy = '1';
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Analyzing…';
    const status = ensureStatus();
    if (status) status.innerHTML = '<b style="color:#35d8ff">ANALYZING AI…</b><div style="margin-top:5px">Step 1/2 · refreshing live M5 → M15 → H1 → H4 → D1 data…</div>';

    const tf = selectedTF();
    try {
      // IMPORTANT: await the MTF request before asking for AI.
      const pm = await request(`/api/pre-market/candle-open?tf=${encodeURIComponent(tf)}&_=${Date.now()}`);
      if (!pm?.complete) {
        throw Object.assign(new Error(`MTF incomplete: ${(pm?.missingTimeframes || []).join(', ') || 'unknown'}`), { data:pm, status:409 });
      }
      if (status) status.innerHTML = '<b style="color:#35d8ff">ANALYZING AI…</b><div style="margin-top:5px">Step 2/2 · sending complete MTF context to AI confirmation…</div>';
      const result = await request(`/api/pre-market/ai?tf=${encodeURIComponent(tf)}&_=${Date.now()}`);
      renderAI(result, tf);
      if (status) status.scrollIntoView({behavior:'smooth',block:'nearest'});
    } catch (e) {
      const data = e?.data;
      const status = ensureStatus();
      if (status) {
        status.style.borderColor = '#7c2532';
        status.innerHTML = `<b style="color:#ff5968">AI ANALYSIS FAILED</b>`+
          `<div style="margin-top:5px">${esc(e?.message || e)}</div>`+
          (data?.preMarket?.missingTimeframes?.length ? `<div style="margin-top:5px">Missing: ${esc(data.preMarket.missingTimeframes.join(', '))}</div>` : '')+
          `<div style="margin-top:5px;color:#8493ab">The button is connected; the backend returned an error instead of silently failing.</div>`;
      }
      console.error('[VTRADE AI BUTTON]', e);
    } finally {
      btn.dataset.aiBusy = '0';
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function install() {
    const btn = button();
    if (!btn || btn.dataset.aiHotfixInstalled === '1') return;
    btn.dataset.aiHotfixInstalled = '1';
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
})();
