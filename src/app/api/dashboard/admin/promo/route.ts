/**
 * /api/dashboard/admin/promo  (PROMO-7)
 *
 * The only way to issue a promo code outside the SQL editor. Every code up to
 * now was hand-inserted, which is why created_by and source have sat empty
 * since 0006 and why the table kept filling with TEST20-style leftovers.
 *
 * promo_codes has RLS enabled with no policies at all (0006) and grants only
 * to service_role, so no client-side call can read or write it, admin or not.
 * That makes this route the entire enforcement boundary: it re-establishes the
 * caller from the session before touching the service-role client, exactly as
 * /api/dashboard/admin/role does.
 */

import { NextResponse } from 'next/server';
import { requireUser, getVerifiedProfile } from '@/lib/supabase/auth';
import { serviceClient } from '@/lib/supabase/service';
import { createPromoSchema, togglePromoSchema } from '@/lib/validation/dashboard';
import { X2_MULTIPLIER } from '@/lib/pricing/promoBonus';
import { consumeRateLimit, tooManyRequests } from '@/lib/rateLimit';

export const runtime = 'nodejs';

type Gate =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string };

async function requireAdmin(): Promise<Gate> {
  const user = await requireUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }

  // getVerifiedProfile(), not getProfile(): serviceClient() below ignores RLS,
  // so the role has to come from the session, never from a request header.
  const caller = await getVerifiedProfile();
  if (!caller || caller.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }

  // Keyed on the caller and placed after the admin gate: a stolen admin
  // session should not be able to mint a thousand codes in one burst.
  const verdict = await consumeRateLimit('adminPromo', user.id);
  if (!verdict.allowed) return { ok: false, response: tooManyRequests(verdict) };

  return { ok: true, userId: user.id };
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const parsed = createPromoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }
  const { code, kind, discountValue, minOrderUsd, expiresAt, reservedForUserId } = parsed.data;
  const isBonus = kind === 'bonus_x2';

  const { data, error } = await serviceClient()
    .from('promo_codes')
    .insert({
      code,
      // Percent or bonus, never fixed_usd: a fixed amount is capped at 20% of
      // the order by MAX_DISCOUNT_SHARE anyway, so such a code would promise
      // more than it can grant on a small basket.
      discount_type: isBonus ? 'bonus_x2' : 'percent',
      // For a bonus row this column holds the multiplier (2), not a percent --
      // the same convention bonusMultiplierFor() reads back out.
      discount_value: isBonus ? X2_MULTIPLIER : discountValue,
      min_order_usd: minOrderUsd,
      expires_at: expiresAt ?? null,
      reserved_for_user_id: reservedForUserId ?? null,
      // The two columns this route exists to stop leaving empty.
      source: 'admin',
      created_by: gate.userId,
    })
    .select('id, code')
    .single();

  if (error) {
    // code is unique (0006). A collision is the normal outcome of typing a
    // memorable code, not a server fault, so it gets its own answer.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'code_exists' }, { status: 409 });
    }
    // percent_in_range, min_order_usd_non_negative or bonus_multiplier_sane
    // refused a value the zod schema allowed, which means the two have
    // drifted apart. Worth shouting
    // about rather than reporting as a generic failure.
    if (error.code === '23514') {
      console.error('[admin/promo] a constraint refused a code the schema allowed', error);
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    console.error('[admin/promo] insert failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, code: data.code });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const parsed = togglePromoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // active is the only writable field. Editing the value or the threshold of a
  // code already in a customer's hands would silently rewrite what they were
  // promised -- issue a new code instead. A spent code stays in the table
  // forever as the record of what a discount on a paid order was for.
  const { data, error } = await serviceClient()
    .from('promo_codes')
    .update({ active: parsed.data.active })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin/promo] toggle failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
