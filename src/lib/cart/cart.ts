/**
 * BATCH F11 (FEAT-CART-022): the shopping cart, pure logic only.
 *
 * The cart lives in the customer's browser (localStorage) and holds nothing
 * but `OrderSelection`s -- the same shape /api/checkout already accepts. No
 * prices are stored: every price is recomputed from the selection with the
 * same `calculatePrice` the server uses, so a stale cart can never show (or
 * later submit) an old price. An item that no longer prices (pricing config
 * changed, product removed) is dropped on read instead of breaking the page.
 *
 * Paying for the whole cart with one invoice is BATCH F12.
 */

import type { OrderSelection, ProductKind } from '@/types/order';
import { calculatePrice } from '@/lib/pricing/calculate';

export const CART_STORAGE_KEY = 'nd_cart_v1';
export const MAX_CART_ITEMS = 10;

const PRODUCTS: readonly ProductKind[] = ['shark_card', 'leveling', 'money'];

export interface CartItem {
  id: string;
  selection: OrderSelection;
  addedAt: number;
}

export type AddResult =
  | { ok: true; items: CartItem[] }
  | { ok: false; reason: 'full' | 'invalid'; items: CartItem[] };

/** Local price of one selection, or null when it cannot be priced. */
export function priceOf(selection: OrderSelection): number | null {
  try {
    const { total } = calculatePrice(selection);
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const sel = v.selection as Record<string, unknown> | null | undefined;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.addedAt === 'number' &&
    Number.isFinite(v.addedAt) &&
    !!sel &&
    typeof sel === 'object' &&
    PRODUCTS.includes(sel.product as ProductKind)
  );
}

/** Never throws: anything malformed reads as an empty / shorter cart. */
export function parseCart(raw: string | null | undefined): CartItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(isCartItem)
      .filter((item) => priceOf(item.selection) !== null)
      .slice(0, MAX_CART_ITEMS);
  } catch {
    return [];
  }
}

export function addItem(
  items: readonly CartItem[],
  selection: OrderSelection,
  id: string,
  now: number,
): AddResult {
  const current = [...items];
  if (priceOf(selection) === null) return { ok: false, reason: 'invalid', items: current };
  if (current.length >= MAX_CART_ITEMS) return { ok: false, reason: 'full', items: current };
  // Deep copy: the configurator keeps mutating its own selection state.
  const copy = JSON.parse(JSON.stringify(selection)) as OrderSelection;
  return { ok: true, items: [...current, { id, selection: copy, addedAt: now }] };
}

export function removeItem(items: readonly CartItem[], id: string): CartItem[] {
  return items.filter((item) => item.id !== id);
}

/** Sum of local prices, rounded to cents. */
export function cartTotal(items: readonly CartItem[]): number {
  const sum = items.reduce((acc, item) => acc + (priceOf(item.selection) ?? 0), 0);
  return Math.round(sum * 100) / 100;
}
