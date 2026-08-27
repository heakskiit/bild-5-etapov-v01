import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — RLS bypassed. Import ONLY from route handlers that run
 * on the server (webhooks, checkout). Never from a 'use client' file.
 */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
