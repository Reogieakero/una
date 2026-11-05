import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { UserRole } from "@dorsu/shared-types";

/** Server-side role guard for route-group layouts (policy source: rbac.ts). */
export async function requireRole(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const approval = (profile as { approval_status?: string | null }).approval_status;
  // Self-registered faculty wait here until the head approves (00075).
  if (approval === "pending") redirect("/pending-approval");
  if (approval === "rejected") {
    await (await createClient()).auth.signOut();
    redirect("/login?rejected=1");
  }
  if ((profile as { is_active?: boolean | null }).is_active === false) {
    // Deactivated by admin — drop the session so no guarded page renders.
    await (await createClient()).auth.signOut();
    redirect("/login?deactivated=1");
  }
  // Approved self-registered staff finish their real profile before the shell
  // renders (00076).
  const completed = (profile as { profile_completed?: boolean | null }).profile_completed;
  if (
    completed === false &&
    (profile.role === "faculty" || profile.role === "counselor")
  ) {
    redirect("/complete-profile");
  }
  if (!allowed.includes(profile.role as UserRole)) redirect("/");
  return profile;
}
