/**
 * "FROM $X" PRICES ON THE PRODUCT CARDS (Batch F2).
 *
 * The point of startingPrice is that the homepage never hardcodes money:
 * every card asks the real price engine for the cheapest realistic basket.
 * So the tests check both halves of that promise — the numbers shown today,
 * and the fact that they are genuinely produced by calculatePrice rather
 * than copied into the module as constants.
 */

import { describe, expect, it } from 'vitest';

import { MONEY_PC, SHARK_CARDS } from '@/../config/pricing.config';
import { calculatePrice } from '@/lib/pricing/calculate';
import { startingPrice } from '@/lib/pricing/startingPrice';
import type { ProductKind } from '@/types/order';

const ALL_KINDS: ProductKind[] = ['shark_card', 'leveling', 'money'];

describe('startingPrice', () => {
	it('quotes the cheapest card, the opening level, and the smallest money amount', () => {
		expect(startingPrice('shark_card')).toBe(2.49);
		expect(startingPrice('leveling')).toBe(6.5);
		expect(startingPrice('money')).toBe(9);
	});

	it('derives the card price from the catalogue, not from a literal', () => {
		expect(startingPrice('shark_card')).toBe(SHARK_CARDS[0].price);
	});

	it('matches calculatePrice for the same basket', () => {
		// If these ever diverge, the homepage is advertising a price the
		// configurator will not honour.
		expect(startingPrice('money')).toBe(
			calculatePrice({
				product: 'money',
				platform: 'pc',
				amountMillions: MONEY_PC.minMillions,
				gameVersion: 'legacy',
				launcher: 'steam',
				addonIds: [],
				delivery: 'normal',
			}).total,
		);
		expect(startingPrice('leveling')).toBe(
			calculatePrice({
				product: 'leveling',
				platform: 'pc',
				level: 100,
				addonIds: [],
				delivery: 'normal',
			}).total,
		);
	});

	it('never shows a free or nonsensical card price', () => {
		for (const kind of ALL_KINDS) {
			const price = startingPrice(kind);
			expect(Number.isFinite(price)).toBe(true);
			expect(price).toBeGreaterThan(0);
		}
	});

	it('quotes a starting basket every product can actually be ordered with', () => {
		// A "from" price built on an invalid selection would throw here rather
		// than silently advertise something the checkout refuses.
		for (const kind of ALL_KINDS) {
			expect(() => startingPrice(kind)).not.toThrow();
		}
	});
});
