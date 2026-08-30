/**
 * POST /api/dashboard/jobs/[id]/status
 * The modder_claim_and_update policy (0002) already restricts writes to
 * rows the caller owns (assigned_modder_id = auth.uid()) or, for admins,
 * everything — this route adds the app-level role gate and the audit
 * event, matching the pattern in /api/dashboard/queue/claim.
 */

import { NextResponse } from 'next/server';
import { routeClient, requireUser, getProfile } from '@/lib/supabase/auth';
import { jobStatusSchema } from '@/lib/validation/dashboard';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: publicId } = await params;

  const user = await requireUser();
  if (!user) {
    console.warn('[jobs/status] rejected: no session on the request');
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const profile = await getProfile();
  if (!profile || !['modder', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = jobStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = await routeClient();
  const { data: order, error } = await supabase
    .from('orders')
    .update({ status: parsed.data.status })
    .eq('public_id', publicId)
    .select('id, public_id, status')
    .maybeSingle();

  if (error) {
    console.error('[jobs/status] update failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: 'not_found_or_forbidden' }, { status: 404 });
  }

  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: order.id,
    kind: 'status_change',
    detail: { to: parsed.data.status, actor_id: user.id },
  });
  if (eventError) console.error('[jobs/status] event insert failed (status change itself still succeeded)', eventError);

  return NextResponse.json({ ok: true, status: order.status });
}
