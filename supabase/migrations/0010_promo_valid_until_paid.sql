-- =====================================================================
-- 0010_promo_valid_until_paid.sql
-- A code is valid until it is PAID FOR, not until someone starts paying.
--
-- 0007 made a checkout take a one-hour hold so two customers could not both
-- pay with one single-use code. That hold was blind to WHO took it, so it
-- locked out the person who took it too: abandon the modal, come back five
-- minutes later, and your own code answers "invalid" for an hour. The same
-- clause sat in both paths -- peek_promo() in the preview and
-- claim_promo_hold() at payment -- so the customer could neither see the
-- discount nor pay with it.
--
-- The hold was also weaker than it looked. The discount is frozen into the
-- order row when the invoice is created and never re-checked at payment, so
-- the hold only DELAYED a double-spend by an hour, it never prevented one.
-- A certain customer-facing bug was being paid for an uncertain defence.
--
-- Eligibility therefore rests on used_at alone: two states, free or spent.
-- held_until and held_by_order_id are KEPT and still written, but purely as
-- an audit trail of "a checkout was started". Nothing gates on them now.
--
-- Accepted risk: a leaked code can be turned into several discounted
-- invoices at once instead of one per hour. Bounded by the 20% ceiling
-- (percent_in_range) and no longer silent -- the webhook records a
-- promo_already_used event when a payment arrives with no code left to
-- burn. For a code that must belong to one person, use reserved_for_user_id,
-- which this migration does not touch.
-- =====================================================================

-- ------------------------------------------------------------------- hold
-- Still one statement, still the concurrency control for a code that is
-- already spent. The held_until test is gone from the predicate; the write
-- stays so support can still see when a checkout was last attempted.
create or replace function public.claim_promo_hold(
  p_code         text,
  p_user_id      uuid,
  p_hold_minutes int default 60
)
returns table (id bigint, discount_type discount_type, discount_value numeric)
language sql
as $$
  update promo_codes pc
     set held_until = now() + make_interval(mins => p_hold_minutes)
   where pc.code = p_code
     and pc.active
     and pc.used_at is null
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
  returning pc.id, pc.discount_type, pc.discount_value;
$$;

-- ------------------------------------------------------------------- peek
-- Must stay predicate-identical to claim_promo_hold() above, or a code
-- previews as valid and then fails to hold, which is worse than showing
-- nothing. If you edit one, edit both.
create or replace function public.peek_promo(
  p_code    text,
  p_user_id uuid
)
returns table (discount_type discount_type, discount_value numeric)
language sql
stable
as $$
  select pc.discount_type, pc.discount_value
    from promo_codes pc
   where pc.code = p_code
     and pc.active
     and pc.used_at is null
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
   limit 1;
$$;

-- ------------------------------------------------------------------- burn
-- Now matched by the code recorded on the order instead of held_by_order_id.
-- That column is backfilled by the checkout route AFTER the order row is
-- created, so a failed backfill used to leave a paid order whose code could
-- never be burned. The code text is written in the same insert as the order
-- itself and cannot go missing.
--
-- Still idempotent: used_at is already set on a replay, so no row comes back.
-- The caller distinguishes "already burned by this very order" (a retry)
-- from "burned by a different order" (a real double-use) by reading
-- used_by_order_id.
create or replace function public.burn_promo_for_order(p_order_id uuid)
returns bigint
language sql
as $$
  update promo_codes pc
     set used_at          = now(),
         used_by_order_id = p_order_id,
         held_until       = null
   where pc.code = (select o.promo_code from orders o where o.id = p_order_id)
     and pc.used_at is null
  returning pc.id;
$$;

-- Unchanged posture: not security definer, service-role only.
revoke all on function public.claim_promo_hold(text, uuid, int) from public, anon, authenticated;
revoke all on function public.peek_promo(text, uuid)            from public, anon, authenticated;
revoke all on function public.burn_promo_for_order(uuid)        from public, anon, authenticated;
grant execute on function public.claim_promo_hold(text, uuid, int) to service_role;
grant execute on function public.peek_promo(text, uuid)            to service_role;
grant execute on function public.burn_promo_for_order(uuid)        to service_role;

notify pgrst, 'reload schema';
