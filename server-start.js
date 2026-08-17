// V-TRADE AI launcher: applies the live H4/H1/M15 direction profile before server.js loads.
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const DIRECTION_TFS = ['H4', 'H1', 'M15'];
const DIRECTION_ALIGNMENT = 2;
const SERVER_FILE = path.resolve(__dirname, 'server.js');

const originalJsLoader = Module._extensions['.js'];
Module._extensions['.js'] = function vtradeJsLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) return originalJsLoader(mod, filename);
  let source = fs.readFileSync(filename, 'utf8');

  source = source.replace(
    /const\s+CORE_MTF_TFS\s*=\s*\[[^\]]*\]\s*;/,
    "const CORE_MTF_TFS = ['H4','H1','M15'];"
  );
  source = source.replace(
    /const\s+FULL_MTF_TFS\s*=\s*\[[^\]]*\]\s*;/,
    "const FULL_MTF_TFS = ['D1','H4','H1','M15','M5','M1'];"
  );

  // Keep the execution-gate wording consistent with the live H4/H1/M15 profile.
  source = source.replace(
    /MTF core bias not aligned — need 2\/3 H1\/M15\/M5 agreement/g,
    'MTF core bias not aligned — need 2/3 H4/H1/M15 agreement'
  );

  // Normalize the Telegram MTF order after all source substitutions.
  source = source.replace(
    /const\s+order\s*=\s*\[[^\]]*\]\s*;/,
    "const order = ['D1','H4','H1','M15','M5','M1'];"
  );

  // Improve MTF direction display when pure HH/HL swing structure is ranging.
  // The raw ICT structure remains intact; this only supplies a transparent
  // directional score from independent EMA/price/MACD/RSI/momentum evidence.
  const profileHeader = `
const VTRADE_DIRECTION_PROFILE = Object.freeze({
  timeframes: ['H4','H1','M15'],
  alignmentRequired: 2,
  roles: Object.freeze({ H4: 'macro-direction', H1: 'confirmation', M15: 'execution-context' })
});

function vtradeMtfStructure(c, raw) {
  const s = { ...(raw || {}) };
  if (!Array.isArray(c) || c.length < 30) return s;
  const closes = c.slice(-200).map(x => Number(x.c)).filter(Number.isFinite);
  if (closes.length < 30) return s;
  const e20 = ema(closes, 20), e50 = ema(closes, 50);
  const m = macd(closes), r = rsi(closes, AI_RSI_PERIOD);
  const last = closes[closes.length - 1];
  const anchor = closes[Math.max(0, closes.length - 6)];
  let bull = 0, bear = 0;
  if (Number.isFinite(e20) && Number.isFinite(e50)) {
    if (e20 > e50) bull++; else if (e20 < e50) bear++;
  }
  if (Number.isFinite(e20)) {
    if (last > e20) bull++; else if (last < e20) bear++;
  }
  if (m) {
    if (m.histogram > 0) bull++; else if (m.histogram < 0) bear++;
  }
  if (Number.isFinite(r)) {
    if (r >= 52) bull++; else if (r <= 48) bear++;
  }
  if (Number.isFinite(anchor)) {
    if (last > anchor) bull++; else if (last < anchor) bear++;
  }
  const total = bull + bear;
  const directionScore = total ? Math.round(50 + ((bull - bear) / total) * 50) : 50;
  let bias = s.bias;
  if (bull >= 3 && bull > bear) bias = 'BULLISH';
  else if (bear >= 3 && bear > bull) bias = 'BEARISH';
  else if (!['BULLISH','BEARISH'].includes(bias)) bias = 'RANGE';
  return { ...s, bias, score: Math.max(0, Math.min(100, directionScore)), directionScore, strength: Math.max(0, Math.min(100, directionScore)), evidence: { bull, bear, total } };
}
`;
  source = `${profileHeader}${source}`;

  // analyzeTF uses structure() for the public MTF row. Feed it through the
  // transparent directional profile so H4/H1/M15 do not stay at 50/100 solely
  // because the latest three swing points are temporarily range-bound.
  source = source.replace(
    "const s=structure(c), sweep=liquiditySweep(c), a=atr(c,14);",
    "let s=structure(c); s=vtradeMtfStructure(c,s); const sweep=liquiditySweep(c), a=atr(c,14);"
  );

  return mod._compile(source, filename);
};

// OpenAI Responses API compatibility wrapper.
// OpenAI is confirmation-only. A deterministic WAIT never becomes a trade signal.
const originalFetch = global.fetch;
if (typeof originalFetch === 'function' && !originalFetch.__vtradeOpenAiPatch) {
  const patchedFetch = async function (url, options = {}) {
    const target = String(url || '');
    if (!target.includes('api.openai.com/v1/responses')) return originalFetch(url, options);
    let nextOptions = options;
    try {
      const headers = { ...(options.headers || {}) };
      if (!String(headers.Authorization || headers.authorization || '')) console.warn('[OPENAI] Missing Authorization header');

      if (typeof options.body === 'string') {
        const payload = JSON.parse(options.body);
        const userText = payload?.input?.find?.(x => x?.role === 'user')?.content?.find?.(x => x?.type === 'input_text')?.text || '';
        let supplied = null;
        try { supplied = JSON.parse(userText); } catch (_) {}

        if (supplied && supplied.signal === 'WAIT') {
          const blockedReasons = Array.isArray(supplied?.score?.blockedReasons)
            ? supplied.score.blockedReasons.slice(0, 12).map(String) : [];
          const rawConfluence = supplied?.score?.confluence ?? supplied?.score?.total ?? supplied?.confluenceScore;
          const rawDirection = supplied?.directionScore ?? supplied?.score?.directionScore ?? supplied?.score?.direction ?? supplied?.score?.aiScore;
          const confluenceScore = Number(rawConfluence);
          const directionScore = Number(rawDirection);
          const gateSnapshot = {
            signal: 'WAIT',
            bias: supplied?.bias ?? supplied?.direction ?? supplied?.macroBias ?? 'NEUTRAL',
            confluenceScore: Number.isFinite(confluenceScore) ? confluenceScore : 0,
            directionScore: Number.isFinite(directionScore) ? directionScore : 50,
            phase: supplied?.phase ?? supplied?.decision?.state ?? 'WAIT',
            setupGrade: supplied?.setupGrade ?? supplied?.score?.grade ?? 'WAIT',
            status: supplied?.status ?? supplied?.decision?.reason ?? 'WAIT',
            trigger: supplied?.trigger ?? supplied?.decision?.reason ?? null,
            blockedReasons
          };
          console.log(`[ICT GATE DEBUG] ${JSON.stringify(gateSnapshot)}`);

          const skipped = {
            decision: 'WAIT', confidence: 0, agreement: 'NEUTRAL',
            reasons: ['Deterministic ICT/MTF engine is WAIT; AI confirmation skipped until a qualified BUY/SELL candidate exists.'],
            missingConfirmations: blockedReasons,
            riskFlags: ['No AI veto/approval is applied while the deterministic entry gate is not qualified.'],
            summary: 'AI confirmation is intentionally skipped because the deterministic engine has not produced a qualified BUY/SELL candidate.'
          };
          console.log('[OPENAI] confirmation skipped | engineSignal=WAIT | reason=deterministic gate pending');
          return new Response(JSON.stringify({ id:'vtrade-ai-skip', output_text:JSON.stringify(skipped), usage:null }), {
            status: 200, headers: { 'content-type': 'application/json' }
          });
        }

        if (payload && payload.text?.format?.type === 'json_object') {
          payload.text = { format: { type: 'json_schema', name: 'xauusd_confirmation', strict: true,
            schema: {
              type: 'object',
              properties: {
                decision: { type: 'string', enum: ['BUY','SELL','WAIT'] },
                confidence: { type: 'number', minimum: 0, maximum: 100 },
                agreement: { type: 'string', enum: ['AGREE','DISAGREE','NEUTRAL'] },
                reasons: { type: 'array', items: { type: 'string' } },
                missingConfirmations: { type: 'array', items: { type: 'string' } },
                riskFlags: { type: 'array', items: { type: 'string' } },
                summary: { type: 'string' }
              },
              required: ['decision','confidence','agreement','reasons','missingConfirmations','riskFlags','summary'],
              additionalProperties: false
            }
          }};
          nextOptions = { ...options, body: JSON.stringify(payload) };
          console.log(`[OPENAI] Responses request normalized | model=${payload.model || 'unknown'} | structured=json_schema`);
        }
      }
    } catch (e) {
      console.warn(`[OPENAI] Request normalization skipped: ${e?.message || e}`);
    }
    const response = await originalFetch(url, nextOptions);
    if (!response.ok) {
      try { console.error(`[OPENAI] HTTP ${response.status} | ${(await response.clone().text()).slice(0,700)}`); }
      catch (_) { console.error(`[OPENAI] HTTP ${response.status} | unable to read error body`); }
    }
    return response;
  };
  patchedFetch.__vtradeOpenAiPatch = true;
  global.fetch = patchedFetch;
}

const originalSendMessage = TelegramBot.prototype.sendMessage;
if (!originalSendMessage.__vtradeSignalAiPatch) {
  const patchedSendMessage = async function (chatId, text, options, ...rest) {
    let finalText = text;
    try {
      const enabled = String(process.env.OPENAI_ENABLED || 'false').toLowerCase() === 'true';
      const keyConfigured = !!String(process.env.OPENAI_API_KEY || '').trim();
      const isSignalWait = typeof finalText === 'string' && finalText.includes('AI Confirm: *NOT RUN*');
      if (typeof finalText === 'string' && (finalText.includes('MTF LIVE SIGNALS') || finalText.includes('NO TRADE') || finalText.includes('ENTRY CONFIRMED'))) {
        const compact = finalText.replace(/\*/g,'').replace(/\\n/g,'\n').replace(/\n{3,}/g,'\n\n').slice(0,5000);
        console.log(`[ICT DIRECTION DEBUG]\n${compact}`);
      }
      if (enabled && keyConfigured && isSignalWait) {
        const port = Number(process.env.PORT || 10000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(2500, Number(process.env.OPENAI_TIMEOUT_MS || 9000)));
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/ai/analysis/xauusd`, { method:'GET', headers:{ 'x-vtrade-request':'telegram-signal-ai' }, signal:controller.signal });
          if (response.ok) {
            const payload = await response.json();
            const ai = payload?.ai;
            if (ai) {
              const line = `AI Confirm: *${ai.decision || 'WAIT'}* | Confidence: *${ai.confidence ?? '—'}/100* | Agreement: *${ai.agreement || '—'}*`;
              finalText = finalText.replace(/AI Confirm: \*NOT RUN\* \| Confidence: \*—\/100\* \| Agreement: \*—\*/, line);
              console.log(`[AI CONFIRM /signal bridge] decision=${ai.decision || 'WAIT'} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} status=${ai.status || 'unknown'}`);
            }
          } else console.warn(`[AI CONFIRM /signal bridge] HTTP ${response.status}`);
        } finally { clearTimeout(timer); }
      }
    } catch (error) { console.warn(`[AI CONFIRM /signal bridge] ${error?.message || error}`); }
    return originalSendMessage.call(this, chatId, finalText, options, ...rest);
  };
  patchedSendMessage.__vtradeSignalAiPatch = true;
  TelegramBot.prototype.sendMessage = patchedSendMessage;
}

require('./server.js');