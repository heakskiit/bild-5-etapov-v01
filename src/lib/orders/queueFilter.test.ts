import { describe, expect, it } from 'vitest';
import { isQueueOrder, QUEUE_PRODUCTS, QUEUE_STATUSES } from './queueFilter';

const order = (status: string | null, product: unknown) => ({ status, selection: { product } });

describe('isQueueOrder (FIX-QUEUE-018)', () => {
	it('shows a paid leveling order waiting for a booster', () => {
		expect(isQueueOrder(order('action_required', 'leveling'))).toBe(true);
	});

	it('shows a money order that is in progress', () => {
		expect(isQueueOrder(order('in_progress', 'money'))).toBe(true);
	});

	it('hides an unpaid order', () => {
		expect(isQueueOrder(order('awaiting_payment', 'leveling'))).toBe(false);
	});

	it('hides completed, cancelled and refunded orders', () => {
		for (const status of ['completed', 'cancelled', 'refunded']) {
			expect(isQueueOrder(order(status, 'money'))).toBe(false);
		}
	});

	it('hides cash cards even when paid', () => {
		expect(isQueueOrder(order('action_required', 'shark_card'))).toBe(false);
	});

	it('hides rows with a missing status or selection', () => {
		expect(isQueueOrder(order(null, 'leveling'))).toBe(false);
		expect(isQueueOrder({ status: 'in_progress', selection: null })).toBe(false);
		expect(isQueueOrder({ status: 'in_progress', selection: 'leveling' })).toBe(false);
	});

	it('matches the modder_queue_select policy from 0002', () => {
		expect([...QUEUE_PRODUCTS]).toEqual(['leveling', 'money']);
		expect([...QUEUE_STATUSES]).toEqual(['action_required', 'in_progress']);
	});
});
