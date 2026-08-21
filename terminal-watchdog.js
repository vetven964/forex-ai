/* V TRADE AI — Live Terminal Watchdog V1 */
(() => {
  if (window.__VTRADE_TERMINAL_WATCHDOG__) return;
  window.__VTRADE_TERMINAL_WATCHDOG__ = true;

  const $ = id => document.getElementById(id);
  const c = () => window.VTRADE_CONNECTION;

  async function check() {
    const conn = c();
    if (!conn?.status) return;
    const badge = $('backend');
    const status = $('status');
    try {
      const h = await conn.status();
      if (h.ok) {
        if (badge) {
          badge.textContent = 'BACKEND LIVE';
          badge.className = 'backend';
        }
        if (status && /offline|connection failed|connecting/i.test(status.textContent || '')) {
          status.className = 'notice success';
          status.textContent = 'Live Backend connected. Waiting for the latest MT5/ICT analysis.';
        }
      } else {
        if (badge) {
          badge.textContent = 'BACKEND OFFLINE';
          badge.className = 'backend';
        }
        if (status) {
          status.className = 'notice';
          status.textContent = 'Backend is offline or waking up. No market data is fabricated.';
        }
      }
    } catch (_) {
      if (badge) badge.textContent = 'BACKEND OFFLINE';
      if (status) status.textContent = 'Backend connection unavailable. No market data is fabricated.';
    }
  }

  function boot() {
    check();
    window.setInterval(check, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
