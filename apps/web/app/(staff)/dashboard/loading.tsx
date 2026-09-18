import { getCurrentProfile } from "@/lib/supabase/server";
import {
  CounselorDashboardSkeleton,
  FacultyDashboardSkeleton,
  HeadDashboardSkeleton,
} from "@/components/shared/skeletons";

/** Role-aware dashboard skeleton — matches the real per-role layout. */
export default async function Loading() {
  const profile = await getCurrentProfile().catch(() => null);
  const role = (profile as { role?: string } | null)?.role;
  if (role === "faculty") return <FacultyDashboardSkeleton />;
  if (role === "guidance_head") return <HeadDashboardSkeleton />;
  return <CounselorDashboardSkeleton />;
}
