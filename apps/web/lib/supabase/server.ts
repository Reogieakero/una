import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { resolveSupabaseEnv, type TypedSupabaseClient } from "@dorsu/supabase-client";

/** Server Supabase client (cookie-based, per-request). Wraps shared config. */
export async function createClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Current profile (id + role) for RBAC guards. Layouts fetch it once via
 * requireRole() and pass it down (StaffShell → StaffSidebar) so one
 * navigation costs a single lookup instead of one per component.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, is_active")
    .eq("id", user.id)
    .single();
  return data;
}
