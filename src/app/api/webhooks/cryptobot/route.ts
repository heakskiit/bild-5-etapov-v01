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
import { notifyBoostersCart } from '@/lib/discord/notifyBoosters';
import { AUTO_DELIVERY, mirrorCompletedOrder } from '@/lib/orders/mirrorCompleted';
import { sheetSkuForVariant } from '@/lib/keys/vault';
import { isPaidAfterCancel, isPayableStatus } from '@/lib/orders/payableStatus';
import { sumMoney } from '@/lib/cart/cartCheckout';

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

  // --- locate the order(s) ----------------------------------------------
  // BATCH F12: one invoice may now cover a whole cart. A single order is just
  // a group of one, so the old path is the same code running once.
  const { data: group, error } = await db
    .from('orders')
    .select('*')
    .eq('invoice_id', String(update.payload.invoice_id))
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error || !group || group.length === 0) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }
  const payable = group.filter((o) => isPayableStatus(o.status));
  if (payable.length === 0) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // FIX-PAY-019: 0015 may have auto-cancelled it; the money is real, settle it.
  for (const order of payable) {
    if (isPaidAfterCancel(order.status)) {
      console.warn(`[webhook] payment arrived for auto-cancelled order ${order.public_id}`);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'paid_after_cancel',
        detail: { invoice_id: update.payload.invoice_id },
      });
    }
  }

  // --- amount sanity check: against the WHOLE invoice -------------------
  const expected = sumMoney(group.map((o) => o.total_usd));
  if (Number(update.payload.amount) + 1e-9 < expected) {
    for (const order of payable) {
      await db.from('orders').update({ status: 'action_required' }).eq('id', order.id);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'underpaid',
        detail: { expected, received: update.payload.amount, cart_id: order.cart_id ?? null },
      });
    }
    return NextResponse.json({ ok: true, flagged: 'underpaid' });
  }

  // --- promo: spent only now, at confirmed payment (0007) ----------------
  // Once per invoice: every order of a cart carries the code, but the code
  // is a single use. burn_promo_for_order matches on the code, so burning it
  // through the first order spends it for the whole cart.
  const promoOrder = payable.find((o) => o.promo_code);
  if (promoOrder) {
    const groupIds = new Set(group.map((o) => o.id));
    const { data: burnedPromoId, error: burnError } = await db.rpc('burn_promo_for_order', {
      p_order_id: promoOrder.id,
    });
    if (burnError) {
      // The payment is already good — never fail fulfilment over bookkeeping.
      console.error('[webhook] promo burn failed', burnError);
      await db.from('order_events').insert({
        order_id: promoOrder.id,
        kind: 'promo_burn_failed',
        detail: { promo_code: promoOrder.promo_code },
      });
    } else if (burnedPromoId == null) {
      // Nothing burned: either a re-run after this very invoice already spent
      // it (used_by_order_id is one of ours), or a genuinely double-used code.
      const { data: promoRow } = await db
        .from('promo_codes')
        .select('used_by_order_id')
        .eq('code', promoOrder.promo_code)
        .maybeSingle<{ used_by_order_id: string | null }>();

      if (!promoRow?.used_by_order_id || !groupIds.has(promoRow.used_by_order_id)) {
        console.error('[webhook] discount not backed by an unused code', {
          order: promoOrder.public_id,
          promoCode: promoOrder.promo_code,
        });
        await db.from('order_events').insert({
          order_id: promoOrder.id,
          kind: 'promo_already_used',
          detail: {
            promo_code: promoOrder.promo_code,
            discount_usd: sumMoney(group.map((o) => o.discount_usd)),
            used_by_order_id: promoRow?.used_by_order_id ?? null,
          },
        });
      }
    }
  }

  // --- fulfilment: one order at a time ----------------------------------
  // Sequential on purpose: two cards of the same SKU must not race for the
  // same Apps Script lock. One failed line never stops the others.
  const flagged: string[] = [];
  const jobs: Record<string, any>[] = [];
  for (const order of payable) {
    const flag = await fulfilOrder(db, order);
    if (flag) flagged.push(`${order.public_id}:${flag}`);
    else if (order.selection?.product !== 'shark_card') jobs.push(order);
  }

  // BATCH F13: one Discord message per invoice (a cart = one message).
  // The orders are already paid and in the queue; a Discord outage must not
  // turn into a failed webhook.
  try {
    await notifyBoostersCart(jobs as any);
  } catch (err) {
    console.error('[webhook] booster notification failed', { orders: jobs.map((o) => o.public_id), err });
    flagged.push('notify_failed');
  }

  return NextResponse.json({ ok: true, orders: payable.length, ...(flagged.length ? { flagged } : {}) });
}

/** Settles one paid order. Never throws; returns a flag when it needs a human. */
async function fulfilOrder(
  db: ReturnType<typeof serviceClient>,
  order: Record<string, any>,
): Promise<string | null> {
  const paidAt = new Date().toISOString();

  if (order.selection?.product === 'shark_card') {
    // Atomic key reservation happens inside Apps Script (LockService).
    //
    // FIX-PAY-016: the vault is keyed by the sheet SKU (SHARK_100K), not by
    // the variant id (sc_100k). A failed reservation must not throw: the
    // update_id is already recorded, so CryptoBot's retry would be dropped
    // as a duplicate. Instead this order goes to action_required.
    const sku = sheetSkuForVariant(order.selection.variantId);
    let code: string;
    try {
      if (!sku) throw new Error(`unknown cash card variant: ${String(order.selection.variantId)}`);
      code = await fulfilDigitalCode(sku, order.public_id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error('[webhook] cash card delivery failed', { order: order.public_id, sku, reason });
      await db.from('orders').update({ status: 'action_required', paid_at: paidAt }).eq('id', order.id);
      await db.from('order_events').insert({
        order_id: order.id,
        kind: 'fulfilment_failed',
        detail: { variant_id: order.selection.variantId ?? null, sku, reason },
      });
      return 'fulfilment_failed';
    }
    await db.from('digital_codes').insert({ order_id: order.id, code_ciphertext: code });
    await db.from('orders').update({ status: 'completed', paid_at: paidAt }).eq('id', order.id);

    // BATCH E3: mirrorCompletedOrder never throws.
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
    return null;
  }

  // Boost job: into the queue. Discord is told once, by the caller.
  await db.from('orders').update({ status: 'action_required', paid_at: paidAt }).eq('id', order.id);
  return null;
}
