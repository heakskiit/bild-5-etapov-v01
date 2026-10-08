'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { useCart } from '@/lib/cart/useCart';
import { MAX_CART_ITEMS, priceOf } from '@/lib/cart/cart';
import { describeSelection } from '@/lib/orders/describeSelection';
import type { OrderSelection } from '@/types/order';

const PLATFORM_LABELS: Record<string, string> = { pc: 'PC', ps: 'PlayStation', xbox: 'Xbox' };
const DELIVERY_KEYS: Record<string, string> = {
	normal: 'configurator.deliveryNormal',
	express: 'configurator.deliveryExpress',
	super_express: 'configurator.deliverySuperExpress',
};

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * BATCH F11: the /cart page. List, remove, clear, total.
 * The pay button is intentionally disabled until BATCH F12 wires up one
 * invoice for the whole cart.
 */
export function CartView({ locale, messages }: { locale: string; messages: Dict }) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const { items, count, total, remove, clear } = useCart();

	const subtitle = (s: OrderSelection) => {
		const parts = [PLATFORM_LABELS[s.platform] ?? s.platform];
		if (s.product !== 'shark_card' && s.delivery) parts.push(t(DELIVERY_KEYS[s.delivery] ?? s.delivery));
		if (s.addonIds?.length) parts.push(`+${s.addonIds.length}`);
		return parts.join(' · ');
	};

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h1 className="font-display text-3xl text-neon-pink">{t('cart.title')}</h1>
				{count > 0 && (
					<span className="text-sm text-ink-muted">{t('cart.count', { count, max: MAX_CART_ITEMS })}</span>
				)}
			</div>

			{count === 0 ? (
				<div className="glass-panel space-y-4 p-8 text-center">
					<p className="text-ink-soft">{t('cart.empty')}</p>
					<Link href={`/${locale}/gta-5`} className="inline-block text-cyan-500 underline-offset-4 hover:underline">
						{t('cart.emptyCta')} →
					</Link>
				</div>
			) : (
				<>
					<ul className="space-y-2">
						{items.map((item) => {
							const price = priceOf(item.selection);
							return (
								<li key={item.id} className="glass-panel-sm flex items-center gap-4 px-4 py-3">
									<div className="min-w-0 flex-1">
										<p className="truncate font-display text-sm text-ink">{describeSelection(item.selection, t)}</p>
										<p className="mt-0.5 text-xs text-ink-muted">{subtitle(item.selection)}</p>
									</div>
									<span className="shrink-0 font-display text-ink">{price !== null ? money(price) : '—'}</span>
									<button
										type="button"
										onClick={() => remove(item.id)}
										aria-label={t('cart.remove')}
										title={t('cart.remove')}
										className="shrink-0 px-1 text-lg leading-none text-white/50 hover:text-pink-400"
									>
										×
									</button>
								</li>
							);
						})}
					</ul>

					<div className="glass-panel-sm border-neon-pink shadow-neon-pink space-y-3 p-4">
						<div className="flex items-baseline justify-between">
							<span className="text-ink-soft">{t('common.total')}</span>
							<span className="font-display text-2xl text-ink">{money(total)}</span>
						</div>
						<Button variant="primary" size="lg" className="w-full" disabled disabledReason={t('cart.paySoon')}>
							{t('common.payFor', { price: money(total) })}
						</Button>
						<p className="text-center text-xs text-ink-muted">{t('cart.paySoon')}</p>
						<button type="button" onClick={clear} className="mx-auto block text-xs text-white/50 underline-offset-4 hover:text-pink-400 hover:underline">
							{t('cart.clear')}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
