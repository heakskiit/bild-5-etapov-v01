/**
 * Minimum-order rule for promo codes (PROMO-7).
 *
 * Tiers like "10% from $10" and "20% from $30" need exactly one comparison,
 * in exactly one place. Both the preview endpoint and the checkout endpoint
 * call this, for the same reason they both call applyPromoDiscount(): the
 * figure a customer is shown and the rule applied when they pay must come
 * from the same code, or they will eventually disagree and the customer will
 * be the one who is right.
 *
 * Deliberately not enforced in Postgres. claim_promo_hold() and peek_promo()
 * are handed no order amount (0011) and stay a pure eligibility question --
 * they return the threshold instead of filtering on it. Both are revoked from
 * anon and authenticated and granted only to service_role, so the only
 * callers are these two server routes and the comparison cannot be skipped
 * by a crafted request.
 */

import { roundMoney } from '@/../config/pricing.config';

/**
 * Postgres numeric arrives over PostgREST as a string, so the threshold is
 * accepted in either shape and coerced exactly once, here -- the same reason
 * applyPromoDiscount() calls Number() on discount_value.
 */
export type PromoThreshold = number | string | null | undefined;

export type PromoEligibility =
	| { eligible: true }
	| { eligible: false; reason: 'min_order'; minOrderUsd: number };

/** Mirrors the webhook's underpaid check: a cent is a cent, floats are not. */
const EPSILON = 1e-9;

export function checkPromoMinOrder(
	subtotal: number,
	minOrderUsd: PromoThreshold,
): PromoEligibility {
	const threshold = Number(minOrderUsd ?? 0);

	// Missing, zero, negative or unparseable all mean "no threshold", which is
	// what every code issued before 0011 means. Failing open is safe here: the
	// 20% ceiling still bounds the discount either way.
	if (!Number.isFinite(threshold) || threshold <= 0) return { eligible: true };

	if (subtotal + EPSILON >= threshold) return { eligible: true };
	return { eligible: false, reason: 'min_order', minOrderUsd: roundMoney(threshold) };
}
