/**
 * Pure helpers for the key warehouse (BATCH F5 / FIX-PAY-016).
 *
 * Two mistakes used to hide here:
 *  - the webhook asked the vault for the internal card id (`sc_100k`) while
 *    the KEYS sheet, the storefront and the admin stock page all use the
 *    sheet SKU (`SHARK_100K`) — so a paid card could never be found;
 *  - any vault reply without a stock figure (a wrong URL answering
 *    `{"ok":true,"row":190}`, or `{"ok":false,"error":"unauthorized"}`)
 *    was read as "0 left", which looked exactly like an empty warehouse.
 *
 * Both decisions live here, with no network and no database, so they can be
 * unit-tested.
 */

import { SHARK_CARDS } from '@/../config/pricing.config';

/** Sheet SKU for a cash-card variant id, or null if the id is unknown. */
export function sheetSkuForVariant(variantId: unknown): string | null {
  if (typeof variantId !== 'string') return null;
  const card = SHARK_CARDS.find((c) => c.id === variantId);
  return card ? card.sheetSku : null;
}

/**
 * Reads a vault `stock` reply. Only `{ ok: true, remaining: <whole number ≥ 0> }`
 * counts; anything else throws, so callers treat it as "vault unavailable"
 * instead of "sold out".
 */
export function parseStockResponse(data: unknown, sku: string): number {
  const body = (data ?? {}) as { ok?: unknown; remaining?: unknown };
  const remaining = body.remaining;
  if (
    body.ok !== true ||
    typeof remaining !== 'number' ||
    !Number.isInteger(remaining) ||
    remaining < 0
  ) {
    const preview = String(JSON.stringify(data)).slice(0, 120);
    throw new Error(`Key vault gave no stock figure for ${sku}: ${preview}`);
  }
  return remaining;
}
