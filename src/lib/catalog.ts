import type { ProductKind } from '@/types/order';

/**
 * Catalog metadata (art, slugs, structure) — deliberately separate from
 * pricing.config.ts so the owner can change prices without touching content
 * and vice versa.
 *
 * `titleKey`/`summaryKey` point into messages/*.json (`catalog.*`) instead of
 * holding English text directly — this was the one piece of product content
 * that stayed hardcoded through the whole localization pass, since nothing
 * reading `.title` here had ever needed anything but English before. Look
 * the text up with `t(entry.titleKey)` / `t(entry.summaryKey)`.
 */
export interface CatalogEntry {
  slug: string;
  kind: ProductKind;
  titleKey: string;
  summaryKey: string;
  illustration: string;
  gameVersion: string;
  section: 'store' | 'coop';
  /** Which numbered title this product belongs to — the new GTA V / GTA VI
   *  top-level split. Separate from `gameVersion` (a patch string like
   *  '1.70') on purpose: one is "which game", the other is "which patch of
   *  that game", and conflating them would make both harder to read. */
  game: 'gta5' | 'gta6';
}

export const CATALOG: CatalogEntry[] = [
  {
    slug: 'leveling-boost',
    kind: 'leveling',
    titleKey: 'catalog.levelingBoost.title',
    summaryKey: 'catalog.levelingBoost.summary',
    illustration: '/illustrations/level-up.svg',
    gameVersion: '1.70',
    section: 'coop',
    game: 'gta5',
  },
  {
    slug: 'money-boost',
    kind: 'money',
    titleKey: 'catalog.moneyBoost.title',
    summaryKey: 'catalog.moneyBoost.summary',
    illustration: '/illustrations/money-drop.svg',
    gameVersion: '1.70',
    section: 'coop',
    game: 'gta5',
  },
  {
    slug: 'cash-cards',
    kind: 'shark_card',
    titleKey: 'catalog.cashCards.title',
    summaryKey: 'catalog.cashCards.summary',
    illustration: '/illustrations/cash-card.svg',
    gameVersion: '1.70',
    section: 'store',
    game: 'gta5',
  },
];

export const getProductBySlug = (slug: string) => CATALOG.find((p) => p.slug === slug);
export const getProductsBySection = (section: CatalogEntry['section']) =>
  CATALOG.filter((p) => p.section === section);
export const getProductsByGame = (game: CatalogEntry['game']) =>
  CATALOG.filter((p) => p.game === game);
