# V TRADE AI — Official Connected Build

## Official website flow
Public:
- `index.html`
- `pricing.html`
- `login.html`
- `register.html` (if present)
- `reset-password.html`

Authenticated:
- `premium-dashboard-v5.html`
- `premium-dashboard-live.html`
- `profile.html`

Admin-only:
- `admin-dashboard.html`

## Connection architecture
All HTML pages load `site-connection.js`.
It:
- uses the official Render API base
- attaches `x-vtrade-auth` to API calls
- sends cookies with requests
- redirects expired sessions to `login.html`
- exposes `window.VTRADE` helpers
- shows a backend live/offline indicator

## Server RBAC
Package entitlements are enforced server-side. Supported plan names include:
- Free / Trial
- Basic
- Standard
- Pro / VIP
- Premium
- Admin

Admin has `*` permissions. Normal users only receive permissions from their package.

## Deployment
Render:
- start command: `node server-launcher.js`
- service listens on `0.0.0.0:$PORT`
- GitHub Pages origin is explicitly allowed by CORS

Never commit `.env` secrets, Telegram tokens, broker keys, or admin passwords.
