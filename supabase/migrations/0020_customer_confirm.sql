-- 0020: BATCH F18 (FEAT-ORD-030) -- "I received it" on a finished order.
--
-- No new status. completed is still set exactly as before (code handed out
-- by the webhook, or the booster closing the job). customer_confirmed_at is
-- only a signal: it never blocks completion, payouts or the Sheets mirror.
-- Written by the server (service role) only -- 0002 revoked UPDATE on orders
-- from customers, and that stays.
--
-- Safe to run more than once.

alter table public.orders
  add column if not exists customer_confirmed_at timestamptz;

-- Admin filter "completed, not confirmed for N days".
create index if not exists orders_unconfirmed_idx
  on public.orders (completed_at)
  where status = 'completed' and customer_confirmed_at is null;

notify pgrst, 'reload schema';

-- Check (should return one row):
--   select column_name, data_type from information_schema.columns
--    where table_name = 'orders' and column_name = 'customer_confirmed_at';
