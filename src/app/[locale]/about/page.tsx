import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Trust page: safety guarantees and the legality story for the keys we resell.
 * Copy here is legally load-bearing — route changes through review. That
 * includes these translations: DE/FR/ES/RU below are a faithful rendering
 * of the same English claims, not new copy, but a legal/compliance read
 * before shipping is still worth it precisely because it IS load-bearing.
 */
export default async function AboutPage() {
  const t = await getTranslations();

  return (
    <div className="prose prose-invert max-w-3xl">
      <h1 className="font-display text-3xl text-neon-pink">{t('about.title')}</h1>

      <h2>{t('about.safety.heading')}</h2>
      <p>{t('about.safety.body')}</p>

      <h2>{t('about.codes.heading')}</h2>
      <p>{t('about.codes.body')}</p>

      <h2>{t('about.payments.heading')}</h2>
      <p>{t('about.payments.body')}</p>

      <h2>{t('about.credentials.heading')}</h2>
      <p>{t('about.credentials.body')}</p>
    </div>
  );
}
