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
}

export const CATALOG: CatalogEntry[] = [
  {
    slug: 'cash-cards',
    kind: 'shark_card',
    titleKey: 'catalog.cashCards.title',
    summaryKey: 'catalog.cashCards.summary',
    illustration: '/illustrations/cash-card.svg',
    gameVersion: '1.70',
    section: 'store',
  },
  {
    slug: 'leveling-boost',
    kind: 'leveling',
    titleKey: 'catalog.levelingBoost.title',
    summaryKey: 'catalog.levelingBoost.summary',
    illustration: '/illustrations/level-up.svg',
    gameVersion: '1.70',
    section: 'coop',
  },
  {
    slug: 'money-boost',
    kind: 'money',
    titleKey: 'catalog.moneyBoost.title',
    summaryKey: 'catalog.moneyBoost.summary',
    illustration: '/illustrations/money-drop.svg',
    gameVersion: '1.70',
    section: 'coop',
  },
];

export const getProductBySlug = (slug: string) => CATALOG.find((p) => p.slug === slug);
export const getProductsBySection = (section: CatalogEntry['section']) =>
  CATALOG.filter((p) => p.section === section);
