import { z } from 'zod';

export const claimOrderSchema = z.object({
  orderId: z.string().min(1),
}).strict();

/**
 * Modders can only ever move a claimed job forward through this subset —
 * 'awaiting_payment' and 'cancelled'/'refunded' are not reachable from here,
 * those are payment/webhook-owned states.
 */
export const jobStatusSchema = z.object({
  status: z.enum(['in_progress', 'action_required', 'completed']),
}).strict();

export const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ghost', 'modder', 'admin']),
}).strict();

/**
 * Promo codes are admin-issued only (PROMO-7).
 *
 * The form offers percent codes and X2 bonus codes. fixed_usd still exists
 * in the enum, but MAX_DISCOUNT_SHARE caps any amount at 20% of the order, so
 * a fixed code would silently grant less than it claims on small baskets --
 * a support ticket waiting to happen.
 *
 * An X2 code carries no percent at all: it never touches the price, it
 * doubles what the booster delivers (PROMO-10). discountValue is therefore
 * optional and required only for percent codes -- checked below rather than
 * defaulted, so a malformed request is refused instead of quietly becoming a
 * 1% code.
 */
export const createPromoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Uppercase letters, digits and dashes only'),
  kind: z.enum(['percent', 'bonus_x2']).default('percent'),
  // Whole percents, never above the ceiling that percent_in_range (0007) and
  // MAX_DISCOUNT_SHARE already enforce independently of each other.
  // Meaningless for a bonus code, hence optional.
  discountValue: z.number().int().min(1).max(20).optional(),
  // 0 means no threshold, which is how every pre-0011 code behaves.
  minOrderUsd: z.number().min(0).max(100000),
  expiresAt: z.string().datetime().nullable().optional(),
  reservedForUserId: z.string().uuid().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'percent' && value.discountValue === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'discountValue is required for percent codes',
    });
  }
});

/** Codes are switched off, never deleted: a spent code is the only record of
 *  what a discount on a paid order was for. */
export const togglePromoSchema = z.object({
  id: z.number().int().positive(),
  active: z.boolean(),
}).strict();
