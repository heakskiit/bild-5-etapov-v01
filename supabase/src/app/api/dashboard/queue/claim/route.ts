/**
 * POST /api/dashboard/queue/claim
 * Atomic claim: `UPDATE orders SET assigned_modder_id = uid, status =
 * 'in_progress' WHERE public_id = ? AND assigned_modder_id IS NULL`. Two
 * modders hitting the same job race at the database, not in application
 * code — the loser's UPDATE simply matches zero rows.
 *
 * Uses routeClient (RLS-bound), not serviceClient — the modder_claim_and_update
 * policy from 0002 is what actually authorizes this, this route is just the
 * app-level role gate + audit-event write on top of it.
 */

import { NextResponse } from 'next/server';
import { routeClient, requireUser, getProfile } from '@/lib/supabase/auth';
import { claimOrderSchema } from '@/lib/validation/dashboard';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const profile = await getProfile();
  if (!profile || !['modder', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = claimOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = await routeClient();
  const { data: order, error } = await supabase
    .from('orders')
    .update({ status: 'in_progress', assigned_modder_id: user.id })
    .eq('public_id', parsed.data.orderId)
    .is('assigned_modder_id', null)
    .select('id, public_id')
    .maybeSingle();

  if (error) {
    console.error('[queue/claim] update failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
  if (!order) {
    // Either it never matched the RLS predicate, or someone else claimed it
    // between page load and this click — same user-facing outcome.
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  await supabase.from('order_events').insert({
    order_id: order.id,
    kind: 'claimed',
    detail: { modder_id: user.id },
  });

  return NextResponse.json({ ok: true, orderId: order.public_id });
}
