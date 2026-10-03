import { describe, expect, it } from 'vitest';
import { EMPTY_PREVIEW, readPromoPreview } from './promoPreviewStatus';

const PRICES = { subtotal: 6.5, total: 6.5 };

describe('readPromoPreview — throttling (FIX-RATE-015)', () => {
	it('429 becomes rate_limited, not unavailable', () => {
		const p = readPromoPreview(429, { ...PRICES, error: 'rate_limited', retryAfterSeconds: 42 }, true);
		expect(p.status).toBe('rate_limited');
		expect(p.retryAfterSeconds).toBe(42);
	});

	it('429 keeps the server prices so the total does not blank', () => {
		const p = readPromoPreview(429, { ...PRICES, retryAfterSeconds: 10 }, true);
		expect(p.subtotal).toBe(6.5);
		expect(p.total).toBe(6.5);
		expect(p.promoApplied).toBe(false);
		expect(p.discountUsd).toBe(0);
	});

	it('429 without retryAfterSeconds falls back to 60', () => {
		expect(readPromoPreview(429, PRICES, true).retryAfterSeconds).toBe(60);
	});

	it('429 with an unreadable body still says rate_limited', () => {
		const p = readPromoPreview(429, null, true);
		expect(p.status).toBe('rate_limited');
		expect(p.retryAfterSeconds).toBe(60);
		expect(p.total).toBeNull();
	});

	it('429 never shows zero, negative or fractional seconds', () => {
		expect(readPromoPreview(429, { retryAfterSeconds: 0 }, true).retryAfterSeconds).toBe(1);
		expect(readPromoPreview(429, { retryAfterSeconds: -3 }, true).retryAfterSeconds).toBe(1);
		expect(readPromoPreview(429, { retryAfterSeconds: 4.2 }, true).retryAfterSeconds).toBe(5);
		expect(readPromoPreview(429, { retryAfterSeconds: Number.NaN }, true).retryAfterSeconds).toBe(60);
	});
});

describe('readPromoPreview — only a 200 may judge a code', () => {
	it.each([400, 401, 422, 500, 503])('%i is unavailable, never invalid', (status) => {
		const p = readPromoPreview(status, { ...PRICES, error: 'invalid_promo' }, true);
		expect(p).toEqual({ ...EMPTY_PREVIEW, status: 'unavailable' });
	});

	it('200 with a missing price is unavailable', () => {
		expect(readPromoPreview(200, { subtotal: 6.5 }, true).status).toBe('unavailable');
	});

	it('200 with a NaN price is unavailable, not "$NaN"', () => {
		expect(readPromoPreview(200, { subtotal: 6.5, total: Number.NaN }, false).status).toBe('unavailable');
	});

	it('200 with a non-object body is unavailable', () => {
		expect(readPromoPreview(200, 'oops', false).status).toBe('unavailable');
	});
});

describe('readPromoPreview — 200 verdicts', () => {
	it('no code typed is ready, even with an error field', () => {
		const p = readPromoPreview(200, { ...PRICES, promoApplied: false }, false);
		expect(p.status).toBe('ready');
		expect(p.total).toBe(6.5);
	});

	it('applied code is ready with discount and bonus', () => {
		const p = readPromoPreview(
			200,
			{ subtotal: 6.5, total: 5.53, discountUsd: 0.97, promoApplied: true, bonusMultiplier: 2 },
			true,
		);
		expect(p).toEqual({
			status: 'ready',
			subtotal: 6.5,
			discountUsd: 0.97,
			total: 5.53,
			promoApplied: true,
			minOrderUsd: null,
			bonusMultiplier: 2,
			retryAfterSeconds: null,
		});
	});

	it('refused code is invalid', () => {
		const p = readPromoPreview(200, { ...PRICES, promoApplied: false, error: 'invalid_promo' }, true);
		expect(p.status).toBe('invalid');
		expect(p.discountUsd).toBe(0);
	});

	it('min_order carries the required amount', () => {
		const p = readPromoPreview(200, { ...PRICES, error: 'min_order', minOrderUsd: 10 }, true);
		expect(p.status).toBe('min_order');
		expect(p.minOrderUsd).toBe(10);
	});

	it('wrong_product is its own status', () => {
		expect(readPromoPreview(200, { ...PRICES, error: 'wrong_product' }, true).status).toBe('wrong_product');
	});

	it('an unknown refusal falls back to invalid, never success', () => {
		const p = readPromoPreview(200, { ...PRICES, error: 'something_new' }, true);
		expect(p.status).toBe('invalid');
		expect(p.promoApplied).toBe(false);
	});
});
