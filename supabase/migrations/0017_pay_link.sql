-- 0017: BATCH F14 (FEAT-PAY-026) -- "Pay" button on an unpaid order.
--
-- The CryptoBot pay link used to live only in the HTTP response of
-- /api/checkout: if the Telegram tab never opened, the link was gone and the
-- customer had to place the order again. The link is stored now, together
-- with the moment the invoice stops being payable, so the orders page can
-- offer it back -- and issue a fresh invoice once the old one has lapsed.
--
-- Safe to run more than once. Existing unpaid orders keep pay_url = null and
-- simply get a new invoice the first time the button is pressed.

alter table public.orders
  add column if not exists pay_url text;

alter table public.orders
  add column if not exists invoice_expires_at timestamptz;

notify pgrst, 'reload schema';

-- Check (should return two rows):
--   select column_name, data_type from information_schema.columns
--    where table_name = 'orders' and column_name in ('pay_url', 'invoice_expires_at');
