// Database layer.
// - Production (Netlify/Vercel): set DATABASE_URL (Netlify DB sets NETLIFY_DATABASE_URL automatically) to a Postgres database (Neon, Supabase, Vercel Postgres...).
// - Local development: if DATABASE_URL is missing, an embedded Postgres (PGlite) is used,
//   stored in ./.data so you can run the project with zero setup.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { TOPICS } from './topics-data.js';

let dbPromise = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','investigator','admin')),
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     password_changed_at TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     device_id TEXT,
     device_label TEXT,
     user_agent TEXT,
     ip TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at TIMESTAMPTZ NOT NULL,
     revoked_at TIMESTAMPTZ,
     revoked_reason TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS password_resets (
     id SERIAL PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash TEXT NOT NULL UNIQUE,
     expires_at TIMESTAMPTZ NOT NULL,
     used_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS topics (
     id SERIAL PRIMARY KEY,
     slug TEXT NOT NULL UNIQUE,
     number INTEGER,
     title TEXT NOT NULL,
     region TEXT NOT NULL DEFAULT '',
     era TEXT NOT NULL DEFAULT '',
     summary TEXT NOT NULL DEFAULT '',
     sections JSONB NOT NULL DEFAULT '[]'::jsonb,
     facts JSONB NOT NULL DEFAULT '[]'::jsonb,
     theme TEXT NOT NULL DEFAULT 'atlas',
     accent TEXT,
     created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS favorites (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, topic_id)
   )`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
     id SERIAL PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
     section TEXT NOT NULL DEFAULT '',
     note TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS discussions (
     id SERIAL PRIMARY KEY,
     topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS comments (
     id SERIAL PRIMARY KEY,
     discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS outbox (
     id SERIAL PRIMARY KEY,
     to_email TEXT NOT NULL,
     subject TEXT NOT NULL,
     body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

export const DEFAULT_SETTINGS = {
  site_name: 'Chronicle Atlas',
  announcement: 'Welcome, researchers! 20 civilizations and states are open for investigation.',
  registration_open: 'true',
  session_policy: 'fifo', // 'fifo' = revoke oldest session, 'reject' = refuse 3rd login
};

async function createDriver() {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 3,
    });
    return { kind: 'postgres', query: async (text, params = []) => (await pool.query(text, params)).rows };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const serverless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT;
  const dir = serverless ? '/tmp/atlas-pg' : (process.env.PGLITE_DIR || './.data/pg');
  if (dir !== 'memory') {
    const fs = await import('node:fs');
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new PGlite(dir === 'memory' ? undefined : dir);
  await db.waitReady;
  return { kind: 'pglite', query: async (text, params = []) => (await db.query(text, params)).rows };
}

async function migrateAndSeed(db) {
  for (const stmt of SCHEMA) await db.query(stmt);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query('INSERT INTO settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }

  const [{ count: topicCount }] = await db.query('SELECT COUNT(*)::int AS count FROM topics');
  if (topicCount === 0) {
    for (const t of TOPICS) {
      await db.query(
        `INSERT INTO topics (slug, number, title, region, era, summary, sections, facts, theme)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (slug) DO NOTHING`,
        [t.slug, t.number, t.title, t.region, t.era, t.summary, JSON.stringify(t.sections), JSON.stringify(t.facts), t.theme]
      );
    }
  }

  // Demo accounts (one per role) so the RBAC rubric can be tested immediately.
  // Passwords come from environment variables so they are NOT visible in the public repo.
  // Local development (no DATABASE_URL) uses simple defaults; production without the
  // variables gets a random password printed once in the function logs.
  const [{ count: userCount }] = await db.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount === 0) {
    const production = Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);
    const pick = (envName, devDefault) => {
      if (process.env[envName]) return process.env[envName];
      if (!production) return devDefault;
      const generated = 'Atlas#' + crypto.randomBytes(9).toString('base64url') + '9a';
      console.warn(`[seed] ${envName} not set - generated password: ${generated}`);
      return generated;
    };
    const demo = [
      ['Atlas Admin', process.env.ADMIN_EMAIL || 'admin@atlas.demo', pick('ADMIN_PASSWORD', 'Admin#2026!'), 'admin'],
      ['Ines Investigator', 'investigator@atlas.demo', pick('INVESTIGATOR_PASSWORD', 'Research#2026!'), 'investigator'],
      ['Sam Standard', 'user@atlas.demo', pick('USER_PASSWORD', 'Reader#2026!'), 'user'],
    ];
    for (const [name, email, password, role] of demo) {
      const hash = await bcrypt.hash(password, 11);
      await db.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING',
        [name, email.toLowerCase(), hash, role]
      );
    }
  }
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createDriver();
      await migrateAndSeed(db);
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function q(text, params) {
  const db = await getDb();
  return db.query(text, params);
}

export async function one(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

export async function getSettings() {
  const rows = await q('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
