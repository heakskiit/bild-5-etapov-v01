/**
 * SERVER-SIDE PRICE ENGINE (Batch F2).
 *
 * calculatePrice is the only place a payable amount is born, and until now it
 * had no tests at all. The cases below pin three separate things: the
 * marginal tier walk (money that a rounding slip would quietly change), the
 * refusals (every way a hand-crafted POST can ask for a price that must not
 * exist), and the order of operations inside a breakdown (percent add-ons on
 * base, delivery on the subtotal) — the part most likely to drift during a
 * refactor because every intermediate number still looks plausible.
 *
 * Expected values are written out literally rather than recomputed from the
 * config: a test that repeats the implementation's formula passes even when
 * both are wrong.
 */

import { describe, expect, it } from 'vitest';

import {
	BOOSTER_PAYOUT_SHARE,
	LEVELING_PC,
	MONEY_PC,
	PRICING_VERSION,
} from '@/../config/pricing.config';
import { calculatePrice, PricingError, tieredPrice } from '@/lib/pricing/calculate';
import type { OrderSelection } from '@/types/order';

/** Leveling selection with sane defaults; override what the case is about. */
const leveling = (over: Partial<OrderSelection> = {}): OrderSelection => ({
	product: 'leveling',
	platform: 'pc',
	level: 100,
	addonIds: [],
	delivery: 'normal',
	...over,
});

const moneyBoost = (over: Partial<OrderSelection> = {}): OrderSelection => ({
	product: 'money',
	platform: 'pc',
	amountMillions: 100,
	gameVersion: 'legacy',
	launcher: 'steam',
	addonIds: [],
	delivery: 'normal',
	...over,
});

/** Asserts the throw is ours and carries the expected machine-readable code. */
function expectPricingError(run: () => unknown, code: string) {
	expect(run).toThrow(PricingError);
	try {
		run();
	} catch (err) {
		expect((err as PricingError).code).toBe(code);
	}
}

describe('tieredPrice', () => {
	it('charges each portion at its own tier rate, not the top tier for everything', () => {
		// 100 levels at $0.05 = $5. The next 400 cost $0.03 each, so 500
		// levels is 5 + 12, never 500 x 0.03 nor 500 x 0.05.
		expect(tieredPrice(100, LEVELING_PC.tiers)).toBeCloseTo(5, 10);
		expect(tieredPrice(500, LEVELING_PC.tiers)).toBeCloseTo(17, 10);
		expect(tieredPrice(1000, LEVELING_PC.tiers)).toBeCloseTo(26, 10);
		expect(tieredPrice(3000, LEVELING_PC.tiers)).toBeCloseTo(48, 10);
		expect(tieredPrice(8000, LEVELING_PC.tiers)).toBeCloseTo(83, 10);
	});

	it('walks the money tiers the same way', () => {
		expect(tieredPrice(100, MONEY_PC.tiers)).toBeCloseTo(9, 10);
		expect(tieredPrice(500, MONEY_PC.tiers)).toBeCloseTo(45, 10);
		expect(tieredPrice(1000, MONEY_PC.tiers)).toBeCloseTo(80, 10);
		expect(tieredPrice(2000, MONEY_PC.tiers)).toBeCloseTo(135, 10);
		expect(tieredPrice(3500, MONEY_PC.tiers)).toBeCloseTo(198, 10);
		expect(tieredPrice(5000, MONEY_PC.tiers)).toBeCloseTo(247.5, 10);
	});

	it('prices nothing as nothing', () => {
		expect(tieredPrice(0, LEVELING_PC.tiers)).toBe(0);
	});

	it('refuses a value above the last bound instead of giving it away free', () => {
		// The dangerous failure mode is silence: units past the final tier
		// would otherwise simply not be charged.
		expectPricingError(() => tieredPrice(8001, LEVELING_PC.tiers), 'OUT_OF_RANGE');
	});

	it('keeps the average rate falling as the slider grows (the advertised discount)', () => {
		let previousAverage = Infinity;
		for (let millions = 500; millions <= MONEY_PC.maxMillions; millions += 500) {
			const average = tieredPrice(millions, MONEY_PC.tiers) / millions;
			expect(average).toBeLessThan(previousAverage);
			previousAverage = average;
		}
	});
});

describe('calculatePrice: shark cards', () => {
	it('charges the card denomination and nothing else', () => {
		const price = calculatePrice({ product: 'shark_card', platform: 'pc', variantId: 'sc_100k' });
		expect(price.base).toBe(2.49);
		expect(price.total).toBe(2.49);
		expect(price.pricingVersion).toBe(PRICING_VERSION);
	});

	it('pays no booster for a card: it is stock, not labour', () => {
		const price = calculatePrice({ product: 'shark_card', platform: 'pc', variantId: 'sc_10m' });
		expect(price.total).toBe(59.99);
		expect(price.boosterPayout).toBe(0);
	});

	it('ignores add-ons and express delivery smuggled in with a card order', () => {
		// A card is a code out of stock: there is nothing to speed up and no
		// add-on catalogue, so these fields must not move the price (and the
		// unknown add-on id must not even be validated).
		const price = calculatePrice({
			product: 'shark_card',
			platform: 'pc',
			variantId: 'sc_100k',
			addonIds: ['pc_lvl_unlock_all'],
			delivery: 'super_express',
		});
		expect(price.deliveryFee).toBe(0);
		expect(price.addonsFlat).toBe(0);
		expect(price.total).toBe(2.49);
	});

	it('rejects a denomination that is not in the catalogue', () => {
		expectPricingError(
			() => calculatePrice({ product: 'shark_card', platform: 'pc', variantId: 'sc_nope' }),
			'UNKNOWN_VARIANT',
		);
	});
});

describe('calculatePrice: leveling', () => {
	it('adds the flat base fee on top of the tier walk', () => {
		// $1.50 base + $5.00 of levels.
		expect(calculatePrice(leveling({ level: 100 })).total).toBe(6.5);
		expect(calculatePrice(leveling({ level: 8000 })).total).toBe(84.5);
	});

	it('pays the booster half of the service total', () => {
		const price = calculatePrice(leveling({ level: 100 }));
		expect(price.boosterPayout).toBe(3.25);
		expect(price.boosterPayout).toBeCloseTo(price.total * BOOSTER_PAYOUT_SHARE, 2);
	});

	it('rejects a fractional level: no booster can deliver level 100.5', () => {
		// The number field next to the slider accepts hand-typed input, and
		// /api/checkout can be posted to directly — the range check alone used
		// to let this through and price it.
		expectPricingError(() => calculatePrice(leveling({ level: 100.5 })), 'OUT_OF_RANGE');
	});

	it('rejects levels outside 1..8000', () => {
		expectPricingError(() => calculatePrice(leveling({ level: 0 })), 'OUT_OF_RANGE');
		expectPricingError(() => calculatePrice(leveling({ level: 8001 })), 'OUT_OF_RANGE');
	});

	it('uses the fixed console table instead of the slider maths', () => {
		expect(calculatePrice(leveling({ platform: 'ps', level: 100 })).total).toBe(11.99);
		expect(calculatePrice(leveling({ platform: 'xbox', level: 300 })).total).toBe(34.99);
	});

	it('rejects a console level that is not one of the dropdown options', () => {
		expectPricingError(
			() => calculatePrice(leveling({ platform: 'ps', level: 110 })),
			'UNKNOWN_VARIANT',
		);
	});

	it('refuses an add-on from the other platform catalogue', () => {
		// PC and console sell different add-ons; accepting the wrong id would
		// invoice for work the booster never agreed to.
		expectPricingError(
			() => calculatePrice(leveling({ addonIds: ['con_lvl_crew'] })),
			'UNKNOWN_ADDON',
		);
		expectPricingError(
			() => calculatePrice(leveling({ platform: 'ps', level: 100, addonIds: ['pc_lvl_stealth'] })),
			'UNKNOWN_ADDON',
		);
	});
});

describe('calculatePrice: money boost', () => {
	it('prices the PC slider straight off the tier walk', () => {
		expect(calculatePrice(moneyBoost({ amountMillions: 100 })).total).toBe(9);
		expect(calculatePrice(moneyBoost({ amountMillions: 5000 })).total).toBe(247.5);
	});

	it('applies the enhanced-edition multiplier', () => {
		// $9.00 x 1.15.
		expect(calculatePrice(moneyBoost({ gameVersion: 'enhanced' })).total).toBe(10.35);
	});

	it('treats every launcher the same today, but reads the value from config', () => {
		for (const launcher of ['steam', 'epic', 'rockstar'] as const) {
			expect(calculatePrice(moneyBoost({ launcher })).total).toBe(9);
		}
	});

	it('rejects amounts outside the slider range', () => {
		expectPricingError(() => calculatePrice(moneyBoost({ amountMillions: 50 })), 'OUT_OF_RANGE');
		expectPricingError(() => calculatePrice(moneyBoost({ amountMillions: 5050 })), 'OUT_OF_RANGE');
	});

	it('rejects amounts off the 50m step grid, fractional ones included', () => {
		expectPricingError(() => calculatePrice(moneyBoost({ amountMillions: 125 })), 'OUT_OF_RANGE');
		expectPricingError(() => calculatePrice(moneyBoost({ amountMillions: 150.5 })), 'OUT_OF_RANGE');
	});

	it('rejects a version or launcher it does not know', () => {
		expectPricingError(
			() => calculatePrice(moneyBoost({ launcher: 'gog' as never })),
			'UNKNOWN_VARIANT',
		);
		expectPricingError(
			() => calculatePrice(moneyBoost({ gameVersion: 'remastered' as never })),
			'UNKNOWN_VARIANT',
		);
	});

	it('uses the fixed console amounts and refuses anything else', () => {
		expect(calculatePrice(moneyBoost({ platform: 'ps', amountMillions: 20 })).total).toBe(8.49);
		expectPricingError(
			() => calculatePrice(moneyBoost({ platform: 'ps', amountMillions: 30 })),
			'UNKNOWN_VARIANT',
		);
	});
});

describe('calculatePrice: add-ons and delivery', () => {
	it('takes percent add-ons off the base, not off base plus flat add-ons', () => {
		// This is the order-of-operations test. base 6.50, flat 4.99,
		// percent 10% => 0.65 (10% of base), NOT 1.15 (10% of 11.49).
		const price = calculatePrice(
			leveling({ addonIds: ['pc_lvl_unlock_all', 'pc_lvl_stealth'], delivery: 'express' }),
		);
		expect(price.base).toBe(6.5);
		expect(price.addonsFlat).toBe(4.99);
		expect(price.addonsPercent).toBe(0.65);
		// Delivery, in contrast, is charged on the whole subtotal: 30% of 12.14.
		expect(price.deliveryFee).toBe(3.64);
		expect(price.total).toBe(15.78);
	});

	it('lets the "together" add-on reduce the price', () => {
		// The only negative add-on in the catalogue: -15% of base.
		const price = calculatePrice(leveling({ addonIds: ['pc_lvl_together'] }));
		expect(price.addonsPercent).toBeLessThan(0);
		expect(price.total).toBe(5.53);
		expect(price.total).toBeLessThan(calculatePrice(leveling()).total);
	});

	it('sums several percent add-ons before applying them', () => {
		// stealth 10% + priority 12% = 22% of 6.50.
		const price = calculatePrice(leveling({ addonIds: ['pc_lvl_stealth', 'pc_lvl_priority'] }));
		expect(price.addonsPercent).toBe(1.43);
		expect(price.total).toBe(7.93);
	});

	it('charges the delivery modifier on the configurator subtotal', () => {
		expect(calculatePrice(leveling({ delivery: 'normal' })).deliveryFee).toBe(0);
		expect(calculatePrice(leveling({ delivery: 'express' })).deliveryFee).toBe(1.95);
		expect(calculatePrice(leveling({ delivery: 'super_express' })).total).toBe(10.4);
	});

	it('defaults to normal delivery when the field is absent', () => {
		expect(calculatePrice(leveling({ delivery: undefined })).total).toBe(6.5);
	});

	it('rejects a delivery speed that is not in the config', () => {
		expectPricingError(
			() => calculatePrice(leveling({ delivery: 'turbo' as never })),
			'UNKNOWN_DELIVERY',
		);
	});

	it('rejects a product it does not sell', () => {
		expectPricingError(
			() => calculatePrice({ product: 'mods' as never, platform: 'pc' }),
			'UNKNOWN_PRODUCT',
		);
	});

	it('reports every money field rounded to cents', () => {
		// An unrounded cent reaching the invoice is a CryptoBot mismatch, so
		// every field in the breakdown, not just the total, is checked.
		const price = calculatePrice(
			leveling({ level: 777, addonIds: ['pc_lvl_stealth'], delivery: 'express' }),
		);
		for (const value of [
			price.base,
			price.addonsFlat,
			price.addonsPercent,
			price.deliveryFee,
			price.total,
			price.boosterPayout,
		]) {
			expect(value).toBe(Math.round(value * 100) / 100);
		}
	});

	it('stamps the pricing version onto every breakdown', () => {
		// The stamp is what lets a paid order be re-checked against the rates
		// that were live when it was placed.
		expect(calculatePrice(leveling()).pricingVersion).toBe(PRICING_VERSION);
		expect(calculatePrice(moneyBoost()).pricingVersion).toBe(PRICING_VERSION);
	});
});
