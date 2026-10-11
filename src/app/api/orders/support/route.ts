/**
 * POST /api/orders/support -- BATCH F15 (FEAT-SUP-027), "Need help with this
 * order".
 *
 * The browser sends only the order number, a reason from a fixed list and an
 * optional comment. Everything support needs to act -- items, status, paid
 * time, recent events, contact -- is read here, server-side, so the customer
 * never retypes it and cannot misstate it.
 *
 * The request is saved BEFORE Discord is called: if the webhook is down the
 * request still exists, is visible in the admin list and is flagged
 * notify_failed, instead of vanishing with the failed HTTP call.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { canRequestHelp, createSupportSchema } from '@/lib/support/requests';
import { notifySupport } from '@/lib/discord/notifySupport';

export const runtime = 'nodejs';

const EVENTS_ATTACHED = 10;

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const verdict = await consumeRateLimit('supportRequest', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const parsed = createSupportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }
  const { orderId, reason, message } = parsed.data;

  const db = serviceClient();
  try {
    const { data: order } = await db
      .from('orders')
      .select('id, public_id, user_id, status, selection, total_usd, discount_usd, promo_code, paid_at, created_at, contact_handle, cart_id')
      .eq('public_id', orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!canRequestHelp(order.status, order.created_at)) {
      return NextResponse.json({ error: 'not_allowed' }, { status: 409 });
    }

    const { data: created, error: insertError } = await db
      .from('support_requests')
      .insert({ order_id: order.id, user_id: user.id, reason, message: message || null })
      .select('id, public_id, reason, message, status, reply, replied_at, reply_seen_at, created_at')
      .single();

    if (insertError) {
      // 0018's partial unique index: an open request already exists.
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'already_open' }, { status: 409 });
      }
      throw insertError;
    }

    const [{ data: events }, { data: profile }] = await Promise.all([
      db
        .from('order_events')
        .select('kind, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(EVENTS_ATTACHED),
      db.from('profiles').select('email, discord_id').eq('id', user.id).maybeSingle(),
    ]);

    // Logged on the order too, so the timeline shows when help was asked.
    await db.from('order_events').insert({
      order_id: order.id,
      kind: 'support_requested',
      detail: { request: created.public_id, reason },
    });

    try {
      await notifySupport({
        requestId: created.public_id,
        reason,
        message: message || null,
        order,
        customer: { email: profile?.email ?? user.email ?? null, discordId: profile?.discord_id ?? null },
        events: (events ?? []).reverse(),
        adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/ru/dashboard/admin/support`,
      });
    } catch (err) {
      console.error('[orders/support] discord', err);
      await db.from('support_requests').update({ notify_failed: true }).eq('id', created.id);
    }

    return NextResponse.json({
      request: {
        publicId: created.public_id,
        reason: created.reason,
        message: created.message,
        status: created.status,
        reply: created.reply,
        repliedAt: created.replied_at,
        replySeenAt: created.reply_seen_at,
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    console.error('[orders/support]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
