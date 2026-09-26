/**
 * Locale negotiation: cookie → 'en'. New visitors always land on /en
 * regardless of browser language; once someone picks a different locale
 * via the language switcher, that choice is remembered via cookie and
 * wins on every later visit. Runs before every page render so SSR output
 * is already localised (SEO).
 *
 * Also refreshes the Supabase session on every page request (FIX-AUTH-014)
 * and guards /[locale]/dashboard/** (spec §2: role check at the middleware
 * layer, not just per-page). The guard is deliberately redundant with
 * `requireRole()` in each dashboard page and with RLS — a session check
 * here can't leak data even if it's wrong, since RLS is still the real
 * backstop. What it buys is a single place that catches a future dashboard
 * route someone forgets to add `requireRole()` to, instead of relying on
 * every page remembering to.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';

const PUBLIC_FILE = /\.(.*)$/;

type CookieList = { name: string; value: string; options: CookieOptions }[];

/**
 * Supabase client bound to this request, collecting any cookies the auth
 * library wants to write so the caller can copy them onto the response.
 *
 * middleware() and guardDashboard() share one client on purpose: getUser()
 * is a network round trip, and the guard needs exactly the user the refresh
 * just produced.
 */
function sessionClient(request: NextRequest) {
  const cookiesToSet: CookieList = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: CookieList) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.push(...list);
        },
      },
    },
  );

  return { supabase, cookiesToSet };
}

/** Copies refreshed auth cookies onto an outgoing response. */
function withCookies(response: NextResponse, cookiesToSet: CookieList) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

/**
 * True when the browser is carrying a Supabase session at all.
 *
 * Signed-out visitors are the common case on public pages, and for them a
 * refresh would be a pointless network round trip on every navigation —
 * there is no token to rotate. @supabase/ssr names its cookies
 * `sb-<project-ref>-auth-token`, optionally chunked with a `.0`/`.1`
 * suffix, so a prefix test is the stable way to spot one.
 */
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('auth-token'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // FIX-SEC-001: x-nd-user-* arriving from outside is forged by definition —
  // guardDashboard() below is the only legitimate writer. Strip on every path,
  // including /api, before anything downstream can read them.
  request.headers.delete('x-nd-user-id');
  request.headers.delete('x-nd-user-role');

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/auth/callback' ||
    PUBLIC_FILE.test(pathname)
  ) {
    // next({ request }) is required for the header deletion above to reach the
    // handler; a bare next() forwards the original, unmodified headers.
    return NextResponse.next({ request });
  }

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (!hasLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = (LOCALES as readonly string[]).includes(cookieLocale ?? '') ? cookieLocale! : DEFAULT_LOCALE;

    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, path: '/' });
    // No session refresh here on purpose: the browser immediately re-requests
    // the localised URL, and that request goes through the refresh below.
    return response;
  }

  const locale = pathname.split('/')[1] as Locale;
  const rest = pathname.slice(`/${locale}`.length) || '/';
  const isDashboard = rest === '/dashboard' || rest.startsWith('/dashboard/');

  // FIX-AUTH-014: refresh the session on every page, not just /dashboard/**.
  //
  // Supabase access tokens last an hour. Renewing one spends the refresh
  // token and issues a new pair, and the spent token stops working the moment
  // it is used — so whoever triggers a renewal MUST persist the new cookies,
  // or the session is destroyed rather than extended.
  //
  // This used to run inside guardDashboard() only. Public pages render
  // Header.tsx, which calls getUser() through routeClient(); that renewed the
  // token too, but routeClient() cannot write cookies from a Server Component
  // and silently discards them (see the catch there). An hour spent browsing
  // the store was therefore enough to burn the refresh token and log the
  // visitor out — the intermittent "logged out on its own" report this fixes.
  // Middleware is the only layer that can both refresh and persist.
  if (!isDashboard && !hasSessionCookie(request)) {
    return NextResponse.next({ request });
  }

  const { supabase, cookiesToSet } = sessionClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isDashboard) {
    return guardDashboard(request, locale, rest, supabase, user, cookiesToSet);
  }

  return withCookies(NextResponse.next({ request }), cookiesToSet);
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
 * only place that sets them, and middleware() strips any inbound copy first,
 * so a client cannot supply its own. RLS independently re-validates the real
 * session cookie for every data query on top of that.
 *
 * Authorisation that leads to a serviceClient() call must still not rely on
 * these headers — serviceClient bypasses RLS, so there is no second backstop.
 * Such call sites use getVerifiedProfile() instead.
 *
 * Takes the already-refreshed client and user from middleware() rather than
 * building its own, so the dashboard still costs one getUser() round trip,
 * exactly as before FIX-AUTH-014.
 */
async function guardDashboard(
  request: NextRequest,
  locale: Locale,
  path: string,
  supabase: ReturnType<typeof sessionClient>['supabase'],
  user: { id: string } | null,
  cookiesToSet: CookieList,
) {
  // Carry the cookies even when signing out: if the session was already dead,
  // the auth library clears its cookies, and that clearing has to stick too.
  if (!user) {
    return withCookies(NextResponse.redirect(new URL(`/${locale}/auth`, request.url)), cookiesToSet);
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role ?? 'ghost';

  const needsModder = path.startsWith('/dashboard/queue') || path.startsWith('/dashboard/jobs');
  const needsAdmin = path.startsWith('/dashboard/admin');

  if (needsAdmin && role !== 'admin') {
    return withCookies(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)), cookiesToSet);
  }
  if (needsModder && role !== 'modder' && role !== 'admin') {
    return withCookies(NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url)), cookiesToSet);
  }

  request.headers.set('x-nd-user-id', user.id);
  request.headers.set('x-nd-user-role', role);

  return withCookies(NextResponse.next({ request }), cookiesToSet);
}

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] };
