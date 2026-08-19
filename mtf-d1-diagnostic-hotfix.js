// V-TRADE AI — D1 MTF diagnostic (non-fatal)
// Diagnostics only. Never changes execution gates or Telegram authorization.
'use strict';

const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const MARKER = '// V-TRADE AI D1 MTF DIAGNOSTIC HOTFIX INSTALLED';

try {
  const source = fs.readFileSync(SERVER_FILE, 'utf8');
  const hasD1Feed = /timeframes\?\.D1|timeframes\[.D1.\]/.test(source);
  const hasExecutionGate = /required=\[.M5.\s*,\s*.M15.\s*,\s*.H1.\s*,\s*.H4./.test(source);

  // D1 is context-only. M5/M15/H1/H4 remain the broker-readiness gate.
  console.log(
    `[V-TRADE MTF] D1 diagnostic ${hasD1Feed ? 'available' : 'not detected'} | ` +
    `execution gate ${hasExecutionGate ? 'M5/M15/H1/H4' : 'check required'} | non-fatal`
  );

  // Do not rewrite server.js and do not set process.exitCode on diagnostic mismatch.
  // A diagnostic must never take down the trading backend.
  void MARKER;
} catch (e) {
  console.warn('[V-TRADE MTF] D1 diagnostic skipped:', e?.message || e);
}
