// V-TRADE AI launcher: applies the live H1/15M/5M direction profile before server.js loads.
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const Module = require('module');
const path = require('path');

// Direction profile:
// H1  = macro direction
// M15 = confirmation / structure
// M5  = entry trigger
// A trade candidate requires at least 2 aligned timeframes.
const DIRECTION_TFS = ['H1', 'M15', 'M5'];
const DIRECTION_ALIGNMENT = 2;
const SERVER_FILE = path.resolve(__dirname, 'server.js');

const originalJsLoader = Module._extensions['.js'];
Module._extensions['.js'] = function vtradeJsLoader(mod, filename) {
  if (path.resolve(filename) !== SERVER_FILE) {
    return originalJsLoader(mod, filename);
  }

  let source = fs.readFileSync(filename, 'utf8');

  // Replace the core profile even if server.js has formatting/spacing changes.
  source = source.replace(
    /const\s+CORE_MTF_TFS\s*=\s*\[[^\]]*\]\s*;/,
    "const CORE_MTF_TFS = ['H1','M15','M5'];"
  );

  // Keep legacy labels from misleading the scoring/debug output.
  source = source.replace(/H4\/H1\/M15/g, 'H1/M15/M5');
  source = source.replace(/H4,\s*H1,\s*M15/g, 'H1, M15, M5');
  source = source.replace(/H4'\s*,\s*'H1'\s*,\s*'M15'/g, "H1','M15','M5");
  source = source.replace(/H4\s*\/\s*H1\s*\/\s*M15/g, 'H1/15M/5M');

  // Export a small immutable profile so diagnostics can report exactly what the
  // launcher is enforcing without changing the existing server architecture.
  const profileHeader = `\nconst VTRADE_DIRECTION_PROFILE = Object.freeze({\n  timeframes: ['H1','M15','M5'],\n  alignmentRequired: 2,\n  roles: Object.freeze({ H1: 'macro-direction', M15: 'confirmation', M5: 'entry-trigger' })\n});\n`;
  source = `${profileHeader}${source}`;

  return mod._compile(source, filename);
};

// OpenAI Responses API compatibility wrapper.
// OpenAI is a confirmation layer only. When the deterministic ICT/MTF engine has
// no BUY/SELL candidate, do not call the model and do not manufacture a signal.
const originalFetch = global.fetch;
if (typeof originalFetch === 'function' && !originalFetch.__vtradeOpenAiPatch) {
  const patchedFetch = async function (url, options = {}) {
    const target = String(url || '');
    if (!target.includes('api.openai.com/v1/responses')) return originalFetch(url, options);

    let nextOptions = options;
    try {
      const headers = { ...(options.headers || {}) };
      const auth = String(headers.Authorization || headers.authorization || '');
      if (!auth) console.warn('[OPENAI] Missing Authorization header');

      if (typeof options.body === 'string') {
        const payload = JSON.parse(options.body);
        const userText = payload?.input?.find?.(x => x?.role === 'user')?.content?.find?.(x => x?.type === 'input_text')?.text || '';
        let supplied = null;
        try { supplied = JSON.parse(userText); } catch (_) {}

        if (supplied && supplied.signal === 'WAIT') {
          const blockedReasons = Array.isArray(supplied?.score?.blockedReasons)
            ? supplied.score.blockedReasons.slice(0, 12).map(String)
            : [];
          const gateSnapshot = {
            signal: supplied.signal,
            bias: supplied.bias ?? supplied.direction ?? supplied.macroBias ?? null,
            score: supplied.score?.confluence ?? supplied.score?.total ?? supplied.score ?? null,
            phase: supplied.phase ?? null,
            setupGrade: supplied.setupGrade ?? null,
            status: supplied.status ?? null,
            trigger: supplied.trigger ?? null,
            directionScore: supplied.directionScore ?? supplied.score?.direction ?? null,
            blockedReasons
          };
          console.log(`[ICT GATE DEBUG] ${JSON.stringify(gateSnapshot)}`);

          const skipped = {
            decision: 'WAIT',
            confidence: 0,
            agreement: 'NEUTRAL',
            reasons: ['Deterministic ICT/MTF engine is WAIT; AI confirmation skipped until a qualified BUY/SELL candidate exists.'],
            missingConfirmations: blockedReasons,
            riskFlags: ['No AI veto/approval is applied while the deterministic entry gate is not qualified.'],
            summary: 'AI confirmation is intentionally skipped because the deterministic engine has not produced a qualified BUY/SELL candidate.'
          };
          console.log('[OPENAI] confirmation skipped | engineSignal=WAIT | reason=deterministic gate pending');
          return new Response(JSON.stringify({ id:'vtrade-ai-skip', output_text:JSON.stringify(skipped), usage:null }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }

        if (payload && payload.text?.format?.type === 'json_object') {
          payload.text = {
            format: {
              type: 'json_schema',
              name: 'xauusd_confirmation',
              strict: true,
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
            }
          };
          nextOptions = { ...options, body: JSON.stringify(payload) };
          console.log(`[OPENAI] Responses request normalized | model=${payload.model || 'unknown'} | structured=json_schema`);
        }
      }
    } catch (e) {
      console.warn(`[OPENAI] Request normalization skipped: ${e?.message || e}`);
    }

    const response = await originalFetch(url, nextOptions);
    if (!response.ok) {
      try {
        const body = await response.clone().text();
        console.error(`[OPENAI] HTTP ${response.status} | ${body.slice(0, 700)}`);
      } catch (_) {
        console.error(`[OPENAI] HTTP ${response.status} | unable to read error body`);
      }
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
          const response = await fetch(`http://127.0.0.1:${port}/api/ai/analysis/xauusd`, {
            method:'GET',
            headers:{ 'x-vtrade-request':'telegram-signal-ai' },
            signal:controller.signal
          });
          if (response.ok) {
            const payload = await response.json();
            const ai = payload?.ai;
            if (ai) {
              const line = `AI Confirm: *${ai.decision || 'WAIT'}* | Confidence: *${ai.confidence ?? '—'}/100* | Agreement: *${ai.agreement || '—'}*`;
              finalText = finalText.replace(/AI Confirm: \*NOT RUN\* \| Confidence: \*—\/100\* \| Agreement: \*—\*/, line);
              console.log(`[AI CONFIRM /signal bridge] decision=${ai.decision || 'WAIT'} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'} status=${ai.status || 'unknown'}`);
            }
          } else {
            console.warn(`[AI CONFIRM /signal bridge] HTTP ${response.status}`);
          }
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (error) {
      console.warn(`[AI CONFIRM /signal bridge] ${error?.message || error}`);
    }
    return originalSendMessage.call(this, chatId, finalText, options, ...rest);
  };
  patchedSendMessage.__vtradeSignalAiPatch = true;
  TelegramBot.prototype.sendMessage = patchedSendMessage;
}

require('./server.js');
