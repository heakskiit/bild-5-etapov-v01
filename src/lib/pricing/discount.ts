/**
 * PROMO DISCOUNT MATH — the single place a discount amount is produced.
 *
 * Extracted in this batch so that /api/checkout (which actually charges) and
 * /api/checkout/preview (which only renders a number) can never drift apart.
 * A preview that disagrees with the invoice is worse than no preview at all,
 * so the rule is: both routes call this, neither reimplements it.
 *
 * Still server-only in practice — the browser is told the result, never
 * trusted to compute it. `calculatePrice()` remains the source of the
 * pre-discount subtotal; this module only takes it down.
 */

import {
	MAX_DISCOUNT_SHARE,
	MIN_INVOICE_USD,
	roundMoney,
} from '@/../config/pricing.config';

export type PromoDiscountType = 'percent' | 'fixed_usd' | 'bonus_x2';

export interface DiscountedTotal {
	/** Price before any code, straight from calculatePrice(). */
	subtotal: number;
	/** What the customer actually saves — the real difference, not the code's face value. */
	discountUsd: number;
	/** What will be charged. */
	total: number;
}

/**
 * Applies a promo code to a subtotal, honouring the 20% ceiling and the
 * minimum invoice amount.
 *
 * `discountValue` arrives from Postgres `numeric`, which the driver may hand
 * over as a string — hence the explicit Number() coercions. Without them
 * `subtotal - granted` would silently become string concatenation.
 */
export function applyPromoDiscount(
	subtotal: number,
	discountType: PromoDiscountType,
	discountValue: number,
): DiscountedTotal {
	// A bonus code buys goods, not money: it must leave the price completely
	// alone. This branch exists because the fallback below reads any
	// non-percent type as a fixed dollar amount, which would quietly turn the
	// multiplier 2 into a $2 discount.
	if (discountType === 'bonus_x2') return noPromoDiscount(subtotal);

	// Face value the code asks for...
	const requested =
		discountType === 'percent'
			? subtotal * (Number(discountValue) / 100)
			: Number(discountValue);

	// ...capped by the business ceiling. Enforced here as well as in the schema
	// because a fixed_usd code would otherwise slip past it on a cheap order:
	// a $999 code against an $80 order is only ever worth $16.
	const granted = Math.min(requested, subtotal * MAX_DISCOUNT_SHARE);

	const total = roundMoney(Math.max(MIN_INVOICE_USD, subtotal - granted));

	// Report what was actually given, not what was asked for: the floor can
	// absorb part of it, and total + discount has to reconcile to the subtotal.
	return { subtotal, discountUsd: roundMoney(subtotal - total), total };
}

/** The no-code case, shaped identically so callers need no branching. */
export function noPromoDiscount(subtotal: number): DiscountedTotal {
	return { subtotal, discountUsd: 0, total: subtotal };
}