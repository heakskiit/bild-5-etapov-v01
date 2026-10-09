/**
 * BATCH F13 (FEAT-CART-025): orders that were paid as one cart belong
 * together on screen. Pure so it is tested without a database.
 *
 * Order is preserved: a group sits where its first (newest, given the page's
 * sort) order appears. Orders without cart_id stay single.
 */

export type CartGroupable = { cart_id?: string | null; total_usd?: string | number | null };

export type OrderUnit<T> =
  | { kind: 'single'; order: T }
  | { kind: 'cart'; cartId: string; orders: T[]; totalUsd: number };

export function groupByCart<T extends CartGroupable>(rows: readonly T[]): OrderUnit<T>[] {
  const units: OrderUnit<T>[] = [];
  const byCart = new Map<string, Extract<OrderUnit<T>, { kind: 'cart' }>>();

  for (const row of rows) {
    const cartId = row.cart_id ?? null;
    if (!cartId) {
      units.push({ kind: 'single', order: row });
      continue;
    }
    let unit = byCart.get(cartId);
    if (!unit) {
      unit = { kind: 'cart', cartId, orders: [], totalUsd: 0 };
      byCart.set(cartId, unit);
      units.push(unit);
    }
    unit.orders.push(row);
    unit.totalUsd = Math.round((unit.totalUsd + (Number(row.total_usd) || 0)) * 100) / 100;
  }

  // A "cart" of one (the rest filtered away, e.g. cancelled) is just an order.
  return units.map((u) => (u.kind === 'cart' && u.orders.length === 1 ? { kind: 'single', order: u.orders[0] } : u));
}

/** Short, human-readable cart label: the first 4 hex digits, uppercased. */
export function shortCartId(cartId: string): string {
  return cartId.replace(/-/g, '').slice(0, 4).toUpperCase();
}
