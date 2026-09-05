/**
 * POST /api/orders/reveal-code — the "Show Code" button.
 * A code is only ever decrypted here, for the owner, on a completed order.
 * Each reveal is stamped so disputes can be resolved from the audit trail.
 */

import { NextResponse } from 'next/server';
import { decryptSecret } from '@/lib/crypto/aes';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Every accepted call decrypts a secret and writes both revealed_at
  // and an order_events row, so the owner alone could inflate the audit
  // trail without bound by holding the button down.
  const verdict = await consumeRateLimit('revealCode', user.id);
  if (!verdict.allowed) return tooManyRequests(verdict);

  const { orderId } = (await request.json()) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, public_id, user_id, status')
    .eq('public_id', orderId)
    .single();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (order.status !== 'completed') {
    return NextResponse.json({ error: 'not_paid' }, { status: 409 });
  }

  const { data: row } = await db
    .from('digital_codes')
    .select('id, code_ciphertext')
    .eq('order_id', order.id)
    .single();
  if (!row) return NextResponse.json({ error: 'no_code' }, { status: 404 });

  await db.from('digital_codes').update({ revealed_at: new Date().toISOString() }).eq('id', row.id);
  await db.from('order_events').insert({ order_id: order.id, kind: 'code_revealed' });

  return NextResponse.json({ code: decryptSecret(row.code_ciphertext, order.public_id) });
}
