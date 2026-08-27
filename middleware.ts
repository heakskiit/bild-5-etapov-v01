/**
 * Locale negotiation: cookie → Accept-Language → 'en'.
 * Runs before every page render so SSR output is already localised (SEO).
 *
 * Also guards /[locale]/dashboard/** (spec §2: role check at the
 * middleware layer, not just per-page). This is deliberately redundant
 * with `requireRole()` in each dashboard page and with RLS — a session
 * check here can't leak data even if it's wrong, since RLS is still the
 * real backstop. What it buys is a single place that catches a future
 * dashboard route someone forgets to add `requireRole()` to, instead of
 * relying on every page remembering to.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';

const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!hasLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const headerLocale = request.headers
      .get('accept-language')
      ?.split(',')
      .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase())
      .find((code) => LOCALES.includes(code as (typeof LOCALES)[number]));

    const locale =
      (LOCALES as readonly string[]).includes(cookieLocale ?? '') ? cookieLocale! :
      headerLocale ?? DEFAULT_LOCALE;

    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: '/' });
    return response;
  }

  const locale = pathname.split('/')[1] as Locale;
  const rest = pathname.slice(`/${locale}`.length) || '/';

  if (rest === '/dashboard' || rest.startsWith('/dashboard/')) {
    return guardDashboard(request, locale, rest);
  }

  return NextResponse.next();
}

/**
 * `/dashboard/queue*` and `/dashboard/jobs*` need modder or admin;
 * `/dashboard/admin*` (including the inventory sub-route) needs admin;
 * everything else under /dashboard just needs a session. Matches the
 * allow-lists already enforced by requireRole() on each page.
 *
 * Also stamps x-nd-user-id/x-nd-user-role onto the downstream request —
 * getProfile() (lib/supabase/auth.ts) reads these instead of re-verifying
 * the session over the network on every single page render. This is the
 * only place that sets them; RLS still independently re-validates the real
 * session cookie for every data query, so the header can only ever affect
 * a redirect decision, never data access.
 */
async function guardDashboard(request: NextRequest, locale: Locale, path: string) {
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.push(...list);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/${locale}/auth`, request.url));

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role ?? 'ghost';

  const needsModder = path.startsWith('/dashboard/queue') || path.startsWith('/dashboard/jobs');
  const needsAdmin = path.startsWith('/dashboard/admin');

  if (needsAdmin && role !== 'admin') {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (needsModder && role !== 'modder' && role !== 'admin') {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  request.headers.set('x-nd-user-id', user.id);
  request.headers.set('x-nd-user-role', role);

  const response = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] };
