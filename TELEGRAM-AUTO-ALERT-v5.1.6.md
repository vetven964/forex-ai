# Telegram Auto Alert v5.1.6

## Behavior
1. The dashboard calls `/api/analysis/xauusd` every 30 seconds.
2. The server runs the XAUUSD MTF ICT analysis.
3. If a Telegram session is connected, the server sends an alert when the signal state/levels differ from the previous alert.
4. `WAIT` is allowed for the first/state-change alert and is deduplicated, so it does not spam every poll.

## Manual vs Auto
- **Manual:** `ផ្ញើ Signal នេះចូល Telegram Bot` sends immediately.
- **Auto:** no button click is required after Telegram is connected, but the dashboard must remain open because polling is browser-driven in this build.

## 24/7 mode
For alerts while the browser/PC is offline, move the alert scheduler to the server and store user Telegram configurations in encrypted persistent storage (e.g. PostgreSQL + application-level encryption). Do not put bot tokens in GitHub Pages or localStorage.
