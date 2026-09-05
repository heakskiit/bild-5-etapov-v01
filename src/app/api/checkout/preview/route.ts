/**
 * POST /api/checkout/preview
 *
 * Returns the subtotal, the discount a promo code would grant, and the
 * resulting total — without creating an order, an invoice, or a hold.
 * PROMO-6/8: the customer could previously only discover the effect of a
 * code by being redirected to a payment page, which is the worst possible
 * moment to find out it did nothing.
 *
 * WHY THIS IS A SERVER ROUTE AND NOT CLIENT MATH
 * The browser already computes the pre-discount price (BoostConfigurator
 * calls the same pure calculatePrice()), so it is tempting to also apply the
 * discount there. It must not: the discount depends on promo_codes rows the
 * browser cannot see, and a client-side figure would be trivially forgeable.
 * The real amount charged is still, as before, recomputed in /api/checkout
 * from IDs alone — this endpoint is strictly informational and grants nothing.
 *
 * WHY IT DOES NOT USE claim_promo_hold()
 * Taking a hold to render a number would mean that opening the modal and
 * typing four characters squats codes for an hour. peek_promo() (0008) asks
 * the same eligibility question read-only.
 */

import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { applyPromoDiscount, noPromoDiscount } from '@/lib/pricing/discount';
import { checkoutPreviewSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
	const user = await requireUser();
	if (!user) {
		return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
	}

	const parsed = checkoutPreviewSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: 'invalid_selection' }, { status: 400 });
	}
	const { selection, promoCode } = parsed.data;

	try {
		// Same engine, same config, same rounding as the real charge.
		const { total: subtotal } = calculatePrice(selection);

		// No code typed yet: still worth answering, so the modal can show the
		// honest total from the moment it opens.
		if (!promoCode) {
			return NextResponse.json({ ...noPromoDiscount(subtotal), promoApplied: false });
		}

		// A read-only preview is a promo-code oracle: unlike checkout, probing
		// here costs the attacker nothing. The counter is durable now (0009)
		// and shared between instances — the in-process map it replaces reset
		// on every cold start, so it bounded nothing.
		const verdict = await consumeRateLimit('checkoutPreview', user.id);
		if (!verdict.allowed) {
			// The price is still valid — only the code lookup was refused, so the
			// modal keeps showing a correct undiscounted total rather than blanking.
			return NextResponse.json(
				{ ...noPromoDiscount(subtotal), promoApplied: false, error: 'rate_limited' },
				{ status: 429 },
			);
		}

		const db = serviceClient();
		const { data: promo, error: promoError } = await db
			.rpc('peek_promo', { p_code: promoCode, p_user_id: user.id })
			.maybeSingle<{ discount_type: 'percent' | 'fixed_usd'; discount_value: number }>();
		if (promoError) throw promoError;

		if (!promo) {
			// 200, not 4xx: the selection and its price are perfectly valid, it is
			// only the code that isn't. Unknown, spent, held, expired and
			// reserved-for-someone-else are answered identically, exactly as in
			// /api/checkout, so this cannot be used to distinguish them.
			return NextResponse.json({
				...noPromoDiscount(subtotal),
				promoApplied: false,
				error: 'invalid_promo',
			});
		}

		// applyPromoDiscount is the *same* function /api/checkout uses, so the
		// figure shown here and the figure charged cannot drift apart.
		return NextResponse.json({
			...applyPromoDiscount(subtotal, promo.discount_type, promo.discount_value),
			promoApplied: true,
		});
	} catch (err) {
		if (err instanceof PricingError) {
			return NextResponse.json({ error: err.code }, { status: 422 });
		}
		console.error('[checkout/preview]', err);
		return NextResponse.json({ error: 'internal' }, { status: 500 });
	}
}
