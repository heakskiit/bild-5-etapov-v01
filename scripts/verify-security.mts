/**
 * Sanity check for the two security-critical primitives:
 *   1. AES-256-GCM envelope round-trips, and rejects tampering / wrong AAD.
 *   2. The CryptoBot webhook signature scheme accepts a correctly signed body
 *      and rejects everything else.
 * Run with `npm run verify:security`.
 */

import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { encryptSecret, decryptSecret, generateKey } from '../src/lib/crypto/aes.ts';

process.env.CREDENTIALS_ENCRYPTION_KEY = generateKey();

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
};

console.log('security primitives');

check('AES-256-GCM round-trips', () => {
  const envelope = encryptSecret('super-secret-password', 'GT-1A2B3C4D');
  assert.notEqual(envelope, 'super-secret-password');
  assert.ok(envelope.startsWith('v1.'));
  assert.equal(decryptSecret(envelope, 'GT-1A2B3C4D'), 'super-secret-password');
});

check('ciphertext is unique per call (fresh IV)', () => {
  const a = encryptSecret('same', 'GT-1');
  const b = encryptSecret('same', 'GT-1');
  assert.notEqual(a, b);
});

check('a credential row cannot be replayed onto another order (AAD binding)', () => {
  const envelope = encryptSecret('pw', 'GT-AAAA');
  assert.throws(() => decryptSecret(envelope, 'GT-BBBB'));
});

check('tampered ciphertext fails authentication', () => {
  const [v, iv, tag, ct] = encryptSecret('pw', 'GT-1').split('.');
  const flipped = Buffer.from(ct, 'base64url');
  flipped[0] ^= 0xff;
  assert.throws(() => decryptSecret([v, iv, tag, flipped.toString('base64url')].join('.'), 'GT-1'));
});

/* ------------------------------------------------------------------ */

const TOKEN = 'test-token-12345';
const sign = (body: string, token = TOKEN) =>
  createHmac('sha256', createHash('sha256').update(token).digest()).update(body).digest('hex');

const verify = (body: string, signature: string | null) => {
  if (!signature) return false;
  const a = Buffer.from(sign(body), 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

console.log('cryptobot webhook signature');

check('valid signature accepted', () => {
  const body = JSON.stringify({ update_id: 1, update_type: 'invoice_paid' });
  assert.equal(verify(body, sign(body)), true);
});

check('signature over a different body rejected (amount tampering)', () => {
  const original = JSON.stringify({ amount: '10.00' });
  const tampered = JSON.stringify({ amount: '0.01' });
  assert.equal(verify(tampered, sign(original)), false);
});

check('signature from a foreign token rejected', () => {
  const body = JSON.stringify({ update_id: 2 });
  assert.equal(verify(body, sign(body, 'attacker-token')), false);
});

check('missing or malformed header rejected', () => {
  const body = '{}';
  assert.equal(verify(body, null), false);
  assert.equal(verify(body, 'deadbeef'), false);
});

console.log(`\n${checks} checks passed`);
