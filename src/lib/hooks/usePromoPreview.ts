'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrderSelection } from '@/types/order';
import { EMPTY_PREVIEW, readPromoPreview, type PromoPreview } from '@/lib/hooks/promoPreviewStatus';

// Re-exported so existing imports from this module keep working.
export type { PreviewStatus, PromoPreview } from '@/lib/hooks/promoPreviewStatus';

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
 *     network down) the hook reports no discount rather than
 *     blanking the price: the caller falls back to the locally computed
 *     subtotal, which is always correct pre-discount. Throttling is the one
 *     refusal reported separately ('rate_limited'), because it is the one
 *     the customer can fix by waiting (FIX-RATE-015).
 */

const DEBOUNCE_MS = 600;

export function usePromoPreview(
	/** One selection, or (BATCH F12) every selection of the cart. */
	selection: OrderSelection | readonly OrderSelection[] | null,
	promoCode: string,
	/** Pass the modal's `open` flag — no point previewing a closed modal. */
	enabled: boolean,
): PromoPreview {
	const [preview, setPreview] = useState<PromoPreview>(EMPTY_PREVIEW);
	const latest = useRef(0);

	// Selection is compared by content, not identity: some call sites build it
	// inline, and depending on the object reference would re-fetch on every
	// single render.
	const selectionKey = selection ? JSON.stringify(selection) : '';
	const code = promoCode.trim();

	useEffect(() => {
		if (!enabled || !selection || (Array.isArray(selection) && selection.length === 0)) {
			setPreview(EMPTY_PREVIEW);
			return;
		}

		const requestId = ++latest.current;
		const controller = new AbortController();
		setPreview((prev) => ({ ...prev, status: 'loading' }));

		const timer = setTimeout(
			async () => {
				try {
					const isCart = Array.isArray(selection);
					const res = await fetch(isCart ? '/api/checkout/cart/preview' : '/api/checkout/preview', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							...(isCart ? { items: selection } : { selection }),
							...(code ? { promoCode: code } : {}),
						}),
						signal: controller.signal,
					});
					const data = await res.json().catch(() => null);

					// A newer keystroke already superseded this request.
					if (requestId !== latest.current) return;

					// The mapping lives in a pure function so every status is unit-tested;
					// see promoPreviewStatus.ts for why only a 200 may judge a code.
					setPreview(readPromoPreview(res.status, data, Boolean(code)));
				} catch {
					// AbortError included: a superseded request must not clobber state.
					if (requestId === latest.current) {
						setPreview({ ...EMPTY_PREVIEW, status: 'unavailable' });
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
