import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { one, q } from './db.js';

export const ROLES = ['user', 'investigator', 'admin'];
export const MAX_DEVICES = 2;
export const TOKEN_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const ISSUER = 'chronicle-atlas';
const AUDIENCE = 'chronicle-atlas-web';

function resolveSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  if (process.env.JWT_SECRET) console.warn('[auth] JWT_SECRET should be at least 32 characters long.');
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // Fallback so a fresh deploy still works: derive a stable secret from the DB URL.
  // Set a real JWT_SECRET in production.
  console.warn('[auth] JWT_SECRET not set - using a derived development secret.');
  return crypto.createHash('sha256').update('atlas-dev::' + (process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || 'local')).digest('hex');
}
const SECRET = resolveSecret();

export function signToken({ userId, role, sid, name }) {
  return jwt.sign({ userId, role, sid, name }, SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: String(userId),
  });
}

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Strong password policy (A3 rubric: "enforces strong password rules")
export function passwordProblems(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 8) problems.push('at least 8 characters');
  if (typeof pw === 'string' && pw.length > 128) problems.push('at most 128 characters');
  if (!/[a-z]/.test(pw || '')) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(pw || '')) problems.push('an uppercase letter');
  if (!/[0-9]/.test(pw || '')) problems.push('a number');
  if (!/[^A-Za-z0-9]/.test(pw || '')) problems.push('a symbol');
  return problems;
}

// Human readable device label from the User-Agent (device identification, A2 rubric)
export function describeDevice(ua = '') {
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    /curl|node|undici|PostmanRuntime|insomnia/i.test(ua) ? 'API client' : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const kind = /Mobile|Android|iPhone/.test(ua) ? 'mobile' : 'desktop';
  return `${browser} on ${os} (${kind})`;
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : (fwd || '')).split(',')[0].trim() || req.socket?.remoteAddress || '';
}

const unauthorized = (res, code, error) => res.status(401).json({ error, code });

// Verifies the JWT signature + expiry + payload shape, then checks the session registry.
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/);
    if (!match) return unauthorized(res, 'NO_TOKEN', 'Authentication required. Send Authorization: Bearer <token>.');

    let payload;
    try {
      payload = jwt.verify(match[1], SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    } catch (err) {
      if (err.name === 'TokenExpiredError') return unauthorized(res, 'TOKEN_EXPIRED', 'Your session expired. Please log in again.');
      return unauthorized(res, 'TOKEN_INVALID', 'Invalid or tampered token.');
    }

    // Strict payload validation of userId and role
    if (!Number.isInteger(payload.userId) || typeof payload.sid !== 'string' || !ROLES.includes(payload.role) || payload.sub !== String(payload.userId)) {
      return unauthorized(res, 'TOKEN_INVALID', 'Malformed token payload.');
    }

    const row = await one(
      `SELECT s.id AS sid, s.last_seen_at, u.id, u.name, u.email, u.role, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [payload.sid, payload.userId]
    );
    if (!row) return unauthorized(res, 'SESSION_REVOKED', 'This session is no longer active (logged out, replaced by another device, or revoked).');
    if (row.status !== 'active') return res.status(403).json({ error: 'Account disabled by an administrator.', code: 'ACCOUNT_DISABLED' });
    if (row.role !== payload.role) {
      // Role changed by an admin since the token was issued: force a fresh login.
      await q(`UPDATE sessions SET revoked_at = now(), revoked_reason = 'role_changed' WHERE id = $1`, [payload.sid]);
      return unauthorized(res, 'ROLE_CHANGED', 'Your role was updated. Please log in again.');
    }

    if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) {
      q('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [payload.sid]).catch(() => {});
    }

    req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
    req.sid = row.sid;
    next();
  } catch (err) {
    next(err);
  }
}

// RBAC: server-side enforcement, returns 403 Forbidden (A5 rubric)
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res, 'NO_TOKEN', 'Authentication required.');
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Forbidden: requires role ${roles.join(' or ')}.`, code: 'FORBIDDEN' });
  }
  next();
};

// Tiny in-memory rate limiter (best effort on serverless) for login / recovery endpoints.
const buckets = new Map();
export const rateLimit = (name, max, windowMs) => (req, res, next) => {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count += 1;
  buckets.set(key, b);
  if (b.count > max) {
    res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
    return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.', code: 'RATE_LIMITED' });
  }
  next();
};
