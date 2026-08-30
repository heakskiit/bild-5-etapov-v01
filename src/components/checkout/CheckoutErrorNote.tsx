'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CheckoutError } from '@/lib/hooks/useCheckout';

/**
 * `error.code` was already distinct per failure (`useCheckout` passes the
 * server's `error` field straight through), but all three call sites
 * rendered the same generic "Payment error / Retry" regardless — so a 401
 * (not signed in) and a 500 (CRYPTO_PAY_TOKEN missing, etc.) were visually
 * identical, and "Retry" on the 401 just fails again the same way.
 */
export function CheckoutErrorNote({
	error,
	t,
	onRetry,
}: {
	error: CheckoutError | null;
	t: (key: string) => string;
	onRetry: () => void;
}) {
	const pathname = usePathname();
	if (!error) return null;

	if (error.code === 'unauthenticated') {
		const locale = pathname.split('/')[1] || 'en';
		return (
			<div className="mt-1 flex items-center gap-2">
				<span className="text-xs text-pink-400">{t('common.checkoutSignInRequired')}</span>
				<Link
					href={`/${locale}/auth`}
					className="text-xs font-semibold text-cyan-500 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2"
				>
					{t('nav.login')}
				</Link>
			</div>
		);
	}

	if (error.code === 'invalid_promo') {
		// Retrying with the same code fails the same way every time — no
		// button here, just enough text to point at the field to fix.
		return (
			<div className="mt-1">
				<span className="text-xs text-pink-400">{t('checkout.invalidPromo')}</span>
			</div>
		);
	}

	return (
		<div className="mt-1 flex items-center gap-2">
			<span className="text-xs text-pink-400">{t('common.checkoutError')}</span>
			<button
				type="button"
				onClick={onRetry}
				className="text-xs font-semibold text-cyan-500 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2"
			>
				{t('common.retry')}
			</button>
		</div>
	);
}
