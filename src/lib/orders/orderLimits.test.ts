/**
 * ORDER VOLUME LIMITS (Batch E1).
 *
 * The rule these tests pin down is a business rule, not arithmetic: refusing
 * one order too eagerly costs a sale, refusing one too late leaves the owner
 * reading past junk. Both boundaries are therefore asserted exactly, and so is
 * the fail-open behaviour -- a broken COUNT(*) must never close the shop.
 */

import { describe, expect, it } from 'vitest';

import {
	canPlaceOrder,
	dayWindowStart,
	MAX_ORDERS_PER_DAY,
	MAX_PENDING_ORDERS,
	PENDING_WINDOW_HOURS,
	pendingWindowStart,
} from '@/lib/orders/orderLimits';

describe('canPlaceOrder', () => {
	it('allows a customer with no history at all', () => {
		expect(canPlaceOrder({ pendingCount: 0, dailyCount: 0 })).toEqual({ allowed: true });
	});

	it('allows the last order below each ceiling', () => {
		expect(
			canPlaceOrder({
				pendingCount: MAX_PENDING_ORDERS - 1,
				dailyCount: MAX_ORDERS_PER_DAY - 1,
			}),
		).toEqual({ allowed: true });
	});

	it('refuses exactly at the pending ceiling, not one order later', () => {
		expect(canPlaceOrder({ pendingCount: MAX_PENDING_ORDERS, dailyCount: 0 })).toEqual({
			allowed: false,
			reason: 'too_many_pending',
			limit: MAX_PENDING_ORDERS,
		});
	});

	it('keeps refusing once the ceiling is passed', () => {
		const verdict = canPlaceOrder({ pendingCount: MAX_PENDING_ORDERS + 40, dailyCount: 0 });
		expect(verdict.allowed).toBe(false);
	});

	it('refuses at the daily ceiling even with nothing pending', () => {
		expect(canPlaceOrder({ pendingCount: 0, dailyCount: MAX_ORDERS_PER_DAY })).toEqual({
			allowed: false,
			reason: 'daily_limit',
			limit: MAX_ORDERS_PER_DAY,
		});
	});

	it('reports the pending refusal first when both ceilings are hit', () => {
		// The customer can act on this one; "come back tomorrow" they cannot.
		expect(
			canPlaceOrder({
				pendingCount: MAX_PENDING_ORDERS,
				dailyCount: MAX_ORDERS_PER_DAY,
			}),
		).toMatchObject({ reason: 'too_many_pending' });
	});

	it('allows the order when a count could not be read', () => {
		expect(canPlaceOrder({ pendingCount: null, dailyCount: null })).toEqual({ allowed: true });
		expect(canPlaceOrder({ pendingCount: undefined, dailyCount: 0 })).toEqual({ allowed: true });
	});

	it('treats a nonsense count as unreadable rather than as a refusal', () => {
		expect(canPlaceOrder({ pendingCount: Number.NaN, dailyCount: 0 })).toEqual({ allowed: true });
		expect(canPlaceOrder({ pendingCount: -3, dailyCount: 0 })).toEqual({ allowed: true });
	});

	it('still applies the other limit when one count is missing', () => {
		expect(canPlaceOrder({ pendingCount: null, dailyCount: MAX_ORDERS_PER_DAY })).toMatchObject({
			reason: 'daily_limit',
		});
	});

	it('keeps the pending ceiling below the daily one', () => {
		// Otherwise the daily cap would fire first and the pending rule, the one
		// that actually protects the lists, would be unreachable.
		expect(MAX_PENDING_ORDERS).toBeLessThan(MAX_ORDERS_PER_DAY);
	});
});

describe('window helpers', () => {
	const now = new Date('2026-09-06T12:00:00.000Z');

	it('opens the pending window exactly PENDING_WINDOW_HOURS ago', () => {
		expect(pendingWindowStart(now)).toBe('2026-09-04T12:00:00.000Z');
		expect(PENDING_WINDOW_HOURS).toBe(48);
	});

	it('opens the daily window exactly 24 hours ago', () => {
		expect(dayWindowStart(now)).toBe('2026-09-05T12:00:00.000Z');
	});

	it('defaults to the current time when no clock is given', () => {
		const before = Date.now() - PENDING_WINDOW_HOURS * 3_600_000;
		const produced = new Date(pendingWindowStart()).getTime();
		expect(Math.abs(produced - before)).toBeLessThan(5_000);
	});
});
