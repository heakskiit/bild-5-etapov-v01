-- 0012_promo_bonus_x2_enum.sql
-- PROMO-10, step 1 of 2: teach discount_type about the X2 bonus.
--
-- ⚠ RUN THIS FILE ON ITS OWN, BEFORE 0013.
-- PostgreSQL refuses to use a newly added enum value inside the same
-- transaction that added it ("unsafe use of new value of enum type").
-- The SQL Editor wraps one run in one transaction, so the ALTER TYPE below
-- has to commit before anything -- constraint, function, or insert -- may
-- mention 'bonus_x2'. Splitting the migration is not tidiness, it is the
-- only order that works.
--
-- Why an enum value rather than a boolean column: the multiplier is stored
-- in the existing discount_value column (2 for X2), so a future X3 needs no
-- schema change at all. The two existing checks stay out of the way --
-- discount_value > 0 is satisfied by 2, and percent_in_range only constrains
-- rows whose discount_type is 'percent'.
--
-- Note there is deliberately no change to claim_promo_hold() or peek_promo():
-- both already return the discount_type column itself, so a third value
-- travels through them untouched.

alter type discount_type add value if not exists 'bonus_x2';

-- Verify (run after this file, expect three rows: percent, fixed_usd, bonus_x2):
--   select unnest(enum_range(null::discount_type)) as value;
