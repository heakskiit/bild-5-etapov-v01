-- 0018: BATCH F15 (FEAT-SUP-027) -- "Need help with this order".
--
-- A customer used to be sent to Discord to open a ticket and retype the order
-- number. Now the request is raised from the order card: the reason is picked
-- from a fixed list, the order snapshot is attached by the server, and the
-- answer comes back into the same card.
--
-- One OPEN request per order (partial unique index): a second click while the
-- first is still being handled must not open a parallel thread. A resolved
-- request frees the slot, so a new problem can still be raised later.
--
-- RLS on, no policies, no grants to anon/authenticated: every read and write
-- goes through API routes that check the caller first (same model as
-- promo_codes in 0006).
--
-- Safe to run more than once.

create table if not exists public.support_requests (
  id            uuid primary key default gen_random_uuid(),
  public_id     text not null unique
                default 'SR-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6)),
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  reason        text not null check (reason in (
                  'payment_not_confirmed', 'queue_too_long', 'credentials_help',
                  'item_not_received', 'cancel_refund', 'other')),
  message       text check (message is null or char_length(message) <= 500),
  status        text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  reply         text check (reply is null or char_length(reply) <= 2000),
  replied_at    timestamptz,
  reply_seen_at timestamptz,
  notify_failed boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists support_requests_one_open_idx
  on public.support_requests (order_id) where status <> 'resolved';
create index if not exists support_requests_user_idx
  on public.support_requests (user_id, created_at desc);
create index if not exists support_requests_status_idx
  on public.support_requests (status, created_at desc);

alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant all on public.support_requests to service_role;

notify pgrst, 'reload schema';

-- Check (should return 1 row with 0):
--   select count(*) from public.support_requests;
