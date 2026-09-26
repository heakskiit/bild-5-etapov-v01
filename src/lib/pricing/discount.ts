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
 * Raised when a figure that decides money is not a usable number.
 *
 * Two distinct causes share one class because both mean the same thing to a
 * caller: stop, do not invoice. `code` says which one, so a route can answer
 * "invalid code" for a broken promo row and fail loudly for a broken price.
 */
export class PriceValueError extends Error {
	readonly code: 'invalid_subtotal' | 'invalid_promo_value';

	constructor(code: 'invalid_subtotal' | 'invalid_promo_value', message: string) {
		super(message);
		this.name = 'PriceValueError';
		this.code = code;
	}
}

/**
 * A subtotal has to be a real, non-negative amount before anything is done to
 * it. NaN is the dangerous one: it survives every arithmetic step below and
 * then loses to MIN_INVOICE_USD inside Math.max(), so an $80 order would be
 * invoiced at $0.50 rather than failing. Money is never guessed — a broken
 * price is a defect in calculatePrice(), not something to paper over.
 */
function assertUsableSubtotal(subtotal: number): void {
	if (!Number.isFinite(subtotal) || subtotal < 0) {
		throw new PriceValueError(
			'invalid_subtotal',
			`subtotal is not a usable amount: ${String(subtotal)}`,
		);
	}
}

/**
 * Whether a promo row can safely be turned into money.
 *
 * Exported so the routes can refuse a broken code the same way they refuse an
 * unknown one — with the existing "invalid_promo" answer, before a hold is
 * taken — instead of discovering the problem through a thrown error halfway
 * through checkout.
 *
 * `discount_value` arrives from Postgres `numeric`, which the driver hands
 * over as a string, so '20' is valid and must stay valid. What is not valid:
 * null, '', 'abc' (all NaN once coerced), Infinity, and negative values —
 * a negative discount is an *upcharge*, which would quietly invoice the
 * customer above the price they were shown.
 *
 * Bonus codes never touch the price, so their value is a multiplier that
 * promoBonus.ts validates; it is not this module's business.
 */
export function isUsableDiscountValue(
	discountType: PromoDiscountType,
	discountValue: number,
): boolean {
	if (discountType === 'bonus_x2') return true;

	// Number() alone is not a validator, and this is the trap the guard exists
	// to close: Number(null) and Number('') are both 0, i.e. "finite and
	// non-negative". An empty column would sail through as a 0% code and be
	// silently treated as a working discount. Emptiness is rejected by shape
	// first, and only then is the value coerced.
	const raw: unknown = discountValue;
	if (raw === null || raw === undefined) return false;
	if (typeof raw === 'string' && raw.trim() === '') return false;
	if (typeof raw !== 'number' && typeof raw !== 'string') return false;

	const numeric = Number(raw);
	return Number.isFinite(numeric) && numeric >= 0;
}

/**
 * Applies a promo code to a subtotal, honouring the 20% ceiling and the
 * minimum invoice amount.
 *
 * `discountValue` arrives from Postgres `numeric`, which the driver may hand
 * over as a string — hence the explicit Number() coercions. Without them
 * `subtotal - granted` would silently become string concatenation.
 *
 * Throws PriceValueError rather than returning a number it cannot stand
 * behind. Both routes screen their inputs with isUsableDiscountValue() first,
 * so in practice this is the backstop that guarantees no NaN can ever reach
 * an invoice, whatever a future caller forgets.
 */
export function applyPromoDiscount(
	subtotal: number,
	discountType: PromoDiscountType,
	discountValue: number,
): DiscountedTotal {
	assertUsableSubtotal(subtotal);

	// A bonus code buys goods, not money: it must leave the price completely
	// alone. This branch exists because the fallback below reads any
	// non-percent type as a fixed dollar amount, which would quietly turn the
	// multiplier 2 into a $2 discount.
	if (discountType === 'bonus_x2') return noPromoDiscount(subtotal);

	if (!isUsableDiscountValue(discountType, discountValue)) {
		throw new PriceValueError(
			'invalid_promo_value',
			`discount_value is not a usable amount for a ${discountType} code: ${String(discountValue)}`,
		);
	}

	// Face value the code asks for...
	const requested =
		discountType === 'percent'
			? subtotal * (Number(discountValue) / 100)
			: Number(discountValue);

	// ...capped by the business ceiling. Enforced here as well as in the schema
	// because a fixed_usd code would otherwise slip past it on a cheap order:
	// a $999 code against an $80 order is only ever worth $16.
	//
	// The lower clamp costs nothing and closes the upcharge case for good:
	// even if a negative value ever reaches this line, the worst it can do is
	// grant zero.
	const granted = Math.max(0, Math.min(requested, subtotal * MAX_DISCOUNT_SHARE));

	const total = roundMoney(Math.max(MIN_INVOICE_USD, subtotal - granted));

	// Report what was actually given, not what was asked for: the floor can
	// absorb part of it, and total + discount has to reconcile to the subtotal.
	return { subtotal, discountUsd: roundMoney(subtotal - total), total };
}

/** The no-code case, shaped identically so callers need no branching. */
export function noPromoDiscount(subtotal: number): DiscountedTotal {
	// Guarded too: the preview answers with this shape in six places, so an
	// unusable price would otherwise reach the payment modal through the one
	// path that does no arithmetic at all.
	assertUsableSubtotal(subtotal);

	return { subtotal, discountUsd: 0, total: subtotal };
}
