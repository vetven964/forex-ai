// V-TRADE AI production launcher
// One startup path for Render + npm start.
const fs = require('fs');
const Module = require('module');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const FRONTEND_FILE = path.resolve(__dirname, 'premium-dashboard-live.html');
const originalLoader = Module._extensions['.js'];

function patchExecutionLogic(source) {
  // Hard fix for the production ReferenceError seen in Render:
  // "executionLocationOk is not defined". The launcher must be able to recover
  // even when the exact source layout changes between server.js revisions.
  if (!/\bconst\s+executionLocationOk\s*=/.test(source) && /\bexecutionLocationOk\b/.test(source)) {
    const firstUse = source.search(/\bexecutionLocationOk\b/);
    if (firstUse >= 0) {
      const declaration = `const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;\n  `;
      source = source.slice(0, firstUse) + declaration + source.slice(firstUse);
      console.log('[V-TRADE LAUNCHER] executionLocationOk fallback declaration injected');
    }
  }

  const gatePattern = /(const\s+biasOk=[\s\S]*?structureAgreement=mssOk\|\|bosOk;)/;
  if (gatePattern.test(source) && !/\bconst\s+executionLocationOk\s*=/.test(source)) {
    source = source.replace(gatePattern, `$1\n  const zoneMid=Number.isFinite(Number(candidateZone?.low))&&Number.isFinite(Number(candidateZone?.high))?(Number(candidateZone.low)+Number(candidateZone.high))/2:NaN;\n  const zonePremiumDiscount=Number.isFinite(zoneMid)?(zoneMid>mid?'PREMIUM':'DISCOUNT'):'UNKNOWN';\n  const zonePdOk=side==='BULLISH'?zonePremiumDiscount==='DISCOUNT':side==='BEARISH'?zonePremiumDiscount==='PREMIUM':false;\n  const limitZoneReady=!!candidateZone&&!retestOk&&zonePdOk&&((side==='BULLISH'&&Number(candidateZone.high)<live.price)||(side==='BEARISH'&&Number(candidateZone.low)>live.price))&&zoneDistance(live.price,candidateZone)<=Math.max(a*6,20);\n  const executionLocationOk=pdOk||limitZoneReady;`);
  }
  source = source.replace("{key:'location',label:'Premium / Discount location',points:pdOk?5:0,max:5,passed:pdOk}", "{key:'location',label:'Premium / Discount location',points:executionLocationOk?5:0,max:5,passed:executionLocationOk}");
  source = source.replace("const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&pdOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk);", "const setupReady=candlesFresh&&biasOk&&structureAgreement&&(sweepOk||bosOk)&&(alignedFvg||alignedOb)&&executionLocationOk&&spreadOk&&(displacementOk||technicalMomentumOk)&&trendStrengthOk&&provisionalRR>=1.5&&confluenceScore>=MIN_ENTRY_SCORE&&(retestOk||zoneNearOk||limitZoneReady);");
  source = source.replace("if(!retestOk && !zoneNearOk) reasons.push('Price is outside the execution zone');", "if(!retestOk && !zoneNearOk && !limitZoneReady) reasons.push('Price is outside the execution zone');");
  source = source.replace("if(!pdOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);", "if(!executionLocationOk) reasons.push(`Price is in ${premiumDiscount} — wait for ${side==='BULLISH'?'discount':'premium'} execution`);");
  source = source.replace(/(const confirmations=\{[\s\S]*?premiumDiscountOk:)pdOk/, '$1executionLocationOk');

  // Normalize the final authorization flag for downstream Web/Telegram consumers.
  // A signal is never authorized merely because direction score is high: the
  // deterministic setup must be ready and there must be no blocked ICT gates.
  if (!/const\s+tradeAuthorized\s*=/.test(source) && /const\s+setupReady\s*=/.test(source)) {
    source = source.replace(/(const\s+setupReady\s*=.*?;)/, `$1\n  const tradeAuthorized=setupReady===true&&executionLocationOk===true&&Array.isArray(reasons)?reasons.length===0:false;`);
  }
  // Make the normalized flag visible when the analysis object already exposes setupReady.
  source = source.replace(/(setupReady\s*:\s*setupReady\s*,?)/, `$1\n    tradeAuthorized,`);
  source = source.replace(/(setupReady\s*,)(?![\s\S]*tradeAuthorized)/, `$1\n    tradeAuthorized,`);
  return source;
}

function patchWaitCard(source) {
  const advancedWait = [
    'function telegramWaitText(a) {',
    "  const price = Number(a?.price ?? a?.livePrice ?? a?.bid);",
    "  const bias = String(a?.bias || a?.directionBand || 'NEUTRAL').toUpperCase();",
    "  const directionScore = Number(a?.directionScore ?? a?.aiScore ?? 0);",
    "  const confidence = Number(a?.confidence ?? a?.score?.confidence ?? 0);",
    "  const blocked = Array.isArray(a?.score?.blockedReasons) ? a.score.blockedReasons.slice(0, 8).map(String) : [];",
    "  const ai = a?.aiConfirmation || a?.ai || null;",
    "  const aiDecision = String(ai?.decision || a?.aiDecision || 'WAIT').toUpperCase();",
    "  const aiConfidence = Number(ai?.confidence ?? a?.aiConfidence ?? 0);",
    "  const agreement = String(ai?.agreement || a?.aiAgreement || 'NEUTRAL').toUpperCase();",
    "  const broker = String(a?.broker || 'VT Markets MT5');",
    "  const quoteAgeValue = a?.quoteAge ?? a?.quote_age ?? a?.feedAgeSec ?? a?.priceAgeSec;",
    "  const quoteAge = Number.isFinite(Number(quoteAgeValue)) ? Number(quoteAgeValue) : 0;",
    "  const zone = a?.entryZone || a?.executionZone || null;",
    "  const low = Number(zone?.low);",
    "  const high = Number(zone?.high);",
    "  const entryZone = Number.isFinite(low) && Number.isFinite(high) ? `${low.toFixed(2)} — ${high.toFixed(2)}` : 'WAITING FOR CONFIRMATION';",
    "  const authorized = a?.tradeAuthorized === true || (a?.setupReady === true && a?.executionLocationOk === true && blocked.length === 0);",
    "  const side = bias === 'BULLISH' ? 'BUY' : bias === 'BEARISH' ? 'SELL' : '';",
    "  if (authorized && side) {",
    "    const entry = Number(a?.entry ?? a?.entryPrice ?? a?.livePrice);",
    "    const sl = Number(a?.sl ?? a?.stopLoss);",
    "    const tp1 = Number(a?.tp1 ?? a?.takeProfit1);",
    "    const tp2 = Number(a?.tp2 ?? a?.takeProfit2);",
    "    const tp3 = Number(a?.tp3 ?? a?.takeProfit3);",
    "    const n = x => Number.isFinite(x) ? x.toFixed(2) : '—';",
    "    return [",
    "      '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',",
    "      '📊 Asset: *XAU/USD (Gold)*',",
    "      '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "      '🚨 Action: *' + (side === 'BUY' ? '🟢 BUY — TRADE AUTHORIZED' : '🔴 SELL — TRADE AUTHORIZED') + '*',",
    "      '📈 Bias: *' + bias + '*',",
    "      '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "      '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*','',",
    "      '🎯 Entry: *' + n(entry) + '*',",
    "      '🛑 Stop Loss: *' + n(sl) + '*',",
    "      '🎯 TP1: *' + n(tp1) + '*',",
    "      '🎯 TP2: *' + n(tp2) + '*',",
    "      '🎯 TP3: *' + n(tp3) + '*','',",
    "      '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "      '🔐 *ORDER AUTHORIZED — ICT EXECUTION GATES PASSED*',",
    "      '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'",
    "    ].join('\\n');",
    "  }",
    "  const action = bias === 'BULLISH' ? '🟡 WAIT — BUY BIAS' : bias === 'BEARISH' ? '🟡 WAIT — SELL BIAS' : '🟡 WAIT — NO ENTRY';",
    "  const premium = blocked.some(x => /PREMIUM/i.test(x));",
    "  const sweep = blocked.some(x => /liquidity sweep/i.test(x));",
    "  const mss = blocked.some(x => /MSS|BOS/i.test(x));",
    "  const displacement = blocked.some(x => /displacement|momentum/i.test(x));",
    "  const fvgob = blocked.some(x => /FVG|OB/i.test(x));",
    "  const phase = premium ? 'PREMIUM — WAIT FOR DISCOUNT' : (sweep || mss || displacement || fvgob) ? 'SETUP FORMING — WAIT FOR CONFIRMATION' : 'WAITING FOR QUALIFIED SETUP';",
    "  const gateLine = blocked.length ? blocked.map(x => '• ' + x).join('\\n') : '• No confirmed entry gate';",
    '  return [',
    "    '🤖 *V TRADE AI — ADVANCED ICT SIGNAL*','',",
    "    '📊 Asset: *XAU/USD (Gold)*',",
    "    '💰 Price: *' + (Number.isFinite(price) ? price.toFixed(2) : '—') + '*',",
    "    '⚡ Action: *' + action + '*',",
    "    '🧭 Phase: *' + phase + '*','',",
    "    '📈 Bias: *' + bias + '*',",
    "    '📊 Direction Score: *' + (Number.isFinite(directionScore) ? directionScore : 0) + '/100*',",
    "    '🧠 Confidence: *' + (Number.isFinite(confidence) ? confidence : 0) + '/100*','',",
    "    '🔎 *ICT ENTRY GATES*', gateLine,'',",
    "    '🎯 Execution Zone: *' + entryZone + '*',",
    "    '🟢 Entry: *WAIT — gate confirmation required*',",
    "    '🛑 Stop Loss (SL): *WAIT*', '🎯 TP1: *WAIT*', '🎯 TP2: *WAIT*', '🎯 TP3: *WAIT*','',",
    "    '🤖 AI Confirm: *' + aiDecision + '* | Confidence: *' + (Number.isFinite(aiConfidence) ? aiConfidence : 0) + '/100* | Agreement: *' + agreement + '*',",
    "    '⚡ Status: *WAIT — NO ORDER AUTHORIZED*','',",
    "    '🔒 No order until all required ICT execution gates pass.',",
    "    '🏦 Broker: *' + broker + '* | Quote age: *' + quoteAge + 's*'",
    '  ].join("\\n");',
    '}', ''
  ].join('\n');
  const pattern = /function\s+telegramWaitText\s*\(a\)\s*\{[\s\S]*?\n\}\s*(?=\n\s*function\s+)/;
  if (!pattern.test(source)) return source;
  return source.replace(pattern, advancedWait);
}

function patchFrontend(source) {
  // Critical UI correctness: missing numeric data must stay "—", never become 0/100.
  source = source.replace("const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';", "const fmt=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—';const pct=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Math.max(0,Math.min(100,Math.round(Number(n)))):'—';");
  // Khmer font fallback for PC + phone without changing the existing layout.
  source = source.replace("font:14px Segoe UI,Arial,sans-serif", "font:14px 'Kantumruy Pro','Noto Sans Khmer','Segoe UI',Arial,sans-serif");
  const oldGate="function gate(label,v,detail=''){return `<div class=\"gate\"><span class=\"dot ${v===true?'pass':'wait'}\"></span><div><b>${label}</b><small>${v===true?'PASS':'WAIT'}${detail?' · '+detail:''}</small></div></div>`}";
  const newGate="function gate(label,v,detail=''){const km=lang==='km';const labels={'MTF Alignment':'ការតម្រឹម MTF','Liquidity Sweep':'Liquidity Sweep','MSS':'MSS','BOS':'BOS','Displacement':'Displacement','FVG':'FVG','Order Block':'Order Block','Premium / Discount':'Premium / Discount','Execution Zone':'តំបន់ប្រតិបត្តិ','Momentum':'Momentum','ADX Trend':'ADX Trend','Spread':'Spread'};const d=detail?String(detail):'';const detailKm={'PREMIUM':'PREMIUM','DISCOUNT':'DISCOUNT','UNKNOWN':'មិនស្គាល់'}[d]||d;return `<div class=\"gate\"><span class=\"dot ${v===true?'pass':'wait'}\"></span><div><b>${km?(labels[label]||label):label}</b><small>${v===true?(km?'ជាប់':'PASS'):(km?'រង់ចាំ':'WAIT')}${detail?' · '+(km?detailKm:detail):''}</small></div></div>`}";
  source = source.replace(oldGate,newGate);
  const oldReasons="const reasons=a.score?.blockedReasons||[];$('reasons').innerHTML=reasons.length?reasons.map(x=>`• ${x}`).join('<br>'):'All deterministic gates passed.';";
  const newReasons="const reasons=a.score?.blockedReasons||[];const reasonKm=x=>{const s=String(x||'');const m={'MTF core bias not aligned — need 2/3 H4/H1/M15 agreement':'MTF Core មិនទាន់តម្រឹម — ត្រូវការ H4/H1/M15 យ៉ាងហោចណាស់ 2/3','Fresh liquidity sweep not confirmed':'មិនទាន់ Confirm Liquidity Sweep ថ្មី','Fresh M5 MSS not confirmed':'មិនទាន់ Confirm M5 MSS ថ្មី','Directional displacement not confirmed':'មិនទាន់ Confirm Directional Displacement','No fresh aligned FVG/OB':'មិនមាន FVG/OB ថ្មីដែលតម្រឹម','Price is outside the execution zone':'តម្លៃនៅក្រៅ Execution Zone','Fresh M5 MSS/BOS structure break not confirmed':'មិនទាន់ Confirm M5 MSS/BOS Structure Break','Momentum/displacement does not confirm the execution direction':'Momentum/Displacement មិនទាន់បញ្ជាក់ទិសដៅ Entry'};return m[s]||s};$('reasons').innerHTML=reasons.length?reasons.map(x=>`• ${lang==='km'?reasonKm(x):x}`).join('<br>'):(lang==='km'?'ICT Gate ទាំងអស់បានជាប់។':'All deterministic gates passed.');window.vtradeNotify&&window.vtradeNotify(a);";
  source = source.replace(oldReasons,newReasons);

  // Browser notifications: permission is requested only after a user gesture.
  // Notifications are state-change based to avoid 5-second refresh spam.
  if (!source.includes('window.vtradeNotify=')) {
    const notificationScript = `<script>\n(()=>{\n  let lastKey='';\n  const keyOf=a=>{const side=String(a?.bias||a?.directionBand||'NEUTRAL').toUpperCase();const auth=a?.tradeAuthorized===true||(a?.setupReady===true&&a?.executionLocationOk===true&&!(a?.score?.blockedReasons||[]).length);const p=a?.entry??a?.entryPrice??a?.livePrice??a?.price;const sl=a?.sl??a?.stopLoss;const tp1=a?.tp1??a?.takeProfit1;return [side,auth,p,sl,tp1].join('|');};\n  const notify=async(a)=>{try{if(!('Notification' in window))return;const k=keyOf(a);if(!k||k===lastKey)return;lastKey=k;const side=String(a?.bias||a?.directionBand||'NEUTRAL').toUpperCase();const auth=a?.tradeAuthorized===true||(a?.setupReady===true&&a?.executionLocationOk===true&&!(a?.score?.blockedReasons||[]).length);if(Notification.permission!=='granted')return;const title=auth&&side==='BULLISH'?'🟢 BUY — TRADE AUTHORIZED':auth&&side==='BEARISH'?'🔴 SELL — TRADE AUTHORIZED':side==='BULLISH'?'🟡 BUY BIAS — WAIT':side==='BEARISH'?'🟡 SELL BIAS — WAIT':'🟡 WAIT — NO ENTRY';const body=auth?'ICT execution gates passed. Entry/SL/TP are ready.':((a?.score?.blockedReasons||[]).slice(0,3).join(' • ')||'Waiting for ICT confirmation.');new Notification(title,{body,tag:'vtrade-signal',renotify:true});}catch(e){}};\n  window.vtradeNotify=notify;\n  document.addEventListener('click',async()=>{try{if('Notification' in window&&Notification.permission==='default')await Notification.requestPermission();}catch(e){}},{once:true});\n})();\n</script>`;\n    source = source.replace('</body>', notificationScript+'\n</body>');\n  }
  return source;
}

Module._extensions['.js'] = function vtradeServerLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');
  source = patchExecutionLogic(source);
  source = patchWaitCard(source);
  console.log('[V-TRADE LAUNCHER] production ICT execution policy active');
  console.log('[V-TRADE LAUNCHER] production WAIT/AUTHORIZED-card logic active');
  mod._compile(source, filename);
};

try {
  if (fs.existsSync(FRONTEND_FILE)) {
    const before = fs.readFileSync(FRONTEND_FILE, 'utf8');
    const after = patchFrontend(before);
    if (after !== before) {
      fs.writeFileSync(FRONTEND_FILE, after, 'utf8');
      console.log('[V-TRADE LAUNCHER] critical frontend data/i18n/notification fixes applied');
    }
  }
} catch (e) {
  console.warn('[V-TRADE LAUNCHER] frontend patch skipped:', e.message);
}

require('./server.js');
