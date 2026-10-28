import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@dorsu/shared-types";
import { resolveSupabaseEnv, type TypedSupabaseClient } from "@dorsu/supabase-client";

let cached: TypedSupabaseClient | null = null;

/**
 * Mobile Supabase client (AsyncStorage session persistence).
 * Connection config shared; only the storage adapter lives here (principle #5).
 */
export function getSupabase(): TypedSupabaseClient {
  if (cached) return cached;
  const { url, anonKey } = resolveSupabaseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env["EXPO_PUBLIC_SUPABASE_URL"],
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"],
  });
  cached = createClient<Database>(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // The app handles the OAuth/deep-link redirect itself (googleAuth.ts),
      // so the SDK must not try to parse the URL. PKCE stores the verifier in
      // AsyncStorage and we exchange the returned code for a session.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return cached;
}
