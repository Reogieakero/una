import { getCurrentProfile } from "@/lib/supabase/server";
import {
  CounselorReportsSkeleton,
  FacultyReportsSkeleton,
  HeadReportsSkeleton,
} from "@/components/shared/skeletons";

/** Role-aware reports skeleton — 8 KPIs (counselor/head) vs 4 (faculty). */
export default async function Loading() {
  const profile = await getCurrentProfile().catch(() => null);
  const role = (profile as { role?: string } | null)?.role;
  if (role === "faculty") return <FacultyReportsSkeleton />;
  if (role === "guidance_head") return <HeadReportsSkeleton />;
  return <CounselorReportsSkeleton />;
}
