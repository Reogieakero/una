import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { UserRole } from "@dorsu/shared-types";

/** Server-side role guard for route-group layouts (policy source: rbac.ts). */
export async function requireRole(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if ((profile as { is_active?: boolean | null }).is_active === false) {
    // Deactivated by admin — drop the session so no guarded page renders.
    await (await createClient()).auth.signOut();
    redirect("/login?deactivated=1");
  }
  if (!allowed.includes(profile.role as UserRole)) redirect("/");
  return profile;
}
