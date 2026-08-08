/**
 * Session-refresh helper used by the root middleware.
 *
 * On every request it refreshes the Supabase auth token (if any) and writes
 * the updated cookies onto the response so both server and browser clients see
 * a valid session. No-ops when Supabase isn't configured yet.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Without keys there's no session to refresh — pass the request through.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: touch getUser() so the token is refreshed and cookies are set.
  await supabase.auth.getUser();

  return response;
}
