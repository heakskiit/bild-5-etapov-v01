/**
 * POST /api/checkout
 * Accepts a selection of IDs, recomputes the price, creates the order, then
 * asks CryptoBot for an invoice. The client receives only the pay URL.
 */

import { NextResponse } from 'next/server';
import { calculatePrice, PricingError } from '@/lib/pricing/calculate';
import { checkoutRequestSchema } from '@/lib/validation/order';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { createInvoice } from '@/lib/pricing/cryptobot';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    console.warn('[checkout] rejected: no session on the request');
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Zod strips unknown keys — a client-supplied `price` cannot survive this.
  const parsed = checkoutRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_selection', issues: parsed.error.issues }, { status: 400 });
  }
  const { selection, contactMethod, contactHandle } = parsed.data;

  try {
    const breakdown = calculatePrice(selection);
    const db = serviceClient();

    const { data: order, error } = await db
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'awaiting_payment',
        selection,
        total_usd: breakdown.total,
        booster_payout_usd: breakdown.boosterPayout,
        pricing_version: breakdown.pricingVersion,
        // Single free-text column (0001) — method is folded into the string
        // itself ("telegram: @handle") so notifyBoosters/the dashboard don't
        // need a second field to read.
        contact_handle: `${contactMethod}: ${contactHandle}`,
      })
      .select()
      .single();
    if (error) throw error;

    const invoice = await createInvoice({
      amount: breakdown.total,
      description: `Order ${order.public_id}`,
      payload: order.public_id,
    });

    await db.from('orders').update({ invoice_id: invoice.invoice_id }).eq('id', order.id);

    return NextResponse.json({ payUrl: invoice.pay_url, orderId: order.public_id });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
