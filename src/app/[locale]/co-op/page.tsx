import Link from 'next/link';
import { getProductsBySection } from '@/lib/catalog';
import { getTranslations } from '@/lib/i18n/getTranslations';

/** Co-op & boost services (piloted and play-together). */
export default async function CoopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('nav.coop')}</h1>
      <p className="mt-2 max-w-prose text-sm text-white/70">{t('coop.intro')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {getProductsBySection('coop').map((p) => (
          <Link
            key={p.slug}
            href={`/${locale}/product/${p.slug}`}
            className="glass-panel p-5 transition hover:border-neon-pink/60 hover:shadow-neon-pink"
          >
            <img src={p.illustration} alt="" className="h-32 w-full object-contain" />
            <h2 className="mt-3 text-balance font-display text-lg">{t(p.titleKey)}</h2>
            <p className="mt-1 text-xs text-white/60">{t(p.summaryKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
