"use client";

import {
  CounselorDashboardSkeleton,
  FacultyDashboardSkeleton,
  HeadDashboardSkeleton,
} from "@/components/shared/skeletons";
import { useShellRole } from "@/components/shared/shell-role";

/**
 * Role-aware dashboard skeleton.
 *
 * Deliberately client-side: the role comes from the staff shell, which
 * already resolved it in the layout. Awaiting `getCurrentProfile()` here
 * would delay the fallback itself, leaving the previous page on screen.
 */
export default function Loading() {
  const role = useShellRole();
  if (role === "faculty") return <FacultyDashboardSkeleton />;
  if (role === "guidance_head") return <HeadDashboardSkeleton />;
  return <CounselorDashboardSkeleton />;
}
