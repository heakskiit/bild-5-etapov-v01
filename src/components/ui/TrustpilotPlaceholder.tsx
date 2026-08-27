import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Static 4.8/5 block for the MVP. `reviewsUrl` and `businessUnitId` are the
 * only inputs a future Trustpilot Business API call will need, so swapping the
 * data source later does not touch layout.
 */
export async function TrustpilotPlaceholder({ rating = 4.8 }: { rating?: number }) {
  const t = await getTranslations();
  const filled = Math.round(rating);

  return (
    <section
      aria-label="Customer rating"
      className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-surface/50 px-6 py-4"
      data-trustpilot-placeholder="true"
    >
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={i < filled ? 'text-neon-blue drop-shadow' : 'text-white/20'}
          >
            ★
          </span>
        ))}
      </div>
      <span className="font-display text-sm text-white/80">{t('home.trustpilotRating', { rating })}</span>
      <span className="text-xs text-white/40">(placeholder — API integration pending)</span>
    </section>
  );
}
