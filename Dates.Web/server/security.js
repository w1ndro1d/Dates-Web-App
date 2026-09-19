import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const token = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function equalSecret(a, b) {
  return typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [scheme, salt, encoded] = (stored || '').split(':');
  // Still perform the expensive hash when the email is unknown.
  const key = await scrypt(password, salt || '00000000000000000000000000000000', 64, options);
  return scheme === 'scrypt' && /^[a-f0-9]{128}$/.test(encoded || '') && timingSafeEqual(key, Buffer.from(encoded, 'hex'));
}
export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export function validateEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) || email.split('@')[0].length > 64 || email.startsWith('.') || email.includes('..') || email.includes('.@')) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  return email;
}
export function validatePassword(value, signup = false) {
  if (typeof value !== 'string' || value.length < (signup ? 8 : 1) || Buffer.byteLength(value, 'utf8') > 256) {
    throw new HttpError(400, signup ? 'Use a password of at least 8 characters and at most 256 bytes.' : 'Enter a valid password.');
  }
  return value;
}
