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
require('./pre-market-structure-hook.js');
require('./predeploy-consistency-hotfix.js');
require('./vtrade-start.js');
require('./server-launcher.js');
