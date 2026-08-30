'use client';

import { useCallback, useState } from 'react';
import type { OrderSelection } from '@/types/order';
import type { ContactMethod, OrderDetails } from '@/lib/validation/order';

export interface Contact {
	method: ContactMethod;
	handle: string;
}

export const emptyOrderDetails: OrderDetails = { detailOne: '', detailTwo: '', comment: '' };
export const isOrderDetailsValid = (d: OrderDetails) =>
	d.detailOne.trim().length > 0 && d.detailTwo.trim().length > 0 && d.comment.trim().length > 0;

/**
 * §3.4: "Обязательные состояния экранов, которых сейчас нет: ... ошибка
 * оплаты с кнопкой «Повторить»."
 *
 * All three checkout entry points (BoostConfigurator, SharkCardConfigurator,
 * ProductPreviewCard) called POST /api/checkout and did nothing if it
 * failed — `if (data.payUrl) window.location.href = ...` silently no-ops on
 * any error, network failure, or malformed response. The button just goes
 * back to idle with zero feedback. One of the three (SharkCardConfigurator)
 * didn't even have try/finally, so a thrown fetch left it stuck in loading
 * forever. One hook, used by all three, fixes both problems in one place.
 *
 * §1: contact is now mandatory for every order — `checkout()` takes it as a
 * required second argument so a call site can't silently omit it the way
 * the API route used to let happen.
 */

export interface CheckoutError {
	/** Server error code (e.g. 'invalid_selection', 'internal') or 'network' for a failed fetch. Not shown to the user — logged for debugging. */
	code: string;
	message?: string;
}

export function useCheckout() {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<CheckoutError | null>(null);

	const checkout = useCallback(
		async (selection: OrderSelection, contact: Contact, details: OrderDetails, promoCode?: string) => {
			setBusy(true);
			setError(null);
			try {
				const res = await fetch('/api/checkout', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						selection,
						contactMethod: contact.method,
						contactHandle: contact.handle.trim(),
						details: {
							detailOne: details.detailOne.trim(),
							detailTwo: details.detailTwo.trim(),
							comment: details.comment.trim(),
						},
						// Server re-validates and re-normalizes regardless — trimming
						// here is just so an empty/whitespace-only field doesn't get
						// sent as a truthy string and trip 'invalid_promo' for nothing.
						...(promoCode?.trim() ? { promoCode: promoCode.trim() } : {}),
					}),
				});
				const data = await res.json().catch(() => null);

				if (!res.ok || !data?.payUrl) {
					console.error('[checkout] failed', { status: res.status, data });
					setError({ code: data?.error ?? String(res.status), message: data?.message });
					setBusy(false);
					return;
				}

				window.location.href = data.payUrl;
				// Deliberately not calling setBusy(false) on the success path — the
				// page is about to navigate away, and flipping the button back to
				// enabled for one frame right before that would just be a flash of
				// "wait, did it work?" for no reason.
			} catch (err) {
				console.error('[checkout] network error', err);
				setError({ code: 'network' });
				setBusy(false);
			}
		},
		[],
	);

	return { busy, error, checkout, clearError: () => setError(null) };
}
