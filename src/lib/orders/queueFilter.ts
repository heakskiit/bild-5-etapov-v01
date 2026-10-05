/**
 * What the booster board may show (BATCH F7 / FIX-QUEUE-018).
 *
 * The queue page used to rely on RLS alone. For a modder that is exact:
 * `modder_queue_select` (0002) only exposes paid service orders. But RLS
 * policies are OR-ed, and an admin also matches `admin_select_all_orders`,
 * so an admin's board listed every order in the database — unpaid,
 * completed, cash cards — and offered "claim" on unpaid ones.
 *
 * The page now asks for exactly the same slice the modder policy allows,
 * for every role. Admins still change any order from the admin page; this
 * only keeps the board honest.
 */

/** Products a booster works on. Cash cards are fulfilled from stock, never queued. */
export const QUEUE_PRODUCTS = ['leveling', 'money'] as const;

/** Paid and waiting for a booster, or being worked on. */
export const QUEUE_STATUSES = ['action_required', 'in_progress'] as const;

export type QueueCandidate = {
  status: string | null | undefined;
  selection: unknown;
};

/** Same predicate as the `modder_queue_select` policy, as a pure check. */
export function isQueueOrder(order: QueueCandidate): boolean {
  const product = (order.selection as { product?: unknown } | null | undefined)?.product;
  return (
    typeof product === 'string' &&
    (QUEUE_PRODUCTS as readonly string[]).includes(product) &&
    typeof order.status === 'string' &&
    (QUEUE_STATUSES as readonly string[]).includes(order.status)
  );
}
