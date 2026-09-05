-- =====================================================================
-- 0009_rate_limits.sql
-- Durable, shared rate limiting (PROMO-5).
--
-- The preview endpoint shipped with an in-process counter. It resets on every
-- cold start and is not shared between serverless instances, so it raised the
-- cost of guessing promo codes without ever bounding it. This moves the
-- counter into Postgres -- the one piece of state every instance already
-- shares -- so no new infrastructure is introduced.
--
-- Fixed window, not a sliding log: one row per key, one statement per check.
-- A sliding window is more precise but needs a row per request, which is a
-- bad trade for an endpoint whose whole purpose is to be cheap.
-- =====================================================================

create table rate_limits (
  key          text        primary key,
  window_start timestamptz not null,
  hits         integer     not null check (hits > 0)
);

-- Reached only through service_role. Deliberately NOT granted to
-- authenticated: keys are predictable ('checkout:<user id>'), so a signed-in
-- caller able to run this could pump *someone else's* counter and lock that
-- person out of paying. A limiter that enables denial of service is worse
-- than no limiter.
alter table rate_limits enable row level security;
grant select, insert, update, delete on rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, hit_count integer, reset_at timestamptz)
language plpgsql
as $$
declare
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => p_window_seconds);
  v_hits   integer;
  v_start  timestamptz;
begin
  -- Single statement on purpose: the row lock taken by ON CONFLICT serialises
  -- concurrent callers, so two requests racing on the same key cannot both
  -- read the same count and both conclude they are under the limit. Same
  -- reasoning as the queue claim in 0002 and claim_promo_hold in 0007.
  insert into rate_limits as rl (key, window_start, hits)
  values (p_key, v_now, 1)
  on conflict (key) do update
     set hits = case when rl.window_start + v_window <= v_now then 1 else rl.hits + 1 end,
         window_start = case when rl.window_start + v_window <= v_now then v_now else rl.window_start end
  returning rl.hits, rl.window_start into v_hits, v_start;

  -- Abandoned keys would otherwise accumulate for ever. Pruning here, rarely,
  -- avoids requiring a scheduled job in a project that has none.
  if random() < 0.001 then
    delete from rate_limits where window_start < v_now - interval '1 day';
  end if;

  return query select v_hits <= p_limit, v_hits, v_start + v_window;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
