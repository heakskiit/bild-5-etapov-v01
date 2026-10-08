/**
 * BATCH F12 (FEAT-CART-023): pure helpers for paying a whole cart with one
 * CryptoBot invoice. Everything that decides money lives here so it is unit
 * tested; the routes only do I/O around it.
 */

import { roundMoney } from '@/../config/pricing.config';

/**
 * Splits one cart-level discount across the orders in proportion to their
 * prices, to the cent. The shares always add up to exactly `discountUsd`
 * (the rounding remainder goes to the most expensive line) and no line is
 * ever discounted below zero.
 */
export function splitDiscount(totals: readonly number[], discountUsd: number): number[] {
  const cents = Math.round(discountUsd * 100);
  const subtotal = totals.reduce((a, b) => a + b, 0);
  if (cents <= 0 || subtotal <= 0 || totals.length === 0) return totals.map(() => 0);

  const capCents = totals.map((t) => Math.round(t * 100));
  const shares = totals.map((t, i) => Math.min(capCents[i], Math.floor((cents * t) / subtotal)));
  let rest = cents - shares.reduce((a, b) => a + b, 0);

  // Hand out the leftover cents, biggest lines first, never past a line's price.
  const order = totals.map((_, i) => i).sort((a, b) => totals[b] - totals[a]);
  while (rest > 0) {
    let moved = false;
    for (const i of order) {
      if (rest === 0) break;
      if (shares[i] < capCents[i]) {
        shares[i] += 1;
        rest -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return shares.map((c) => c / 100);
}

/** Sum of order totals, rounded to cents (what the invoice must cover). */
export function sumMoney(values: readonly (number | string | null | undefined)[]): number {
  return roundMoney(values.reduce<number>((acc, v) => acc + (Number(v) || 0), 0));
}

/**
 * Number of purchases in a list of order rows: every cart counts once,
 * every standalone order counts once. Used by both checkout routes for the
 * pending and daily limits.
 */
export function countPurchases(rows: readonly { id: string; cart_id?: string | null }[]): number {
  return new Set(rows.map((r) => (r.cart_id ? `cart:${r.cart_id}` : `order:${r.id}`))).size;
}

/** How many codes of each sheet SKU the cart needs. */
export function skuDemand(skus: readonly (string | null)[]): Record<string, number> {
  const demand: Record<string, number> = {};
  for (const sku of skus) if (sku) demand[sku] = (demand[sku] ?? 0) + 1;
  return demand;
}

/**
 * First SKU the warehouse cannot cover, or null. An unknown stock map
 * (Sheets not configured / unreachable) is not a refusal: the webhook already
 * handles a failed reservation per order, exactly as for single orders.
 */
export function findShortSku(
  demand: Record<string, number>,
  stock: Record<string, number> | undefined,
): string | null {
  if (!stock) return null;
  for (const [sku, need] of Object.entries(demand)) {
    const have = stock[sku];
    if (typeof have === 'number' && Number.isFinite(have) && have < need) return sku;
  }
  return null;
}
