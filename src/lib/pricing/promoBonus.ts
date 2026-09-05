/**
 * X2 BONUS MATH (PROMO-10) -- the single place the delivery multiplier is
 * derived, mirroring what discount.ts does for money.
 *
 * A bonus code is not a discount. The customer pays the ordinary price and
 * the booster hands over more goods, so nothing here touches a total. The
 * multiplier is carried in the promo row's discount_value column (2 for X2),
 * which is why a future X3 needs code changes nowhere but the admin form.
 *
 * Pure and server/client safe: every screen that shows "how much are we
 * delivering" runs the same two functions, because the failure mode we are
 * guarding against is one screen disagreeing with another about the same
 * order.
 */

import type { ProductKind } from '@/types/order';

export const BONUS_X2 = 'bonus_x2';

/** What an X2 row stores in discount_value. Named so the admin route and
 *  the database constraint cannot disagree about it. */
export const X2_MULTIPLIER = 2;

/** Ceiling mirrors the delivery_multiplier_sane check in migration 0013. */
const MAX_MULTIPLIER = 10;

export type BonusEligibility =
	| { eligible: true }
	| { eligible: false; reason: 'wrong_product' };

export function isBonusPromo(discountType: string | null | undefined): boolean {
	return discountType === BONUS_X2;
}

/**
 * The multiplier a code grants, or 1 for every ordinary code.
 *
 * numeric arrives from PostgREST as a string, and a malformed row must never
 * turn into NaN on an invoice screen -- anything unusable degrades to 1,
 * i.e. "deliver exactly what was ordered".
 */
export function bonusMultiplierFor(
	discountType: string | null | undefined,
	discountValue: number | string | null | undefined,
): number {
	if (!isBonusPromo(discountType)) return 1;
	const parsed = Number(discountValue);
	if (!Number.isFinite(parsed) || parsed < 1) return 1;
	return Math.min(parsed, MAX_MULTIPLIER);
}

/**
 * X2 is money-only, by decision: doubling a levelling job or a cash card has
 * no defined meaning, and silently accepting the code would leave the
 * customer believing they got something.
 */
export function checkBonusProduct(product: ProductKind | undefined): BonusEligibility {
	if (product === 'money') return { eligible: true };
	return { eligible: false, reason: 'wrong_product' };
}

/**
 * What the booster actually owes. Returns null when the order carries no
 * amount, so callers can fall back to their own placeholder rather than
 * printing "NaNm" into a Discord embed.
 */
export function deliveredMillions(
	amountMillions: number | null | undefined,
	multiplier: number | string | null | undefined,
): number | null {
	if (amountMillions == null) return null;
	const base = Number(amountMillions);
	if (!Number.isFinite(base)) return null;
	const factor = Number(multiplier);
	if (!Number.isFinite(factor) || factor < 1) return base;
	return base * Math.min(factor, MAX_MULTIPLIER);
}
