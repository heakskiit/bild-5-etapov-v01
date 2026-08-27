import { cookies, headers } from 'next/headers';
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
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component during page render, where
            // cookies() is read-only — only Route Handlers and Server
            // Actions can actually write. Safe to ignore here: middleware.ts
            // is what's responsible for refreshing the session cookie on
            // navigation; this component only ever needed to *read* it.
          }
        },
      },
    },
  );
}

/** Headers middleware sets on /dashboard/** after it has already verified
 *  the session over the network — see guardDashboard() in middleware.ts. */
const USER_ID_HEADER = 'x-nd-user-id';
const USER_ROLE_HEADER = 'x-nd-user-role';

/**
 * Auth model: Magic Link (email) + Discord OAuth. No passwords are ever
 * collected for the account itself — see docs/security.md.
 *
 * Always a network call, deliberately — Header.tsx (site-wide, not just
 * /dashboard/**) needs the full Supabase user object for
 * user_metadata.avatar_url, which the middleware header doesn't carry. The
 * dashboard-specific duplicate-round-trip fix lives in getProfile() below
 * instead, which nothing needs the full object from.
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

/**
 * Signed-in user + their `profiles.role`, or null if not logged in.
 *
 * Fast path: every /dashboard/** request already went through
 * guardDashboard() in middleware.ts, which called getUser() (network) and
 * read profiles.role (another network call) once, then stamped the result
 * onto x-nd-user-id/x-nd-user-role request headers. Reading those here is
 * zero I/O — on a slow connection to Supabase that's the difference between
 * one round trip per page and three. This is a UI-gating shortcut only:
 * every actual data query still goes through routeClient(), which forwards
 * the real session cookie to PostgREST, and RLS re-validates that JWT
 * independently for every query — a forged header can't grant data access,
 * it can only ever affect which redirect a page takes.
 *
 * Falls back to the full network check for anything middleware didn't
 * cover (e.g. a page outside /dashboard/**, or a direct server-action call).
 */
export async function getProfile(): Promise<Profile | null> {
  const h = await headers();
  const headerId = h.get(USER_ID_HEADER);
  const headerRole = h.get(USER_ROLE_HEADER) as AppRole | null;
  if (headerId && headerRole) {
    // email/locale aren't read by anything downstream of getProfile() today
    // (checked every call site) — left as safe placeholders rather than a
    // 4th network call just to populate fields nobody uses.
    return { id: headerId, email: null, role: headerRole, locale: 'en' };
  }

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
  if (!profile) redirect(`/${locale}/auth`);
  if (!allowed.includes(profile.role)) redirect(`/${locale}/dashboard`);
  return profile;
}
