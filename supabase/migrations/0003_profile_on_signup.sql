-- =====================================================================
-- 0003_profile_on_signup.sql
-- Without this, a brand-new Magic Link / Discord sign-in creates a row in
-- auth.users but nothing in public.profiles — every RLS policy and every
-- getProfile() call keyed on profiles.id then finds nothing, and the user
-- silently behaves as a role-less ghost forever.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'locale', 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
