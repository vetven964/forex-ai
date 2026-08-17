// V-TRADE AI launcher: keeps server.js unchanged while ensuring manual Telegram /signal
// messages include the OpenAI confirmation when the AI layer is enabled.
const TelegramBot = require('node-telegram-bot-api');

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
              console.log(`[AI CONFIRM /signal bridge] decision=${ai.decision || 'WAIT'} confidence=${ai.confidence ?? 0} agreement=${ai.agreement || 'NEUTRAL'}`);
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
