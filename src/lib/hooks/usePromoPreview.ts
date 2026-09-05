'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrderSelection } from '@/types/order';

/**
 * Live discount preview for the checkout modal (PROMO-6/8).
 *
 * Asks the server what the order would cost with the typed code, so the
 * total visibly changes as soon as a valid code is entered instead of the
 * customer discovering the effect on the payment page.
 *
 * Three things this hook is careful about:
 *
 *  1. DEBOUNCE. A request per keystroke would hammer the promo lookup, so
 *     typing settles for DEBOUNCE_MS first. The no-code case is not debounced
 *     — there is nothing to wait for, and the modal should show the honest
 *     total the instant it opens.
 *
 *  2. OUT-OF-ORDER RESPONSES. "WELCOME1" and "WELCOME10" can be in flight at
 *     once, and the slower one may land last. Every request carries a
 *     sequence number and only the newest is allowed to write state —
 *     otherwise a stale reply could show a discount for a code the customer
 *     has already edited away.
 *
 *  3. GRACEFUL DEGRADATION. If the preview is unavailable (not signed in,
 *     throttled, network down) the hook reports no discount rather than
 *     blanking the price: the caller falls back to the locally computed
 *     subtotal, which is always correct pre-discount.
 */

const DEBOUNCE_MS = 600;

export type PreviewStatus =
	| 'idle'
	| 'loading'
	| 'ready'
	/** Code was checked and rejected — unknown, spent, held, expired or not yours. */
	| 'invalid'
	/** Real code, but this order is below the minimum it requires. */
	| 'min_order'
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
}

const EMPTY: PromoPreview = {
	status: 'idle',
	subtotal: null,
	discountUsd: 0,
	total: null,
	promoApplied: false,
	minOrderUsd: null,
};

export function usePromoPreview(
	selection: OrderSelection | null,
	promoCode: string,
	/** Pass the modal's `open` flag — no point previewing a closed modal. */
	enabled: boolean,
): PromoPreview {
	const [preview, setPreview] = useState<PromoPreview>(EMPTY);
	const latest = useRef(0);

	// Selection is compared by content, not identity: some call sites build it
	// inline, and depending on the object reference would re-fetch on every
	// single render.
	const selectionKey = selection ? JSON.stringify(selection) : '';
	const code = promoCode.trim();

	useEffect(() => {
		if (!enabled || !selection) {
			setPreview(EMPTY);
			return;
		}

		const requestId = ++latest.current;
		const controller = new AbortController();
		setPreview((prev) => ({ ...prev, status: 'loading' }));

		const timer = setTimeout(
			async () => {
				try {
					const res = await fetch('/api/checkout/preview', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ selection, ...(code ? { promoCode: code } : {}) }),
						signal: controller.signal,
					});
					const data = await res.json().catch(() => null);

					// A newer keystroke already superseded this request.
					if (requestId !== latest.current) return;

					if (!res.ok || typeof data?.total !== 'number' || typeof data?.subtotal !== 'number') {
						// Only a 200 may judge a code: 401/429/400/500 mean "unknown", never "invalid".
						setPreview({ ...EMPTY, status: 'unavailable' });
						return;
					}

					setPreview({
						status: code && !data.promoApplied ? (data.error === 'min_order' ? 'min_order' : 'invalid') : 'ready',
						subtotal: data.subtotal,
						discountUsd: typeof data.discountUsd === 'number' ? data.discountUsd : 0,
						total: data.total,
						promoApplied: Boolean(data.promoApplied),
						minOrderUsd: typeof data.minOrderUsd === 'number' ? data.minOrderUsd : null,
					});
				} catch {
					// AbortError included: a superseded request must not clobber state.
					if (requestId === latest.current) {
						setPreview({ ...EMPTY, status: 'unavailable' });
					}
				}
			},
			code ? DEBOUNCE_MS : 0,
		);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
		// `selectionKey` stands in for `selection` deliberately — see above.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectionKey, code, enabled]);

	return preview;
}
