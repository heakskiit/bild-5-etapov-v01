/**
 * POST /api/orders/credentials — Safe Account Sharing intake.
 *
 * Gate conditions (all must hold):
 *  1. Caller owns the order.
 *  2. Order is PAID (status action_required | in_progress). Never at checkout.
 *  3. Order actually uses the piloted method.
 * The secret is AES-256-GCM encrypted before it reaches Postgres, with the
 * order id bound in as AAD so a row cannot be moved between orders.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encryptSecret } from '@/lib/crypto/aes';
import { serviceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

const schema = z.object({
  orderId: z.string().min(6),
  login: z.string().min(3).max(120),
  password: z.string().min(3).max(200),
  twoFactorNote: z.string().max(500).optional(),
});

const PAID_STATES = ['action_required', 'in_progress'];

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, public_id, user_id, status, selection')
    .eq('public_id', parsed.data.orderId)
    .single();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!PAID_STATES.includes(order.status)) {
    return NextResponse.json({ error: 'not_payable_yet' }, { status: 409 });
  }

  const aad = order.public_id;
  await db.from('account_credentials').upsert({
    order_id: order.id,
    login_ciphertext: encryptSecret(parsed.data.login, aad),
    password_ciphertext: encryptSecret(parsed.data.password, aad),
    note_ciphertext: parsed.data.twoFactorNote
      ? encryptSecret(parsed.data.twoFactorNote, aad)
      : null,
    submitted_at: new Date().toISOString(),
  });

  await db.from('orders').update({ status: 'in_progress' }).eq('id', order.id);
  await db.from('order_events').insert({ order_id: order.id, kind: 'credentials_submitted' });

  return NextResponse.json({ ok: true });
}
