/**
 * Support requests raised from an order card (BATCH F15 / FEAT-SUP-027).
 *
 * Client-safe on purpose: the order card (a client component) and the API
 * routes share these lists and rules, so the button can never offer what the
 * server would refuse.
 */

import { z } from 'zod';

export const SUPPORT_REASONS = [
  'payment_not_confirmed',
  'queue_too_long',
  'credentials_help',
  'item_not_received',
  'cancel_refund',
  'other',
] as const;

export type SupportReason = (typeof SUPPORT_REASONS)[number];

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_MESSAGE_MAX = 500;
export const SUPPORT_REPLY_MAX = 2000;

/** A cancelled order is help-worthy for a week ("why was it cancelled?"), then it is history. */
export const CANCELLED_HELP_DAYS = 7;

/** What the order card needs to know about the latest request on an order. */
export type SupportSummary = {
  publicId: string;
  reason: SupportReason;
  message: string | null;
  status: SupportStatus;
  reply: string | null;
  repliedAt: string | null;
  replySeenAt: string | null;
  createdAt: string;
};

export const createSupportSchema = z
  .object({
    orderId: z.string().trim().min(1).max(40),
    reason: z.enum(SUPPORT_REASONS),
    message: z.string().trim().max(SUPPORT_MESSAGE_MAX).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // "Other" without a word of explanation tells support nothing at all.
    if (value.reason === 'other' && !value.message) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'required' });
    }
  });

export const adminSupportUpdateSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    status: z.enum(SUPPORT_STATUSES),
    reply: z.string().trim().max(SUPPORT_REPLY_MAX).optional(),
  })
  .strict();

/** May the customer raise a new request on this order right now? */
export function canRequestHelp(status: unknown, createdAt: unknown, now: number = Date.now()): boolean {
  if (typeof status !== 'string') return false;
  if (status !== 'cancelled') return true;
  if (typeof createdAt !== 'string') return false;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created < CANCELLED_HELP_DAYS * 24 * 3600 * 1000;
}

/** Drives the "Has reply" badge: an answer exists that the customer has not opened. */
export function hasUnseenReply(request: Pick<SupportSummary, 'reply' | 'replySeenAt'> | null | undefined): boolean {
  return Boolean(request?.reply) && !request?.replySeenAt;
}
