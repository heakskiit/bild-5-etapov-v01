-- =====================================================================
-- 0006_promo_codes.sql
-- Single-use promo codes ("один код — один клиент"): each row is claimed
-- atomically exactly once, the same UPDATE...WHERE...IS NULL RETURNING
-- pattern as the queue claim in 0002 — two concurrent checkouts racing on
-- the same code can't both win.
--
-- `reserved_for_user_id` and `source` are here now, unused, so the wheel
-- feature (later) can generate a code tied to a specific winner without a
-- schema change — for admin-created codes today, leave both null/'admin'
-- and the code is redeemable by any signed-in customer, once.
-- =====================================================================

create type discount_type as enum ('percent', 'fixed_usd');

create table promo_codes (
  id                    bigserial primary key,
  code                  text not null unique,
  discount_type         discount_type not null,
  discount_value        numeric not null check (discount_value > 0),
  active                boolean not null default true,
  expires_at            timestamptz,
  reserved_for_user_id  uuid references profiles(id),
  used_at               timestamptz,
  used_by_order_id      uuid references orders(id),
  source                text not null default 'admin',
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  constraint percent_in_range check (discount_type <> 'percent' or discount_value <= 100)
);

alter table orders add column promo_code text;
alter table orders add column discount_usd numeric not null default 0;

-- Never exposed to anon/authenticated at all — checkout validates and
-- claims a code entirely server-side via service_role, so there's no
-- reason for the full code list (and everyone's discount amounts) to be
-- reachable through the Data API by any logged-in user.
alter table promo_codes enable row level security;
grant select, insert, update on promo_codes to service_role;

notify pgrst, 'reload schema';
