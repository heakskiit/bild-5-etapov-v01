/**
 * Turns one /api/checkout/preview response into the shape the modal renders
 * (FIX-RATE-015).
 *
 * Extracted from usePromoPreview so the mapping is testable on its own: the
 * hook's debounce, AbortController and sequence numbers made every one of
 * these cases require a fake-timer DOM test to reach.
 *
 * WHY 429 IS NOT 'unavailable'
 * It used to be, and the modal renders nothing for 'unavailable' — so a
 * throttled customer watched the discount line vanish with no explanation and
 * assumed the code was bad. A refusal to look the code up is a different
 * event from "the code is invalid", and the only one of the two that has a
 * remedy: wait.
 */

export type PreviewStatus =
	| 'idle'
	| 'loading'
	| 'ready'
	/** Code was checked and rejected — unknown, spent, held, expired or not yours. */
	| 'invalid'
	/** Real code, but this order is below the minimum it requires. */
	| 'min_order'
	| 'wrong_product'
	/** Lookup refused: too many attempts. The price shown is still correct. */
	| 'rate_limited'
	/** Preview could not run; price shown is pre-discount only. */
	| 'unavailable';

export interface PromoPreview {
	status: PreviewStatus;
	/** Server-computed price before any code, or null if the preview never ran. */
	subtotal: number | null;
	discountUsd: number;
	/** Server-computed amount that would actually be charged, or null. */
	total: number | null;
	promoApplied: boolean;
	/** Set only when status is min_order: the amount the code needs. */
	minOrderUsd: number | null;
	/** 2 for an X2 code, 1 for everything else. Never affects the price. */
	bonusMultiplier: number;
	/** Set only when status is rate_limited: seconds until the next attempt. */
	retryAfterSeconds: number | null;
}

export const EMPTY_PREVIEW: PromoPreview = {
	status: 'idle',
	subtotal: null,
	discountUsd: 0,
	total: null,
	promoApplied: false,
	minOrderUsd: null,
	bonusMultiplier: 1,
	retryAfterSeconds: null,
};

/** NaN and Infinity are rejected, not coerced: they would render as "$NaN". */
function finiteOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readPromoPreview(httpStatus: number, data: unknown, hasCode: boolean): PromoPreview {
	const body: Record<string, unknown> =
		data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
	const subtotal = finiteOrNull(body.subtotal);
	const total = finiteOrNull(body.total);

	// Throttled. The route deliberately still sends both prices, so the modal
	// keeps showing a correct undiscounted total instead of blanking it.
	if (httpStatus === 429) {
		const retry = finiteOrNull(body.retryAfterSeconds);
		return {
			...EMPTY_PREVIEW,
			status: 'rate_limited',
			subtotal,
			total,
			// A missing or absurd value must not print "try again in -3s".
			retryAfterSeconds: retry === null ? 60 : Math.max(1, Math.ceil(retry)),
		};
	}

	// Only a 200 with both prices may judge a code: 401/400/500 mean "unknown",
	// never "invalid".
	if (httpStatus !== 200 || subtotal === null || total === null) {
		return { ...EMPTY_PREVIEW, status: 'unavailable' };
	}

	const promoApplied = Boolean(body.promoApplied);

	// No code typed, or the code worked: the price is the whole answer.
	if (!hasCode || promoApplied) {
		return {
			status: 'ready',
			subtotal,
			discountUsd: finiteOrNull(body.discountUsd) ?? 0,
			total,
			promoApplied,
			minOrderUsd: null,
			bonusMultiplier: finiteOrNull(body.bonusMultiplier) ?? 1,
			retryAfterSeconds: null,
		};
	}

	// A code was sent and refused. Every refusal the server can express keeps
	// its own status; anything unrecognised falls back to 'invalid' rather than
	// being silently treated as success.
	const status: PreviewStatus =
		body.error === 'min_order' ? 'min_order' : body.error === 'wrong_product' ? 'wrong_product' : 'invalid';

	return {
		...EMPTY_PREVIEW,
		status,
		subtotal,
		total,
		minOrderUsd: status === 'min_order' ? finiteOrNull(body.minOrderUsd) : null,
	};
}
