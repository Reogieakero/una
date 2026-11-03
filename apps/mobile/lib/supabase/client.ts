import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import type { Database } from "@dorsu/shared-types";
import { resolveSupabaseEnv, type TypedSupabaseClient } from "@dorsu/supabase-client";

let cached: TypedSupabaseClient | null = null;

/**
 * Mobile Supabase client (AsyncStorage session persistence).
 * Connection config shared; only the storage adapter lives here (principle #5).
 *
 * EXPO_PUBLIC_* env vars are injected at build time, but EAS/local Gradle
 * builds do not upload the gitignored `.env.local`. The public URL + anon key
 * are therefore also embedded in app.json `extra` as a fallback so release
 * APKs never launch without config (that used to throw in the root layout and
 * kill the app). Env vars still win when present.
 */
export function getSupabase(): TypedSupabaseClient {
  if (cached) return cached;
  const extra = Constants.expoConfig?.extra ?? {};
  const { url, anonKey } = resolveSupabaseEnv({
    EXPO_PUBLIC_SUPABASE_URL:
      process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? extra["supabaseUrl"],
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? extra["supabaseAnonKey"],
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
