// V TRADE AI enhanced single-process launcher.
// Keeps existing startup patches, while enabling Pre-Market Intelligence V9.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const DASHBOARD=path.join(ROOT,'premium-dashboard-live.html');
const UI=path.join(ROOT,'pre-market-intelligence-ui.js');
const POST=path.join(ROOT,'pre-market-post-open-ai.js');
const AUTH_UI=path.join(ROOT,'pre-market-authority-ui-hotfix.js');
const V9=path.join(ROOT,'pre-market-v9.js');
const UI_MARK='VTRADE_PREMARKET_INTELLIGENCE_UI_V2';
const AUTH_UI_MARK='VTRADE_PREMARKET_AUTHORITY_UI_V1';
const V9_MARK='VTRADE_PREMARKET_V9_UI';
function installDashboardUI(){
  if(!fs.existsSync(DASHBOARD)||!fs.existsSync(UI)||!fs.existsSync(POST)||!fs.existsSync(V9)) return;
  let s=fs.readFileSync(DASHBOARD,'utf8');
  const anchor='  <script src="terminal-pre-market.js"></script>';
  if(!s.includes(anchor)) return;

  // V9 MUST load before the legacy terminal-pre-market.js. The legacy renderer
  // must see the V9 global and exit, preventing its 30s loop from overwriting
  // the authoritative MT5 truth panel.
  const v9Tag=`  <script src="pre-market-v9.js?v=20260821-v9"></script><!-- ${V9_MARK} -->\n`;
  if(!s.includes(V9_MARK)) s=s.replace(anchor,v9Tag+anchor);

  if(fs.existsSync(AUTH_UI)&&!s.includes(AUTH_UI_MARK)) s=s.replace(anchor,`  <script src="pre-market-authority-ui-hotfix.js?v=20260821-v1"></script><!-- ${AUTH_UI_MARK} -->\n`+anchor);
  if(!s.includes(UI_MARK)) s=s.replace(anchor,anchor+`\n  <script src="pre-market-intelligence-ui.js?v=20260819-v2"></script><!-- ${UI_MARK} -->`);
  if(!s.includes('pre-market-post-open-ai.js')) s=s.replace('</body>',`  <script src="pre-market-post-open-ai.js?v=20260819-post-open"></script>\n</body>`);
  fs.writeFileSync(DASHBOARD,s,'utf8');
  console.log('[V-TRADE START] Pre-Market V9 loaded before legacy renderer; authoritative UI locked');
}
installDashboardUI();

try {
  require('./package-access-hotfix.js');
  console.log('[V-TRADE START] Package/RBAC access gate loaded');
} catch (e) {
  console.error('[V-TRADE PACKAGE] FATAL:', e.stack || e.message);
  process.exitCode=1;
  throw e;
}

try {
  require('./pre-market-route-boot-hotfix.js');
  console.log('[V-TRADE START] Pre-Market route boot hotfix loaded');
} catch (e) {
  console.error('[V-TRADE PRE-MARKET] FATAL boot hotfix:', e.stack || e.message);
  process.exitCode=1;
  throw e;
}

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
