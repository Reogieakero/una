import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HeadDashboardView } from "@/components/shared/head-dashboard-view";
import { CounselorDashboardView } from "@/components/shared/counselor-dashboard-view";
import { FacultyDashboardView } from "@/components/shared/faculty-dashboard-view";

/**
 * Shared /dashboard — one URL, role-aware.
 * Lives in (staff) so counselor + guidance_head + faculty layouts can reach
 * it. All three branches render cached client views with the same data hook
 * pattern — the head sees a dark, landing-style office overview, the counselor
 * sees their personal queue, and faculty see their own referrals.
 */
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const approval = (profile as { approval_status?: string | null }).approval_status;
  if (approval === "pending") redirect("/pending-approval");
  if (approval === "rejected") redirect("/login?rejected=1");
  if ((profile as { is_active?: boolean | null }).is_active === false) redirect("/login?deactivated=1");
  if (profile.role === "faculty") {
    return <FacultyDashboardView name={profile.full_name} />;
  }
  if (profile.role === "counselor") {
    return <CounselorDashboardView name={profile.full_name} />;
  }
  if (profile.role === "guidance_head") return <HeadDashboardView name={profile.full_name} />;
  redirect("/");
}
