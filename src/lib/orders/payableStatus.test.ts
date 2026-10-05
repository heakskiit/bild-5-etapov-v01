import { describe, expect, it } from 'vitest';
import { isPaidAfterCancel, isPayableStatus, STALE_ORDER_HOURS } from './payableStatus';

describe('isPayableStatus (FIX-PAY-019)', () => {
	it('settles an order still waiting for payment', () => {
		expect(isPayableStatus('awaiting_payment')).toBe(true);
	});

	it('settles an auto-cancelled order instead of losing the money', () => {
		expect(isPayableStatus('cancelled')).toBe(true);
	});

	it('ignores orders that were already paid or finished', () => {
		for (const status of ['action_required', 'in_progress', 'completed', 'refunded']) {
			expect(isPayableStatus(status)).toBe(false);
		}
	});

	it('ignores a missing or malformed status', () => {
		expect(isPayableStatus(null)).toBe(false);
		expect(isPayableStatus(undefined)).toBe(false);
		expect(isPayableStatus('')).toBe(false);
		expect(isPayableStatus(1)).toBe(false);
	});
});

describe('isPaidAfterCancel (FIX-PAY-019)', () => {
	it('flags only a payment on a cancelled order', () => {
		expect(isPaidAfterCancel('cancelled')).toBe(true);
		expect(isPaidAfterCancel('awaiting_payment')).toBe(false);
	});

	it('keeps the cancel delay above the one-hour invoice lifetime', () => {
		expect(STALE_ORDER_HOURS).toBeGreaterThan(1);
	});
});
