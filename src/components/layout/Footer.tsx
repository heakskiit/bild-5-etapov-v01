import Link from 'next/link';
import { Disclaimer } from './Disclaimer';
import { LocaleSwitcher } from './LocaleSwitcher';
import { CATALOG } from '@/lib/catalog';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { BtcIcon, EthIcon, UsdtIcon, TonIcon } from '@/components/ui/icons';

/**
 * §4.2 point 9 (originally): "Четыре колонки: Магазин · Услуги · Компания ·
 * Поддержка." Since the GTA V / GTA VI restructure, Shop and Services were
 * both just `section: 'store' | 'coop'` slices of the same GTA V catalog —
 * now that GTA V is its own top-level section in the header, splitting it
 * two ways here just duplicates that grouping under a different name.
 * Merged into one GTA V column instead (three columns total). GTA VI stays
 * header-only for now — it has no real links yet, so a footer column would
 * be a heading over a single "Coming Soon", not worth the row.
 *
 * The GTA V column still reads straight from the catalog's `game: 'gta5'`
 * entries rather than a hand-typed link list, so a new product shows up
 * here automatically instead of silently missing from the footer.
 */
export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations();

  const gta5Links = CATALOG.filter((p) => p.game === 'gta5');

  const columns: { key: string; heading: string; links: { href: string; label: string }[] }[] = [
    {
      key: 'gta5',
      heading: t('nav.gta5'),
      links: gta5Links.map((p) => ({ href: `/${locale}/product/${p.slug}`, label: t(p.titleKey) })),
    },
    {
      key: 'company',
      heading: t('footer.companyColumn'),
      links: [
        { href: `/${locale}/about`, label: t('nav.about') },
        { href: `/${locale}/legal/terms`, label: t('footer.terms') },
        { href: `/${locale}/legal/privacy`, label: t('footer.privacy') },
      ],
    },
    {
      key: 'support',
      heading: t('footer.supportColumn'),
      links: [
        { href: `/${locale}/support`, label: t('common.support') },
        { href: `/${locale}/legal/refund`, label: t('footer.refund') },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-white/10 bg-night px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.key}>
              <p className="font-display text-xs uppercase tracking-widest text-ink-muted">{col.heading}</p>
              <ul className="mt-3 space-y-2 text-sm text-white/60">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.key === 'support' && (
                  <li>
                    <a
                      href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-blue hover:text-cyan-400"
                    >
                      {t('common.joinDiscord')}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* §4.2 point 9: mandatory standalone legal block, own border. */}
        <Disclaimer />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-ink-muted">
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-display font-semibold text-ink-soft">
              {t('footer.ageNotice')}
            </span>
            <span>
              © {new Date().getFullYear()} {t('footer.copyright')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="sr-only">{t('footer.paymentMethods')}</span>
            <div className="flex items-center gap-2 text-ink-muted" aria-hidden="true" title={t('footer.paymentMethods')}>
              <BtcIcon className="h-5 w-5" />
              <EthIcon className="h-5 w-5" />
              <UsdtIcon className="h-5 w-5" />
              <TonIcon className="h-5 w-5" />
            </div>
            <LocaleSwitcher current={locale} />
          </div>
        </div>
      </div>
    </footer>
  );
}
