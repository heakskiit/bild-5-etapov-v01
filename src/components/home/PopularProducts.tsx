import { CATALOG } from '@/lib/catalog';
import { ProductCard } from './ProductCard';
import { getTranslations } from '@/lib/i18n/getTranslations';

export async function PopularProducts({ locale }: { locale: string }) {
	const t = await getTranslations();

	return (
		<section>
			<h2 className="font-display text-2xl md:text-3xl">{t('home.popular.title')}</h2>
			<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{CATALOG.map((product) => (
					<ProductCard key={product.slug} product={product} locale={locale} t={t} />
				))}
			</div>
		</section>
	);
}
