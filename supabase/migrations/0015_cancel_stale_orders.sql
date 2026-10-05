-- 0015_cancel_stale_orders.sql (FIX-PAY-019)
--
-- Unpaid orders never left `awaiting_payment`: nothing expired them, so they
-- piled up in every list. A CryptoBot invoice dies after one hour
-- (expires_in: 3600 in lib/pricing/cryptobot.ts); an order still unpaid two
-- hours after creation is abandoned. Every 15 minutes pg_cron moves such
-- orders to `cancelled` and writes an `auto_cancelled` event.
--
-- Nothing is deleted. A payment that still arrives is settled by the webhook
-- (lib/orders/payableStatus.ts), never dropped.
--
-- Prerequisite: Supabase Dashboard -> Integrations -> Cron -> enable
-- (installs the pg_cron extension). Safe to re-run: the function is
-- replaced and cron.schedule() updates the job with the same name.

create or replace function public.cancel_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with cancelled as (
    update orders
       set status = 'cancelled'
     where status = 'awaiting_payment'
       and created_at < now() - interval '2 hours'
    returning id
  ), logged as (
    insert into order_events (order_id, kind, detail)
    select id, 'auto_cancelled', jsonb_build_object('after_hours', 2)
      from cancelled
    returning 1
  )
  select count(*) into v_count from logged;
  return v_count;
end;
$$;

revoke all on function public.cancel_stale_orders() from public, anon, authenticated;

select cron.schedule(
  'cancel-stale-orders',
  '*/15 * * * *',
  $$select public.cancel_stale_orders()$$
);
