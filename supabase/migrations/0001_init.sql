-- =====================================================================
-- 0001_init.sql — MVP schema
-- Design notes:
--  * `selection` is jsonb: configurators evolve faster than DDL should.
--  * No plaintext secret column exists anywhere by construction.
--  * RLS everywhere; only the service role (webhooks) bypasses it.
-- =====================================================================

create extension if not exists "pgcrypto";

create type order_status as enum (
  'awaiting_payment', 'action_required', 'in_progress',
  'completed', 'cancelled', 'refunded'
);

-- ---------------------------------------------------------------- profiles
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  discord_id  text unique,
  locale      text not null default 'en' check (locale in ('en','de','fr','es','ru')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ orders
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  public_id          text not null unique
                     default 'GT-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8)),
  user_id            uuid not null references profiles(id) on delete cascade,
  status             order_status not null default 'awaiting_payment',
  selection          jsonb not null,
  total_usd          numeric(10,2) not null check (total_usd >= 0),
  booster_payout_usd numeric(10,2) not null default 0,
  pricing_version    text not null,
  invoice_id         text unique,
  contact_handle     text,
  paid_at            timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index orders_user_idx on orders(user_id, created_at desc);
create index orders_status_idx on orders(status);

-- ----------------------------------------------------------- digital codes
-- Rows appear ONLY after a verified invoice_paid webhook.
create table digital_codes (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  code_ciphertext text not null,
  revealed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------- piloted-method secrets
create table account_credentials (
  order_id            uuid primary key references orders(id) on delete cascade,
  login_ciphertext    text,
  password_ciphertext text,
  note_ciphertext     text,
  submitted_at        timestamptz,
  nullified_at        timestamptz
);

-- Wipe secrets the moment the job is done.
create or replace function nullify_credentials_on_complete()
returns trigger language plpgsql as $$
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

create trigger trg_nullify_credentials
before update on orders
for each row execute function nullify_credentials_on_complete();

-- ---------------------------------------------------- audit + idempotency
create table order_events (
  id         bigserial primary key,
  order_id   uuid not null references orders(id) on delete cascade,
  kind       text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id          bigserial primary key,
  provider    text not null,
  external_id text not null,
  body        jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, external_id)   -- replay protection
);

-- -------------------------------------------------------------------- RLS
alter table profiles            enable row level security;
alter table orders              enable row level security;
alter table digital_codes       enable row level security;
alter table account_credentials enable row level security;
alter table order_events        enable row level security;

create policy own_profile on profiles
  for all using (id = auth.uid());

create policy own_orders on orders
  for select using (user_id = auth.uid());

create policy own_codes on digital_codes
  for select using (exists (
    select 1 from orders o
     where o.id = digital_codes.order_id
       and o.user_id = auth.uid()
       and o.status = 'completed'));

-- Customers may write credentials but never read them back.
create policy insert_own_credentials on account_credentials
  for insert with check (exists (
    select 1 from orders o
     where o.id = account_credentials.order_id
       and o.user_id = auth.uid()
       and o.status in ('action_required','in_progress')));

create policy own_events on order_events
  for select using (exists (
    select 1 from orders o
     where o.id = order_events.order_id and o.user_id = auth.uid()));
