-- 0019: BATCH F15c (FEAT-SUP-028) -- support request as a conversation.
--
-- F15 had one customer message and one staff answer. Now both sides can
-- write any number of messages (support_messages). The ticket stays open
-- while it is support's turn; once support has answered and the customer
-- stays silent for 48 hours, close_idle_support_requests() closes it.
-- The clock never runs while the customer is waiting for support.
--
-- support_requests.message / reply stay as "first customer message" and
-- "latest staff answer" so F15 code paths and the "Has reply" badge keep
-- working unchanged.
--
-- Safe to run more than once.

create table if not exists public.support_messages (
  id          bigserial primary key,
  request_id  uuid not null references public.support_requests(id) on delete cascade,
  author      text not null check (author in ('customer', 'staff')),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_request_idx
  on public.support_messages (request_id, created_at);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated;
grant all on public.support_messages to service_role;
grant usage, select on sequence public.support_messages_id_seq to service_role;

alter table public.support_requests
  add column if not exists last_customer_at timestamptz,
  add column if not exists last_staff_at    timestamptz,
  add column if not exists closed_reason    text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_requests_closed_reason_check'
  ) then
    alter table public.support_requests
      add constraint support_requests_closed_reason_check
      check (closed_reason is null or closed_reason in ('staff', 'customer', 'auto_idle'));
  end if;
end $$;

-- Backfill F15 requests into the thread (only once per request).
insert into public.support_messages (request_id, author, body, created_at)
select r.id, 'customer', r.message, r.created_at
  from public.support_requests r
 where r.message is not null
   and not exists (select 1 from public.support_messages m where m.request_id = r.id);

insert into public.support_messages (request_id, author, body, created_at)
select r.id, 'staff', r.reply, coalesce(r.replied_at, r.updated_at)
  from public.support_requests r
 where r.reply is not null
   and not exists (
     select 1 from public.support_messages m where m.request_id = r.id and m.author = 'staff'
   );

update public.support_requests
   set last_customer_at = coalesce(last_customer_at, created_at),
       last_staff_at    = coalesce(last_staff_at, replied_at)
 where last_customer_at is null
    or (last_staff_at is null and replied_at is not null);

-- Auto-close: support answered last, customer silent for 48 hours.
create or replace function public.close_idle_support_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with closed as (
    update support_requests
       set status = 'resolved',
           closed_reason = 'auto_idle',
           updated_at = now()
     where status <> 'resolved'
       and last_staff_at is not null
       and last_staff_at > coalesce(last_customer_at, created_at)
       and last_staff_at < now() - interval '48 hours'
    returning id, order_id, public_id
  ), logged as (
    insert into order_events (order_id, kind, detail)
    select order_id, 'support_auto_closed', jsonb_build_object('request', public_id, 'after_hours', 48)
      from closed
    returning 1
  )
  select count(*) into v_count from logged;
  return v_count;
end;
$$;

revoke all on function public.close_idle_support_requests() from public, anon, authenticated;

-- Re-running replaces the job instead of adding a second one.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'close-idle-support') then
    perform cron.unschedule('close-idle-support');
  end if;
end $$;

select cron.schedule(
  'close-idle-support',
  '*/15 * * * *',
  $$select public.close_idle_support_requests()$$
);

notify pgrst, 'reload schema';

-- Checks:
--   select jobid, jobname, schedule from cron.job order by jobid;   -- 2 rows
--   select public.close_idle_support_requests();                     -- 0
--   select count(*) from public.support_messages;                    -- your F15 test messages
