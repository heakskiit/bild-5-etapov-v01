/**
 * PATCH /api/dashboard/admin/support -- BATCH F15 (FEAT-SUP-027).
 * Admin sets the status of a support request and writes the answer the
 * customer sees in their order card.
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
      .select('id, order_id, reply, status')
      .eq('public_id', id)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status, updated_at: now };

    // A new or changed answer re-lights the customer's "Has reply" badge.
    const newReply = reply ?? '';
    const replyChanged = newReply !== (current.reply ?? '');
    if (replyChanged) {
      update.reply = newReply || null;
      update.replied_at = newReply ? now : null;
      update.reply_seen_at = null;
    }

    const { error } = await db.from('support_requests').update(update).eq('id', current.id);
    if (error) throw error;

    if (replyChanged || status !== current.status) {
      await db.from('order_events').insert({
        order_id: current.order_id,
        kind: replyChanged && newReply ? 'support_replied' : 'support_status',
        detail: { request: id, status },
      });
    }

    // BATCH F16 hook: notify the customer (email / Discord DM) here when
    // replyChanged && newReply. Kept out of F15 so this route stays simple.

    return NextResponse.json({ ok: true, replyChanged });
  } catch (err) {
    console.error('[admin/support]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
