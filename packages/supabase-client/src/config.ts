import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dorsu/shared-types";

/**
 * Single source of truth for Supabase connection config.
 * Platform-specific code (cookie storage on web, AsyncStorage on mobile)
 * lives in each app's `lib/supabase/*` wrapper — this package only resolves
 * URL/key and exposes a typed factory type. No `localStorage`, no
 * `AsyncStorage`, no `fetch` overrides here (principle #1).
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Resolve URL + anon key from either web (NEXT_PUBLIC_*) or mobile (EXPO_PUBLIC_*) envs. */
export function resolveSupabaseEnv(env: Record<string, string | undefined>): SupabaseEnv {
  const url =
    env["NEXT_PUBLIC_SUPABASE_URL"] ?? env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
  const anonKey =
    env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (web) or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (mobile).",
    );
  }
  return { url, anonKey };
}

/** Default client factory for scripts/tests; apps pass their own storage adapter. */
export function createTypedClient(
  env: SupabaseEnv,
  options?: Parameters<typeof createClient<Database>>[2],
): TypedSupabaseClient {
  return createClient<Database>(env.url, env.anonKey, options);
}
