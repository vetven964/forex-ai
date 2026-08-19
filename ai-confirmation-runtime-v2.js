// V-TRADE AI — Local ICT Confirmation Runtime V7
// AI is confirmation-only. External paid AI is hard-disabled for this runtime.
// The deterministic broker-native ICT engine remains authoritative.
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const SERVER = path.join(__dirname, 'server.js');
const MARK = 'VTRADE_LOCAL_CONFIRM_RUNTIME_V7';

process.env.OPENAI_ENABLED = 'false';
process.env.OPENAI_MODEL = 'local-ict-v1';

function replaceOnce(source, oldText, newText) {
  if (!source.includes(oldText)) return { source, changed: false };
  return { source: source.replace(oldText, newText), changed: true };
}

// Telegram presentation only. The server-authoritative engine still decides BUY/SELL/WAIT.
// Alert tiers:
// M5  -> BUY/SELL + Confidence + Zone + SL + TP1
// M15+ -> BUY/SELL + Confidence + Zone + SL + TP1 + TP2
// H1+ -> BUY/SELL + Confidence + Zone + SL + TP1 + TP2 + TP3
function telegramTierText(a) {
  const n = x => Number.isFinite(Number(x)) ? Number(x).toFixed(2) : 'WAIT';
  const side = String(a?.signal || a?.side || 'WAIT').toUpperCase();
  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();
  const price = n(a?.livePrice ?? a?.price ?? a?.bid ?? a?.ask);
  const confidenceRaw = Number(a?.confidence ?? a?.score?.confidence ?? a?.setupScore ?? 0);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
  const tfRaw = String(a?.timeframe ?? a?.timeFrame ?? a?.tf ?? a?.selectedTF ?? a?.executionTF ?? 'M5').toUpperCase();
  const tf = tfRaw.replace(/[^A-Z0-9]/g, '');
  const minutes = tf === 'M1' ? 1 : tf === 'M5' ? 5 : tf === 'M15' ? 15 : tf === 'M30' ? 30 : tf === 'H1' ? 60 : tf === 'H4' ? 240 : tf === 'D1' ? 1440 : 5;
  const z = a?.entryZone || a?.candidateZone || a?.referenceZone || a?.zone || {};
  const zone = Number.isFinite(Number(z?.low)) && Number.isFinite(Number(z?.high)) ? `${n(z.low)} – ${n(z.high)}` : 'WAIT';
  const sl = ['BUY','SELL'].includes(side) ? n(a?.stopLoss ?? a?.sl) : 'WAIT';
  const tp = Array.isArray(a?.takeProfit) ? a.takeProfit : Array.isArray(a?.tp) ? a.tp : [];
  const action = side === 'BUY' ? '🟢 BUY' : side === 'SELL' ? '🔴 SELL' : bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT';
  const lines = [
    '🤖 *V TRADE AI — XAUUSD*',
    '',
    `💰 Price: *${price}*`,
    `⏱ TF: *${tfRaw}*`,
    `⚡ Action: *${action}*`,
    `🧠 Confidence: *${confidence}/100*`,
    '',
    `📍 Zone: *${zone}*`,
    `🛑 SL: *${sl}*`,
    `🎯 TP1: *${['BUY','SELL'].includes(side) ? n(tp[0]) : 'WAIT'}*`
  ];
  if (minutes >= 15) lines.push(`🎯 TP2: *${['BUY','SELL'].includes(side) ? n(tp[1]) : 'WAIT'}*`);
  if (minutes >= 60) lines.push(`🎯 TP3: *${['BUY','SELL'].includes(side) ? n(tp[2]) : 'WAIT'}*`);
  return lines.join('\n');
}

function simpleTelegramSource(source) {
  const marker = 'function telegramWaitText(a) {';
  if (!source.includes(marker)) return source;
  const start = source.indexOf(marker);
  const end = source.indexOf('\nfunction ', start + marker.length);
  if (end < 0) return source;
  const fn = `function telegramWaitText(a) { return telegramTierText(a); }\n`;
  return source.slice(0,start)+fn+source.slice(end);
}

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
            src = simpleTelegramSource(src);
            // Inject the shared formatter before server.js functions so both the
            // launcher and server Telegram paths use the same timeframe tiers.
            if (!src.includes('function telegramTierText(a) {')) {
              const marker = 'function telegramWaitText(a) {';
              const idx = src.indexOf(marker);
              if (idx >= 0) src = src.slice(0, idx) + telegramTierTextSource() + '\n' + src.slice(idx);
            }
            return oldCompile.call(this, src, file);
          };
          try { return next(mod, filename); } finally { mod._compile = oldCompile; }
        };
      }
    });
    ext.__vtradeSimpleTelegramGuard = true;
    console.log('[V-TRADE TELEGRAM] TIMEFRAME TIER FORMAT GUARD ACTIVE');
  } catch (e) {
    console.warn('[V-TRADE TELEGRAM] tier format guard skipped:', e.message);
  }
}

function telegramTierTextSource() {
  return `function telegramTierText(a) {\n  const n=x=>Number.isFinite(Number(x))?Number(x).toFixed(2):'WAIT';\n  const side=String(a?.signal||a?.side||'WAIT').toUpperCase();\n  const bias=String(a?.bias||a?.directionBand||'NEUTRAL').toUpperCase();\n  const price=n(a?.livePrice??a?.price??a?.bid??a?.ask);\n  const cr=Number(a?.confidence??a?.score?.confidence??a?.setupScore??0);\n  const confidence=Number.isFinite(cr)?Math.max(0,Math.min(100,Math.round(cr))):0;\n  const tfRaw=String(a?.timeframe??a?.timeFrame??a?.tf??a?.selectedTF??a?.executionTF??'M5').toUpperCase();\n  const tf=tfRaw.replace(/[^A-Z0-9]/g,'');\n  const minutes=tf==='M1'?1:tf==='M5'?5:tf==='M15'?15:tf==='M30'?30:tf==='H1'?60:tf==='H4'?240:tf==='D1'?1440:5;\n  const z=a?.entryZone||a?.candidateZone||a?.referenceZone||a?.zone||{};\n  const zone=Number.isFinite(Number(z?.low))&&Number.isFinite(Number(z?.high))?n(z.low)+' – '+n(z.high):'WAIT';\n  const sl=['BUY','SELL'].includes(side)?n(a?.stopLoss??a?.sl):'WAIT';\n  const tp=Array.isArray(a?.takeProfit)?a.takeProfit:Array.isArray(a?.tp)?a.tp:[];\n  const action=side==='BUY'?'🟢 BUY':side==='SELL'?'🔴 SELL':bias==='BULLISH'?'🟡 WAIT — BUY BIAS':bias==='BEARISH'?'🟡 WAIT — SELL BIAS':'🟡 WAIT';\n  const lines=['🤖 *V TRADE AI — XAUUSD*','','💰 Price: *'+price+'*','⏱ TF: *'+tfRaw+'*','⚡ Action: *'+action+'*','🧠 Confidence: *'+confidence+'/100*','', '📍 Zone: *'+zone+'*','🛑 SL: *'+sl+'*','🎯 TP1: *'+(['BUY','SELL'].includes(side)?n(tp[0]):'WAIT')+'*'];\n  if(minutes>=15)lines.push('🎯 TP2: *'+(['BUY','SELL'].includes(side)?n(tp[1]):'WAIT')+'*');\n  if(minutes>=60)lines.push('🎯 TP3: *'+(['BUY','SELL'].includes(side)?n(tp[2]):'WAIT')+'*');\n  return lines.join('\\n');\n}\n`;
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
    const localFn = `async function openAIConfirmXauAnalysis(a) {\n  const c=a?.confirmations||{};\n  const signal=['BUY','SELL'].includes(a?.signal)?a.signal:'WAIT';\n  const allGates=c.allGatesPassed===true;\n  const evidence=[['MTF alignment',c.mtfAligned===true],['Liquidity sweep',c.liquiditySweep===true],['MSS',c.mss===true],['BOS',c.bos===true],['Fresh FVG/OB',c.freshFvg===true||c.freshOb===true],['Premium/Discount',c.premiumDiscountOk===true],['Displacement or momentum',c.displacement?.confirmed===true||c.technicalMomentumOk===true],['Trend strength',c.trendStrengthOk===true],['Spread',c.spreadOk===true],['Retest / execution zone',c.retest===true||c.zoneIsNear===true]];\n  const passed=evidence.filter(x=>x[1]).map(x=>x[0]),missing=evidence.filter(x=>!x[1]).map(x=>x[0]);\n  const decision=allGates&&signal!=='WAIT'?signal:'WAIT';\n  const confidence=decision!=='WAIT'?Math.max(0,Math.min(100,Number(a?.confidence??a?.setupScore??0))):Math.max(0,Math.min(100,Number(a?.confidence??a?.setupScore??0)));\n  return {enabled:true,configured:true,provider:'LOCAL_DETERMINISTIC',model:'local-ict-v1',status:'local',decision,confidence,agreement:decision!=='WAIT'?'AGREE':'NEUTRAL',reasons:decision!=='WAIT'?['Local ICT confirmation agrees with the server-authoritative execution gate.',...passed.slice(0,6)]:['External AI confirmation is disabled.',...missing.slice(0,6)],missingConfirmations:missing,riskFlags:[],summary:decision!=='WAIT'?'Local ICT confirmation passed.':'Local ICT confirmation is waiting for mandatory execution gates.',gate:{engineSignal:signal,engineConfidence:Number(a?.confidence??a?.setupScore??0),enginePassed:allGates,aiEligible:allGates&&decision!=='WAIT',finalSignal:decision},localEvidence:{passed,missing}};\n}\n`;
    s=s.slice(0,start)+localFn+s.slice(end); changed=true;
  }

  const tgStart=s.indexOf('function telegramText(a) {');
  const tgEnd=tgStart>=0?s.indexOf('\nfunction ',tgStart+1):-1;
  if(tgStart>=0&&tgEnd>tgStart){
    s=s.slice(0,tgStart)+telegramTierTextSource()+s.slice(tgEnd); changed=true;
  }
  if(!s.includes(MARK)){s='// '+MARK+' installed by runtime hotfix\n'+s;changed=true;}
  if(changed)fs.writeFileSync(SERVER,s,'utf8');
  installTelegramLoaderGuard();
  console.log('[V-TRADE AI] Local ICT Confirmation V7 active | OPENAI_ENABLED=false | timeframe tier Telegram alerts enabled');
}

install();