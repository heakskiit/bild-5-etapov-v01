/**
 * POST /api/dashboard/jobs/[id]/credentials — "Show account data" (FIX-JOB-017).
 *
 * The only place a customer's game login is ever decrypted. Gate:
 *  1. caller is the assigned modder, or an admin (credentialRevealDenial);
 *  2. job is in_progress — after completion the 0001 trigger wipes the row;
 *  3. the audit event is written BEFORE the secret leaves the server. If the
 *     audit insert fails, nothing is revealed: an unlogged read is the exact
 *     thing this table exists to prevent.
 * Reads go through the service client because RLS on account_credentials
 * grants select to nobody; the role/ownership check above replaces it.
 */

import { NextResponse } from 'next/server';
import { decryptSecret } from '@/lib/crypto/aes';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser, getProfile } from '@/lib/supabase/auth';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';
import { credentialRevealDenial, credentialRowState } from '@/lib/orders/credentialAccess';

export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: publicId } = await params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const profile = await getProfile();
  if (!profile || !['modder', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const verdict = await consumeRateLimit('revealCredentials', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, public_id, status, assigned_modder_id')
    .eq('public_id', publicId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const denial = credentialRevealDenial({
    role: profile.role,
    userId: user.id,
    assignedModderId: order.assigned_modder_id,
    status: order.status,
  });
  // A stranger gets the same 404 as a missing order: no hint the job exists.
  if (denial === 'forbidden') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (denial === 'not_in_progress') {
    return NextResponse.json({ error: 'not_in_progress' }, { status: 409 });
  }

  const { data: row } = await db
    .from('account_credentials')
    .select('login_ciphertext, password_ciphertext, note_ciphertext, nullified_at')
    .eq('order_id', order.id)
    .maybeSingle();

  const state = credentialRowState(row);
  if (state === 'missing') return NextResponse.json({ error: 'no_credentials' }, { status: 404 });
  if (state === 'wiped') return NextResponse.json({ error: 'wiped' }, { status: 410 });

  let login: string;
  let password: string;
  let note: string | null;
  try {
    const aad = order.public_id;
    login = decryptSecret(row!.login_ciphertext!, aad);
    password = decryptSecret(row!.password_ciphertext!, aad);
    note = row!.note_ciphertext ? decryptSecret(row!.note_ciphertext, aad) : null;
  } catch (err) {
    // Almost always CREDENTIALS_ENCRYPTION_KEY differing from the one the
    // row was written with. Logged without any ciphertext or plaintext.
    console.error('[jobs/credentials] decrypt failed for', order.public_id, (err as Error).message);
    return NextResponse.json({ error: 'decrypt_failed' }, { status: 500 });
  }

  const { error: eventError } = await db.from('order_events').insert({
    order_id: order.id,
    kind: 'credentials_revealed',
    detail: { actor_id: user.id, role: profile.role },
  });
  if (eventError) {
    console.error('[jobs/credentials] audit insert failed, refusing to reveal', eventError);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ login, password, note }, { headers: NO_STORE });
}
