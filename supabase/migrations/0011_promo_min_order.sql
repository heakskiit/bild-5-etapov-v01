-- =====================================================================
-- 0011_promo_min_order.sql
-- Tiered promo codes: a code may require a minimum order amount.
--
-- The tier table this supports: 5% and 10% from $10, 15% and 20% from $30.
-- The 20% ceiling (percent_in_range from 0007) and MAX_DISCOUNT_SHARE are
-- deliberately NOT touched. A 25% tier was considered and dropped for
-- exactly that reason: raising the ceiling would also widen the double-use
-- risk accepted in 0010, and two predicates guarding the same number are
-- worth more than one extra tier.
--
-- WHY THE FUNCTIONS ARE DROPPED AND RECREATED
-- Both eligibility functions now hand min_order_usd up to the caller, so a
-- refusal can say "works from $30" instead of the flat "invalid code" that
-- PROMO-6 already proved to be the worst possible message. Adding an OUT
-- column changes a function's return type, and Postgres refuses that through
-- create or replace -- drop + create is the only route. Execute grants die
-- with the function and are re-issued at the bottom of this file.
--
-- WHERE THE THRESHOLD IS ENFORCED
-- Not in these functions, deliberately. They receive no order amount, and
-- teaching them the price would put the pricing engine in two places. They
-- stay a pure eligibility question; both server routes compare the returned
-- threshold against the subtotal they already computed, through one shared
-- helper (src/lib/pricing/promoEligibility.ts). That comparison cannot be
-- skipped by a crafted request: execute on both functions is revoked from
-- anon and authenticated and granted only to service_role, so the sole
-- callers are our own two server routes.
-- =====================================================================

alter table promo_codes
  add column if not exists min_order_usd numeric(10,2) not null default 0;

-- Zero means "no threshold", which is what every code issued before today
-- already means. Negative would silently behave like zero, so it is refused.
alter table promo_codes drop constraint if exists min_order_usd_non_negative;
alter table promo_codes add constraint min_order_usd_non_negative
  check (min_order_usd >= 0);

-- ------------------------------------------------------------------- hold
-- Predicate unchanged from 0010: eligibility still rests on used_at alone.
-- The held_until write stays an audit trail of "a checkout was started".
drop function if exists public.claim_promo_hold(text, uuid, int);
create function public.claim_promo_hold(
  p_code         text,
  p_user_id      uuid,
  p_hold_minutes int default 60
)
returns table (
  id             bigint,
  discount_type  discount_type,
  discount_value numeric,
  min_order_usd  numeric
)
language sql
as $$
  update promo_codes pc
     set held_until = now() + make_interval(mins => p_hold_minutes)
   where pc.code = p_code
     and pc.active
     and pc.used_at is null
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
  returning pc.id, pc.discount_type, pc.discount_value, pc.min_order_usd;
$$;

-- ------------------------------------------------------------------- peek
-- Must stay predicate-identical to claim_promo_hold() above, or a code
-- previews as valid and then fails to hold, which is worse than showing
-- nothing. If you edit one, edit both. The threshold is returned, never
-- filtered on, so the two paths cannot disagree about eligibility either.
drop function if exists public.peek_promo(text, uuid);
create function public.peek_promo(
  p_code    text,
  p_user_id uuid
)
returns table (
  discount_type  discount_type,
  discount_value numeric,
  min_order_usd  numeric
)
language sql
stable
as $$
  select pc.discount_type, pc.discount_value, pc.min_order_usd
    from promo_codes pc
   where pc.code = p_code
     and pc.active
     and pc.used_at is null
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
   limit 1;
$$;

-- burn_promo_for_order() is untouched by this migration: it matches on the
-- code recorded on the order (0010) and never looked at the threshold.

-- Same posture as before: not security definer, service-role only.
revoke all on function public.claim_promo_hold(text, uuid, int) from public, anon, authenticated;
revoke all on function public.peek_promo(text, uuid)            from public, anon, authenticated;
grant execute on function public.claim_promo_hold(text, uuid, int) to service_role;
grant execute on function public.peek_promo(text, uuid)            to service_role;

notify pgrst, 'reload schema';
