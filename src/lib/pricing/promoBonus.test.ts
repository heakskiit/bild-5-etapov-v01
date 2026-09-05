/**
 * X2 BONUS MATH (Batch D).
 *
 * The failure mode being guarded against is not a wrong price -- a bonus code
 * cannot move a price -- but a wrong quantity: the booster reading one figure
 * while the customer reads another. Every case below is therefore about
 * degrading to "deliver exactly what was ordered" instead of producing NaN,
 * an empty line, or an unbounded multiplier.
 */

import { describe, expect, it } from 'vitest';

import {
	BONUS_X2,
	X2_MULTIPLIER,
	bonusMultiplierFor,
	checkBonusProduct,
	deliveredMillions,
	isBonusPromo,
} from '@/lib/pricing/promoBonus';

describe('isBonusPromo', () => {
	it('recognises the enum value the database stores', () => {
		expect(isBonusPromo(BONUS_X2)).toBe(true);
		expect(BONUS_X2).toBe('bonus_x2');
	});

	it('says no to every ordinary code and to nothing at all', () => {
		expect(isBonusPromo('percent')).toBe(false);
		expect(isBonusPromo('fixed_usd')).toBe(false);
		expect(isBonusPromo(null)).toBe(false);
		expect(isBonusPromo(undefined)).toBe(false);
		expect(isBonusPromo('')).toBe(false);
		// Postgres enum labels are lower case; a mixed-case string is a bug
		// elsewhere and must not be treated as a bonus code.
		expect(isBonusPromo('BONUS_X2')).toBe(false);
	});
});

describe('bonusMultiplierFor', () => {
	it('grants the stored multiplier', () => {
		expect(bonusMultiplierFor(BONUS_X2, X2_MULTIPLIER)).toBe(2);
		expect(X2_MULTIPLIER).toBe(2);
	});

	it('accepts the numeric string PostgREST returns', () => {
		expect(bonusMultiplierFor(BONUS_X2, '2')).toBe(2);
	});

	it('leaves ordinary codes at 1', () => {
		// Critical: a 20% code must not be read as a 20x delivery.
		expect(bonusMultiplierFor('percent', 20)).toBe(1);
		expect(bonusMultiplierFor('fixed_usd', 5)).toBe(1);
		expect(bonusMultiplierFor(null, 2)).toBe(1);
		expect(bonusMultiplierFor(undefined, 2)).toBe(1);
	});

	it('degrades unusable values to 1 rather than to nothing', () => {
		for (const value of [0, -3, 0.5, Number.NaN, 'abc', '', null, undefined]) {
			expect(bonusMultiplierFor(BONUS_X2, value as never)).toBe(1);
		}
	});

	it('clamps at the ceiling the database also enforces', () => {
		// Mirrors delivery_multiplier_sane in migration 0013.
		expect(bonusMultiplierFor(BONUS_X2, 99)).toBe(10);
		expect(bonusMultiplierFor(BONUS_X2, Number.POSITIVE_INFINITY)).toBe(1);
	});
});

describe('checkBonusProduct', () => {
	it('allows money orders', () => {
		expect(checkBonusProduct('money')).toEqual({ eligible: true });
	});

	it('refuses everything else with a reason the UI can translate', () => {
		// Doubling a levelling job or a cash card has no defined meaning, and a
		// silent acceptance would leave the customer believing they got something.
		expect(checkBonusProduct('leveling')).toEqual({ eligible: false, reason: 'wrong_product' });
		expect(checkBonusProduct('shark_card')).toEqual({ eligible: false, reason: 'wrong_product' });
		expect(checkBonusProduct(undefined)).toEqual({ eligible: false, reason: 'wrong_product' });
	});
});

describe('deliveredMillions', () => {
	it('doubles what the booster owes', () => {
		expect(deliveredMillions(100, 2)).toBe(200);
		expect(deliveredMillions(100, '2')).toBe(200);
	});

	it('returns the ordered amount for an ordinary order', () => {
		expect(deliveredMillions(100, 1)).toBe(100);
	});

	it('returns null when the order carries no amount', () => {
		// Callers print their own placeholder; the alternative is "NaNm" in a
		// Discord embed a booster then has to interpret.
		expect(deliveredMillions(null, 2)).toBeNull();
		expect(deliveredMillions(undefined, 2)).toBeNull();
		expect(deliveredMillions(Number.NaN, 2)).toBeNull();
	});

	it('falls back to the ordered amount when the multiplier is unusable', () => {
		for (const factor of [null, undefined, 'abc', 0, -1, Number.NaN]) {
			expect(deliveredMillions(100, factor as never)).toBe(100);
		}
	});

	it('clamps an absurd multiplier instead of promising the impossible', () => {
		expect(deliveredMillions(100, 99)).toBe(1000);
	});

	it('never produces NaN, whatever it is handed', () => {
		const amounts = [0, 1, 100, null, undefined, Number.NaN, '100', '', 'abc'];
		const factors = [1, 2, '2', 0, -1, 99, null, undefined, Number.NaN, 'abc'];

		for (const amount of amounts) {
			for (const factor of factors) {
				const result = deliveredMillions(amount as never, factor as never);
				if (result !== null) expect(Number.isFinite(result)).toBe(true);
			}
		}
	});
});
