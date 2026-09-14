"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { StaffSidebar, StaffSidebarSkeleton } from "./staff-sidebar";
import type { getCurrentProfile } from "@/lib/supabase/server";

type Profile = Awaited<ReturnType<typeof getCurrentProfile>>;

/** Routes that need every pixel (e.g. chat, the full-width handbook) render without the sidebar. */
const FULL_WIDTH_ROUTES = ["/chat", "/about"];

/**
 * Shell body — sidebar + content grid, except on full-width routes where
 * the page renders alone. Pathname-driven so all three staff layouts
 * (admin/staff/counselor) behave the same without per-page props.
 */
export function StaffShellBody({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  if (FULL_WIDTH_ROUTES.includes(pathname)) {
    return <div className="min-w-0">{children}</div>;
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Suspense fallback={<StaffSidebarSkeleton />}>
        <StaffSidebar profile={profile} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
