import { describe, expect, it } from 'vitest';
import {
	canConfirmReceipt,
	confirmOverdueBefore,
	confirmReceiptSchema,
	isConfirmOverdue,
	revealedAtOf,
} from './confirmReceipt';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const DAY = 24 * 3600 * 1000;

describe('canConfirmReceipt', () => {
	it('allows a completed service', () => {
		expect(canConfirmReceipt({ status: 'completed', isCode: false })).toBe(true);
	});

	it('refuses anything not completed', () => {
		for (const status of ['awaiting_payment', 'action_required', 'in_progress', 'cancelled', 'refunded', null]) {
			expect(canConfirmReceipt({ status, isCode: false })).toBe(false);
		}
	});

	it('refuses a code that was never opened', () => {
		expect(canConfirmReceipt({ status: 'completed', isCode: true, revealedAt: null })).toBe(false);
		expect(canConfirmReceipt({ status: 'completed', isCode: true, revealedAt: '2026-10-12T10:00:00Z' })).toBe(true);
	});

	it('is a no-op once confirmed', () => {
		expect(canConfirmReceipt({ status: 'completed', isCode: false, confirmedAt: '2026-10-12T10:00:00Z' })).toBe(false);
	});
});

describe('revealedAtOf', () => {
	it('reads array, object and empty shapes', () => {
		expect(revealedAtOf([{ revealed_at: 'x' }])).toBe('x');
		expect(revealedAtOf({ revealed_at: 'y' })).toBe('y');
		expect(revealedAtOf([{ revealed_at: null }])).toBeNull();
		expect(revealedAtOf(null)).toBeNull();
		expect(revealedAtOf([])).toBeNull();
	});
});

describe('isConfirmOverdue', () => {
	it('flags completed orders past the window only', () => {
		const old = new Date(NOW - 4 * DAY).toISOString();
		const fresh = new Date(NOW - 1 * DAY).toISOString();
		expect(isConfirmOverdue('completed', old, null, NOW)).toBe(true);
		expect(isConfirmOverdue('completed', fresh, null, NOW)).toBe(false);
		expect(isConfirmOverdue('completed', old, '2026-10-11T00:00:00Z', NOW)).toBe(false);
		expect(isConfirmOverdue('in_progress', old, null, NOW)).toBe(false);
		expect(isConfirmOverdue('completed', null, null, NOW)).toBe(false);
	});

	it('cut-off matches the window', () => {
		expect(confirmOverdueBefore(NOW)).toBe(new Date(NOW - 3 * DAY).toISOString());
	});
});

describe('confirmReceiptSchema', () => {
	it('accepts an order number and rejects junk', () => {
		expect(confirmReceiptSchema.safeParse({ orderId: 'GT-56A3823D' }).success).toBe(true);
		expect(confirmReceiptSchema.safeParse({ orderId: '' }).success).toBe(false);
		expect(confirmReceiptSchema.safeParse(null).success).toBe(false);
	});
});
