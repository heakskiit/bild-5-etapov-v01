/**
 * PATCH /api/dashboard/admin/support -- BATCH F15 (FEAT-SUP-027), F15c.
 * Admin sets the status of a support request and/or ADDS a message to its
 * conversation. Since F15c a reply is appended to support_messages instead
 * of overwriting the previous answer; it also starts the customer's 48 h
 * auto-close clock (0019).
 *
 * support_requests has RLS on and no grants for authenticated (0018), so this
 * route is the whole enforcement boundary -- same gate as the promo route.
 */

import { NextResponse } from 'next/server';
import { requireUser, getVerifiedProfile } from '@/lib/supabase/auth';
import { serviceClient } from '@/lib/supabase/service';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { adminSupportUpdateSchema } from '@/lib/support/requests';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const caller = await getVerifiedProfile();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const verdict = await consumeRateLimit('adminSupport', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const parsed = adminSupportUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }
  const { id, status, reply } = parsed.data;

  const db = serviceClient();
  try {
    const { data: current } = await db
      .from('support_requests')
      .select('id, order_id, status')
      .eq('public_id', id)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status, updated_at: now };

    if (reply) {
      const { error: msgError } = await db
        .from('support_messages')
        .insert({ request_id: current.id, author: 'staff', body: reply });
      if (msgError) throw msgError;
      // reply = latest answer; a fresh answer re-lights "Has reply".
      update.reply = reply;
      update.replied_at = now;
      update.last_staff_at = now;
      update.reply_seen_at = null;
    }

    if (status === 'resolved' && current.status !== 'resolved') update.closed_reason = 'staff';
    if (status !== 'resolved') update.closed_reason = null;

    const { error } = await db.from('support_requests').update(update).eq('id', current.id);
    if (error) {
      // Reopening while the customer already has another open request on the
      // same order hits 0018's one-open-per-order index.
      if (error.code === '23505') return NextResponse.json({ error: 'already_open' }, { status: 409 });
      throw error;
    }

    if (reply || status !== current.status) {
      await db.from('order_events').insert({
        order_id: current.order_id,
        kind: reply ? 'support_replied' : 'support_status',
        detail: { request: id, status },
      });
    }

    // BATCH F16 hook: notify the customer (email / Discord DM) here when a
    // reply was added. Kept out of F15 so this route stays simple.

    return NextResponse.json({ ok: true, replied: Boolean(reply) });
  } catch (err) {
    console.error('[admin/support]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
