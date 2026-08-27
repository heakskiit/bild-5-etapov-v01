import { z } from 'zod';
import {
  LEVELING_PC,
  MONEY_PC,
  SHARK_CARDS,
} from '@/../config/pricing.config';

/**
 * The trust boundary. `.strict()` makes an unexpected key (e.g. `price`) a
 * hard 400 rather than something we might accidentally read later.
 */
export const orderSelectionSchema = z
  .object({
    product: z.enum(['shark_card', 'leveling', 'money']),
    platform: z.enum(['pc', 'ps', 'xbox']),
    variantId: z.enum(SHARK_CARDS.map((c) => c.id) as [string, ...string[]]).optional(),
    level: z.number().int().min(LEVELING_PC.minLevel).max(LEVELING_PC.maxLevel).optional(),
    amountMillions: z.number().int().min(10).max(MONEY_PC.maxMillions).optional(),
    gameVersion: z.enum(['legacy', 'enhanced']).optional(),
    launcher: z.enum(['steam', 'epic', 'rockstar']).optional(),
    addonIds: z.array(z.string()).max(10).optional(),
    delivery: z.enum(['normal', 'express', 'super_express']).optional(),
    locale: z.enum(['en', 'de', 'fr', 'es', 'ru']).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.product === 'shark_card' && !value.variantId) {
      ctx.addIssue({ code: 'custom', message: 'variantId required for shark_card' });
    }
    if (value.product === 'leveling' && value.level === undefined) {
      ctx.addIssue({ code: 'custom', message: 'level required for leveling' });
    }
    if (value.product === 'money' && value.amountMillions === undefined) {
      ctx.addIssue({ code: 'custom', message: 'amountMillions required for money' });
    }
    // PC-only selectors must not arrive for consoles, and vice versa.
    if (value.platform !== 'pc' && (value.gameVersion || value.launcher)) {
      ctx.addIssue({ code: 'custom', message: 'version/launcher are PC-only' });
    }
  });

export type ValidatedSelection = z.infer<typeof orderSelectionSchema>;

/**
 * §1: contact is mandatory at checkout for every product type, not just
 * boost orders — a customer can't reach payment without it. Kept as its
 * own schema (rather than folded into orderSelectionSchema) since it's
 * about the customer, not the product being configured.
 */
export const contactMethodSchema = z.enum(['telegram', 'whatsapp', 'discord']);
export type ContactMethod = z.infer<typeof contactMethodSchema>;

/**
 * Three extra fields requested at checkout, purpose still undecided as of
 * this pass — kept as plain strings, validated and persisted the same way
 * as contactHandle (HTTPS in transit, RLS at rest, visible to the
 * customer/assigned modder/admin). NOT run through the AES credential
 * pipe — that's reserved for actual account secrets. If these turn out to
 * be account-login-shaped after all, move them there instead of loosening
 * that pipe's scope to fit them.
 */
export const orderDetailsSchema = z
  .object({
    detailOne: z.string().trim().min(1, 'required').max(200),
    detailTwo: z.string().trim().min(1, 'required').max(200),
    comment: z.string().trim().min(1, 'required').max(500),
  })
  .strict();
export type OrderDetails = z.infer<typeof orderDetailsSchema>;

export const checkoutRequestSchema = z
  .object({
    selection: orderSelectionSchema,
    contactMethod: contactMethodSchema,
    contactHandle: z.string().trim().min(2, 'contact handle too short').max(120),
    details: orderDetailsSchema,
  })
  .strict();
