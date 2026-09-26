/**
 * POST /api/checkout
 * Accepts a selection of IDs, recomputes the price, creates the order, then
 * asks CryptoBot for an invoice. The client receives only the pay URL.
 */

import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { applyPromoDiscount, isUsableDiscountValue } from '@/lib/pricing/discount';
import { checkPromoMinOrder } from '@/lib/pricing/promoEligibility';
import { bonusMultiplierFor, checkBonusProduct } from '@/lib/pricing/promoBonus';
import {
  roundMoney,
  BOOSTER_PAYOUT_SHARE,
  PROMO_HOLD_MINUTES,
} from '@/../config/pricing.config';
import { checkoutRequestSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { createInvoice } from '@/lib/pricing/cryptobot';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { canPlaceOrder, dayWindowStart, pendingWindowStart } from '@/lib/orders/orderLimits';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    console.warn('[checkout] rejected: no session on the request');
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Checked before any work: each accepted call writes an order row and
  // asks CryptoBot for an invoice, which makes this the most expensive
  // endpoint in the app to abuse.
  const verdict = await consumeRateLimit('checkout', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  // Zod strips unknown keys — a client-supplied `price` cannot survive this.
  const parsed = checkoutRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_selection', issues: parsed.error.issues }, { status: 400 });
  }
  const { selection, contactMethod, contactHandle, details, promoCode } = parsed.data;

  const db = serviceClient();

  // Unpaid orders are the cheap abuse: the row and the invoice cost whoever
  // placed them nothing, and a few dozen of them bury every list the owner
  // actually reads. Checked before the price is recomputed, so a refusal never
  // reaches CryptoBot.
  //
  // Two head-only COUNT(*) reads, run together -- the answer to "may this
  // profile order at all" should not cost more than the cheapest question we
  // can ask the database.
  const [pendingRead, dailyRead] = await Promise.all([
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'awaiting_payment')
      .gte('created_at', pendingWindowStart()),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayWindowStart()),
  ]);
  if (pendingRead.error || dailyRead.error) {
    // Fail open like the rate limiter does -- but never silently.
    console.error(
      '[checkout] order limit counts failed, allowing request',
      pendingRead.error ?? dailyRead.error,
    );
  }
  const volume = canPlaceOrder({
    pendingCount: pendingRead.error ? null : pendingRead.count,
    dailyCount: dailyRead.error ? null : dailyRead.count,
  });
  if (!volume.allowed) {
    console.warn(`[checkout] refused for ${user.id}: ${volume.reason} (limit ${volume.limit})`);
    return NextResponse.json({ error: volume.reason, limit: volume.limit }, { status: 429 });
  }

  let heldPromoId: number | null = null;
    // Recorded on the order itself, so deleting the code later cannot
    // quietly halve what a booster owes an already-paid customer.
    let deliveryMultiplier = 1;

  try {
    const breakdown = calculatePrice(selection);
    let total = breakdown.total;
    let discountUsd = 0;

    if (promoCode) {
      // Two phases, split by 0007: checkout only *holds* the code, payment
      // burns it. claim_promo_hold() is a single UPDATE ... WHERE ...
      // RETURNING, so the WHERE clause is the concurrency control and two
      // customers racing on one code cannot both get a row back.
      //
      // An abandoned checkout needs no cleanup job: the hold stops matching
      // that WHERE clause once it lapses, and the window equals the CryptoBot
      // invoice lifetime, so the code frees itself exactly when the invoice
      // stops being payable.
      const { data: promo, error: promoError } = await db
        .rpc('claim_promo_hold', {
          p_code: promoCode,
          p_user_id: user.id,
          p_hold_minutes: PROMO_HOLD_MINUTES,
        })
        .maybeSingle<{ id: number; discount_type: 'percent' | 'fixed_usd' | 'bonus_x2'; discount_value: number; min_order_usd: number | string }>();
      if (promoError) throw promoError;
      if (!promo) {
        // Unknown, spent, held, expired or reserved for somebody else all
        // answer identically, so this cannot be used to probe which.
        return NextResponse.json({ error: 'invalid_promo' }, { status: 422 });
      }

      // Compared against the pre-discount total -- the very figure the
      // preview compares, so a code that previewed as eligible cannot be
      // refused here.
      //
      // The claim above already wrote held_until, and that is harmless:
      // since 0010 nothing gates on it, so a refused order leaves the code
      // fully usable. heldPromoId is still null, so the catch below has
      // nothing to release either.
      const eligibility = checkPromoMinOrder(total, promo.min_order_usd);
      if (!eligibility.eligible) {
        return NextResponse.json(
          { error: 'min_order', minOrderUsd: eligibility.minOrderUsd },
          { status: 422 },
        );
      }

      // Checked before the code is claimed: refusing after the claim would
      // leave a hold behind for no reason, and this refusal is entirely
      // predictable from the selection.
      const bonusMultiplier = bonusMultiplierFor(promo.discount_type, promo.discount_value);
      if (bonusMultiplier > 1) {
        const bonus = checkBonusProduct(selection.product);
        if (!bonus.eligible) {
          return NextResponse.json({ error: 'wrong_product' }, { status: 422 });
        }
      }

      // A promo row whose discount_value is null, empty, non-numeric or
      // negative cannot be turned into money: coerced it becomes NaN, which
      // survives the arithmetic and lands on the invoice floor, or it becomes
      // an upcharge. Answered exactly like an unknown code -- the customer
      // sees the wording that already exists in all five dictionaries, and no
      // new i18n key is introduced.
      //
      // Checked before the hold is recorded, for the same reason as the
      // bonus-product refusal above: a refused order must not leave a claim
      // behind for the catch to unwind.
      if (!isUsableDiscountValue(promo.discount_type, promo.discount_value)) {
        console.error(
          '[checkout] promo row is unusable, refusing as invalid_promo',
          { promoId: promo.id, discountType: promo.discount_type, discountValue: promo.discount_value },
        );
        return NextResponse.json({ error: 'invalid_promo' }, { status: 422 });
      }

      heldPromoId = promo.id;

      if (bonusMultiplier > 1) {
        // Price untouched on purpose: the customer pays the ordinary total
        // and the booster hands over more. discountUsd stays 0, so the
        // orders list will not claim a saving that never happened.
        deliveryMultiplier = bonusMultiplier;
      } else {
        // The very same function /api/checkout/preview calls, so the figure the
        // customer was shown while typing and the figure charged here cannot
        // drift apart. The ceiling, the invoice floor and the truthful
        // discount all live in that one module now.
        const priced = applyPromoDiscount(total, promo.discount_type, promo.discount_value);
        discountUsd = priced.discountUsd;
        total = priced.total;
      }
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
        // Share of what the customer actually pays. Payouts are settled off
        // the site, so this column is reference data — but it must never
        // exceed revenue, which it would if based on the pre-discount total.
        booster_payout_usd:
          breakdown.boosterPayout === 0 ? 0 : roundMoney(total * BOOSTER_PAYOUT_SHARE),
        pricing_version: breakdown.pricingVersion,
        promo_code: promoCode ?? null,
        discount_usd: discountUsd,
        delivery_multiplier: deliveryMultiplier,
        // Single free-text column (0001) — method is folded into the string
        // itself ("telegram: @handle") so notifyBoosters/the dashboard don't
        // need a second field to read.
        contact_handle: `${contactMethod}: ${contactHandle}`,
      })
      .select()
      .single();
    if (error) throw error;

    if (heldPromoId) {
      // Payment looks the code up by this link to burn it, so a failed write
      // means the discount was granted but the code quietly returns to the
      // pool an hour later. Recorded rather than swallowed.
      const { error: linkError } = await db
        .from('promo_codes')
        .update({ held_by_order_id: order.id })
        .eq('id', heldPromoId);
      if (linkError) {
        console.error('[checkout] promo held but order link failed', linkError);
        await db.from('order_events').insert({
          order_id: order.id,
          kind: 'promo_link_failed',
          detail: { promo_code: promoCode ?? null },
        });
      }
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
    if (heldPromoId) {
      // Order or invoice creation failed while the code was held — release it
      // now instead of making the customer wait out the hold.
      const { error: releaseError } = await db
        .from('promo_codes')
        .update({ held_until: null, held_by_order_id: null })
        .eq('id', heldPromoId)
        .is('used_at', null);
      if (releaseError) console.error('[checkout] promo hold release failed', releaseError);
    }
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
