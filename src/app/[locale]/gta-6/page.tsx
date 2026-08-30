import { CATALOG } from '@/lib/catalog';
import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * GTA VI — same three subsections as GTA V (Level Boost / Money / Shark
 * Cards), reusing GTA V's titleKey/illustration for each so the category
 * labels stay identical across both games. No CatalogEntry exists with
 * `game: 'gta6'` yet — these are static stub cards, not real products, so
 * there's deliberately no href here; wiring one to a real /product/[slug]
 * before that product exists would just be a fresh dead link.
 */
const STUB_KINDS = ['leveling', 'money', 'shark_card'] as const;

export default async function Gta6Page() {
  const t = await getTranslations();
  const stubs = STUB_KINDS.map((kind) => CATALOG.find((p) => p.kind === kind && p.game === 'gta5')!);

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('nav.gta6')}</h1>
      <p className="mt-2 max-w-prose text-sm text-white/70">{t('gta.gta6Intro')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stubs.map((p) => (
          <div
            key={p.slug}
            aria-disabled="true"
            className="glass-panel relative overflow-hidden p-5 opacity-60"
          >
            <span className="absolute right-3 top-3 rounded-full border border-neon-pink/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-pink-300">
              {t('gta.comingSoon')}
            </span>
            <img src={p.illustration} alt="" className="h-32 w-full object-contain grayscale" />
            <h2 className="mt-3 text-balance font-display text-lg">{t(p.titleKey)}</h2>
            <p className="mt-1 text-xs text-white/60">{t(p.summaryKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
