import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HeadDashboardView } from "@/components/shared/head-dashboard-view";
import { CounselorDashboardView } from "@/components/shared/counselor-dashboard-view";

/**
 * Shared /dashboard — one URL, role-aware.
 * Lives in (staff) so both counselor + guidance_head layouts can reach it.
 * Faculty is redirected to their home (/referrals).
 * Both branches render cached client views with the same layout (header +
 * Stats dropdown, content + 320px rail grid, list-style quick links) — the
 * head sees office-wide data, the counselor sees their personal queue.
 */
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if ((profile as { is_active?: boolean | null }).is_active === false) redirect("/login?deactivated=1");
  if (profile.role === "faculty") redirect("/referrals");
  if (profile.role === "counselor") {
    return <CounselorDashboardView name={profile.full_name} />;
  }
  if (profile.role === "guidance_head") return <HeadDashboardView />;
  redirect("/");
}
