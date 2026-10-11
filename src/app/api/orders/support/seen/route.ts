/**
 * POST /api/orders/support/seen -- BATCH F15. The customer opened the answer:
 * the "Has reply" badge goes away. Only the owner's own request, and only a
 * reply that exists and has not been marked yet, so this cannot touch
 * anything else.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { requestId } = ((await request.json().catch(() => null)) ?? {}) as { requestId?: string };
  if (!requestId || typeof requestId !== 'string' || requestId.length > 40) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const { error } = await serviceClient()
    .from('support_requests')
    .update({ reply_seen_at: new Date().toISOString() })
    .eq('public_id', requestId)
    .eq('user_id', user.id)
    .not('reply', 'is', null)
    .is('reply_seen_at', null);

  if (error) {
    console.error('[orders/support/seen]', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
