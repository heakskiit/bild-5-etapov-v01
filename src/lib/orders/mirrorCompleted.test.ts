import { describe, expect, it } from 'vitest';
import { AUTO_DELIVERY, buildOrderRow, type CompletedOrder } from './mirrorCompleted';
import type { OrderSelection } from '@/types/order';

/** Echoes the key and its vars, so a wrong key or a wrong amount is visible. */
const t = (key: string, vars?: Record<string, string | number>) =>
	vars ? `${key}:${JSON.stringify(vars)}` : key;

const money = (over: Partial<OrderSelection> = {}): OrderSelection =>
	({ product: 'money', platform: 'pc', amountMillions: 100, ...over }) as OrderSelection;

const order = (over: Partial<CompletedOrder> = {}): CompletedOrder => ({
	publicId: 'GT-BFF78D6D',
	selection: money(),
	totalUsd: '7.65',
	completedBy: 'booster@example.com',
	completedAt: '2026-09-06T07:00:00.000Z',
	...over,
});

describe('buildOrderRow', () => {
	it('carries the identifying fields through untouched', () => {
		const row = buildOrderRow(order({ contactHandle: 'telegram: 11' }), t);
		expect(row.publicId).toBe('GT-BFF78D6D');
		expect(row.contact).toBe('telegram: 11');
		expect(row.completedBy).toBe('booster@example.com');
		expect(row.completedAt).toBe('2026-09-06T07:00:00.000Z');
	});

	it('formats money to two decimals and keeps a zero total visible', () => {
		expect(buildOrderRow(order({ totalUsd: 7.6 }), t).totalUsd).toBe('7.60');
		expect(buildOrderRow(order({ totalUsd: 0 }), t).totalUsd).toBe('0.00');
	});

	it('leaves the discount column empty when no code was used', () => {
		const row = buildOrderRow(order(), t);
		expect(row.discountUsd).toBe('');
		expect(row.promoCode).toBe('');
	});

	it('reports the discount and the code when one was', () => {
		const row = buildOrderRow(order({ discountUsd: '1.8', promoCode: 'HOLDTEST' }), t);
		expect(row.discountUsd).toBe('1.80');
		expect(row.promoCode).toBe('HOLDTEST');
	});

	it('never prints NaN into the sheet', () => {
		const row = buildOrderRow(order({ totalUsd: 'not a number', discountUsd: undefined }), t);
		expect(row.totalUsd).toBe('');
		expect(row.discountUsd).toBe('');
	});

	it('uppercases the platform', () => {
		expect(buildOrderRow(order(), t).platform).toBe('PC');
	});

	it('describes an ordinary money order with the ordered amount', () => {
		expect(buildOrderRow(order(), t).item).toBe('dashboard.describeMoney:{"amount":100}');
	});

	it('describes an X2 order with the delivered amount, not the ordered one', () => {
		const row = buildOrderRow(order({ deliveryMultiplier: '2' }), t);
		expect(row.item).toBe('dashboard.describeMoneyBonus:{"amount":200,"multiplier":2}');
	});

	it('describes a cash card without inventing an amount', () => {
		const row = buildOrderRow(order({ selection: money({ product: 'shark_card' }) }), t);
		expect(row.item).toBe('dashboard.describeCashCard');
	});

	it('marks automatic delivery with a marker no email can collide with', () => {
		expect(AUTO_DELIVERY).toContain('auto');
		expect(AUTO_DELIVERY).not.toContain('@');
	});
});
