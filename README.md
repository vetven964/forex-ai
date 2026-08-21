# V TRADE AI Server Boundary

The Render runtime currently depends on the root launcher and root-relative modules. Do not physically move runtime files until every `require()`/static path and the Render start command are migrated together.

Target boundary:
- `server/` — Express runtime, auth/package access, MT5 bridge, ICT engine, Telegram and server-side integrations.
- root `server-launcher.js` remains a compatibility bootstrap until Render is switched to `node server/server-launcher.js`.

This marker is intentional: it prevents a partial move that would break Render startup.