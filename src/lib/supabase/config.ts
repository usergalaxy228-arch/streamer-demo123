/**
 * Supabase environment configuration.
 *
 * These are read from env vars (see .env.local). We expose an
 * `isSupabaseConfigured` flag so the rest of the app can degrade gracefully
 * when keys aren't set yet — the clip generator still works, it just won't
 * persist history or gate on auth.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when both the project URL and anon key are present. */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
