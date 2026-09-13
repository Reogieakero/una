import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseEnv, type TypedSupabaseClient } from "@dorsu/supabase-client";

/**
 * Browser Supabase client (cookie-based). Connection config comes from the
 * shared package; only the cookie storage adapter lives here (principle #5).
 */
export function createClient(): TypedSupabaseClient {
  const { url, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  return createBrowserClient(url, anonKey);
}
