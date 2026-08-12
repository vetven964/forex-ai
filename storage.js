'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.VTRADE_DATA_DIR || path.join(__dirname, 'data');
const JSON_FILE = process.env.VTRADE_DB_FILE || path.join(DATA_DIR, 'vtrade-storage.json');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();

let pgPool = null;
let initialized = false;
let initPromise = null;
let jsonDb = { version: 1, quotes: [], signals: [], events: [] };

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson() {
  ensureDir();
  try {
    if (fs.existsSync(JSON_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        jsonDb = {
          version: 1,
          quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
          signals: Array.isArray(parsed.signals) ? parsed.signals : [],
          events: Array.isArray(parsed.events) ? parsed.events : []
        };
      }
    }
  } catch (e) {
    console.error('[STORAGE] JSON load failed:', e.message);
  }
}

let writeTimer = null;
function scheduleJsonWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      ensureDir();
      const tmp = `${JSON_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(jsonDb), 'utf8');
      fs.renameSync(tmp, JSON_FILE);
    } catch (e) {
      console.error('[STORAGE] JSON write failed:', e.message);
    }
  }, 250);
}

function trimJson() {
  const maxQuotes = Number(process.env.VTRADE_MAX_STORED_QUOTES || 5000);
  const maxSignals = Number(process.env.VTRADE_MAX_STORED_SIGNALS || 2000);
  const maxEvents = Number(process.env.VTRADE_MAX_STORED_EVENTS || 2000);
  if (jsonDb.quotes.length > maxQuotes) jsonDb.quotes = jsonDb.quotes.slice(-maxQuotes);
  if (jsonDb.signals.length > maxSignals) jsonDb.signals = jsonDb.signals.slice(-maxSignals);
  if (jsonDb.events.length > maxEvents) jsonDb.events = jsonDb.events.slice(-maxEvents);
}

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (DATABASE_URL) {
      try {
        const { Pool } = require('pg');
        pgPool = new Pool({
          connectionString: DATABASE_URL,
          ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
          max: Number(process.env.DATABASE_POOL_MAX || 3),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        });
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS vtrade_quotes (
            id BIGSERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            symbol TEXT NOT NULL,
            bid DOUBLE PRECISION NOT NULL,
            ask DOUBLE PRECISION NOT NULL,
            last_price DOUBLE PRECISION,
            spread DOUBLE PRECISION,
            server_time BIGINT,
            source TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_vtrade_quotes_created_at ON vtrade_quotes(created_at DESC);
          CREATE TABLE IF NOT EXISTS vtrade_signals (
            id BIGSERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            symbol TEXT NOT NULL,
            signal TEXT,
            status TEXT,
            confidence DOUBLE PRECISION,
            score DOUBLE PRECISION,
            entry_low DOUBLE PRECISION,
            entry_high DOUBLE PRECISION,
            entry DOUBLE PRECISION,
            stop_loss DOUBLE PRECISION,
            take_profit JSONB,
            news_state TEXT,
            payload JSONB NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_vtrade_signals_created_at ON vtrade_signals(created_at DESC);
        `);
        initialized = true;
        console.log('[STORAGE] PostgreSQL connected and schema ready');
        return;
      } catch (e) {
        console.error('[STORAGE] PostgreSQL unavailable; falling back to local JSON:', e.message);
        try { if (pgPool) await pgPool.end(); } catch (_) {}
        pgPool = null;
      }
    }
    loadJson();
    initialized = true;
    console.log(`[STORAGE] Local JSON storage ready: ${JSON_FILE}`);
  })();
  return initPromise;
}

function mode() { return pgPool ? 'postgresql' : 'local-json'; }

async function saveQuote(q) {
  await init();
  if (pgPool) {
    await pgPool.query(
      `INSERT INTO vtrade_quotes(symbol,bid,ask,last_price,spread,server_time,source) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [q.symbol, q.bid, q.ask, q.last, q.spread, q.serverTime || null, q.source || 'VT Markets MT5']
    );
    return;
  }
  jsonDb.quotes.push({ id: Date.now(), created_at: new Date().toISOString(), ...q });
  trimJson();
  scheduleJsonWrite();
}

async function saveSignal(a) {
  await init();
  const row = {
    symbol: 'XAUUSD',
    signal: a.signal || null,
    status: a.status || null,
    confidence: Number(a.confidence || 0),
    score: Number(a.score || a.confidence || 0),
    entry_low: Number.isFinite(Number(a.entryZone?.low)) ? Number(a.entryZone.low) : null,
    entry_high: Number.isFinite(Number(a.entryZone?.high)) ? Number(a.entryZone.high) : null,
    entry: Number.isFinite(Number(a.entry)) ? Number(a.entry) : null,
    stop_loss: Number.isFinite(Number(a.stopLoss)) ? Number(a.stopLoss) : null,
    take_profit: a.takeProfit || [],
    news_state: a.news?.state || a.newsRisk?.state || null,
    payload: a
  };
  if (pgPool) {
    await pgPool.query(
      `INSERT INTO vtrade_signals(symbol,signal,status,confidence,score,entry_low,entry_high,entry,stop_loss,take_profit,news_state,payload)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [row.symbol,row.signal,row.status,row.confidence,row.score,row.entry_low,row.entry_high,row.entry,row.stop_loss,JSON.stringify(row.take_profit),row.news_state,JSON.stringify(row.payload)]
    );
    return;
  }
  jsonDb.signals.push({ id: Date.now(), created_at: new Date().toISOString(), ...row });
  trimJson();
  scheduleJsonWrite();
}

async function recordEvent(type, payload = {}) {
  await init();
  const event = { id: Date.now(), created_at: new Date().toISOString(), type, payload };
  if (pgPool) {
    // Keep the event table optional to avoid schema overhead on the small server.
    await pgPool.query(`CREATE TABLE IF NOT EXISTS vtrade_events (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), type TEXT NOT NULL, payload JSONB NOT NULL)`);
    await pgPool.query(`INSERT INTO vtrade_events(type,payload) VALUES($1,$2)`, [type, JSON.stringify(payload)]);
    return;
  }
  jsonDb.events.push(event);
  trimJson();
  scheduleJsonWrite();
}

async function getHistory(kind, limit = 50) {
  await init();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  if (pgPool) {
    if (kind === 'signals') {
      const r = await pgPool.query(`SELECT id,created_at,symbol,signal,status,confidence,score,entry_low,entry_high,entry,stop_loss,take_profit,news_state FROM vtrade_signals ORDER BY id DESC LIMIT $1`, [safeLimit]);
      return r.rows;
    }
    if (kind === 'quotes') {
      const r = await pgPool.query(`SELECT id,created_at,symbol,bid,ask,last_price,spread,server_time,source FROM vtrade_quotes ORDER BY id DESC LIMIT $1`, [safeLimit]);
      return r.rows;
    }
    return [];
  }
  const source = kind === 'signals' ? jsonDb.signals : kind === 'quotes' ? jsonDb.quotes : jsonDb.events;
  return source.slice(-safeLimit).reverse();
}

async function stats() {
  await init();
  if (pgPool) {
    const [q,s] = await Promise.all([
      pgPool.query('SELECT COUNT(*)::int AS count FROM vtrade_quotes'),
      pgPool.query('SELECT COUNT(*)::int AS count FROM vtrade_signals')
    ]);
    return { mode: mode(), quotes: q.rows[0].count, signals: s.rows[0].count, file: null };
  }
  return { mode: mode(), quotes: jsonDb.quotes.length, signals: jsonDb.signals.length, file: JSON_FILE };
}

module.exports = { init, mode, saveQuote, saveSignal, recordEvent, getHistory, stats };
