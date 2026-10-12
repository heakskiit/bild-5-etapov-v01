/**
 * BATCH F18 (FEAT-ORD-030): the customer confirms an order arrived.
 *
 * Pure rules, shared by the API route, the orders page and the admin list,
 * so they are tested without a database.
 *
 *  - only a completed order can be confirmed;
 *  - a digital code only after the customer has opened it (revealed_at);
 *  - confirming twice is a no-op, never an error.
 */

import { z } from 'zod';

/** Admin filter: completed this many days ago and still not confirmed. */
export const CONFIRM_OVERDUE_DAYS = 3;

export const confirmReceiptSchema = z.object({
  orderId: z.string().trim().min(1).max(40),
});

export type ConfirmCandidate = {
  status: unknown;
  isCode: boolean;
  revealedAt?: string | null;
  confirmedAt?: string | null;
};

export function canConfirmReceipt(c: ConfirmCandidate): boolean {
  if (c.status !== 'completed') return false;
  if (c.confirmedAt) return false;
  if (c.isCode && !c.revealedAt) return false;
  return true;
}

/**
 * PostgREST returns an embedded one-to-many relation as an array, and an
 * embedded one-to-one as an object (or null). Accept either.
 */
export function revealedAtOf(digitalCodes: unknown): string | null {
  const rows = Array.isArray(digitalCodes) ? digitalCodes : digitalCodes ? [digitalCodes] : [];
  for (const row of rows as Array<{ revealed_at?: unknown }>) {
    if (typeof row?.revealed_at === 'string' && row.revealed_at) return row.revealed_at;
  }
  return null;
}

/** Completed more than `days` ago and the customer never confirmed. */
export function isConfirmOverdue(
  status: unknown,
  completedAt: unknown,
  confirmedAt: unknown,
  now: number = Date.now(),
  days: number = CONFIRM_OVERDUE_DAYS,
): boolean {
  if (status !== 'completed' || confirmedAt) return false;
  if (typeof completedAt !== 'string') return false;
  const done = Date.parse(completedAt);
  return Number.isFinite(done) && now - done > days * 24 * 3600 * 1000;
}

/** ISO moment before which a completed order counts as overdue. */
export function confirmOverdueBefore(now: number = Date.now(), days: number = CONFIRM_OVERDUE_DAYS): string {
  return new Date(now - days * 24 * 3600 * 1000).toISOString();
}
