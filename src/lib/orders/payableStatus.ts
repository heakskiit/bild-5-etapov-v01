/**
 * Which orders a confirmed CryptoBot payment may still settle (BATCH F8 /
 * FIX-PAY-019).
 *
 * 0015 auto-cancels orders left in `awaiting_payment` for STALE_ORDER_HOURS.
 * A CryptoBot invoice expires after one hour (lib/pricing/cryptobot.ts), so
 * a payment after that should be impossible. If one ever arrives anyway, the
 * customer has paid real money: dropping it as "already processed" would
 * lose it silently. So an auto-cancelled order stays payable and is fulfilled
 * exactly like a fresh one, with a `paid_after_cancel` event for the admin.
 *
 * `cancelled` is reachable only through 0015: the dashboard status route
 * cannot set it (lib/validation/dashboard.ts).
 */

/** Must match the interval in 0015_cancel_stale_orders.sql. */
export const STALE_ORDER_HOURS = 2;

export const PAYABLE_STATUSES = ['awaiting_payment', 'cancelled'] as const;

export function isPayableStatus(status: unknown): boolean {
  return typeof status === 'string' && (PAYABLE_STATUSES as readonly string[]).includes(status);
}

/** True when the payment revives an order the database already cancelled. */
export function isPaidAfterCancel(status: unknown): boolean {
  return status === 'cancelled';
}
