// V-TRADE AI — Local ICT Confirmation Runtime V6
// AI is confirmation-only. External paid AI is hard-disabled for this runtime.
// The deterministic broker-native ICT engine remains authoritative.
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_LOCAL_CONFIRM_RUNTIME_V6';

process.env.OPENAI_ENABLED = 'false';
process.env.OPENAI_MODEL = 'local-ict-v1';

function replaceOnce(source, oldText, newText) {
  if (!source.includes(oldText)) return { source, changed: false };
  return { source: source.replace(oldText, newText), changed: true };
}

function simpleTelegramSource(source) {
  const marker = 'function telegramWaitText(a) {';
  if (!source.includes(marker)) return source;
  const start = source.indexOf(marker);
  const end = source.indexOf('\nfunction ', start + marker.length);
  if (end < 0) return source;
  const fn = `function telegramWaitText(a) {\n  const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';\n  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();\n  const bias=String(a?.bias||a?.directionBand||'NEUTRAL').toUpperCase();\n  const action=side==='BUY'?'🟢 BUY':side==='SELL'?'🔴 SELL':bias==='BULLISH'?'🟡 WAIT — BUY BIAS':bias==='BEARISH'?'🟡 WAIT — SELL BIAS':'🟡 WAIT';\n  const z=a?.entryZone||a?.candidateZone||a?.referenceZone||{};\n  const zone=Number.isFinite(Number(z?.low))&&Number.isFinite(Number(z?.high))?n(z.low)+' – '+n(z.high):'WAIT';\n  const entry=['BUY','SELL'].includes(side)?n(a?.entry):'WAIT';\n  const sl=['BUY','SELL'].includes(side)?n(a?.stopLoss):'WAIT';\n  const tp=Array.isArray(a?.takeProfit)?a.takeProfit:[];\n  return ['🤖 *V TRADE AI — XAUUSD*','', '*'+action+'*','📍 Zone: *'+zone+'*','🎯 Entry: *'+entry+'*','🛑 SL: *'+sl+'*','🎯 TP1: *'+n(tp[0])+'*','🎯 TP2: *'+n(tp[1])+'*','🎯 TP3: *'+n(tp[2])+'*'].join('\\n');\n}`;
  return source.slice(0,start)+fn+source.slice(end);
}

// server-launcher.js is the active Render path and replaces the JS loader after
// this file is loaded. Wrap that replacement and intercept server.js compilation
// so the launcher's internal WAIT-card patch cannot re-add diagnostics to Telegram.
function installTelegramLoaderGuard() {
  try {
    const ext = Module._extensions;
    if (ext.__vtradeSimpleTelegramGuard) return;
    let current = ext['.js'];
    Object.defineProperty(ext, '.js', {
      configurable: true,
      enumerable: true,
      get() { return current; },
      set(next) {
        current = function(mod, filename) {
          if (path.resolve(filename) !== SERVER) return next(mod, filename);
          const oldCompile = mod._compile;
          mod._compile = function(src, file) {
            return oldCompile.call(this, simpleTelegramSource(src), file);
          };
          try { return next(mod, filename); } finally { mod._compile = oldCompile; }
        };
      }
    });
    ext.__vtradeSimpleTelegramGuard = true;
    console.log('[V-TRADE TELEGRAM] SIMPLE FORMAT GUARD ACTIVE');
  } catch (e) {
    console.warn('[V-TRADE TELEGRAM] simple format guard skipped:', e.message);
  }
}

function install() {
  if (!fs.existsSync(SERVER)) {
    console.warn('[V-TRADE AI] server.js not found; environment hard-disable still active');
    installTelegramLoaderGuard();
    return;
  }

  let s = fs.readFileSync(SERVER, 'utf8');
  let changed = false;
  let r = replaceOnce(s, "const OPENAI_ENABLED = String(process.env.OPENAI_ENABLED || 'false').toLowerCase() === 'true';", "const OPENAI_ENABLED = false;");
  s = r.source; changed ||= r.changed;
  r = replaceOnce(s, "const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5.6-luna').trim();", "const OPENAI_MODEL = 'local-ict-v1';");
  s = r.source; changed ||= r.changed;
  const enabledPattern = /const OPENAI_ENABLED\s*=\s*[^;]+;/;
  if (enabledPattern.test(s)) { const next=s.replace(enabledPattern,'const OPENAI_ENABLED = false;'); changed ||= next!==s; s=next; }
  const modelPattern = /const OPENAI_MODEL\s*=\s*[^;]+;/;
  if (modelPattern.test(s)) { const next=s.replace(modelPattern,"const OPENAI_MODEL = 'local-ict-v1';"); changed ||= next!==s; s=next; }

  const start = s.indexOf('async function openAIConfirmXauAnalysis(a) {');
  const end = s.indexOf('\nasync function buildXauAnalysis()', start);
  if (start >= 0 && end > start) {
    const localFn = `async function openAIConfirmXauAnalysis(a) {\n  const c=a?.confirmations||{};\n  const signal=['BUY','SELL'].includes(a?.signal)?a.signal:'WAIT';\n  const allGates=c.allGatesPassed===true;\n  const evidence=[['MTF alignment',c.mtfAligned===true],['Liquidity sweep',c.liquiditySweep===true],['MSS',c.mss===true],['BOS',c.bos===true],['Fresh FVG/OB',c.freshFvg===true||c.freshOb===true],['Premium/Discount',c.premiumDiscountOk===true],['Displacement or momentum',c.displacement?.confirmed===true||c.technicalMomentumOk===true],['Trend strength',c.trendStrengthOk===true],['Spread',c.spreadOk===true],['Retest / execution zone',c.retest===true||c.zoneIsNear===true]];\n  const passed=evidence.filter(x=>x[1]).map(x=>x[0]),missing=evidence.filter(x=>!x[1]).map(x=>x[0]);\n  const decision=allGates&&signal!=='WAIT'?signal:'WAIT';\n  const confidence=decision!=='WAIT'?Math.max(0,Math.min(100,Number(a?.confidence??a?.setupScore??0))):0;\n  return {enabled:true,configured:true,provider:'LOCAL_DETERMINISTIC',model:'local-ict-v1',status:'local',decision,confidence,agreement:decision!=='WAIT'?'AGREE':'NEUTRAL',reasons:decision!=='WAIT'?['Local ICT confirmation agrees with the server-authoritative execution gate.',...passed.slice(0,6)]:['External AI confirmation is disabled.',...missing.slice(0,6)],missingConfirmations:missing,riskFlags:[],summary:decision!=='WAIT'?'Local ICT confirmation passed.':'Local ICT confirmation is waiting for mandatory execution gates.',gate:{engineSignal:signal,engineConfidence:Number(a?.confidence??a?.setupScore??0),enginePassed:allGates,aiEligible:allGates&&decision!=='WAIT',finalSignal:decision},localEvidence:{passed,missing}};\n}\n`;
    s=s.slice(0,start)+localFn+s.slice(end); changed=true;
  }

  const tgStart=s.indexOf('function telegramText(a) {');
  const tgEnd=tgStart>=0?s.indexOf('\nfunction ',tgStart+1):-1;
  if(tgStart>=0&&tgEnd>tgStart){
    const simple=`function telegramText(a) {\n  const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'—';\n  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();\n  const action=side==='BUY'?'🟢 BUY':side==='SELL'?'🔴 SELL':'🟡 WAIT';\n  const z=a?.entryZone||a?.candidateZone||a?.referenceZone||{};\n  const zone=Number.isFinite(Number(z?.low))&&Number.isFinite(Number(z?.high))?n(z.low)+' – '+n(z.high):'WAIT';\n  const entry=['BUY','SELL'].includes(side)?n(a?.entry):'WAIT';\n  const sl=['BUY','SELL'].includes(side)?n(a?.stopLoss):'WAIT';\n  const tp=Array.isArray(a?.takeProfit)?a.takeProfit:[];\n  return ['🤖 *V TRADE AI — XAUUSD*','', '*'+action+'*','📍 Zone: *'+zone+'*','🎯 Entry: *'+entry+'*','🛑 SL: *'+sl+'*','🎯 TP1: *'+n(tp[0])+'*','🎯 TP2: *'+n(tp[1])+'*','🎯 TP3: *'+n(tp[2])+'*'].join('\\n');\n}\n`;
    s=s.slice(0,tgStart)+simple+s.slice(tgEnd); changed=true;
  }
  if(!s.includes(MARK)){s='// '+MARK+' installed by runtime hotfix\n'+s;changed=true;}
  if(changed)fs.writeFileSync(SERVER,s,'utf8');
  installTelegramLoaderGuard();
  console.log('[V-TRADE AI] Local ICT Confirmation V6 active | OPENAI_ENABLED=false | simple Telegram format guard enabled');
}

install();