// V-TRADE AI — isolated backend CORS runtime
// Loaded before server.js so frontend/auth fixes stay separate from MT5/ICT logic.
'use strict';

const corsPath = require.resolve('cors');
const originalCors = require(corsPath);

if (!originalCors.__vtradeIsolatedCors) {
  const allowed = new Set([
    'https://vetven964.github.io',
    'https://www.vetven964.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ]);

  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean);
  for (const origin of configured) allowed.add(origin);

  const isolatedCors = function isolatedCors(options = {}) {
    const originalOrigin = options.origin;
    const next = {
      ...options,
      origin(origin, callback) {
        const value = String(origin || '').trim().replace(/\/$/, '').toLowerCase();
        if (!value) return callback(null, true);
        if (allowed.has(value)) return callback(null, true);
        if (typeof originalOrigin === 'function') return originalOrigin(origin, callback);
        if (Array.isArray(originalOrigin) && originalOrigin.includes(value)) return callback(null, true);
        if (typeof originalOrigin === 'string' && originalOrigin.replace(/\/$/, '').toLowerCase() === value) return callback(null, true);
        return callback(new Error('CORS origin not allowed'));
      },
      methods: options.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: options.allowedHeaders || [
        'Content-Type',
        'Authorization',
        'x-vtrade-session',
        'x-vtrade-key',
        'x-vtrade-admin-key',
        'x-vtrade-auth',
        'x-vtrade-request',
        'x-mt5-api-key'
      ],
      credentials: true,
      optionsSuccessStatus: 204,
      maxAge: 600
    };
    return originalCors(next);
  };

  isolatedCors.__vtradeIsolatedCors = true;
  require.cache[corsPath].exports = isolatedCors;
  console.log('[V-TRADE BACKEND] isolated CORS runtime loaded');
}
