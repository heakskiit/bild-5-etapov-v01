/**
 * POST /api/dashboard/admin/role
 * `revoke update (role) on profiles from authenticated` (0002) means no
 * client-side call, admin or not, can write this column — this route is
 * the only path, and it re-verifies the caller is admin before using the
 * service-role client to bypass that lock intentionally.
 */

import { NextResponse } from 'next/server';
import { requireUser, getVerifiedProfile } from '@/lib/supabase/auth';
import { serviceClient } from '@/lib/supabase/service';
import { setRoleSchema } from '@/lib/validation/dashboard';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // getVerifiedProfile(), not getProfile(): serviceClient() below bypasses RLS,
  // so this role check is the only gate on the write and must come from the
  // session, never from a request header.
  const caller = await getVerifiedProfile();
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = setRoleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const db = serviceClient();
  const { data: target, error: fetchError } = await db
    .from('profiles')
    .select('id, role')
    .eq('id', parsed.data.userId)
    .maybeSingle();

  if (fetchError || !target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (target.role === parsed.data.role) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: updateError } = await db
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId);
  if (updateError) {
    console.error('[admin/role] update failed', updateError);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  await db.from('role_audit').insert({
    target_user_id: parsed.data.userId,
    changed_by: user.id,
    old_role: target.role,
    new_role: parsed.data.role,
  });

  return NextResponse.json({ ok: true });
}
