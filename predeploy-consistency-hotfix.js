const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const TERM = path.join(ROOT, 'terminal-pre-market.js');
const AI_BUTTON = path.join(ROOT, 'vtrade-ai-button-hotfix.js');
const MARK = 'VTRADE_PREDEPLOY_CONSISTENCY_V1';

// Apply the existing production integrity patch before server-launcher loads server.js.
try { require('./startup-logic-hotfix.js'); } catch (e) { console.error('[VTRADE PREDEPLOY] startup logic patch failed:', e.message); }

function patch(file, fn) {
  if (!fs.existsSync(file)) return;
  const old = fs.readFileSync(file, 'utf8');
  const next = fn(old);
  if (next !== old) fs.writeFileSync(file, next, 'utf8');
}

patch(TERM, source => {
  if (source.includes(MARK)) return source;
  let s = source;
  // Null AI confidence must remain N/A; never coerce unavailable AI to 0/100.
  s = s.replace("<b>${pct(state.ai.confidence)}/100</b>", "<b>${state.ai?.confidence==null?'N/A':pct(state.ai.confidence)+'/100'}</b>");
  s = s.replace("<b>${esc(state.ai.decision||'WAIT')}</b>", "<b>${esc(state.ai?.status==='disabled'?'DISABLED':state.ai?.status==='unavailable'?'UNAVAILABLE':state.ai?.decision||'WAIT')}</b>");
  s = s.replace("<b>${esc(state.ai.agreement||'NEUTRAL')}</b>", "<b>${esc(state.ai?.agreement||'N/A')}</b>");
  return s + `\n/* ${MARK} */\n`;
});

patch(AI_BUTTON, source => {
  if (source.includes(MARK)) return source;
  let s = source;
  s = s.replace(
    "const pct = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : 0;",
    "const pct = n => Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Math.round(Number(n)))) : null;"
  );
  s = s.replace(
    "const decision = String(ai.decision || ai.signal || 'WAIT').toUpperCase();",
    "const decision = String(ai.status==='disabled'?'DISABLED':ai.status==='unavailable'?'UNAVAILABLE':ai.decision || ai.signal || 'WAIT').toUpperCase();"
  );
  s = s.replace("<b>${confidence}/100</b>", "<b>${confidence==null?'N/A':confidence+'/100'}</b>");
  s = s.replace("${pct(pm.sellStrengthPct)}% SELL / ${pct(pm.buyStrengthPct)}% BUY", "${pct(pm.sellStrengthPct)==null?'—':pct(pm.sellStrengthPct)}% SELL / ${pct(pm.buyStrengthPct)==null?'—':pct(pm.buyStrengthPct)}% BUY");
  return s + `\n/* ${MARK} */\n`;
});

// Startup must expose this marker in logs so Render verification is deterministic.
console.log('[VTRADE PREDEPLOY] consistency + AI N/A hotfix active');
