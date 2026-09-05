/**
 * MINIMUM-ORDER RULE (Batch D).
 *
 * The threshold is a boundary rule, and boundary rules fail at the boundary:
 * a $30 order against a "from $30" code has to pass, or the customer is
 * refused a code the marketing copy just promised them. Floats make that
 * comparison less obvious than it looks, hence the epsilon and these cases.
 */

import { describe, expect, it } from 'vitest';

import { checkPromoMinOrder } from '@/lib/pricing/promoEligibility';

describe('checkPromoMinOrder', () => {
	it('accepts an order exactly on the threshold', () => {
		expect(checkPromoMinOrder(30, 30)).toEqual({ eligible: true });
	});

	it('accepts a float that only looks short of the threshold', () => {
		// 0.1 + 0.2 is 0.30000000000000004; the epsilon exists so that the
		// mirror case, a subtotal a hair under, is not refused either.
		expect(checkPromoMinOrder(0.1 + 0.2, 0.3)).toEqual({ eligible: true });
		expect(checkPromoMinOrder(29.999999999, 30)).toEqual({ eligible: true });
	});

	it('refuses an order below the threshold and reports it back', () => {
		// The reason and the number both matter: the UI prints "from $30.00",
		// so the rule has to hand the figure over rather than just say no.
		expect(checkPromoMinOrder(29.99, 30)).toEqual({
			eligible: false,
			reason: 'min_order',
			minOrderUsd: 30,
		});
	});

	it('accepts the numeric string PostgREST returns and rounds it for display', () => {
		expect(checkPromoMinOrder(5, '30.129')).toEqual({
			eligible: false,
			reason: 'min_order',
			minOrderUsd: 30.13,
		});
	});

	it('treats a missing threshold as no threshold', () => {
		// Every code issued before migration 0011 has no minimum, and failing
		// open is safe here because the 20% ceiling still bounds the discount.
		for (const threshold of [null, undefined, 0, -5, 'abc', '']) {
			expect(checkPromoMinOrder(10, threshold as never)).toEqual({ eligible: true });
		}
	});
});
