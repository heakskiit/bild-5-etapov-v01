-- =====================================================================
-- 0004_admin_inventory.sql
-- /dashboard/admin/inventory needs to read fulfilment history, but never
-- the code itself — /api/orders/reveal-code already decrypts via
-- serviceClient (service role), which ignores both RLS and these column
-- grants, so locking `code_ciphertext` out of the anon/authenticated role
-- here doesn't touch that flow at all.
-- =====================================================================

revoke select on digital_codes from authenticated;
grant select (id, order_id, revealed_at, created_at) on digital_codes to authenticated;

create policy admin_select_digital_codes on digital_codes
  for select using (current_role() = 'admin');
