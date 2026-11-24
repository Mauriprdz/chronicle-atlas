import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { q, one, getSettings, getDb, DEFAULT_SETTINGS } from './db.js';
import {
  authenticate, requireRole, signToken, sha256, passwordProblems, describeDevice, clientIp,
  rateLimit, ROLES, MAX_DEVICES, TOKEN_TTL_SECONDS,
} from './auth.js';
import { sendMail } from './mailer.js';
import { renderPlate, PLATES } from './media.js';
import { THEMES, THEME_SLUGS } from './themes.js';

const RUNTIME_ENV = process.env.CONTEXT || process.env.VERCEL_ENV
  || (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME ? 'production' : 'development');

// Sentry (extra points). Loaded lazily so the app works without it.
// Sample every trace locally, 10% in production.
const sentryReady = process.env.SENTRY_DSN
  ? import('@sentry/node')
      .then((Sentry) => {
        const production = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: RUNTIME_ENV,
          release: process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
          tracesSampleRate: production ? 0.1 : 1.0,
          enableLogs: true,
        });
        return Sentry;
      })
      .catch((err) => { console.error('[sentry] could not initialise', err); return null; })
  : Promise.resolve(null);

const RESET_TTL_MINUTES = 20;
const BCRYPT_ROUNDS = 11;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', BCRYPT_ROUNDS);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
// Netlify Functions may deliver the internal path; normalise it to /api/...
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) req.url = '/api' + req.url.slice('/.netlify/functions/api'.length);
  next();
});
// Sentry tunnel: browser events are posted to our own domain and forwarded to Sentry,
// so ad/tracker blockers don't drop them. Only our own project DSN is accepted.
app.post('/api/monitoring', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
  try {
    const dsn = process.env.SENTRY_DSN_FRONTEND || process.env.SENTRY_DSN;
    if (!dsn) return res.status(404).end();
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : '');
    const header = JSON.parse(raw.toString('utf8').split('\n')[0] || '{}');
    const allowed = new URL(dsn);
    const incoming = new URL(header.dsn);
    const projectId = allowed.pathname.replace(/\//g, '');
    if (incoming.host !== allowed.host || incoming.pathname.replace(/\//g, '') !== projectId) return res.status(400).end();
    const upstream = await fetch(`https://${allowed.host}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: raw,
    });
    res.status(upstream.status).end();
  } catch {
    res.status(400).end();
  }
});
app.use(express.json({ limit: '100kb' }));
// Fallback for serverless adapters that hand over the raw body as a Buffer/string
app.use((req, res, next) => {
  const raw = req.body;
  if ((Buffer.isBuffer(raw) || typeof raw === 'string') && raw.length && /json/.test(req.headers['content-type'] || '')) {
    try { req.body = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON body.' }); }
  } else if (Buffer.isBuffer(raw)) {
    req.body = {};
  }
  next();
});
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

const api = express.Router();
const str = (v, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const bad = (res, error, extra = {}) => res.status(400).json({ error, ...extra });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

async function topicBySlug(slug) {
  return one('SELECT * FROM topics WHERE slug = $1', [String(slug)]);
}

// ---------------------------------------------------------------- public
api.get('/health', async (req, res) => {
  const db = await getDb();
  res.json({ ok: true, db: db.kind, time: new Date().toISOString() });
});

api.get('/config', async (req, res) => {
  const s = await getSettings();
  res.json({
    siteName: s.site_name,
    announcement: s.announcement,
    registrationOpen: s.registration_open === 'true',
    maxDevices: MAX_DEVICES,
    sentryDsn: process.env.SENTRY_DSN_FRONTEND || process.env.SENTRY_DSN || null,
    environment: RUNTIME_ENV,
  });
});

api.get('/themes', (req, res) => res.json(THEMES.map(({ slug, name, mode, accent }) => ({ slug, name, mode, accent }))));

// ---------------------------------------------------------------- auth (A1)
api.post('/auth/register', rateLimit('register', 10, 15 * 60_000), async (req, res) => {
  const settings = await getSettings();
  if (settings.registration_open !== 'true') return res.status(403).json({ error: 'Registration is currently closed by the administrator.' });

  const name = str(req.body?.name, 80);
  const email = str(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2) return bad(res, 'Please enter your name (2+ characters).');
  if (!isEmail(email)) return bad(res, 'Please enter a valid email address.');
  const problems = passwordProblems(password);
  if (problems.length) return bad(res, `Password must contain ${problems.join(', ')}.`, { problems });

  const exists = await one('SELECT id FROM users WHERE email = $1', [email]);
  if (exists) return res.status(409).json({ error: 'An account with that email already exists. Try logging in.' });

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // New accounts are ALWAYS Standard Users. Only an admin can promote.
  const user = await one(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role`,
    [name, email, hash]
  );
  res.status(201).json({ user: publicUser(user), message: 'Account created. You can now log in.' });
});

api.post('/auth/login', rateLimit('login', 20, 10 * 60_000), async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const deviceId = str(req.body?.deviceId || req.headers['x-device-id'], 100) || null;
  if (!email || !password) return bad(res, 'Email and password are required.');

  const user = await one('SELECT * FROM users WHERE email = $1', [email]);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password.', code: 'BAD_CREDENTIALS' });
  if (user.status !== 'active') return res.status(403).json({ error: 'This account has been disabled by an administrator.', code: 'ACCOUNT_DISABLED' });

  const ua = str(req.headers['user-agent'], 400);
  const settings = await getSettings();

  // Same browser logging in again replaces its own previous session (not a new device).
  if (deviceId) {
    await q(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = 'replaced_same_device'
        WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL`,
      [user.id, deviceId]
    );
  }

  const active = await q(
    `SELECT id, device_label, created_at FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at ASC`,
    [user.id]
  );

  let revoked = [];
  if (active.length >= MAX_DEVICES) {
    if (settings.session_policy === 'reject') {
      return res.status(409).json({
        error: `This account is already active on ${MAX_DEVICES} devices. Log out from one of them first.`,
        code: 'DEVICE_LIMIT',
        activeSessions: active.map((s) => ({ device: s.device_label, since: s.created_at })),
      });
    }
    // FIFO policy: revoke the oldest session(s) so only MAX_DEVICES - 1 remain before adding the new one
    revoked = active.slice(0, active.length - (MAX_DEVICES - 1));
    for (const s of revoked) {
      await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'device_limit' WHERE id = $1`, [s.id]);
    }
  }

  const sid = crypto.randomUUID();
  await q(
    `INSERT INTO sessions (id, user_id, device_id, device_label, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval)`,
    [sid, user.id, deviceId, describeDevice(ua), ua, clientIp(req), String(TOKEN_TTL_SECONDS)]
  );

  const token = signToken({ userId: user.id, role: user.role, sid, name: user.name });
  res.json({
    token,
    expiresIn: TOKEN_TTL_SECONDS,
    user: publicUser(user),
    sessionId: sid,
    revokedSessions: revoked.map((s) => ({ device: s.device_label, since: s.created_at })),
  });
});

api.post('/auth/logout', authenticate, async (req, res) => {
  await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'logout' WHERE id = $1`, [req.sid]);
  res.json({ ok: true });
});

api.get('/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user, sessionId: req.sid });
});

// ---------------------------------------------------------------- passwords (A3)
api.put('/auth/password', authenticate, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const user = await one('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect.', code: 'BAD_CURRENT_PASSWORD' });
  }
  const problems = passwordProblems(newPassword);
  if (problems.length) return bad(res, `New password must contain ${problems.join(', ')}.`, { problems });
  if (await bcrypt.compare(newPassword, user.password_hash)) return bad(res, 'The new password must be different from the current one.');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await q('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hash, user.id]);
  // Security: sign out every OTHER device after a password change.
  await q(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = 'password_changed'
      WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [user.id, req.sid]
  );
  res.json({ ok: true, message: 'Password updated. Other devices were signed out.' });
});

const NEUTRAL_RECOVERY_MESSAGE = 'If an account exists for that email, a password reset link has been sent. The link expires in 20 minutes.';

api.post('/auth/forgot', rateLimit('forgot', 5, 15 * 60_000), async (req, res) => {
  const started = Date.now();
  const email = str(req.body?.email, 200).toLowerCase();
  if (!isEmail(email)) return bad(res, 'Please enter a valid email address.');

  const user = await one(`SELECT id, name, email FROM users WHERE email = $1 AND status = 'active'`, [email]);
  if (user) {
    // Invalidate older unused tokens, then issue a new cryptographically secure single-use token.
    await q('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    const rawToken = crypto.randomBytes(32).toString('base64url');
    await q(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [user.id, sha256(rawToken), String(RESET_TTL_MINUTES)]
    );
    const base = process.env.APP_URL || process.env.URL || `${req.protocol}://${req.get('host')}`;
    const link = `${base}/#/reset?token=${rawToken}`;
    await sendMail({
      to: user.email,
      subject: 'Chronicle Atlas - password reset',
      text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your Chronicle Atlas password.\nOpen this link within ${RESET_TTL_MINUTES} minutes:\n\n${link}\n\nThe link works only once. If you did not request this, ignore this email.`,
    });
  }
  // Same response + similar timing whether or not the account exists (no account enumeration).
  const elapsed = Date.now() - started;
  if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
  res.json({ ok: true, message: NEUTRAL_RECOVERY_MESSAGE });
});

async function findValidReset(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 200) return null;
  return one(
    `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(rawToken)]
  );
}

api.post('/auth/reset/validate', rateLimit('reset', 20, 15 * 60_000), async (req, res) => {
  const row = await findValidReset(req.body?.token);
  res.json({ valid: Boolean(row) });
});

api.post('/auth/reset', rateLimit('reset', 20, 15 * 60_000), async (req, res) => {
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const row = await findValidReset(req.body?.token);
  if (!row) return res.status(400).json({ error: 'This reset link is invalid, expired, or was already used. Request a new one.', code: 'RESET_INVALID' });
  const problems = passwordProblems(newPassword);
  if (problems.length) return bad(res, `Password must contain ${problems.join(', ')}.`, { problems });

  // Mark used FIRST (single-use, prevents reuse / race conditions)
  const claimed = await q('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id', [row.id]);
  if (!claimed.length) return res.status(400).json({ error: 'This reset link was already used.', code: 'RESET_INVALID' });

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await q('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hash, row.user_id]);
  await q('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
  await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'password_reset' WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
  res.json({ ok: true, message: 'Password reset. Please log in with your new password.' });
});

// ---------------------------------------------------------------- sessions (A2)
api.get('/sessions', authenticate, async (req, res) => {
  const rows = await q(
    `SELECT id, device_label, user_agent, ip, created_at, last_seen_at, expires_at
       FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC`,
    [req.user.id]
  );
  const history = await q(
    `SELECT id, device_label, created_at, revoked_at, revoked_reason
       FROM sessions WHERE user_id = $1 AND (revoked_at IS NOT NULL OR expires_at <= now())
      ORDER BY created_at DESC LIMIT 10`,
    [req.user.id]
  );
  res.json({
    maxDevices: MAX_DEVICES,
    sessions: rows.map((s) => ({ ...s, current: s.id === req.sid })),
    history,
  });
});

api.delete('/sessions/:id', authenticate, async (req, res) => {
  const rows = await q(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = 'terminated_by_user'
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Session not found.' });
  res.json({ ok: true, endedCurrent: req.params.id === req.sid });
});

api.delete('/sessions', authenticate, async (req, res) => {
  const rows = await q(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = 'terminated_by_user'
      WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
    [req.user.id, req.sid]
  );
  res.json({ ok: true, ended: rows.length });
});

// ---------------------------------------------------------------- topics (public read, RBAC write)
const TOPIC_LIST_FIELDS = 'slug, number, title, region, era, summary, theme, accent, updated_at';

api.get('/topics', async (req, res) => {
  res.json(await q(`SELECT ${TOPIC_LIST_FIELDS} FROM topics ORDER BY number NULLS LAST, title`));
});

api.get('/topics/:slug', async (req, res) => {
  const t = await one(
    `SELECT t.*, u.name AS updated_by_name FROM topics t LEFT JOIN users u ON u.id = t.updated_by WHERE t.slug = $1`,
    [req.params.slug]
  );
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const { created_by, updated_by, id, ...rest } = t;
  res.json(rest);
});

function validateTopic(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  if (!partial || body.slug !== undefined) {
    out.slug = str(body.slug, 60).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(out.slug)) errors.push('Slug must be 3-60 lowercase letters, numbers or dashes.');
  }
  if (!partial || body.title !== undefined) {
    out.title = str(body.title, 160);
    if (out.title.length < 3) errors.push('Title is required.');
  }
  for (const f of ['region', 'era']) if (!partial || body[f] !== undefined) out[f] = str(body[f], 120);
  if (!partial || body.summary !== undefined) {
    out.summary = str(body.summary, 1200);
    if (out.summary.length < 10) errors.push('Summary must be at least 10 characters.');
  }
  if (!partial || body.theme !== undefined) {
    out.theme = str(body.theme, 40) || 'atlas';
    if (!THEME_SLUGS.includes(out.theme)) errors.push('Unknown theme.');
  }
  if (body.accent !== undefined) {
    out.accent = str(body.accent, 7) || null;
    if (out.accent && !/^#[0-9a-fA-F]{6}$/.test(out.accent)) errors.push('Accent must be a hex color like #aa5533.');
  }
  if (!partial || body.sections !== undefined) {
    const secs = Array.isArray(body.sections) ? body.sections.slice(0, 12) : [];
    out.sections = secs
      .map((s) => ({ heading: str(s?.heading, 120), body: str(s?.body, 4000) }))
      .filter((s) => s.heading && s.body);
  }
  if (!partial || body.facts !== undefined) {
    out.facts = (Array.isArray(body.facts) ? body.facts : []).map((f) => str(f, 300)).filter(Boolean).slice(0, 12);
  }
  if (body.number !== undefined && body.number !== null && body.number !== '') {
    const n = Number(body.number);
    if (!Number.isInteger(n) || n < 1 || n > 999) errors.push('Number must be between 1 and 999.');
    else out.number = n;
  }
  return { errors, data: out };
}

const canWriteTopics = [authenticate, requireRole('investigator', 'admin')];

api.post('/topics', ...canWriteTopics, async (req, res) => {
  const { errors, data } = validateTopic(req.body || {});
  if (errors.length) return bad(res, errors.join(' '), { errors });
  if (await topicBySlug(data.slug)) return res.status(409).json({ error: 'A topic with that slug already exists.' });
  if (data.number === undefined) {
    const r = await one('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM topics');
    data.number = r.n;
  }
  const t = await one(
    `INSERT INTO topics (slug, number, title, region, era, summary, sections, facts, theme, accent, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$11) RETURNING slug`,
    [data.slug, data.number, data.title, data.region, data.era, data.summary, JSON.stringify(data.sections), JSON.stringify(data.facts), data.theme, data.accent || null, req.user.id]
  );
  res.status(201).json(t);
});

api.put('/topics/:slug', ...canWriteTopics, async (req, res) => {
  const existing = await topicBySlug(req.params.slug);
  if (!existing) return res.status(404).json({ error: 'Topic not found.' });
  const { errors, data } = validateTopic(req.body || {}, { partial: true });
  delete data.slug; // slug is immutable (keeps favorites/bookmark links stable)
  if (errors.length) return bad(res, errors.join(' '), { errors });
  const fields = Object.keys(data);
  if (!fields.length) return bad(res, 'Nothing to update.');
  const sets = fields.map((f, i) => `${f} = $${i + 1}${f === 'sections' || f === 'facts' ? '::jsonb' : ''}`);
  const values = fields.map((f) => (f === 'sections' || f === 'facts' ? JSON.stringify(data[f]) : data[f]));
  await q(
    `UPDATE topics SET ${sets.join(', ')}, updated_by = $${fields.length + 1}, updated_at = now() WHERE id = $${fields.length + 2}`,
    [...values, req.user.id, existing.id]
  );
  res.json({ ok: true, slug: existing.slug });
});

api.delete('/topics/:slug', ...canWriteTopics, async (req, res) => {
  const rows = await q('DELETE FROM topics WHERE slug = $1 RETURNING slug', [req.params.slug]);
  if (!rows.length) return res.status(404).json({ error: 'Topic not found.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- protected media (A4)
api.get('/topics/:slug/media', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  res.json(PLATES.map((p) => ({ ...p, url: `/api/media/${t.slug}/${p.n}` })));
});

api.get('/media/:slug/:n', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  const n = Number(req.params.n);
  if (!t || ![1, 2, 3].includes(n)) return res.status(404).json({ error: 'Media not found.' });
  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.send(renderPlate(t, n));
});

// ---------------------------------------------------------------- favorites & bookmarks (A1)
api.get('/me/favorites', authenticate, async (req, res) => {
  res.json(await q(
    `SELECT t.slug, t.title, t.theme, t.region, f.created_at FROM favorites f
       JOIN topics t ON t.id = f.topic_id WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
    [req.user.id]
  ));
});

api.post('/me/favorites/:slug', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  await q('INSERT INTO favorites (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, t.id]);
  res.status(201).json({ ok: true, favorite: true });
});

api.delete('/me/favorites/:slug', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  await q('DELETE FROM favorites WHERE user_id = $1 AND topic_id = $2', [req.user.id, t.id]);
  res.json({ ok: true, favorite: false });
});

api.get('/me/bookmarks', authenticate, async (req, res) => {
  res.json(await q(
    `SELECT b.id, b.section, b.note, b.created_at, t.slug, t.title, t.theme FROM bookmarks b
       JOIN topics t ON t.id = b.topic_id WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
    [req.user.id]
  ));
});

api.post('/me/bookmarks', authenticate, async (req, res) => {
  const t = await topicBySlug(str(req.body?.slug, 60));
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const section = str(req.body?.section, 120);
  const note = str(req.body?.note, 500);
  const dup = await one('SELECT id FROM bookmarks WHERE user_id = $1 AND topic_id = $2 AND section = $3', [req.user.id, t.id, section]);
  if (dup) {
    await q('UPDATE bookmarks SET note = $1 WHERE id = $2', [note, dup.id]);
    return res.json({ id: dup.id, updated: true });
  }
  const b = await one('INSERT INTO bookmarks (user_id, topic_id, section, note) VALUES ($1,$2,$3,$4) RETURNING id', [req.user.id, t.id, section, note]);
  res.status(201).json(b);
});

api.delete('/me/bookmarks/:id', authenticate, async (req, res) => {
  const rows = await q('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2 RETURNING id', [Number(req.params.id) || 0, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Bookmark not found.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- discussions (A1 + A4)
api.get('/topics/:slug/discussions', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  res.json(await q(
    `SELECT d.id, d.title, d.body, d.created_at, u.name AS author, u.role AS author_role, d.user_id,
            (SELECT COUNT(*)::int FROM comments c WHERE c.discussion_id = d.id) AS comment_count
       FROM discussions d JOIN users u ON u.id = d.user_id
      WHERE d.topic_id = $1 ORDER BY d.created_at DESC`,
    [t.id]
  ));
});

api.post('/topics/:slug/discussions', authenticate, async (req, res) => {
  const t = await topicBySlug(req.params.slug);
  if (!t) return res.status(404).json({ error: 'Topic not found.' });
  const title = str(req.body?.title, 160);
  const body = str(req.body?.body, 4000);
  if (title.length < 3 || body.length < 3) return bad(res, 'A discussion needs a title and a message.');
  const d = await one('INSERT INTO discussions (topic_id, user_id, title, body) VALUES ($1,$2,$3,$4) RETURNING id', [t.id, req.user.id, title, body]);
  res.status(201).json(d);
});

api.get('/discussions/:id', authenticate, async (req, res) => {
  const d = await one(
    `SELECT d.id, d.title, d.body, d.created_at, d.user_id, u.name AS author, u.role AS author_role,
            t.slug, t.title AS topic_title, t.theme, t.accent
       FROM discussions d JOIN users u ON u.id = d.user_id JOIN topics t ON t.id = d.topic_id WHERE d.id = $1`,
    [Number(req.params.id) || 0]
  );
  if (!d) return res.status(404).json({ error: 'Discussion not found.' });
  const comments = await q(
    `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author, u.role AS author_role
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.discussion_id = $1 ORDER BY c.created_at ASC`,
    [d.id]
  );
  res.json({ ...d, comments });
});

api.post('/discussions/:id/comments', authenticate, async (req, res) => {
  const d = await one('SELECT id FROM discussions WHERE id = $1', [Number(req.params.id) || 0]);
  if (!d) return res.status(404).json({ error: 'Discussion not found.' });
  const body = str(req.body?.body, 2000);
  if (body.length < 1) return bad(res, 'Comment cannot be empty.');
  const c = await one('INSERT INTO comments (discussion_id, user_id, body) VALUES ($1,$2,$3) RETURNING id', [d.id, req.user.id, body]);
  res.status(201).json(c);
});

api.delete('/comments/:id', authenticate, async (req, res) => {
  const c = await one('SELECT id, user_id FROM comments WHERE id = $1', [Number(req.params.id) || 0]);
  if (!c) return res.status(404).json({ error: 'Comment not found.' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own comments.', code: 'FORBIDDEN' });
  await q('DELETE FROM comments WHERE id = $1', [c.id]);
  res.json({ ok: true });
});

api.delete('/discussions/:id', authenticate, async (req, res) => {
  const d = await one('SELECT id, user_id FROM discussions WHERE id = $1', [Number(req.params.id) || 0]);
  if (!d) return res.status(404).json({ error: 'Discussion not found.' });
  if (d.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own discussions.', code: 'FORBIDDEN' });
  await q('DELETE FROM discussions WHERE id = $1', [d.id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin (A5)
const adminOnly = [authenticate, requireRole('admin')];

api.get('/admin/stats', ...adminOnly, async (req, res) => {
  const [r] = await q(`SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM topics) AS topics,
      (SELECT COUNT(*)::int FROM discussions) AS discussions,
      (SELECT COUNT(*)::int FROM comments) AS comments,
      (SELECT COUNT(*)::int FROM sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_sessions`);
  res.json(r);
});

api.get('/admin/users', ...adminOnly, async (req, res) => {
  res.json(await q(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
            (SELECT COUNT(*)::int FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS active_sessions
       FROM users u ORDER BY u.created_at ASC`
  ));
});

api.put('/admin/users/:id/role', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id) || 0;
  const role = str(req.body?.role, 20);
  if (!ROLES.includes(role)) return bad(res, `Role must be one of: ${ROLES.join(', ')}.`);
  if (id === req.user.id) return bad(res, 'You cannot change your own role.');
  const rows = await q('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, role', [role, id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  res.json(rows[0]);
});

api.put('/admin/users/:id/status', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id) || 0;
  const status = str(req.body?.status, 20);
  if (!['active', 'disabled'].includes(status)) return bad(res, 'Status must be active or disabled.');
  if (id === req.user.id) return bad(res, 'You cannot disable your own account.');
  const rows = await q('UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status', [status, id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  if (status === 'disabled') await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'disabled_by_admin' WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
  res.json(rows[0]);
});

api.delete('/admin/users/:id', ...adminOnly, async (req, res) => {
  const id = Number(req.params.id) || 0;
  if (id === req.user.id) return bad(res, 'You cannot delete your own account.');
  const rows = await q('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  res.json({ ok: true });
});

api.get('/admin/sessions', ...adminOnly, async (req, res) => {
  res.json(await q(
    `SELECT s.id, s.user_id, u.name, u.email, s.device_label, s.ip, s.created_at, s.last_seen_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > now() ORDER BY s.created_at DESC`
  ));
});

api.delete('/admin/sessions/:id', ...adminOnly, async (req, res) => {
  const rows = await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'revoked_by_admin' WHERE id = $1 AND revoked_at IS NULL RETURNING id`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Session not found.' });
  res.json({ ok: true });
});

api.get('/admin/settings', ...adminOnly, async (req, res) => res.json(await getSettings()));

api.put('/admin/settings', ...adminOnly, async (req, res) => {
  const body = req.body || {};
  const updates = {};
  if (body.site_name !== undefined) updates.site_name = str(body.site_name, 60) || DEFAULT_SETTINGS.site_name;
  if (body.announcement !== undefined) updates.announcement = str(body.announcement, 300);
  if (body.registration_open !== undefined) updates.registration_open = String(body.registration_open) === 'true' ? 'true' : 'false';
  if (body.session_policy !== undefined) {
    if (!['fifo', 'reject'].includes(body.session_policy)) return bad(res, 'session_policy must be fifo or reject.');
    updates.session_policy = body.session_policy;
  }
  for (const [k, v] of Object.entries(updates)) {
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  }
  res.json(await getSettings());
});

api.get('/admin/outbox', ...adminOnly, async (req, res) => {
  res.json(await q('SELECT id, to_email, subject, body, created_at FROM outbox ORDER BY created_at DESC LIMIT 25'));
});

api.post('/admin/sentry-test', ...adminOnly, async () => {
  throw new Error('Sentry test error triggered from the Admin panel');
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/api', api);

app.use(async (err, req, res, next) => {
  console.error(err);
  const Sentry = await sentryReady;
  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setTag('route', `${req.method} ${req.path}`);
      Sentry.captureException(err);
    });
    // Serverless functions freeze after responding: send the event first.
    await Sentry.flush(2000).catch(() => {});
  }
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

export default app;
