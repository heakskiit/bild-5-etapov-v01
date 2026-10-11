/**
 * POST /api/orders/pay-link -- BATCH F14 (FEAT-PAY-026), the "Pay" button on
 * an order that is still waiting for payment.
 *
 * Telegram not opening, a closed tab, a dead phone: the order exists, the
 * invoice exists, and until now there was no way back to it. This hands the
 * same invoice back, and once that invoice has lapsed it issues a new one for
 * the same amount rather than making the customer order again.
 *
 * Nothing about the order changes: same rows, same prices, same promo code,
 * same cart_id. Only the invoice is renewed, so no new order can be smuggled
 * in through this route and the volume limits stay untouched.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { createInvoice, INVOICE_TTL_SECONDS } from '@/lib/pricing/cryptobot';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { sumMoney } from '@/lib/cart/cartCheckout';

export const runtime = 'nodejs';

/** A link about to lapse is worse than no link: the tab opens on a dead page. */
const MIN_REMAINING_SECONDS = 120;

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Shares the checkout bucket: reissuing is creating an invoice.
  const verdict = await consumeRateLimit('checkout', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const { orderId } = ((await request.json().catch(() => null)) ?? {}) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, public_id, user_id, status, cart_id, total_usd, pay_url, invoice_expires_at, selection')
    .eq('public_id', orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (order.status !== 'awaiting_payment') {
    // Already paid, already cancelled: either way there is nothing to pay.
    return NextResponse.json({ error: 'not_payable', status: order.status }, { status: 409 });
  }

  try {
    // One invoice covers a whole cart (F12), so the whole cart is renewed
    // together -- otherwise the other rows would point at a dead invoice.
    let group = [order];
    if (order.cart_id) {
      const { data: siblings, error: groupError } = await db
        .from('orders')
        .select('id, public_id, total_usd')
        .eq('cart_id', order.cart_id)
        .eq('user_id', user.id)
        .eq('status', 'awaiting_payment');
      if (groupError) throw groupError;
      if (siblings && siblings.length > 0) group = siblings as typeof group;
    }

    const expiresAt = order.invoice_expires_at ? Date.parse(order.invoice_expires_at) : 0;
    const stillPayable = Number.isFinite(expiresAt) && expiresAt - Date.now() > MIN_REMAINING_SECONDS * 1000;
    if (order.pay_url && stillPayable) {
      return NextResponse.json({ payUrl: order.pay_url, reissued: false });
    }

    const amount = sumMoney(group.map((o) => o.total_usd));
    const isCart = Boolean(order.cart_id) && group.length > 1;
    const invoice = await createInvoice({
      amount,
      description: isCart
        ? `Cart: ${group.length} items (${group.map((o) => o.public_id).join(', ')})`.slice(0, 1024)
        : `Order ${order.public_id}`,
      payload: order.cart_id ? `cart:${order.cart_id}` : order.public_id,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/${order.selection?.locale ?? 'en'}/dashboard/orders`,
    });

    const { error: writeError } = await db
      .from('orders')
      .update({
        invoice_id: invoice.invoice_id,
        pay_url: invoice.pay_url,
        invoice_expires_at: new Date(Date.now() + INVOICE_TTL_SECONDS * 1000).toISOString(),
      })
      .in(
        'id',
        group.map((o) => o.id),
      );
    if (writeError) throw writeError;

    // The webhook finds orders by invoice_id, so a reissue that was not
    // recorded would be unexplainable later. Never fatal: the customer
    // already has a working link by this point.
    await db.from('order_events').insert(
      group.map((o) => ({
        order_id: o.id,
        kind: 'invoice_reissued',
        detail: { invoice_id: invoice.invoice_id, amount, cart_id: order.cart_id ?? null },
      })),
    );

    return NextResponse.json({ payUrl: invoice.pay_url, reissued: true });
  } catch (err) {
    console.error('[orders/pay-link]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
