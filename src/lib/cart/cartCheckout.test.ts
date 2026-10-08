import { describe, expect, it } from 'vitest';
import { countPurchases, findShortSku, skuDemand, splitDiscount, sumMoney } from './cartCheckout';

const cents = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100);

describe('splitDiscount (FEAT-CART-023)', () => {
	it('splits proportionally and sums to the exact discount', () => {
		const shares = splitDiscount([10, 30], 4);
		expect(shares).toEqual([1, 3]);
	});

	it('never loses or invents a cent on awkward numbers', () => {
		for (const [totals, d] of [
			[[2.49, 6.5, 59.99], 13.8],
			[[0.99, 0.99, 0.99], 0.59],
			[[3.33, 3.33, 3.34], 1.0],
		] as [number[], number][]) {
			const shares = splitDiscount(totals, d);
			expect(cents(shares)).toBe(Math.round(d * 100));
			shares.forEach((s, i) => expect(s).toBeLessThanOrEqual(totals[i]));
			shares.forEach((s) => expect(s).toBeGreaterThanOrEqual(0));
		}
	});

	it('returns zeros for no discount', () => {
		expect(splitDiscount([5, 6], 0)).toEqual([0, 0]);
	});
});

describe('sumMoney', () => {
	it('adds strings from Postgres numeric and rounds to cents', () => {
		expect(sumMoney(['2.49', 6.5, '0.1', null])).toBe(9.09);
	});
});

describe('countPurchases', () => {
	it('counts a cart once and standalone orders individually', () => {
		const rows = [
			{ id: 'a', cart_id: 'c1' },
			{ id: 'b', cart_id: 'c1' },
			{ id: 'c', cart_id: 'c1' },
			{ id: 'd', cart_id: null },
			{ id: 'e' },
			{ id: 'f', cart_id: 'c2' },
		];
		expect(countPurchases(rows)).toBe(4);
		expect(countPurchases([])).toBe(0);
	});
});

describe('stock check', () => {
	it('counts demand per SKU and finds the first short one', () => {
		const demand = skuDemand(['SHARK_100K', 'SHARK_100K', 'SHARK_10M', null]);
		expect(demand).toEqual({ SHARK_100K: 2, SHARK_10M: 1 });
		expect(findShortSku(demand, { SHARK_100K: 1, SHARK_10M: 5 })).toBe('SHARK_100K');
		expect(findShortSku(demand, { SHARK_100K: 2, SHARK_10M: 1 })).toBeNull();
	});

	it('does not refuse when the stock is unknown', () => {
		expect(findShortSku({ SHARK_100K: 3 }, undefined)).toBeNull();
	});
});
