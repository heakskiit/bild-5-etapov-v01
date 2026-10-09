import { describe, expect, it } from 'vitest';
import { groupByCart, shortCartId } from './groupByCart';

describe('groupByCart', () => {
	it('keeps single orders and groups a cart where its first order appears', () => {
		const rows = [
			{ id: 'a', cart_id: null, total_usd: '5.00' },
			{ id: 'b', cart_id: 'c1', total_usd: '2.49' },
			{ id: 'c', cart_id: null, total_usd: '1.00' },
			{ id: 'd', cart_id: 'c1', total_usd: '1.32' },
		];
		const units = groupByCart(rows);
		expect(units.map((u) => u.kind)).toEqual(['single', 'cart', 'single']);
		const cart = units[1];
		if (cart.kind !== 'cart') throw new Error('expected cart');
		expect(cart.orders.map((o) => o.id)).toEqual(['b', 'd']);
		expect(cart.totalUsd).toBe(3.81);
	});

	it('treats a cart with one visible order as a single order', () => {
		const units = groupByCart([{ id: 'x', cart_id: 'c2', total_usd: 3 }]);
		expect(units).toEqual([{ kind: 'single', order: { id: 'x', cart_id: 'c2', total_usd: 3 } }]);
	});

	it('returns nothing for nothing', () => {
		expect(groupByCart([])).toEqual([]);
	});
});

describe('shortCartId', () => {
	it('uses the first four hex digits', () => {
		expect(shortCartId('a1b2c3d4-0000-4000-8000-000000000000')).toBe('A1B2');
	});
});
