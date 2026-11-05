"use client";

import {
  CounselorReportsSkeleton,
  FacultyReportsSkeleton,
  HeadReportsSkeleton,
} from "@/components/shared/skeletons";
import { useShellRole } from "@/components/shared/shell-role";

/**
 * Role-aware reports skeleton — rendered synchronously from the shell's
 * already-resolved role so it appears immediately on navigation.
 */
export default function Loading() {
  const role = useShellRole();
  if (role === "faculty") return <FacultyReportsSkeleton />;
  if (role === "guidance_head") return <HeadReportsSkeleton />;
  return <CounselorReportsSkeleton />;
}
