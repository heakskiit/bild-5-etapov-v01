import Link from 'next/link';
import { ProductIllustration } from '@/components/product/ProductIllustration';
import type { CatalogEntry } from '@/lib/catalog';
import { startingPrice } from '@/lib/pricing/startingPrice';

/**
 * §4.2 point 4: illustration (per-product, not shared — the doc calls out
 * Money Boost currently using Leveling's art as a named bug; ProductIllustration
 * already reads `src` per entry so that can't happen here), name, one line
 * of benefit, price "от", a "Настроить" CTA. Hover: lift 4px + glow-pink-sm.
 *
 * No stock badge (§4.2 also mentions "плашка наличия") — that concept only
 * really applies to Cash Cards (a finite code inventory); Leveling/Money are
 * booster labour, not stock. Wiring a real stock check for the Cash Cards
 * card specifically is the same gap noted in ProductPreviewCard.tsx.
 */
export function ProductCard({
	product,
	locale,
	t,
}: {
	product: CatalogEntry;
	locale: string;
	t: (key: string) => string;
}) {
	return (
		<Link
			href={`/${locale}/product/${product.slug}`}
			className="group glass-panel flex flex-col p-0 transition-transform duration-150 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:border-pink-500 hover:shadow-glow-pink"
		>
			<ProductIllustration src={product.illustration} title={t(product.titleKey)} />
			<div className="flex flex-1 flex-col p-5">
				<p className="text-sm text-ink-soft">{t(product.summaryKey)}</p>
				<div className="mt-4 flex flex-1 items-end justify-between gap-3">
					<p className="tabular-nums text-ink">
						<span className="text-xs text-ink-muted">{t('home.popular.priceFrom')} </span>
						<span className="font-display text-xl">${startingPrice(product.kind).toFixed(2)}</span>
					</p>
					<span className="rounded-md border border-pink-500/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-pink-400 transition-colors group-hover:bg-pink-500 group-hover:text-[var(--text-on-accent)]">
						{t('home.popular.configureCta')}
					</span>
				</div>
			</div>
		</Link>
	);
}
