/**
 * POST /api/orders/confirm -- BATCH F18 (FEAT-ORD-030), "I received it".
 *
 * Sets orders.customer_confirmed_at. Nothing else: the status, payouts and
 * the Sheets mirror do not depend on it. Safe to press twice -- the update is
 * guarded by "customer_confirmed_at is null".
 *
 * A cart is confirmed as one purchase: every order of that cart that belongs
 * to this customer and is ready (completed; a code only once opened) is
 * marked. Orders still in work are left alone and get their own button later.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { canConfirmReceipt, confirmReceiptSchema } from '@/lib/orders/confirmReceipt';

export const runtime = 'nodejs';

const COLUMNS = 'id, public_id, user_id, status, selection, cart_id, customer_confirmed_at';

type Row = {
  id: string;
  public_id: string;
  user_id: string;
  status: string;
  selection: { product?: string } | null;
  cart_id: string | null;
  customer_confirmed_at: string | null;
};

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const verdict = await consumeRateLimit('confirmReceipt', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const parsed = confirmReceiptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const db = serviceClient();
  try {
    const { data: order } = await db.from('orders').select(COLUMNS).eq('public_id', parsed.data.orderId).maybeSingle<Row>();
    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    let rows: Row[] = [order];
    if (order.cart_id) {
      const { data } = await db.from('orders').select(COLUMNS).eq('cart_id', order.cart_id).eq('user_id', user.id);
      if (data && data.length > 0) rows = data as Row[];
    }

    const isCode = (r: Row) => r.selection?.product === 'shark_card';
    const revealed = new Map<string, string>();
    const codeIds = rows.filter(isCode).map((r) => r.id);
    if (codeIds.length > 0) {
      const { data: codes } = await db.from('digital_codes').select('order_id, revealed_at').in('order_id', codeIds);
      for (const c of codes ?? []) if (c.revealed_at) revealed.set(c.order_id, c.revealed_at);
    }

    const targets = rows.filter((r) =>
      canConfirmReceipt({
        status: r.status,
        isCode: isCode(r),
        revealedAt: revealed.get(r.id) ?? null,
        confirmedAt: r.customer_confirmed_at,
      }),
    );

    if (targets.length === 0) {
      // Already confirmed: report success, a double click is not an error.
      if (order.customer_confirmed_at) {
        return NextResponse.json({ confirmed: [], confirmedAt: order.customer_confirmed_at });
      }
      return NextResponse.json({ error: 'not_ready' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await db
      .from('orders')
      .update({ customer_confirmed_at: now })
      .in('id', targets.map((r) => r.id))
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .is('customer_confirmed_at', null)
      .select('id, public_id');
    if (error) throw error;

    const done = updated ?? [];
    if (done.length > 0) {
      await db.from('order_events').insert(
        done.map((r) => ({
          order_id: r.id,
          kind: 'customer_confirmed',
          detail: { cart: order.cart_id ?? null, via: order.public_id },
        })),
      );
    }

    // BATCH F16 hook: a Discord DM "thanks / leave a review" can go here.

    return NextResponse.json({ confirmed: done.map((r) => r.public_id), confirmedAt: now });
  } catch (err) {
    console.error('[orders/confirm]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
