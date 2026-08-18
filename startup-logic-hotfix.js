// V-TRADE AI — startup logic hotfix
// Runs before server-launcher so the production source receives small, deterministic
// data-integrity fixes without changing the broker/MT5 contract.
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');

function normalizeTimestampMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  // MT5 payloads may arrive as Unix seconds or Unix milliseconds.
  return n < 1e12 ? n * 1000 : n;
}

function patchServer(source) {
  const old = "const candleAgeSec=m5.length?Math.max(0,(Date.now()-m5[m5.length-1].t)/1000):Infinity,candlesFresh=candleAgeSec<=15*60;";
  const replacement = `const closedCandleMaxAgeSec=Math.max(60,Number(process.env.CLOSED_CANDLE_MAX_AGE_SEC||900));
  const latestClosedM5Ms=m5.length?normalizeTimestampMs(m5[m5.length-1]?.t):NaN;
  const latestClosedM15Ms=m15.length?normalizeTimestampMs(m15[m15.length-1]?.t):NaN;
  const latestClosedH1Ms=h1.length?normalizeTimestampMs(h1[h1.length-1]?.t):NaN;
  const latestClosedH4Ms=h4.length?normalizeTimestampMs(h4[h4.length-1]?.t):NaN;
  const candleAgeSec=Number.isFinite(latestClosedM5Ms)?Math.max(0,(Date.now()-latestClosedM5Ms)/1000):Infinity;
  const closedAgeByTf={
    M5:Number.isFinite(latestClosedM5Ms)?Math.max(0,(Date.now()-latestClosedM5Ms)/1000):Infinity,
    M15:Number.isFinite(latestClosedM15Ms)?Math.max(0,(Date.now()-latestClosedM15Ms)/1000):Infinity,
    H1:Number.isFinite(latestClosedH1Ms)?Math.max(0,(Date.now()-latestClosedH1Ms)/1000):Infinity,
    H4:Number.isFinite(latestClosedH4Ms)?Math.max(0,(Date.now()-latestClosedH4Ms)/1000):Infinity
  };
  const candlesFresh=closedAgeByTf.M5<=Math.min(closedCandleMaxAgeSec,600)
    &&closedAgeByTf.M15<=Math.min(closedCandleMaxAgeSec*2,1800)
    &&closedAgeByTf.H1<=Math.min(closedCandleMaxAgeSec*8,7200)
    &&closedAgeByTf.H4<=Math.min(closedCandleMaxAgeSec*32,28800);`;

  if (source.includes(old)) {
    source = source.replace(old, replacement);
  } else if (!source.includes('closedAgeByTf')) {
    console.warn('[V-TRADE HOTFIX] closed-candle expression not found; no freshness patch applied');
  }

  if (!source.includes('function normalizeTimestampMs')) {
    const marker = "const HOST = '0.0.0.0';";
    const helper = `${marker}\n\nfunction normalizeTimestampMs(value) {\n  const n=Number(value);\n  if(!Number.isFinite(n)||n<=0)return NaN;\n  return n<1e12?n*1000:n;\n}`;
    source = source.replace(marker, helper);
  }

  // Never let a neutral timeframe carry an extreme directional score.
  // This is a semantic guard: NEUTRAL is centered at 50, while directional
  // evidence may move the score away from 50.
  source = source.replace(
    /const directionBand=directionScore>=80\?'BULLISH':directionScore>=60\?'BULLISH_BIAS':directionScore>=40\?'NEUTRAL':directionScore>=20\?'BEARISH_BIAS':'BEARISH';/g,
    "if(side==='NEUTRAL') directionScore=50;\n  const directionBand=directionScore>=80?'BULLISH':directionScore>=60?'BULLISH_BIAS':directionScore>=40?'NEUTRAL':directionScore>=20?'BEARISH_BIAS':'BEARISH';"
  );

  return source;
}

try {
  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  const patched = patchServer(source);
  if (patched !== source) {
    fs.writeFileSync(SERVER_FILE, patched, 'utf8');
    console.log('[V-TRADE HOTFIX] closed-candle timestamp normalization + neutral-score guard applied');
  } else {
    console.log('[V-TRADE HOTFIX] no source changes required');
  }
} catch (err) {
  console.error('[V-TRADE HOTFIX] startup patch failed:', err.message);
  process.exitCode = 1;
}

require('./server-launcher.js');
