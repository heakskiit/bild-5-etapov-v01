-- =====================================================================
-- 0007_promo_hold.sql
-- Splits "taken at checkout" from "actually paid for".
--
-- 0006 burned a code the moment an order row was created, so an abandoned
-- checkout destroyed a single-use code permanently, and anyone signed in
-- could exhaust every public code without paying a cent. Here the two
-- states become separate columns: a checkout takes a short *hold*, and
-- only a verified invoice_paid webhook ever writes used_at.
--
-- No cleanup job is involved. A lapsed hold simply stops satisfying the
-- WHERE clause in claim_promo_hold(), and the hold window matches the
-- CryptoBot invoice lifetime (expires_in: 3600 in lib/pricing/cryptobot.ts),
-- so a code returns to the pool exactly when its invoice stops being payable.
-- =====================================================================

alter table promo_codes add column held_until       timestamptz;
alter table promo_codes add column held_by_order_id uuid references orders(id) on delete set null;

-- Business rule: no code exceeds 20%. NOT VALID so this migration cannot
-- fail on rows created before the rule existed; every insert and update
-- from here on is checked. The audit query at the bottom shows whether any
-- legacy row would violate it.
alter table promo_codes drop constraint percent_in_range;
alter table promo_codes add constraint percent_in_range
  check (discount_type <> 'percent' or discount_value <= 20) not valid;

-- Align with orders.total_usd (numeric(10,2)). 0006 left this unbounded, so a
-- fixed_usd code could store more decimals than the total it reduces.
alter table orders alter column discount_usd type numeric(10,2);
alter table orders add constraint discount_usd_non_negative check (discount_usd >= 0);

-- ------------------------------------------------------------------- hold
-- One statement, so the WHERE clause *is* the concurrency control: two
-- checkouts racing on the same code cannot both get a row back. Eligibility
-- (active, unexpired, unused, not held by someone else, not reserved for
-- another customer) is decided inside the database, not across round trips.
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
     and (pc.held_until is null or pc.held_until < now())
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
  returning pc.id, pc.discount_type, pc.discount_value;
$$;

-- ------------------------------------------------------------------- burn
-- Idempotent: a webhook replay finds used_at already set and returns no row.
create or replace function public.burn_promo_for_order(p_order_id uuid)
returns bigint
language sql
as $$
  update promo_codes
     set used_at          = now(),
         used_by_order_id = p_order_id,
         held_until       = null
   where held_by_order_id = p_order_id
     and used_at is null
  returning id;
$$;

-- Deliberately NOT security definer: both are called with the service-role
-- key from the server only, which already bypasses RLS, so there is no reason
-- to leave a privilege-escalating entry point behind.
revoke all on function public.claim_promo_hold(text, uuid, int) from public, anon, authenticated;
revoke all on function public.burn_promo_for_order(uuid)        from public, anon, authenticated;
grant execute on function public.claim_promo_hold(text, uuid, int) to service_role;
grant execute on function public.burn_promo_for_order(uuid)        to service_role;

notify pgrst, 'reload schema';

-- Audit before trusting the new ceiling (should return no rows):
--   select code, discount_type, discount_value from promo_codes
--    where discount_type = 'percent' and discount_value > 20;
