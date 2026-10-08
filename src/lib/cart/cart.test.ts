import { describe, expect, it } from 'vitest';
import type { OrderSelection } from '@/types/order';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { addItem, cartTotal, MAX_CART_ITEMS, parseCart, priceOf, removeItem, type CartItem } from './cart';

const shark: OrderSelection = { product: 'shark_card', platform: 'pc', variantId: SHARK_CARDS[0].id };
const leveling: OrderSelection = {
	product: 'leveling',
	platform: 'pc',
	level: 100,
	gameVersion: 'legacy',
	launcher: 'steam',
	addonIds: [],
	delivery: 'normal',
};

const fill = (n: number): CartItem[] => {
	let items: CartItem[] = [];
	for (let i = 0; i < n; i++) {
		const r = addItem(items, shark, `id-${i}`, i);
		items = r.items;
	}
	return items;
};

describe('cart (FEAT-CART-022)', () => {
	it('prices items with the server pricing function', () => {
		expect(priceOf(shark)).toBe(SHARK_CARDS[0].price);
		expect(priceOf(leveling)).toBeGreaterThan(0);
	});

	it('adds mixed products and totals them to the cent', () => {
		const a = addItem([], shark, 'a', 1);
		const b = addItem(a.items, leveling, 'b', 2);
		expect(b.ok).toBe(true);
		expect(b.items).toHaveLength(2);
		expect(cartTotal(b.items)).toBe(Math.round(((priceOf(shark) ?? 0) + (priceOf(leveling) ?? 0)) * 100) / 100);
	});

	it(`refuses item number ${MAX_CART_ITEMS + 1}`, () => {
		const full = fill(MAX_CART_ITEMS);
		const r = addItem(full, shark, 'extra', 99);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('full');
		expect(r.items).toHaveLength(MAX_CART_ITEMS);
	});

	it('refuses a selection that cannot be priced', () => {
		const r = addItem([], { product: 'shark_card', platform: 'pc', variantId: 'nope' }, 'x', 1);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('invalid');
	});

	it('stores a copy, not the live configurator object', () => {
		const live: OrderSelection = { ...leveling, addonIds: [] };
		const r = addItem([], live, 'a', 1);
		live.level = 999;
		expect(r.items[0].selection.level).toBe(100);
	});

	it('removes by id only', () => {
		const items = fill(3);
		expect(removeItem(items, 'id-1').map((i) => i.id)).toEqual(['id-0', 'id-2']);
	});

	it('reads garbage from storage as an empty cart', () => {
		for (const raw of [null, '', 'not json', '{}', '42', '[1,2]', JSON.stringify([{ id: 'a' }])]) {
			expect(parseCart(raw)).toEqual([]);
		}
	});

	it('drops unpriceable items and caps the length on read', () => {
		const bad = { id: 'bad', addedAt: 1, selection: { product: 'shark_card', platform: 'pc', variantId: 'gone' } };
		const raw = JSON.stringify([...fill(MAX_CART_ITEMS + 2), bad]);
		const items = parseCart(raw);
		expect(items).toHaveLength(MAX_CART_ITEMS);
		expect(items.some((i) => i.id === 'bad')).toBe(false);
	});
});
