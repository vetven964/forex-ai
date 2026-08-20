// V TRADE AI enhanced single-process launcher.
// Keeps existing startup patches, while enabling Pre-Market Intelligence V2.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const DASHBOARD=path.join(ROOT,'premium-dashboard-live.html');
const UI=path.join(ROOT,'pre-market-intelligence-ui.js');
const POST=path.join(ROOT,'pre-market-post-open-ai.js');
const UI_MARK='VTRADE_PREMARKET_INTELLIGENCE_UI_V2';
function installDashboardUI(){
  if(!fs.existsSync(DASHBOARD)||!fs.existsSync(UI)||!fs.existsSync(POST)) return;
  let s=fs.readFileSync(DASHBOARD,'utf8');
  const anchor='  <script src="terminal-pre-market.js"></script>';
  if(!s.includes(anchor)) return;
  if(!s.includes(UI_MARK)) s=s.replace(anchor,anchor+`\n  <script src="pre-market-intelligence-ui.js?v=20260819-v2"></script><!-- ${UI_MARK} -->`);
  if(!s.includes('pre-market-post-open-ai.js')) s=s.replace('</body>',`  <script src="pre-market-post-open-ai.js?v=20260819-post-open"></script>\n</body>`);
  fs.writeFileSync(DASHBOARD,s,'utf8');
  console.log('[V-TRADE START] Pre-Market Intelligence V2 + Post-Open AI UI installed');
}
installDashboardUI();

// Pre-Market route boot hotfix MUST run before server.js is required.
// It installs the Candle-Open MTF endpoint and compatibility aliases so the
// dashboard never falls back to HTTP 404 when requesting Pre-Market data.
try {
  require('./pre-market-route-boot-hotfix.js');
  console.log('[V-TRADE START] Pre-Market route boot hotfix loaded');
} catch (e) {
  console.error('[V-TRADE PRE-MARKET] FATAL boot hotfix:', e.stack || e.message);
  process.exitCode=1;
  throw e;
}

// AI Confirmation Runtime V3 MUST load before server.js. Do not swallow a
// startup error: running with the old AI path would hide the provider failure
// and make the dashboard show the legacy WAIT/0/100/NEUTRAL fallback.
try {
  require('./ai-confirmation-runtime-v2.js');
  console.log('[V-TRADE START] AI Confirmation Runtime V3 bootstrapped');
} catch (e) {
  console.error('[V-TRADE AI] FATAL: AI Confirmation Runtime V3 failed:', e.stack || e.message);
  process.exitCode=1;
  throw e;
}

require('./pre-market-structure-hook.js');
require('./predeploy-consistency-hotfix.js');
require('./vtrade-start.js');
require('./server-launcher.js');