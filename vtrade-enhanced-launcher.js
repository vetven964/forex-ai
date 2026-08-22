// V TRADE AI enhanced launcher.
// CORE = MT5/MTF/ICT/Pre-Market/AI analysis only.
// TELEGRAM = independent child process consuming CORE final-signal contract.
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=__dirname;
const DASHBOARD=path.join(ROOT,'premium-dashboard-live.html');
const POST=path.join(ROOT,'pre-market-post-open-ai.js');
const AUTH_UI=path.join(ROOT,'pre-market-authority-ui-hotfix.js');
const V9=path.join(ROOT,'pre-market-v9.js');
const UI_MARK='VTRADE_PREMARKET_INTELLIGENCE_UI_V2';
const AUTH_UI_MARK='VTRADE_PREMARKET_AUTHORITY_UI_V1';
const V9_MARK='VTRADE_PREMARKET_V9_UI';

function installDashboardUI(){
  if(!fs.existsSync(DASHBOARD)||!fs.existsSync(POST)||!fs.existsSync(V9))return;
  let s=fs.readFileSync(DASHBOARD,'utf8');
  const anchor='  <script src="terminal-pre-market.js"></script>';
  if(!s.includes(anchor))return;
  s=s.replace(/\s*<script src="pre-market-intelligence-ui\.js[^>]*><\/script>(?:<!--[^>]*-->)?/g,'');
  s=s.replace(/\s*<script src="pre-market-v8\.js[^>]*><\/script>(?:<!--[^>]*-->)?/g,'');
  const v9Tag=`  <script src="pre-market-v9.js?v=20260821-v9"></script><!-- ${V9_MARK} -->\n`;
  if(!s.includes(V9_MARK))s=s.replace(anchor,v9Tag+anchor);
  if(fs.existsSync(AUTH_UI)&&!s.includes(AUTH_UI_MARK))s=s.replace(anchor,`  <script src="pre-market-authority-ui-hotfix.js?v=20260821-v1"></script><!-- ${AUTH_UI_MARK} -->\n`+anchor);
  if(!s.includes('pre-market-post-open-ai.js'))s=s.replace('</body>',`  <script src="pre-market-post-open-ai.js?v=20260819-post-open"></script>\n</body>`);
  fs.writeFileSync(DASHBOARD,s,'utf8');
  console.log('[V-TRADE START] Pre-Market V9 active; duplicate renderers removed');
}

function installTelegramBridge(){
  const server=path.join(ROOT,'server.js');
  if(!fs.existsSync(server))throw new Error('server.js not found');
  let s=fs.readFileSync(server,'utf8');
  const anchor='const app = express();';
  const marker='VTRADE_TELEGRAM_SIGNAL_BRIDGE_V1';
  if(!s.includes(marker)){
    if(!s.includes(anchor))throw new Error('server app marker not found');
    const code=`\n/* ${marker} */\ntry{require('./telegram-signal-bridge.js').install(app);}catch(e){console.error('[V-TRADE TELEGRAM BRIDGE] install failed:',e.message);throw e;}\n`;
    s=s.replace(anchor,anchor+code);
    fs.writeFileSync(server,s,'utf8');
    console.log('[V-TRADE TELEGRAM BRIDGE] installed into CORE');
  }
}

function startIndependentTelegram(){
  if(String(process.env.VTRADE_TELEGRAM_SEPARATE||'true').toLowerCase()!=='true'){
    console.log('[V-TRADE TELEGRAM AI] separate service disabled');
    return;
  }
  const token=process.env.TELEGRAM_TOKEN||process.env.TELEGRAM_AUTO_TOKEN||'';
  const chat=process.env.TELEGRAM_CHAT_ID||process.env.TELEGRAM_AUTO_CHAT_ID||'';
  if(!token||!chat){
    console.warn('[V-TRADE TELEGRAM AI] not started: Telegram credentials missing');
    return;
  }
  const childEnv={...process.env,
    TELEGRAM_TOKEN:token,TELEGRAM_CHAT_ID:chat,
    TELEGRAM_AUTO_TOKEN:'',TELEGRAM_AUTO_CHAT_ID:'',
    TELEGRAM_AUTO_ALERT_ENABLED:'false',
    VTRADE_CORE_URL:process.env.VTRADE_CORE_URL||`http://127.0.0.1:${process.env.PORT||10000}`,
    VTRADE_TELEGRAM_SEPARATE:'true'
  };
  // CORE must not initialize or deliver Telegram alerts.
  process.env.TELEGRAM_TOKEN='';
  process.env.TELEGRAM_CHAT_ID='';
  process.env.TELEGRAM_AUTO_TOKEN='';
  process.env.TELEGRAM_AUTO_CHAT_ID='';
  process.env.TELEGRAM_AUTO_ALERT_ENABLED='false';
  process.env.VTRADE_TELEGRAM_SEPARATE='true';
  console.log('[V-TRADE TELEGRAM SEPARATION] Legacy CORE Telegram Auto Scanner = DISABLED');
  const child=spawn(process.execPath,[path.join(ROOT,'telegram-bot-ai-service.js')],{env:childEnv,stdio:'inherit'});
  child.on('exit',(code,signal)=>console.warn('[V-TRADE TELEGRAM AI] child exited | code='+(code??'')+' signal='+(signal||'')));
  child.on('error',e=>console.error('[V-TRADE TELEGRAM AI] child error:',e.message));
  global.__vtradeTelegramChild=child;
  console.log('[V-TRADE PROCESS SEPARATION] CORE=PRE-MARKET/AI | TELEGRAM=INDEPENDENT CHILD');
}

installDashboardUI();
installTelegramBridge();
startIndependentTelegram();

try{require('./package-access-hotfix.js');console.log('[V-TRADE START] Package/RBAC access gate loaded');}
catch(e){console.error('[V-TRADE PACKAGE] FATAL:',e.stack||e.message);throw e;}

try{require('./pre-market-route-boot-hotfix.js');console.log('[V-TRADE START] Pre-Market route boot hotfix loaded');}
catch(e){console.error('[V-TRADE PRE-MARKET] FATAL boot hotfix:',e.stack||e.message);throw e;}

try{require('./ai-confirmation-runtime-v2.js');console.log('[V-TRADE START] AI Confirmation Runtime V3 bootstrapped');}
catch(e){console.error('[V-TRADE AI] FATAL:',e.stack||e.message);throw e;}

require('./pre-market-structure-hook.js');
require('./predeploy-consistency-hotfix.js');
require('./vtrade-start.js');
require('./server-launcher.js');
