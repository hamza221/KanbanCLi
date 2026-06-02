import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const SESSION_COOKIE = 'clikanban_session';
const OAUTH_STATE_COOKIE = 'clikanban_oauth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function oauthStateCookieName() {
  return OAUTH_STATE_COOKIE;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password, passwordHash) {
  const [method, salt, hash] = String(passwordHash).split(':');
  if (method !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function createSession(db, userId) {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, expiresAt.toISOString(), now.toISOString());

  return { id, expiresAt };
}

export function deleteSession(db, sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function getSessionUser(db, sessionId) {
  if (!sessionId) return null;

  const row = db.prepare(`
    SELECT
      users.id,
      users.email,
      users.name,
      users.avatar_url AS avatarUrl,
      sessions.expires_at AS expiresAt
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
  `).get(sessionId);

  if (!row) return null;

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    deleteSession(db, sessionId);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
  };
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join('='));
  }

  return cookies;
}

export function sessionCookie(sessionId, expiresAt, secure = false) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function oauthStateCookie(state, secure = false) {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
  const parts = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearOauthStateCookie() {
  return `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
