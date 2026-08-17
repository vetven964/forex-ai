// V-TRADE AI — MT5 readiness grace patch
// Prevents the dashboard/API from failing during the short startup race where
// the first ICT request arrives before the MT5 bridge's first QUOTE payload.
const Module = require('module');
const path = require('path');
const fs = require('fs');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const originalJsLoader = Module._extensions['.js'];
const WAIT_MS = Math.max(1000, Number(process.env.MT5_ANALYSIS_READY_WAIT_MS || 10000));
const POLL_MS = Math.max(100, Number(process.env.MT5_ANALYSIS_READY_POLL_MS || 250));

function patchReadiness(source) {
  const oldBlock = `  if(readinessMissing.length) {
    const age = brokerFeed.quote ? Math.max(0,Math.round((Date.now()-brokerFeed.receivedAt)/1000)) : null;
    const detail = \`VT Markets MT5 feed not ready: missing=\${readinessMissing.join(',')} ageSec=\${age===null?'null':age} maxAgeMs=\${MT5_MAX_AGE_MS}\`;
    throw new Error(detail);
  }`;

  const newBlock = `  if(readinessMissing.length) {
    // MT5 bridge startup is asynchronous. Give the broker-native feed a short
    // grace period before declaring ICT analysis unavailable. This does not
    // fabricate data and never bypasses the freshness/history requirements.
    const deadline = Date.now() + MT5_ANALYSIS_READY_WAIT_MS;
    while (readinessMissing.length && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, MT5_ANALYSIS_READY_POLL_MS));
      const refreshedLive = brokerLivePrice();
      if (refreshedLive) {
        readinessMissing.splice(0, readinessMissing.length);
        for (const tf of ['M5','M15','H1','H4']) {
          const rows = {M5:parseBrokerCandles('M5'),M15:parseBrokerCandles('M15'),H1:parseBrokerCandles('H1'),H4:parseBrokerCandles('H4')}[tf];
          if (!rows) readinessMissing.push(tf);
        }
      }
    }
    if(readinessMissing.length) {
      const age = brokerFeed.quote ? Math.max(0,Math.round((Date.now()-brokerFeed.receivedAt)/1000)) : null;
      const detail = \`VT Markets MT5 feed not ready: missing=\${readinessMissing.join(',')} ageSec=\${age===null?'null':age} maxAgeMs=\${MT5_MAX_AGE_MS}\`;
      throw new Error(detail);
    }
    console.log('[MT5 READINESS] Feed became READY during analysis grace period');
  }`;

  if (!source.includes(oldBlock)) {
    console.warn('[MT5 READINESS] readiness block not found; leaving server.js unchanged');
    return source;
  }
  return source.replace(oldBlock, newBlock);
}

Module._extensions['.js'] = function vtradeMt5ReadinessLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalJsLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchReadiness(source);
  return mod._compile(source, filename);
};

console.log(`[MT5 READINESS] grace patch active | wait=${WAIT_MS}ms poll=${POLL_MS}ms`);
