# V TRADE AI — New Member Registration

The registration page is `/register.html` and posts to `/api/auth/register`.

Required: name, email, password, plan. The server must validate and persist the member before returning success. Telegram notifications should be sent only after successful persistence and must never expose bot tokens/password hashes.
