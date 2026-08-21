# V TRADE AI UI

Canonical UI boundary for the public/auth/dashboard experience.

Flow:
1. `../index.html` — GitHub + Login + Register + Main Dashboard only.
2. `../login.html` — authentication only; no pre-market/terminal modules.
3. `../register.html` — new member registration; Demo until paid package confirmation.
4. `../dashboard.html` — single Main Dashboard entry; redirects into the live dashboard and package gate.
5. `../premium-dashboard-live.html` — the single live terminal workspace with MTF, ICT, execution, AI, news, Telegram, risk and history modules.

Legacy UI pages must not be linked from the public navigation.