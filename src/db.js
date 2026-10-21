import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'qarz-daftar.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  client_limit INTEGER,            -- NULL = cheksiz
  staff_limit INTEGER,
  sms_limit INTEGER NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  inn TEXT NOT NULL DEFAULT '',
  telegram TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'UZS',
  language TEXT NOT NULL DEFAULT 'uz',
  plan_id INTEGER REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trial',     -- active | trial | blocked
  sub_until TEXT,
  sms_template TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '{}',          -- avtomatik SMS qoidalari
  prefs TEXT NOT NULL DEFAULT '{}',          -- bildirishnoma va ilova sozlamalari
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL,                        -- owner | manager | cashier | superadmin | support | finance
  device TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',     -- active | inactive | blocked
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'customer',     -- customer | supplier
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'give',    -- give (qarz berdim) | take (qarz oldim)
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  date TEXT NOT NULL,
  due_date TEXT,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Mahsulot',
  sms_reminder INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'Naqd',       -- Naqd | Karta | Click | Payme
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                        -- pay | late | due | sms
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  ref TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  type TEXT NOT NULL,                        -- Muddat eslatmasi | Muddat o'tdi | To'lov tasdig'i | Kirish kodi
  kind TEXT NOT NULL DEFAULT '',             -- before | due | after | manual | payment | otp
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',       -- sent | wait | fail
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'Payme',
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',         -- ok | wait | fail
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,                       -- info | warn | err | ok
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  user_label TEXT NOT NULL DEFAULT 'Tizim',
  ip TEXT NOT NULL DEFAULT '—',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_debts_store ON debts(store_id, client_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_payments_store ON payments(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_store ON notifications(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_store ON sms_log(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
`);

// Migratsiya: admin tomonidan do'kon uchun SMS yuborishni yoqish/o'chirish
if (!db.prepare('PRAGMA table_info(stores)').all().some((c) => c.name === 'sms_enabled')) {
  db.exec('ALTER TABLE stores ADD COLUMN sms_enabled INTEGER NOT NULL DEFAULT 1');
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

export function getSetting(key, fallback) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

/** SMS yuborish ruxsati: platforma bo'yicha VA do'kon bo'yicha yoqilgan bo'lishi kerak */
export function smsAllowed(store) {
  return getSetting('sms_enabled', true) !== false && !!store?.sms_enabled;
}

export function isEmpty() {
  return get('SELECT COUNT(*) AS n FROM plans').n === 0;
}
