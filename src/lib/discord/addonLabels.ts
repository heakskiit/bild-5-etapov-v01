/**
 * Add-on names for the booster card (F21).
 *
 * The Discord embed used to print the raw catalog ids (`pc_lvl_together`),
 * which tell a booster nothing at a glance. The names come from the English
 * dictionary on purpose: the executors' channel is English whatever language
 * the customer browsed in, and a payment webhook has no customer locale to
 * follow anyway.
 */

import en from '../../../messages/en.json';
import { LEVELING_ADDONS_CONSOLE, LEVELING_ADDONS_PC } from '@/../config/pricing.config';
import { dig, type Dict } from '@/lib/i18n/pick';

const LABEL_KEYS = new Map(
  [...LEVELING_ADDONS_PC, ...LEVELING_ADDONS_CONSOLE].map((addon) => [addon.id, addon.labelKey] as const),
);

/**
 * Readable English name for one add-on id. An id the catalog does not know (an
 * order placed under an older pricing version, say) comes back unchanged: the
 * card must never hide something the customer paid for.
 */
export function addonLabel(id: string): string {
  const key = LABEL_KEYS.get(id);
  if (!key) return id;
  const name = dig(en as Dict, key);
  return name === key ? id : name;
}

/** Value of the card's "Add-ons" field: names joined by commas, a dash when none. */
export function formatAddons(ids: readonly string[] | null | undefined): string {
  return (ids ?? []).map(addonLabel).join(', ') || '—';
}
