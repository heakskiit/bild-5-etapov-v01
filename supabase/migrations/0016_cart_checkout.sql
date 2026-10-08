-- 0016: BATCH F12 (FEAT-CART-023) -- pay a whole cart with one invoice.
--
-- Every item of a cart is still an ordinary row in `orders` (queue, jobs,
-- inventory, auto-cancel and "My orders" keep working untouched). Rows of one
-- cart share `cart_id` and the same `invoice_id`.
--
-- Safe to run more than once. Existing orders keep cart_id = null.

alter table public.orders
  add column if not exists cart_id uuid;

create index if not exists orders_cart_id_idx
  on public.orders (cart_id)
  where cart_id is not null;

-- 0001 made invoice_id UNIQUE (one invoice = one order). A cart invoice now
-- covers several orders, so the uniqueness goes; duplicate payments are still
-- stopped by webhook_events (update_id) and by the payable-status check.
alter table public.orders
  drop constraint if exists orders_invoice_id_key;

-- The webhook now loads every order of an invoice.
create index if not exists orders_invoice_id_idx
  on public.orders (invoice_id);

notify pgrst, 'reload schema';

-- Check (should return one row, data_type = uuid):
--   select column_name, data_type from information_schema.columns
--    where table_name = 'orders' and column_name = 'cart_id';
