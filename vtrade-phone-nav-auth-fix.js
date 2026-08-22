/* V TRADE AI — phone navigation/auth continuity fix V1
   Keep authenticated phone navigation inside the live terminal page.
   Desktop untouched. */
(() => {
  'use strict';
  if (!window.matchMedia || !matchMedia('(max-width:900px)').matches) return;
  if (window.__VTRADE_PHONE_NAV_AUTH_FIX__) return;
  window.__VTRADE_PHONE_NAV_AUTH_FIX__ = true;

  const terminal = 'premium-dashboard-live.html';

  function samePageNav() {
    const bar = document.getElementById('vtradeMobileBar');
    if (bar) {
      bar.querySelectorAll('a').forEach(a => {
        const label = (a.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
        if (label.includes('home')) a.href = terminal + '#dashboard';
        else if (label.includes('analyzer')) a.href = terminal + '#ai';
        else if (label.includes('chart')) a.href = terminal + '#terminal';
        else if (label.includes('signals')) a.href = terminal + '#signals';
        else if (label.includes('stats')) a.href = terminal + '#stats';
      });
    }
  }

  function targetFor(key) {
    const direct = document.getElementById(key);
    if (direct) return direct;
    const byData = document.querySelector(`[data-section="${key}"],[data-module="${key}"]`);
    if (byData) return byData;
    const words = {
      dashboard:['Dashboard','Pre-Market Zone Analysis'],
      terminal:['Terminal','Chart'],
      signals:['Signals','Signal'],
      ai:['AI Intelligence','AI Engine','Pre-Market Zone Analysis'],
      news:['News Intelligence','News'],
      telegram:['Telegram'],
      risk:['Risk Calculator'],
      history:['Trade History'],
      settings:['Settings']
    }[key] || [key];
    const nodes = [...document.querySelectorAll('h1,h2,h3,.section-title,.card,.module-card')];
    return nodes.find(n => words.some(w => (n.textContent||'').toLowerCase().includes(w.toLowerCase()))) || null;
  }

  function handleSideClick(e) {
    if (e.defaultPrevented) return;
    const btn = e.target.closest?.('.side .nav [data-target]');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const key = String(btn.getAttribute('data-target') || '').toLowerCase();
    document.querySelectorAll('.side .nav [data-target]').forEach(x => x.classList.toggle('active', x === btn));
    if (key === 'dashboard') {
      window.scrollTo({top:0,behavior:'smooth'});
      history.replaceState(null,'',terminal+'#dashboard');
      return;
    }
    const target = targetFor(key);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({behavior:'smooth',block:'start'});
      try { history.replaceState(null,'',terminal+'#'+key); } catch {}
    }
  }

  function install() {
    samePageNav();
    document.addEventListener('click', handleSideClick, true);
    const bar = document.getElementById('vtradeMobileBar');
    if (bar) bar.addEventListener('click', e => {
      const a = e.target.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.includes('dashboard.html') && !href.includes(terminal)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        location.hash = '#dashboard';
      }
    }, true);
    try {
      const token = localStorage.getItem('vtrade_auth_token') || localStorage.getItem('vtrade_auth');
      if (token && !localStorage.getItem('vtrade_phone_session_guard')) {
        localStorage.setItem('vtrade_phone_session_guard','1');
      }
    } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  setTimeout(samePageNav, 250);
  setTimeout(samePageNav, 1000);
})();
