import { SafetyWidget } from '@/components/product/SafetyWidget';
import { ProductFaq } from '@/components/product/ProductFaq';
import { ProductIllustration } from '@/components/product/ProductIllustration';
import { BoostConfigurator } from '@/components/configurators/BoostConfigurator';
import { SharkCardConfigurator } from '@/components/configurators/SharkCardConfigurator';
import { getProductBySlug } from '@/lib/catalog';
import { getMessages } from '@/lib/i18n/getTranslations';
import { dig } from '@/lib/i18n/pick';
import { getSharkCardStock } from '@/lib/keys/googleSheets';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { notFound } from 'next/navigation';

/**
 * The dynamic product card. Two columns:
 *   left  — illustration, safety widget, FAQ spoilers (composed, independent)
 *   right — the configurator chosen by product kind
 * Every block is an isolated component so a new product only needs a catalog
 * entry plus (optionally) a new configurator.
 */
export default async function ProductPage({
	params,
}: {
	params: Promise<{ locale: string; slug: string }>;
}) {
	const { slug } = await params;
	const product = getProductBySlug(slug);
	if (!product) notFound();

	const messages = await getMessages();
	const t = (key: string) => dig(messages, key);

	return (
		<article className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
			<aside className="space-y-4">
				<ProductIllustration src={product.illustration} title={t(product.titleKey)} />
				<SafetyWidget gameVersion={product.gameVersion} />
				<ProductFaq />
			</aside>

			<section className="space-y-5">
				<div>
					<h1 className="font-display text-3xl text-neon-pink">{t(product.titleKey)}</h1>
					<p className="mt-2 max-w-prose text-sm text-white/70">{t(product.summaryKey)}</p>
				</div>

				{product.kind === 'shark_card' ? (
					<SharkCardConfigurator messages={messages} stock={await getSharkCardStock(SHARK_CARDS.map((c) => c.sheetSku))} />
				) : (
					<BoostConfigurator product={product.kind} messages={messages} />
				)}
			</section>
		</article>
	);
}
