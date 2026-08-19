// V-TRADE AI canonical Render startup entrypoint.
// Keep the existing runtime hotfixes and install the Telegram scanner watchdog
// before the production launcher compiles server.js.
require('./server-runtime-hotfix.js');
require('./telegram-auto-watchdog.js');
