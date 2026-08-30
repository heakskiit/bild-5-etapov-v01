'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ContactField, isContactValid } from '@/components/checkout/ContactField';
import { CheckoutErrorNote } from '@/components/checkout/CheckoutErrorNote';
import { isOrderDetailsValid } from '@/lib/hooks/useCheckout';
import type { Contact, CheckoutError } from '@/lib/hooks/useCheckout';
import type { OrderDetails } from '@/lib/validation/order';

const INPUT =
	'w-full rounded-lg border border-white/15 bg-night px-3 py-2 text-sm outline-none focus:border-neon-blue';

/**
 * §7 glassmorphism: `bg-[#05050A]/75` + `backdrop-blur-xl` panel, neon glow
 * only on the active submit button — matches every other surface in the
 * dashboard/checkout, not a one-off style.
 *
 * Requested as a structural change: contact + order details now live in
 * this modal, opened from the Buy button, instead of being embedded
 * inline on the product page itself.
 */
export function CheckoutModal({
	open,
	onClose,
	contact,
	onContactChange,
	details,
	onDetailsChange,
	promoCode,
	onPromoCodeChange,
	busy,
	error,
	onSubmit,
	onRetry,
	t,
}: {
	open: boolean;
	onClose: () => void;
	contact: Contact;
	onContactChange: (c: Contact) => void;
	details: OrderDetails;
	onDetailsChange: (d: OrderDetails) => void;
	promoCode: string;
	onPromoCodeChange: (v: string) => void;
	busy: boolean;
	error: CheckoutError | null;
	onSubmit: () => void;
	onRetry: () => void;
	t: (key: string, vars?: Record<string, string | number>) => string;
}) {
	// Esc to close, and lock page scroll while open — standard modal manners.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [open, onClose]);

	if (!open) return null;

	const canSubmit = isContactValid(contact) && isOrderDetailsValid(details) && !busy;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-[#05050A]/75 backdrop-blur-xl" onClick={onClose} aria-hidden="true" />
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t('checkout.modalTitle')}
				className="glass-panel relative w-full max-w-md space-y-4 p-6"
			>
				<div className="flex items-center justify-between">
					<h2 className="font-display text-lg text-neon-pink">{t('checkout.modalTitle')}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label={t('common.close')}
						className="text-white/50 hover:text-white"
					>
						✕
					</button>
				</div>

				<ContactField value={contact} onChange={onContactChange} t={t} />

				<div className="space-y-2">
					<label className="block text-xs uppercase tracking-widest text-white/50" htmlFor="checkout-detail-one">
						{t('checkout.detailOneLabel')}
					</label>
					<input
						id="checkout-detail-one"
						type="text"
						value={details.detailOne}
						onChange={(e) => onDetailsChange({ ...details, detailOne: e.target.value })}
						placeholder={t('checkout.detailOnePlaceholder')}
						className={INPUT}
					/>
				</div>

				<div className="space-y-2">
					<label className="block text-xs uppercase tracking-widest text-white/50" htmlFor="checkout-detail-two">
						{t('checkout.detailTwoLabel')}
					</label>
					<input
						id="checkout-detail-two"
						type="text"
						value={details.detailTwo}
						onChange={(e) => onDetailsChange({ ...details, detailTwo: e.target.value })}
						placeholder={t('checkout.detailTwoPlaceholder')}
						className={INPUT}
					/>
				</div>

				<div className="space-y-2">
					<label className="block text-xs uppercase tracking-widest text-white/50" htmlFor="checkout-comment">
						{t('checkout.commentLabel')}
					</label>
					<textarea
						id="checkout-comment"
						value={details.comment}
						onChange={(e) => onDetailsChange({ ...details, comment: e.target.value })}
						placeholder={t('checkout.commentPlaceholder')}
						rows={3}
						className={INPUT}
					/>
				</div>

				<div className="space-y-2">
					<label className="block text-xs uppercase tracking-widest text-white/50" htmlFor="checkout-promo">
						{t('checkout.promoLabel')}
					</label>
					<input
						id="checkout-promo"
						type="text"
						value={promoCode}
						onChange={(e) => onPromoCodeChange(e.target.value)}
						placeholder={t('checkout.promoPlaceholder')}
						autoCapitalize="characters"
						className={INPUT}
					/>
				</div>

				<CheckoutErrorNote error={error} t={t} onRetry={onRetry} />

				<div className="flex gap-2 pt-2">
					<Button variant="ghost" size="md" onClick={onClose} className="flex-1">
						{t('common.cancel')}
					</Button>
					<Button
						variant="primary"
						size="md"
						onClick={onSubmit}
						loading={busy}
						disabled={!canSubmit}
						disabledReason={!isContactValid(contact) ? t('checkout.contactLabel') : t('checkout.fillAllFields')}
						className="flex-1"
					>
						{t('checkout.payNow')}
					</Button>
				</div>
			</div>
		</div>
	);
}
