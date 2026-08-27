import Link from 'next/link';
import { getProductsBySection } from '@/lib/catalog';
import { getTranslations } from '@/lib/i18n/getTranslations';

/** Catalogue of digital codes. */
export default async function StorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();
  const products = getProductsBySection('store');

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('nav.store')}</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/${locale}/product/${p.slug}`}
            className="group glass-panel p-5 transition hover:border-neon-blue/60 hover:shadow-neon-blue"
          >
            <img src={p.illustration} alt="" className="h-32 w-full object-contain" />
            <h2 className="mt-3 text-balance font-display text-lg group-hover:text-neon-blue">
              {t(p.titleKey)}
            </h2>
            <p className="mt-1 text-xs text-white/60">{t(p.summaryKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
