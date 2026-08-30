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
