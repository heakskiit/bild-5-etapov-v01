import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** Anon-key client bound to the request cookies; RLS applies. */
export async function routeClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) =>
          list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    },
  );
}

/**
 * Auth model: Magic Link (email) + Discord OAuth. No passwords are ever
 * collected for the account itself — see docs/security.md.
 */
export async function requireUser() {
  const supabase = await routeClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export type AppRole = 'ghost' | 'modder' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  role: AppRole;
  locale: string;
}

/** Signed-in user + their `profiles.role`, or null if not logged in. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await routeClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', auth.user.id)
    .single();

  return {
    id: auth.user.id,
    email: auth.user.email ?? null,
    role: (profile?.role as AppRole | undefined) ?? 'ghost',
    locale: profile?.locale ?? 'en',
  };
}

/**
 * Role check per item 2 of the spec: server-only, redirect on failure.
 * Not logged in → /login. Logged in but wrong role → back to the
 * dashboard root rather than a bare 403, since "wrong role" is a routine
 * navigation mistake (e.g. a ghost hitting /dashboard/queue), not an
 * attack to make noise about.
 */
export async function requireRole(locale: string, allowed: AppRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/${locale}/login`);
  if (!allowed.includes(profile.role)) redirect(`/${locale}/dashboard`);
  return profile;
}
