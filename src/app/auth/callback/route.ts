/**
 * GET /auth/callback
 * Single fixed URL (register this exact path in Supabase Auth → URL
 * Configuration → Redirect URLs, and in the Discord OAuth app's redirect
 * list is NOT needed — Supabase's own callback is what Discord redirects
 * to; this route is what Supabase's client-side redirect lands on next).
 * `next` carries the locale-aware destination since this route itself
 * can't live under `/[locale]/` and still be one fixed URL to register.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { routeClient } from '@/lib/supabase/auth';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/i18n/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next');

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  // Only same-origin, non-protocol-relative paths. `new URL(next, origin)`
  // happily accepts an absolute URL and would hand the freshly authenticated
  // visitor straight to another site.
  const isSafeNext =
    !!requestedNext &&
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.startsWith('/\\');
  const next = isSafeNext ? requestedNext! : `/${locale}/dashboard`;

  if (code) {
    const supabase = await routeClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchange failed', error);
      return NextResponse.redirect(new URL(`/${locale}/auth?error=callback`, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
