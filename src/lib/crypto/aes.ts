/**
 * AES-256-GCM envelope for Safe Account Sharing (Piloted method).
 *
 * Rules encoded here:
 *  - Credentials are accepted ONLY after payment (enforced in the route).
 *  - Key material lives in CREDENTIALS_ENCRYPTION_KEY (32 bytes, base64) and
 *    never touches the database.
 *  - GCM gives us authenticity: a tampered ciphertext fails to decrypt rather
 *    than silently returning garbage.
 *  - On order completion the row is nullified — see nullifyCredentials().
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes');
  return buf;
}

/** Returns a self-describing string: v1.<iv>.<tag>.<ciphertext> (all base64url). */
export function encryptSecret(plaintext: string, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptSecret(envelope: string, aad: string): string {
  const [version, ivB64, tagB64, ctB64] = envelope.split('.');
  if (version !== 'v1') throw new Error(`Unsupported envelope version ${version}`);
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Generate a fresh key for .env — run once per environment. */
export const generateKey = (): string => randomBytes(32).toString('base64');
