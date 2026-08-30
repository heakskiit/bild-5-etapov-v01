-- =====================================================================
-- 0002_roles_and_queue.sql — ghost/modder/admin roles + booster queue
-- Design notes:
--  * Does NOT touch account_credentials / the nullify trigger from 0001.
--    Modders get order context + customer contact only, never the
--    encrypted login/password columns — no policy in this file grants
--    select on account_credentials to anyone but the customer (insert-only).
--  * role changes are deliberately impossible via the anon/authenticated
--    Postgres role (see revoke below) — even a user who *is* admin at the
--    app level cannot PATCH their own or anyone else's `role` from the
--    client. The only path is the service-role admin API route, which
--    re-checks the caller's role server-side before writing.
-- =====================================================================

create type app_role as enum ('ghost', 'modder', 'admin');

alter table profiles
  add column role app_role not null default 'ghost';

-- SECURITY DEFINER so policies below can read the caller's role without
-- recursing back through profiles' own RLS.
create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- Column-level lock: no amount of RLS cleverness matters if the anon key
-- can just PATCH the column directly. This is enforced independently of
-- every policy below.
revoke update (role) on profiles from authenticated;

-- ------------------------------------------------------- queue plumbing
alter table orders
  add column assigned_modder_id uuid references profiles(id);
create index orders_assigned_modder_idx on orders(assigned_modder_id);

-- Only these columns are writable by the anon/authenticated role at all;
-- everything else on `orders` (total_usd, selection, invoice_id, ...)
-- stays write-only from the service role (checkout route, webhook).
revoke update on orders from authenticated;
grant update (status, assigned_modder_id) on orders to authenticated;

-- --------------------------------------------------------- role audit
create table role_audit (
  id              bigserial primary key,
  target_user_id  uuid not null references profiles(id) on delete cascade,
  changed_by      uuid not null references profiles(id),
  old_role        app_role not null,
  new_role        app_role not null,
  created_at      timestamptz not null default now()
);
alter table role_audit enable row level security;
create policy admin_select_role_audit on role_audit
  for select using (current_role() = 'admin');
-- Inserts happen exclusively from the service-role admin API route.

-- ------------------------------------------------------------------ RLS
-- profiles: admins can see every row; everyone still sees/updates their own
-- (locale etc.) via the pre-existing own_profile policy from 0001.
create policy admin_select_profiles on profiles
  for select using (current_role() = 'admin');

-- orders: modders see the shared queue (unclaimed + in-flight service
-- orders) and their own claimed jobs. Shark-card orders never appear here —
-- they finish automatically once a code is assigned, no modder involved.
create policy modder_queue_select on orders
  for select using (
    current_role() in ('modder', 'admin')
    and (selection ->> 'product') in ('leveling', 'money')
    and status in ('action_required', 'in_progress')
  );

create policy admin_select_all_orders on orders
  for select using (current_role() = 'admin');

-- Atomic claim: UPDATE ... WHERE assigned_modder_id IS NULL RETURNING *
-- either claims the row or returns zero rows — no race window. Once
-- claimed, the same policy lets the owning modder move status forward;
-- the WITH CHECK stops them handing the job to someone else or reassigning
-- other people's jobs.
create policy modder_claim_and_update on orders
  for update using (
    current_role() = 'modder'
    and (selection ->> 'product') in ('leveling', 'money')
    and (assigned_modder_id is null or assigned_modder_id = auth.uid())
  )
  with check (assigned_modder_id = auth.uid());

create policy admin_update_all_orders on orders
  for update using (current_role() = 'admin')
  with check (true);

-- order_events: staff can read everything; inserts are written by the
-- server route on behalf of the acting modder/admin (service role), so no
-- broad insert policy is needed here for the anon/authenticated role.
create policy staff_select_events on order_events
  for select using (current_role() in ('modder', 'admin'));
