import { createClient as createJsClient } from "@supabase/supabase-js";

/**
 * Service-role client — SERVER ONLY (Route Handlers / Server Actions).
 * Bypasses RLS: every call must enforce RBAC in code first. Never import
 * from client components, never use a NEXT_PUBLIC_ key here.
 */
export function createAdminClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY: set it in apps/web/.env.local (server env, never public).",
    );
  }
  return createJsClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
