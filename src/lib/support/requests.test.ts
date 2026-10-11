import { describe, expect, it } from 'vitest';
import { adminSupportUpdateSchema, canRequestHelp, createSupportSchema, hasUnseenReply } from './requests';

const NOW = Date.parse('2026-10-11T12:00:00Z');

describe('createSupportSchema', () => {
	it('accepts a listed reason without a comment', () => {
		expect(createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'queue_too_long' }).success).toBe(true);
	});

	it('requires a comment for "other"', () => {
		expect(createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'other', message: '   ' }).success).toBe(false);
		expect(createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'other', message: 'help' }).success).toBe(true);
	});

	it('rejects unknown reasons, long comments and extra fields', () => {
		expect(createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'refund_now' }).success).toBe(false);
		expect(
			createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'other', message: 'x'.repeat(501) }).success,
		).toBe(false);
		expect(
			createSupportSchema.safeParse({ orderId: 'GT-1', reason: 'other', message: 'a', status: 'resolved' }).success,
		).toBe(false);
	});
});

describe('adminSupportUpdateSchema', () => {
	it('accepts a status with an optional reply', () => {
		expect(adminSupportUpdateSchema.safeParse({ id: 'SR-1', status: 'in_progress' }).success).toBe(true);
		expect(adminSupportUpdateSchema.safeParse({ id: 'SR-1', status: 'resolved', reply: 'Done' }).success).toBe(true);
		expect(adminSupportUpdateSchema.safeParse({ id: 'SR-1', status: 'closed' }).success).toBe(false);
	});
});

describe('canRequestHelp', () => {
	it('allows any active or completed order', () => {
		expect(canRequestHelp('awaiting_payment', '2026-01-01T00:00:00Z', NOW)).toBe(true);
		expect(canRequestHelp('completed', '2026-01-01T00:00:00Z', NOW)).toBe(true);
	});

	it('allows a cancelled order only for a week', () => {
		expect(canRequestHelp('cancelled', '2026-10-08T12:00:00Z', NOW)).toBe(true);
		expect(canRequestHelp('cancelled', '2026-10-01T12:00:00Z', NOW)).toBe(false);
		expect(canRequestHelp('cancelled', null, NOW)).toBe(false);
	});
});

describe('hasUnseenReply', () => {
	it('is true only for an unopened reply', () => {
		expect(hasUnseenReply({ reply: 'Hi', replySeenAt: null })).toBe(true);
		expect(hasUnseenReply({ reply: 'Hi', replySeenAt: '2026-10-11T12:00:00Z' })).toBe(false);
		expect(hasUnseenReply({ reply: null, replySeenAt: null })).toBe(false);
		expect(hasUnseenReply(null)).toBe(false);
	});
});

describe('customerMessageSchema', () => {
	it('needs a body or resolve', async () => {
		const { customerMessageSchema } = await import('./requests');
		expect(customerMessageSchema.safeParse({ requestId: 'SR-1', body: 'thanks' }).success).toBe(true);
		expect(customerMessageSchema.safeParse({ requestId: 'SR-1', resolve: true }).success).toBe(true);
		expect(customerMessageSchema.safeParse({ requestId: 'SR-1', body: '  ' }).success).toBe(false);
		expect(customerMessageSchema.safeParse({ requestId: 'SR-1' }).success).toBe(false);
	});
});

describe('awaitingCustomer / autoCloseAt', () => {
	const base = { status: 'open' as const, createdAt: '2026-10-10T10:00:00Z', lastCustomerAt: '2026-10-10T10:00:00Z' };

	it('runs the clock only after support answered last', async () => {
		const { awaitingCustomer, autoCloseAt } = await import('./requests');
		expect(awaitingCustomer({ ...base, lastStaffAt: null })).toBe(false);
		expect(awaitingCustomer({ ...base, lastStaffAt: '2026-10-10T12:00:00Z' })).toBe(true);
		expect(autoCloseAt({ ...base, lastStaffAt: '2026-10-10T12:00:00Z' })).toBe('2026-10-12T12:00:00.000Z');
	});

	it('stops when the customer wrote again or the request is resolved', async () => {
		const { awaitingCustomer, autoCloseAt } = await import('./requests');
		expect(awaitingCustomer({ ...base, lastStaffAt: '2026-10-10T12:00:00Z', lastCustomerAt: '2026-10-10T13:00:00Z' })).toBe(false);
		expect(awaitingCustomer({ ...base, status: 'resolved', lastStaffAt: '2026-10-10T12:00:00Z' })).toBe(false);
		expect(autoCloseAt(null)).toBe(null);
	});
});
