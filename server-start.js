// V-TRADE AI launcher: keeps server.js unchanged while adding compatibility layers
// for the OpenAI Responses API and ensuring manual Telegram /signal messages include AI confirmation.
const TelegramBot = require('node-telegram-bot-api');

// OpenAI Responses API compatibility wrapper.
// IMPORTANT: OpenAI is a confirmation layer only. When the deterministic ICT/MTF
// engine has no BUY/SELL candidate, do not call the model and do not manufacture
// a directional signal from an unqualified WAIT state.
const originalFetch = global.fetch;
if (typeof originalFetch === 'function' && !originalFetch.__vtradeOpenAiPatch) {
  const patchedFetch = async function (url, options = {}) {
    const target = String(url || '');
    if (!target.includes('api.openai.com/v1/responses')) {
      return originalFetch(url, options);
    }

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

        // Do not waste an OpenAI call on an unqualified deterministic WAIT.
        // This also prevents misleading logs such as confidence=99 WAIT from
        // looking like an AI-generated trade veto. BUY/SELL candidates still
        // go through the full Responses + JSON Schema confirmation flow.
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
          console.log(`[OPENAI] confirmation skipped | engineSignal=WAIT | reason=deterministic gate pending`);
          return new Response(JSON.stringify({
            id: 'vtrade-ai-skip',
            output_text: JSON.stringify(skipped),
            usage: null
          }), { status: 200, headers: { 'content-type': 'application/json' } });
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
                  decision: { type: 'string', enum: ['BUY', 'SELL', 'WAIT'] },
                  confidence: { type: 'number', minimum: 0, maximum: 100 },
                  agreement: { type: 'string', enum: ['AGREE', 'DISAGREE', 'NEUTRAL'] },
                  reasons: { type: 'array', items: { type: 'string' } },
                  missingConfirmations: { type: 'array', items: { type: 'string' } },
                  riskFlags: { type: 'array', items: { type: 'string' } },
                  summary: { type: 'string' }
                },
                required: ['decision', 'confidence', 'agreement', 'reasons', 'missingConfirmations', 'riskFlags', 'summary'],
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
        const clone = response.clone();
        const body = await clone.text();
        console.error(`[OPENAI] HTTP ${response.status} | ${body.slice(0, 700)}`);
      } catch (e) {
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

      // Direction/ICT diagnostics: log the complete decision evidence whenever
      // the Telegram auto-signal is sent. This does not loosen any entry gate;
      // it only makes the exact direction and blocking conditions visible.
      if (typeof finalText === 'string' && (finalText.includes('MTF LIVE SIGNALS') || finalText.includes('NO TRADE') || finalText.includes('ENTRY CONFIRMED'))) {
        const compact = finalText
          .replace(/\*/g, '')
          .replace(/\\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .slice(0, 5000);
        console.log(`[ICT DIRECTION DEBUG]\n${compact}`);
      }

      if (enabled && keyConfigured && isSignalWait) {
        const port = Number(process.env.PORT || 10000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(2500, Number(process.env.OPENAI_TIMEOUT_MS || 9000)));

        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/ai/analysis/xauusd`, {
            method: 'GET',
            headers: { 'x-vtrade-request': 'telegram-signal-ai' },
            signal: controller.signal
          });

          if (response.ok) {
            const payload = await response.json();
            const ai = payload?.ai;
            if (ai) {
              const line = `AI Confirm: *${ai.decision || 'WAIT'}* | Confidence: *${ai.confidence ?? '—'}/100* | Agreement: *${ai.agreement || '—'}*`;
              finalText = finalText.replace(
                /AI Confirm: \*NOT RUN\* \| Confidence: \*—\/100\* \| Agreement: \*—\*/,
                line
              );
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
