# V TRADE AI v5.2.1 — Telegram + XAUUSD setup

## Telegram: user enters their own Bot Token + Chat ID

v5.2.1 supports **per-user Telegram connections** from the website:

1. Open **Telegram Bot Setup** in the terminal.
2. Enter your own **Bot Token** and **Chat ID**.
3. Press **Connect & Send Test**.
4. The server validates the bot and chat, then sends a test message.
5. When XAUUSD analysis reaches a new actionable state such as WAIT FOR BUY/SELL ENTRY or confirmed BUY/SELL, the same connected Telegram receives a deduplicated alert.
6. Press **Disconnect** any time to remove the active connection.

### Security

- The Bot Token is **not stored in localStorage**.
- The Bot Token is **not embedded in HTML/JavaScript**.
- The token is sent to the backend over HTTPS and held only in server memory for the active session.
- A Render restart/deploy clears active user Telegram connections; the user simply reconnects.
- Never publish or share a Telegram bot token. Telegram states that anyone with the token can control the bot.

Optional `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` environment variables remain supported as an owner/admin fallback, but they are **not required** for end users.

## How to create a Telegram bot

1. Open Telegram and search for **@BotFather**.
2. Press **Start**.
3. Send `/newbot`.
4. Choose a bot display name.
5. Choose a unique username ending in `bot`.
6. BotFather returns the **Bot Token**. Keep it secret.
7. Open your new bot and press **Start**.
8. For a group/channel, add the bot to that chat and give the permissions it needs.
9. Enter the token and chat ID in V TRADE AI → **Telegram Bot Setup**.
10. Press **Connect & Send Test**.

Telegram's official guide confirms `/newbot` is the normal BotFather flow and recommends treating the token like a password.

## Getting the Chat ID

The easiest route for a private chat is to start the bot and use a Telegram update/chat-ID helper or the Bot API. For groups/channels, add the bot first and then obtain the chat ID for that chat. Telegram's Bot API uses the chat/dialog ID to identify the destination.

## Commands

The legacy owner/admin bot mode still supports:
- `/price`
- `/signal`
- `/status`

Per-user website connections are primarily **outbound alert connections**. The website-driven auto-alert currently requires the terminal page to remain open so it can poll the live analysis endpoint. For true 24/7 multi-user alerts while browsers are closed, add persistent encrypted credential storage plus a server-side scheduler/worker.

## XAUUSD API

- `GET /api/market/xauusd`
- `GET /api/analysis/xauusd`
- `GET /api/v5/mt5/status`
- `POST /api/v5/mt5/quote`
- `POST /api/v5/signal`
- `GET /api/telegram/session`
- `GET /api/telegram/status`
- `POST /api/telegram/connect`
- `POST /api/telegram/test`
- `POST /api/telegram/disconnect`
- `GET /api/health`

The XAUUSD analysis remains broker-native VT Markets MT5. If the MT5 bridge is offline/stale or MTF candles are missing, the engine refuses to manufacture a BUY/SELL signal.
