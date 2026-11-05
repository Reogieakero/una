"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRoutePending } from "./route-pending";
import {
  AboutSkeleton,
  AnnouncementsSkeleton,
  AppointmentsSkeleton,
  AuditTrailSkeleton,
  AvailabilitySkeleton,
  BackupsSkeleton,
  ChatSkeleton,
  CounselorDashboardSkeleton,
  CounselorReportsSkeleton,
  CrumbSkeleton,
  EmergencySkeleton,
  FacultyDashboardSkeleton,
  FacultyReportsSkeleton,
  FeedbackSkeleton,
  HeadDashboardSkeleton,
  HeadReportsSkeleton,
  NotificationsSkeleton,
  PanelShellSkeleton,
  ReferralsSkeleton,
  ReferStudentSkeleton,
  SecuritySkeleton,
  SessionsSkeleton,
  SettingsSkeleton,
  SkeletonRoot,
  StudentsSkeleton,
  UserFormSkeleton,
  UsersSkeleton,
} from "./skeletons";

function dashboardSkeleton(role: string | null) {
  if (role === "guidance_head") return <HeadDashboardSkeleton />;
  if (role === "faculty") return <FacultyDashboardSkeleton />;
  return <CounselorDashboardSkeleton />;
}

function reportsSkeleton(role: string | null) {
  if (role === "guidance_head") return <HeadReportsSkeleton />;
  if (role === "faculty") return <FacultyReportsSkeleton />;
  return <CounselorReportsSkeleton />;
}

/** Route-specific skeleton that mirrors the destination's `loading.tsx`. */
function skeletonFor(href: string, role: string | null): ReactNode {
  // Strip query/hash so `/reports?section=...` still resolves to its page.
  const path = href.split(/[?#]/)[0];
  switch (path) {
    case "/dashboard":
      return dashboardSkeleton(role);
    case "/reports":
      return reportsSkeleton(role);
    case "/sessions":
      return <SessionsSkeleton />;
    case "/appointments":
      return <AppointmentsSkeleton />;
    case "/availability":
      return <AvailabilitySkeleton />;
    case "/chat":
      return <ChatSkeleton />;
    case "/users":
      return <UsersSkeleton />;
    case "/users/new":
      return <UserFormSkeleton />;
    case "/students":
      return <StudentsSkeleton />;
    case "/referrals":
      return <ReferralsSkeleton />;
    case "/refer-student":
      return <ReferStudentSkeleton />;
    case "/emergency":
      return <EmergencySkeleton />;
    case "/announcements":
      return <AnnouncementsSkeleton />;
    case "/feedback":
      return <FeedbackSkeleton />;
    case "/security":
      return <SecuritySkeleton />;
    case "/security/audit":
      return <AuditTrailSkeleton />;
    case "/backups":
      return <BackupsSkeleton />;
    case "/settings":
      return <SettingsSkeleton />;
    case "/notifications":
      return <NotificationsSkeleton />;
    case "/about":
      return <AboutSkeleton />;
    default:
      return (
        <SkeletonRoot>
          <CrumbSkeleton />
          <div>
            <div className="h-7 w-56 rounded-lg bg-ink/10" />
            <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
          </div>
          <PanelShellSkeleton rows={3} />
        </SkeletonRoot>
      );
  }
}

/**
 * Swaps the outgoing page for the destination's skeleton the moment a nav
 * link is clicked. The App Router normally keeps the old page visible until
 * the destination's RSC payload arrives (middleware + data), so without this
 * the click looks stuck even though navigation has started.
 */
export function PendingRouteSkeleton({
  role,
  children,
}: {
  role: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { pendingHref } = useRoutePending();
  const pending = pendingHref !== null && pendingHref !== pathname;
  return <>{pending ? skeletonFor(pendingHref, role) : children}</>;
}
