/**
 * Browser-side Supabase client.
 *
 * Use this in Client Components ("use client"). It reads/writes the session
 * from cookies via @supabase/ssr so it stays in sync with the server client.
 */

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
