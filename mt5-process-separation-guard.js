// V-TRADE MT5 PROCESS SEPARATION GUARD
// Keeps the broker-native MT5 feed as the single authoritative readiness source.
// This module is intentionally dependency-free and safe to load more than once.
(function installMT5ProcessSeparationGuard() {
  if (global.__VTRADE_MT5_PROCESS_SEPARATION_GUARD__) return;
  global.__VTRADE_MT5_PROCESS_SEPARATION_GUARD__ = true;

  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const timers = new Set();

  global.__VTRADE_MT5_TIMER_SET__ = function (fn, ms, ...args) {
    const timer = originalSetInterval(fn, ms, ...args);
    timers.add(timer);
    return timer;
  };
  global.__VTRADE_MT5_TIMER_CLEAR__ = function (timer) {
    timers.delete(timer);
    return originalClearInterval(timer);
  };

  // Shared readiness contract used by Telegram/ICT/Pre-Market integrations.
  global.__VTRADE_MT5_READINESS__ = {
    quote: false,
    M5: 0,
    M15: 0,
    H1: 0,
    H4: 0,
    connected: false,
    updatedAt: 0,
    instance: 1
  };

  global.__VTRADE_SET_MT5_READINESS__ = function (state) {
    const s = global.__VTRADE_MT5_READINESS__;
    if (!state || typeof state !== 'object') return s;
    if (state.quote !== undefined) s.quote = !!state.quote;
    for (const tf of ['M5','M15','H1','H4']) {
      if (state[tf] !== undefined) s[tf] = Number(state[tf]) || 0;
    }
    if (state.connected !== undefined) s.connected = !!state.connected;
    s.updatedAt = Date.now();
    return s;
  };

  global.__VTRADE_MT5_READY__ = function () {
    const s = global.__VTRADE_MT5_READINESS__;
    const age = Date.now() - Number(s.updatedAt || 0);
    return !!(s.quote && s.M5 >= 1 && s.M15 >= 1 && s.H1 >= 1 && s.H4 >= 1 && age <= 60000);
  };

  console.log('[V-TRADE PROCESS SEPARATION] MT5 single-source readiness guard installed | instance=1');
})();
