-- 0013_promo_bonus_x2.sql
-- PROMO-10, step 2 of 2: record the multiplier on the order itself.
--
-- Run only after 0012 has committed.
--
-- The multiplier lives on orders, not just on promo_codes, for the reason we
-- proved by accident this evening: deleting a promo code must not rewrite
-- history. An order that was sold as double delivery stays double even after
-- the code that granted it is gone -- exactly like discount_usd.
--
-- Price is untouched by design. X2 is not a discount: total_usd and
-- discount_usd stay as they were, and only the amount the booster has to
-- deliver changes.

alter table orders
  add column if not exists delivery_multiplier numeric(4,2) not null default 1;

-- 1 means "normal order", so the floor is 1 rather than 0. The ceiling is a
-- sanity rail, not a business rule: it stops a typo in the admin form from
-- promising a hundredfold delivery.
alter table orders
  drop constraint if exists delivery_multiplier_sane;
alter table orders
  add constraint delivery_multiplier_sane
  check (delivery_multiplier >= 1 and delivery_multiplier <= 10);

-- Same rail on the code that grants it. A 'bonus_x2' row carries the
-- multiplier in discount_value, so a row claiming x1 (no effect) or x99 is a
-- mistake worth refusing at the database rather than debugging in the UI.
alter table promo_codes
  drop constraint if exists bonus_multiplier_sane;
alter table promo_codes
  add constraint bonus_multiplier_sane
  check (discount_type <> 'bonus_x2' or (discount_value >= 2 and discount_value <= 5));

notify pgrst, 'reload schema';

-- Verify (expect: column present with default 1, and both constraints listed):
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_name = 'orders' and column_name = 'delivery_multiplier';
--   select conname from pg_constraint
--    where conname in ('delivery_multiplier_sane', 'bonus_multiplier_sane');
