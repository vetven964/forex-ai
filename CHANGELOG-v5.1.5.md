# V-TRADE AI v5.1.5 — Telegram/API Fix

- Fixed GitHub Pages → Render API routing.
- Telegram setup no longer calls `/api/*` on GitHub Pages.
- Added Render API base `https://forexai-6xw6.onrender.com`.
- Added safe non-JSON API error handling to prevent `Unexpected token '<'` confusion.
- XAUUSD ICT page now uses the Render backend directly.
- Telegram Bot Token remains server-side only after submission.

## Deployment
Upload the updated static files to the GitHub Pages repository and redeploy/reload the Render backend only if server.js changed.
