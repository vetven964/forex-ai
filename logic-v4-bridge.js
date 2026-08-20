// V-TRADE AI — Logic V4 startup bridge
'use strict';
const fs=require('fs');
const path=require('path');
const SERVER_FILE=path.join(__dirname,'server.js');
const MARKER='VTRADE_LOGIC_V4_HISTORICAL_RANGE_ENGINE';

function install(){
  if(!fs.existsSync(SERVER_FILE)) throw new Error('server.js not found');
  let source=fs.readFileSync(SERVER_FILE,'utf8');
  if(source.includes(MARKER)) return;
  const marker='const app = express();';
  if(!source.includes(marker)) throw new Error('server app marker not found');
  const injected=`\n// ${MARKER}\n(function(){\n  const {applyV4}=require('./logic-v4-finalizer');\n  const __vtradeOriginalBuild=buildXauAnalysis;\n  buildXauAnalysis=async function(){\n    const base=await __vtradeOriginalBuild();\n    return applyV4(base);\n  };\n  console.log('[V-TRADE LOGIC V4] Historical candle scan + RANGE/TREND execution logic active');\n})();\n`;
  source=source.replace(marker,marker+injected);
  fs.writeFileSync(SERVER_FILE,source,'utf8');
}
module.exports={install};
