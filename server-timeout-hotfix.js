// V-TRADE AI — runtime hotfix wrapper
// Preserve the existing server-launcher.js logic while preventing the API timeout
// watchdog from racing /api/analysis/xauusd and causing ERR_HTTP_HEADERS_SENT.
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync.bind(fs);

fs.readFileSync = function(file, ...args) {
  const source = originalReadFileSync(file, ...args);
  if (path.resolve(String(file)) !== SERVER_FILE || typeof source !== 'string') return source;
  let out = source;

  // The OpenAI confirmation layer can take up to OPENAI_TIMEOUT_MS (currently 9s).
  // The old API watchdog was 7s, so it could send 504 first and the route would
  // later call res.json(), crashing Node with ERR_HTTP_HEADERS_SENT.
  out = out.replace(
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(1500, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 7000));",
    "const ANALYSIS_REQUEST_TIMEOUT_MS = Math.max(15000, Number(process.env.ANALYSIS_REQUEST_TIMEOUT_MS || 15000));"
  );

  // Make the analysis response defensive even if an operator configures a shorter
  // watchdog in Render. Never attempt a second response after headers are sent.
  out = out.replace(
    "res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});",
    "if (!res.headersSent) res.json({success:true,...a,telegramConfigured:!!tg,aiConfirmation:ai});"
  );
  out = out.replace(
    "res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});",
    "if (!res.headersSent) res.status(503).json({success:false,error:'ICT analysis temporarily unavailable'});"
  );

  console.log('[V-TRADE HOTFIX] analysis timeout/header race protection active');
  return out;
};

require('./server-launcher.js');
