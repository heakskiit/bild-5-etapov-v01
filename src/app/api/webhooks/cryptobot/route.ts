/**
 * CryptoBot Pay webhook — the single place where an order becomes "paid".
 *
 * Signature scheme (Crypto Pay):
 *   secret = SHA256(CRYPTO_PAY_TOKEN)
 *   expected = HMAC_SHA256(secret, rawBody).hex
 *   compare with header `crypto-pay-api-signature`
 *
 * Hard rules:
 *  - Read the RAW body. Parsing before verifying breaks the HMAC.
 *  - Timing-safe compare.
 *  - Idempotent: every update_id is recorded; replays are dropped.
 *  - Cross-check the paid amount against our own recomputed total.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { fulfilDigitalCode } from '@/lib/keys/googleSheets';
import { notifyBoosters } from '@/lib/discord/notifyBoosters';

export const runtime = 'nodejs';

function verify(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const token = process.env.CRYPTO_PAY_TOKEN;
  if (!token) throw new Error('CRYPTO_PAY_TOKEN is not set');
  const secret = createHash('sha256').update(token).digest();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verify(rawBody, request.headers.get('crypto-pay-api-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const update = JSON.parse(rawBody) as {
    update_id: number;
    update_type: string;
    payload: { invoice_id: number; status: string; payload?: string; amount: string };
  };

  const db = serviceClient();

  // --- idempotency gate -------------------------------------------------
  const { error: seenError } = await db
    .from('webhook_events')
    .insert({ provider: 'cryptobot', external_id: String(update.update_id), body: update });
  if (seenError?.code === '23505') {
    return NextResponse.json({ ok: true, deduplicated: true });
  }
  if (seenError) throw seenError;

  if (update.update_type !== 'invoice_paid' || update.payload.status !== 'paid') {
    return NextResponse.json({ ok: true, ignored: update.update_type });
  }

  // --- locate the order -------------------------------------------------
  const { data: order, error } = await db
    .from('orders')
    .select('*')
    .eq('invoice_id', String(update.payload.invoice_id))
    .single();
  if (error || !order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // --- amount sanity check ---------------------------------------------
  if (Number(update.payload.amount) + 1e-9 < Number(order.total_usd)) {
    await db.from('orders').update({ status: 'action_required' }).eq('id', order.id);
    await db.from('order_events').insert({
      order_id: order.id,
      kind: 'underpaid',
      detail: { expected: order.total_usd, received: update.payload.amount },
    });
    return NextResponse.json({ ok: true, flagged: 'underpaid' });
  }

  // --- promo: spent only now, at confirmed payment (0007) ----------------
  if (order.promo_code) {
    const { error: burnError } = await db.rpc('burn_promo_for_order', { p_order_id: order.id });
    if (burnError) {
      // The payment is already good — never fail fulfilment over bookkeeping.
      console.error('[webhook] promo burn failed', burnError);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'promo_burn_failed',
        detail: { promo_code: order.promo_code },
      });
    }
  }

  // --- fulfilment -------------------------------------------------------
  if (order.selection.product === 'shark_card') {
    // Atomic key reservation happens inside Apps Script (LockService).
    const code = await fulfilDigitalCode(order.selection.variantId, order.public_id);
    await db.from('digital_codes').insert({ order_id: order.id, code_ciphertext: code });
    await db.from('orders').update({ status: 'completed', paid_at: new Date().toISOString() }).eq('id', order.id);
  } else {
    await db
      .from('orders')
      .update({ status: 'action_required', paid_at: new Date().toISOString() })
      .eq('id', order.id);
    await notifyBoosters(order);
  }

  return NextResponse.json({ ok: true });
}
