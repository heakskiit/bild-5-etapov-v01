/**
 * POST /api/checkout/cart -- BATCH F12 (FEAT-CART-023).
 *
 * Pays a whole cart with ONE CryptoBot invoice. Each item becomes an ordinary
 * order row (so the queue, jobs, auto-cancel and "My orders" need no changes);
 * the rows share `cart_id` and `invoice_id`, and the webhook settles them all.
 *
 * Same trust boundary as /api/checkout: the client sends selections only,
 * every price is recomputed here, and a promo code is applied to the cart
 * subtotal and then split across the orders to the cent.
 */

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { applyPromoDiscount, isUsableDiscountValue } from '@/lib/pricing/discount';
import { checkPromoMinOrder } from '@/lib/pricing/promoEligibility';
import { bonusMultiplierFor, checkBonusProduct } from '@/lib/pricing/promoBonus';
import { roundMoney, BOOSTER_PAYOUT_SHARE, PROMO_HOLD_MINUTES } from '@/../config/pricing.config';
import { cartCheckoutRequestSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { createInvoice } from '@/lib/pricing/cryptobot';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { canPlaceOrder, dayWindowStart, pendingWindowStart } from '@/lib/orders/orderLimits';
import { countPurchases, findShortSku, skuDemand, splitDiscount, sumMoney } from '@/lib/cart/cartCheckout';
import { sheetSkuForVariant } from '@/lib/keys/vault';
import { getSharkCardStock } from '@/lib/keys/googleSheets';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Shares the checkout bucket: a cart is one checkout, not ten.
  const verdict = await consumeRateLimit('checkout', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const parsed = cartCheckoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_selection', issues: parsed.error.issues }, { status: 400 });
  }
  const { items, contactMethod, contactHandle, details, promoCode, locale } = parsed.data;

  const db = serviceClient();

  // --- limits: a cart counts as ONE purchase -----------------------------
  const [pendingRead, dailyRead] = await Promise.all([
    db
      .from('orders')
      .select('id, cart_id')
      .eq('user_id', user.id)
      .eq('status', 'awaiting_payment')
      .gte('created_at', pendingWindowStart()),
    db.from('orders').select('id, cart_id').eq('user_id', user.id).gte('created_at', dayWindowStart()),
  ]);
  if (pendingRead.error || dailyRead.error) {
    console.error('[checkout/cart] order limit reads failed, allowing request', pendingRead.error ?? dailyRead.error);
  }
  const volume = canPlaceOrder({
    pendingCount: pendingRead.error ? null : countPurchases(pendingRead.data ?? []),
    dailyCount: dailyRead.error ? null : countPurchases(dailyRead.data ?? []),
  });
  if (!volume.allowed) {
    console.warn(`[checkout/cart] refused for ${user.id}: ${volume.reason} (limit ${volume.limit})`);
    return NextResponse.json({ error: volume.reason, limit: volume.limit }, { status: 429 });
  }

  let heldPromoId: number | null = null;
  let cartId: string | null = null;

  try {
    const breakdowns = items.map((selection) => calculatePrice(selection));
    const lineTotals = breakdowns.map((b) => b.total);
    const subtotal = sumMoney(lineTotals);

    // --- warehouse: three 100K cards need three free codes -----------------
    const skus = items.map((s) => (s.product === 'shark_card' ? sheetSkuForVariant(s.variantId) : null));
    const demand = skuDemand(skus);
    if (Object.keys(demand).length > 0) {
      const stock = await getSharkCardStock(Object.keys(demand));
      const shortSku = findShortSku(demand, stock);
      if (shortSku) {
        return NextResponse.json(
          { error: 'out_of_stock', sku: shortSku, available: stock?.[shortSku] ?? 0 },
          { status: 409 },
        );
      }
    }

    // --- promo: applied to the whole cart ----------------------------------
    let lineDiscounts = items.map(() => 0);
    let bonusMultiplier = 1;

    if (promoCode) {
      const { data: promo, error: promoError } = await db
        .rpc('claim_promo_hold', { p_code: promoCode, p_user_id: user.id, p_hold_minutes: PROMO_HOLD_MINUTES })
        .maybeSingle<{ id: number; discount_type: 'percent' | 'fixed_usd' | 'bonus_x2'; discount_value: number; min_order_usd: number | string }>();
      if (promoError) throw promoError;
      if (!promo) return NextResponse.json({ error: 'invalid_promo' }, { status: 422 });

      const eligibility = checkPromoMinOrder(subtotal, promo.min_order_usd);
      if (!eligibility.eligible) {
        return NextResponse.json({ error: 'min_order', minOrderUsd: eligibility.minOrderUsd }, { status: 422 });
      }

      const multiplier = bonusMultiplierFor(promo.discount_type, promo.discount_value);
      if (multiplier > 1 && !items.some((s) => checkBonusProduct(s.product).eligible)) {
        return NextResponse.json({ error: 'wrong_product' }, { status: 422 });
      }

      if (!isUsableDiscountValue(promo.discount_type, promo.discount_value)) {
        console.error('[checkout/cart] promo row is unusable, refusing as invalid_promo', { promoId: promo.id });
        return NextResponse.json({ error: 'invalid_promo' }, { status: 422 });
      }

      heldPromoId = promo.id;
      if (multiplier > 1) {
        // Goods, not money: only the money lines get the multiplier.
        bonusMultiplier = multiplier;
      } else {
        const priced = applyPromoDiscount(subtotal, promo.discount_type, promo.discount_value);
        lineDiscounts = splitDiscount(lineTotals, priced.discountUsd);
      }
    }

    // --- orders: one insert, so the cart is created all-or-nothing --------
    cartId = randomUUID();
    const rows = items.map((selection, i) => {
      const total = roundMoney(lineTotals[i] - lineDiscounts[i]);
      return {
        user_id: user.id,
        status: 'awaiting_payment',
        cart_id: cartId,
        selection: { ...selection, orderNotes: details },
        total_usd: total,
        booster_payout_usd: breakdowns[i].boosterPayout === 0 ? 0 : roundMoney(total * BOOSTER_PAYOUT_SHARE),
        pricing_version: breakdowns[i].pricingVersion,
        promo_code: promoCode ?? null,
        discount_usd: lineDiscounts[i],
        delivery_multiplier: bonusMultiplier > 1 && checkBonusProduct(selection.product).eligible ? bonusMultiplier : 1,
        contact_handle: `${contactMethod}: ${contactHandle}`,
      };
    });

    const { data: orders, error: insertError } = await db
      .from('orders')
      .insert(rows)
      .select('id, public_id, total_usd');
    if (insertError) throw insertError;
    if (!orders || orders.length !== items.length) throw new Error('cart insert returned an unexpected row count');

    if (heldPromoId) {
      const { error: linkError } = await db
        .from('promo_codes')
        .update({ held_by_order_id: orders[0].id })
        .eq('id', heldPromoId);
      if (linkError) {
        console.error('[checkout/cart] promo held but order link failed', linkError);
        await db.from('order_events').insert({
          order_id: orders[0].id,
          kind: 'promo_link_failed',
          detail: { promo_code: promoCode ?? null, cart_id: cartId },
        });
      }
    }

    const amount = sumMoney(orders.map((o) => o.total_usd));
    const invoice = await createInvoice({
      amount,
      description: `Cart: ${orders.length} items (${orders.map((o) => o.public_id).join(', ')})`.slice(0, 1024),
      payload: `cart:${cartId}`,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale ?? items[0].locale ?? 'en'}/dashboard/orders`,
    });

    const { error: invoiceLinkError } = await db
      .from('orders')
      .update({ invoice_id: invoice.invoice_id })
      .eq('cart_id', cartId);
    if (invoiceLinkError) throw invoiceLinkError;

    return NextResponse.json({ payUrl: invoice.pay_url, cartId, orderIds: orders.map((o) => o.public_id) });
  } catch (err) {
    if (heldPromoId) {
      const { error: releaseError } = await db
        .from('promo_codes')
        .update({ held_until: null, held_by_order_id: null })
        .eq('id', heldPromoId)
        .is('used_at', null);
      if (releaseError) console.error('[checkout/cart] promo hold release failed', releaseError);
    }
    if (cartId) {
      // No invoice means nothing can ever pay these rows: close them now
      // instead of letting them count against the pending limit for 2 hours.
      const { error: cancelError } = await db
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('cart_id', cartId)
        .is('invoice_id', null)
        .eq('status', 'awaiting_payment');
      if (cancelError) console.error('[checkout/cart] could not cancel orphaned cart orders', cancelError);
    }
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    console.error('[checkout/cart]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
