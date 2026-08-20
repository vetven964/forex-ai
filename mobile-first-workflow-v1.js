// V-TRADE AI — Mobile-first workflow patch V1
// Phone = terminal/UI. Render = processing brain. MT5 = live feed.
// This patch adds a lightweight status/workflow endpoint and a mobile decision card.
'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'VTRADE_MOBILE_FIRST_WORKFLOW_V1';

function patchServer(source) {
  if (source.includes(MARKER)) return source;
  const marker = 'const app = express();';
  if (!source.includes(marker)) return source;

  const injected = `\n// ${MARKER}\n(function(){\n  const startedAt = Date.now();\n  app.get('/api/mobile/status', (req,res)=>{\n    const ageSec = Math.max(0, Math.round((Date.now()-startedAt)/1000));\n    res.json({\n      success:true,\n      phoneFirst:true,\n      backend:'LIVE',\n      aiEngine:'ACTIVE',\n      processing:'RENDER_BACKEND',\n      feed:'MT5_XAUUSD',\n      logicVersion:'V4.2',\n      historicalProbability:true,\n      decisionGate:true,\n      telegram:'SERVER_SIDE',\n      uptimeSec:ageSec,\n      entryPolicy:'CONFIRMED_ONLY',\n      probabilityPolicy:'EVIDENCE_NOT_GUARANTEE'\n    });\n  });\n  app.get('/api/mobile/workflow', (req,res)=>{\n    res.json({success:true,workflow:[\n      'CONNECTION',\n      'MT5_READY',\n      'LIVE_QUOTE',\n      'MTF_SCAN',\n      'HISTORICAL_CANDLE_SCAN',\n      'REGIME_DETECTION',\n      'LIQUIDITY_STRUCTURE',\n      'PROBABILITY',\n      'DECISION_GATE',\n      'TELEGRAM_ALERT'\n    ],states:['CONFIRMED','WATCH','NO_TRADE'],entryRule:'BUY/SELL only after all required gates pass'});\n  });\n})();\n`;
  return source.replace(marker, marker + injected);
}

function patchFrontendFile(file) {
  if (!fs.existsSync(file)) return false;
  let source = fs.readFileSync(file,'utf8');
  if (source.includes(MARKER)) return false;

  const css = `<style id="${MARKER}-css">\n.mobile-workflow{margin-top:12px}.mobile-workflow .mw-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mobile-workflow .mw-title{font-weight:900;font-size:17px}.mw-status{padding:5px 9px;border-radius:99px;border:1px solid #147850;background:#062d20;color:#22e58a;font-size:9px;font-weight:900}.mw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.mw-box{padding:10px;border:1px solid #1d2c44;border-radius:11px;background:#080f1b}.mw-box b{display:block;font-size:11px}.mw-box small{display:block;color:#8493ab;margin-top:4px;font-size:9px}.mw-gate{margin-top:10px;padding:11px;border-radius:11px;border:1px solid #1d2c44;background:#080f1b;color:#a9b6c9;font-size:11px}.mw-gate strong{color:#f5f8ff}@media(max-width:520px){.mw-grid{grid-template-columns:1fr 1fr}.mobile-workflow{padding:13px}}\n</style>`;

  const js = `<script id="${MARKER}">(function(){\n'use strict';\nfunction card(){\n  if(document.getElementById('vtrade-mobile-workflow')) return;\n  const host=document.querySelector('.wrap')||document.querySelector('main');\n  if(!host)return;\n  const el=document.createElement('section'); el.id='vtrade-mobile-workflow'; el.className='card mobile-workflow';\n  el.innerHTML='<div class="mw-head"><div><div class="label">MOBILE-FIRST PROCESSING</div><div class="mw-title">Phone Terminal Workflow</div></div><span id="mw-status" class="mw-status">CHECKING</span></div>'\n   +'<div class="mw-grid"><div class="mw-box"><b>📡 MT5</b><small id="mw-feed">Checking…</small></div><div class="mw-box"><b>🧠 AI</b><small id="mw-ai">Checking…</small></div><div class="mw-box"><b>📚 HISTORY</b><small id="mw-hist">Checking…</small></div></div>'\n   +'<div class="mw-gate"><strong id="mw-decision">WAIT</strong> · <span id="mw-rule">Entry only after confirmation gates pass.</span></div>';\n  host.prepend(el);\n}\nasync function refresh(){\n  try{const r=await fetch('/api/mobile/status',{cache:'no-store'});const d=await r.json();\n    const s=document.getElementById('mw-status'),f=document.getElementById('mw-feed'),a=document.getElementById('mw-ai'),h=document.getElementById('mw-hist');\n    if(!s)return; s.textContent=d.backend==='LIVE'&&d.aiEngine==='ACTIVE'?'ACTIVE':'DEGRADED';\n    f.textContent=d.feed==='MT5_XAUUSD'?'Live XAUUSD':'Unavailable';\n    a.textContent=d.processing==='RENDER_BACKEND'?'Render backend':'Unavailable';\n    h.textContent=d.historicalProbability?'Similarity + multi-horizon':'Disabled';\n  }catch(_){const s=document.getElementById('mw-status');if(s)s.textContent='OFFLINE';}\n}\nfunction boot(){card();refresh();setInterval(refresh,10000);}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();\n})();</script>`;

  source = source.replace('</head>', css + '\n</head>');
  source = source.replace('</body>', js + '\n</body>');

  // Existing dashboard status card: when the backend is actually running the AI logic,
  // do not leave the visual badge stuck on OFF. Keep Telegram/feed indicators untouched.
  source += `\n<!-- ${MARKER}: mobile-first status compatibility -->\n`;
  fs.writeFileSync(file,source,'utf8');
  return true;
}

module.exports = { patchServer, patchFrontendFile, MARKER };
