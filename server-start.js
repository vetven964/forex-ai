// V-TRADE AI launcher: keeps server.js unchanged while adding a compatibility layer
// for the OpenAI Responses API and ensuring manual Telegram /signal messages include AI confirmation.
const TelegramBot = require('node-telegram-bot-api');

// OpenAI Responses API compatibility wrapper.
// The engine already sends a Responses API request, but older JSON-output syntax can
// be rejected by newer reasoning models. Normalize it to strict JSON Schema here and
// log the real API error (without ever logging the API key).
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
