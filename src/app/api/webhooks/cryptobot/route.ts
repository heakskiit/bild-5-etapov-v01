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
import { AUTO_DELIVERY, mirrorCompletedOrder } from '@/lib/orders/mirrorCompleted';
import { sheetSkuForVariant } from '@/lib/keys/vault';

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
    const { data: burnedPromoId, error: burnError } = await db.rpc('burn_promo_for_order', {
      p_order_id: order.id,
    });
    if (burnError) {
      // The payment is already good — never fail fulfilment over bookkeeping.
      console.error('[webhook] promo burn failed', burnError);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'promo_burn_failed',
        detail: { promo_code: order.promo_code },
      });
    } else if (burnedPromoId == null) {
      // Nothing was burned. Since 0010 a code stays valid until it is paid
      // for, so two checkouts can both carry it and only the first payment
      // finds anything to spend. The money is already in and the discount
      // was already applied to the invoice, so this cannot be prevented
      // here — only recorded, so a double-used code is never silent.
      //
      // One benign case looks identical: this very order burned the code and
      // we are re-running after a failure between the burn and the status
      // update. used_by_order_id tells the two apart.
      const { data: promoRow } = await db
        .from('promo_codes')
        .select('used_by_order_id')
        .eq('code', order.promo_code)
        .maybeSingle<{ used_by_order_id: string | null }>();

      if (promoRow?.used_by_order_id !== order.id) {
        console.error('[webhook] discount not backed by an unused code', {
          order: order.public_id,
          promoCode: order.promo_code,
        });
        await db.from('order_events').insert({
          order_id: order.id,
          kind: 'promo_already_used',
          detail: {
            promo_code: order.promo_code,
            discount_usd: order.discount_usd,
            used_by_order_id: promoRow?.used_by_order_id ?? null,
          },
        });
      }
    }
  }

  // --- fulfilment -------------------------------------------------------
  if (order.selection.product === 'shark_card') {
    // Atomic key reservation happens inside Apps Script (LockService).
    //
    // FIX-PAY-016: the vault is keyed by the sheet SKU (SHARK_100K), not by
    // the variant id (sc_100k). And a failed reservation must not throw: the
    // update_id is already recorded above, so CryptoBot's retry would be
    // dropped as a duplicate and a paid order would sit in awaiting_payment
    // forever. Instead the order goes to action_required with the reason.
    const sku = sheetSkuForVariant(order.selection.variantId);
    let code: string;
    try {
      if (!sku) throw new Error(`unknown cash card variant: ${String(order.selection.variantId)}`);
      code = await fulfilDigitalCode(sku, order.public_id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error('[webhook] cash card delivery failed', { order: order.public_id, sku, reason });
      await db
        .from('orders')
        .update({ status: 'action_required', paid_at: new Date().toISOString() })
        .eq('id', order.id);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'fulfilment_failed',
        detail: { variant_id: order.selection.variantId ?? null, sku, reason },
      });
      return NextResponse.json({ ok: true, flagged: 'fulfilment_failed' });
    }
    await db.from('digital_codes').insert({ order_id: order.id, code_ciphertext: code });
    await db.from('orders').update({ status: 'completed', paid_at: new Date().toISOString() }).eq('id', order.id);

    // BATCH E3: a cash card is delivered the moment it is paid for, so this
    // is where such an order becomes "done" -- nobody closes it by hand.
    // mirrorCompletedOrder never throws: the key is already issued and the
    // customer is already owed it, so a spreadsheet outage cannot be allowed
    // to turn a successful payment into a failed webhook and a retry.
    await mirrorCompletedOrder({
      publicId: order.public_id,
      selection: order.selection,
      totalUsd: order.total_usd,
      discountUsd: order.discount_usd,
      promoCode: order.promo_code,
      deliveryMultiplier: order.delivery_multiplier,
      contactHandle: order.contact_handle,
      completedBy: AUTO_DELIVERY,
    });
  } else {
    await db
      .from('orders')
      .update({ status: 'action_required', paid_at: new Date().toISOString() })
      .eq('id', order.id);
    await notifyBoosters(order);
  }

  return NextResponse.json({ ok: true });
}
