'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Anon-key client for the browser — the only place auth.signIn* calls belong. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
