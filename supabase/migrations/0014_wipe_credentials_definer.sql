-- 0014_wipe_credentials_definer.sql (FIX-JOB-017)
--
-- BUG: the 0001 trigger never wiped anything in production.
-- nullify_credentials_on_complete() ran as SECURITY INVOKER, i.e. as the
-- booster/admin pressing "Mark completed" through the authenticated role.
-- account_credentials has RLS on and grants UPDATE to nobody, so the
-- trigger's UPDATE matched zero rows -- silently, no error -- while the same
-- trigger still stamped orders.completed_at. Found on GT-38701E76: completed,
-- ciphertext still present, nullified_at NULL.
--
-- FIX: run the function as its owner (SECURITY DEFINER, pinned search_path),
-- which is not subject to the table's RLS. The function body is unchanged.
-- It can only fire as a trigger, so DEFINER grants nothing callable.

create or replace function public.nullify_credentials_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update account_credentials
       set password_ciphertext = null,
           login_ciphertext    = null,
           note_ciphertext     = null,
           nullified_at        = now()
     where order_id = new.id;
    new.completed_at := now();
  end if;
  return new;
end $$;

-- Backfill: wipe everything the broken trigger should already have wiped.
update account_credentials c
   set password_ciphertext = null,
       login_ciphertext    = null,
       note_ciphertext     = null,
       nullified_at        = now()
  from orders o
 where o.id = c.order_id
   and o.status = 'completed'
   and c.nullified_at is null;
