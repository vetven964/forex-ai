'use strict';

// V-TRADE Dashboard MTF Adapter V1
// Canonical presentation: H4/H1/M15 = Core MTF (3/3), M5 = Execution.
const CORE = ['H4','H1','M15'];
const EXEC = 'M5';

function bias(v) {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('BULL') || s === 'BUY' || s === 'LONG') return 'BULLISH';
  if (s.includes('BEAR') || s === 'SELL' || s === 'SHORT') return 'BEARISH';
  return 'NEUTRAL';
}
function frame(a, tf) {
  const groups = [a?.timeframes,a?.frames,a?.mtf,a?.multiTimeframe];
  for (const g of groups) {
    if (g && typeof g === 'object' && g[tf] != null) return g[tf];
  }
  return a?.[tf] ?? a?.[tf.toLowerCase()] ?? null;
}
function getContract(a={}) {
  const frames = Object.fromEntries(CORE.map(tf => [tf,bias(frame(a,tf)?.structure?.bias ?? frame(a,tf)?.bias ?? frame(a,tf)?.trend ?? frame(a,tf)?.signal)]));
  const exec = bias(frame(a,EXEC)?.structure?.bias ?? frame(a,EXEC)?.bias ?? frame(a,EXEC)?.trend ?? frame(a,EXEC)?.signal);
  const bull = CORE.filter(tf => frames[tf] === 'BULLISH').length;
  const bear = CORE.filter(tf => frames[tf] === 'BEARISH').length;
  const coreBias = bull === 3 ? 'BULLISH' : bear === 3 ? 'BEARISH' : 'NEUTRAL';
  return {
    core: frames,
    execution: { timeframe: EXEC, bias: exec },
    alignment: `${Math.max(bull,bear)}/3`,
    coreBias,
    coreAligned: coreBias !== 'NEUTRAL',
    executionAligned: coreBias !== 'NEUTRAL' && exec === coreBias,
    status: coreBias !== 'NEUTRAL' && exec === coreBias ? 'ALIGNED' : 'WAIT'
  };
}

function renderContract(target, a) {
  if (!target) return;
  const c = getContract(a);
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('mtf-alignment', c.alignment);
  set('mtf-bias', c.coreBias);
  set('mtf-execution', `${EXEC} · ${c.execution.bias}`);
  for (const tf of CORE) set(`mtf-${tf.toLowerCase()}`, c.core[tf]);
  set('mtf-status', c.status);
}

if (typeof window !== 'undefined') {
  window.VTradeMTF = { CORE, EXEC, getContract, renderContract };
}
module.exports = { CORE, EXEC, getContract };
