/**
 * POST /api/checkout
 * Accepts a selection of IDs, recomputes the price, creates the order, then
 * asks CryptoBot for an invoice. The client receives only the pay URL.
 */

import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { roundMoney } from '@/../config/pricing.config';
import { checkoutRequestSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { createInvoice } from '@/lib/pricing/cryptobot';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    console.warn('[checkout] rejected: no session on the request');
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Zod strips unknown keys — a client-supplied `price` cannot survive this.
  const parsed = checkoutRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_selection', issues: parsed.error.issues }, { status: 400 });
  }
  const { selection, contactMethod, contactHandle, details, promoCode } = parsed.data;

  const db = serviceClient();
  let claimedPromoId: number | null = null;

  try {
    const breakdown = calculatePrice(selection);
    let total = breakdown.total;
    let discountUsd = 0;

    if (promoCode) {
      // Atomic claim — same shape as the queue-claim pattern (0002): the
      // UPDATE's WHERE clause is the actual check, not a SELECT-then-UPDATE,
      // so two customers racing on the same code can't both win it.
      const nowIso = new Date().toISOString();
      const { data: promo, error: promoError } = await db
        .from('promo_codes')
        .update({ used_at: nowIso })
        .eq('code', promoCode)
        .is('used_at', null)
        .eq('active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .select('id, discount_type, discount_value, reserved_for_user_id')
        .maybeSingle();
      if (promoError) throw promoError;
      if (!promo || (promo.reserved_for_user_id && promo.reserved_for_user_id !== user.id)) {
        // Reserved-for-someone-else codes fail the same as "doesn't exist" —
        // no need to leak whose code it is.
        if (promo) await db.from('promo_codes').update({ used_at: null }).eq('id', promo.id);
        return NextResponse.json({ error: 'invalid_promo' }, { status: 422 });
      }

      claimedPromoId = promo.id;
      discountUsd =
        promo.discount_type === 'percent' ? roundMoney(total * (promo.discount_value / 100)) : promo.discount_value;
      total = roundMoney(Math.max(0.5, total - discountUsd));
    }

    const { data: order, error } = await db
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'awaiting_payment',
        // `orderSelectionSchema` stays .strict() for pricing purposes —
        // `orderNotes` is appended here, after validation, purely for
        // storage, so every existing reader of `selection.product` /
        // `.level` / `.platform` etc. (queue, jobs, inventory) keeps
        // working untouched.
        selection: { ...selection, orderNotes: details },
        total_usd: total,
        booster_payout_usd: breakdown.boosterPayout,
        pricing_version: breakdown.pricingVersion,
        promo_code: promoCode ?? null,
        discount_usd: discountUsd,
        // Single free-text column (0001) — method is folded into the string
        // itself ("telegram: @handle") so notifyBoosters/the dashboard don't
        // need a second field to read.
        contact_handle: `${contactMethod}: ${contactHandle}`,
      })
      .select()
      .single();
    if (error) throw error;

    if (claimedPromoId) {
      const { error: linkError } = await db
        .from('promo_codes')
        .update({ used_by_order_id: order.id })
        .eq('id', claimedPromoId);
      if (linkError) console.error('[checkout] promo linked but order_id backfill failed', linkError);
    }

    const invoice = await createInvoice({
      amount: total,
      description: `Order ${order.public_id}`,
      payload: order.public_id,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/${selection.locale ?? 'en'}/dashboard/orders`,
    });

    await db.from('orders').update({ invoice_id: invoice.invoice_id }).eq('id', order.id);

    return NextResponse.json({ payUrl: invoice.pay_url, orderId: order.public_id });
  } catch (err) {
    if (claimedPromoId) {
      // Order or invoice creation failed after the code was already burned —
      // give it back rather than silently costing the customer their code.
      await db.from('promo_codes').update({ used_at: null, used_by_order_id: null }).eq('id', claimedPromoId);
    }
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
