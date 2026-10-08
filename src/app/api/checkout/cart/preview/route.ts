/**
 * POST /api/checkout/cart/preview -- BATCH F12 (FEAT-CART-023).
 *
 * The cart twin of /api/checkout/preview: same answers, same response shape
 * (so the modal's readPromoPreview() needs no changes), but the subtotal is
 * the sum of every cart line and the promo rules are judged for the cart
 * exactly as /api/checkout/cart will judge them. Read-only: no hold, no order.
 */

import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { applyPromoDiscount, isUsableDiscountValue, noPromoDiscount } from '@/lib/pricing/discount';
import { checkPromoMinOrder } from '@/lib/pricing/promoEligibility';
import { bonusMultiplierFor, checkBonusProduct } from '@/lib/pricing/promoBonus';
import { cartPreviewSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit } from '@/lib/rateLimit';
import { sumMoney } from '@/lib/cart/cartCheckout';

export const runtime = 'nodejs';

export async function POST(request: Request) {
	const user = await requireUser();
	if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

	const parsed = cartPreviewSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: 'invalid_selection' }, { status: 400 });
	const { items, promoCode } = parsed.data;

	try {
		const subtotal = sumMoney(items.map((s) => calculatePrice(s).total));

		if (!promoCode) return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: false });

		const verdict = await consumeRateLimit('checkoutPreview', user.id);
		if (!verdict.allowed) {
			const retryAfterSeconds = verdict.retryAfterSeconds || 60;
			return NextResponse.json(
				{ ...noPromoDiscount(subtotal), promoApplied: false, error: 'rate_limited', retryAfterSeconds },
				{ status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
			);
		}

		const db = serviceClient();
		const { data: promo, error: promoError } = await db
			.rpc('peek_promo', { p_code: promoCode, p_user_id: user.id })
			.maybeSingle<{ discount_type: 'percent' | 'fixed_usd' | 'bonus_x2'; discount_value: number; min_order_usd: number | string }>();
		if (promoError) throw promoError;
		if (!promo) return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: false, error: 'invalid_promo' });

		const eligibility = checkPromoMinOrder(subtotal, promo.min_order_usd);
		if (!eligibility.eligible) {
			return NextResponse.json({
				...noPromoDiscount(subtotal),
				promoApplied: false,
				error: 'min_order',
				minOrderUsd: eligibility.minOrderUsd,
			});
		}

		const bonusMultiplier = bonusMultiplierFor(promo.discount_type, promo.discount_value);
		if (bonusMultiplier > 1) {
			if (!items.some((s) => checkBonusProduct(s.product).eligible)) {
				return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: false, error: 'wrong_product' });
			}
			return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: true, bonusMultiplier });
		}

		if (!isUsableDiscountValue(promo.discount_type, promo.discount_value)) {
			return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: false, error: 'invalid_promo' });
		}

		return NextResponse.json({
			...applyPromoDiscount(subtotal, promo.discount_type, promo.discount_value),
			promoApplied: true,
		});
	} catch (err) {
		if (err instanceof PricingError) return NextResponse.json({ error: err.code }, { status: 422 });
		console.error('[checkout/cart/preview]', err);
		return NextResponse.json({ error: 'internal' }, { status: 500 });
	}
}
