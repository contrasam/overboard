import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, storedHash] = stored.split(':');
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expiresAt);
  return token;
}

export function getUserBySession(token: string): { id: string; email: string } | undefined {
  return db.prepare(
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token=? AND s.expires_at>?`
  ).get(token, Date.now()) as { id: string; email: string } | undefined;
}

export function deleteSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}
