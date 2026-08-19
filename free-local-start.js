// V-TRADE AI — FREE LOCAL START GUARD
// Hard-disables paid OpenAI before any server module is loaded.
'use strict';
process.env.OPENAI_ENABLED = 'false';
process.env.OPENAI_MODEL = 'local-ict-v1';
process.env.OPENAI_API_KEY = '';
console.log('[V-TRADE FREE AI] Local ICT mode enforced | provider=LOCAL_DETERMINISTIC | billing=OFF');
require('./server-launcher.js');
