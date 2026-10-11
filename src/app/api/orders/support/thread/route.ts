/**
 * GET  /api/orders/support/thread?id=SR-XXXXXX -- the conversation of one of
 *      the caller's own requests (BATCH F15c).
 * POST /api/orders/support/thread -- the customer writes into an open request
 *      ({ requestId, body }) or closes it as solved ({ requestId, resolve: true }).
 *
 * Writing resets the 48 h auto-close clock: it only runs while support has
 * the last word (0019). Every customer message pings the staff channel so
 * the follow-up is not missed.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { customerMessageSchema } from '@/lib/support/requests';
import { notifySupportFollowUp } from '@/lib/discord/notifySupport';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id || id.length > 40) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const db = serviceClient();
  try {
    const { data: req } = await db
      .from('support_requests')
      .select('id, user_id')
      .eq('public_id', id)
      .maybeSingle();
    if (!req || req.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const { data, error } = await db
      .from('support_messages')
      .select('author, body, created_at')
      .eq('request_id', req.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;

    return NextResponse.json({
      messages: (data ?? []).map((m) => ({ author: m.author, body: m.body, createdAt: m.created_at })),
    });
  } catch (err) {
    console.error('[orders/support/thread GET]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const verdict = await consumeRateLimit('supportRequest', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const parsed = customerMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }
  const { requestId, body, resolve } = parsed.data;

  const db = serviceClient();
  try {
    const { data: req } = await db
      .from('support_requests')
      .select('id, user_id, order_id, status, orders(public_id)')
      .eq('public_id', requestId)
      .maybeSingle();
    if (!req || req.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    // A closed request is history: a new problem gets a new request.
    if (req.status === 'resolved') return NextResponse.json({ error: 'closed' }, { status: 409 });

    const now = new Date().toISOString();

    if (body) {
      const { error } = await db
        .from('support_messages')
        .insert({ request_id: req.id, author: 'customer', body });
      if (error) throw error;
    }

    const update: Record<string, unknown> = { updated_at: now };
    if (body) {
      update.last_customer_at = now;
      // Back in support's queue; "in progress" stays as the admin set it.
      if (req.status !== 'in_progress') update.status = 'open';
    }
    if (resolve) {
      update.status = 'resolved';
      update.closed_reason = 'customer';
    }
    const { error: updateError } = await db.from('support_requests').update(update).eq('id', req.id);
    if (updateError) throw updateError;

    await db.from('order_events').insert({
      order_id: req.order_id,
      kind: resolve ? 'support_closed_by_customer' : 'support_customer_message',
      detail: { request: requestId },
    });

    const order = (Array.isArray(req.orders) ? req.orders[0] : req.orders) as { public_id: string } | null;
    try {
      await notifySupportFollowUp({
        requestId,
        orderPublicId: order?.public_id ?? '\u2014',
        body: body ?? null,
        resolved: Boolean(resolve),
        adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/ru/dashboard/admin/support`,
      });
    } catch (err) {
      console.error('[orders/support/thread] discord', err);
      await db.from('support_requests').update({ notify_failed: true }).eq('id', req.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[orders/support/thread POST]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
