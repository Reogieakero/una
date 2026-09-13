import { requireRole } from "@/lib/auth/guard";
import { StaffShell } from "@/components/shared/staff-shell";
import { STAFF_NAV_GROUPS } from "@/components/shared/staff-nav";

/**
 * Shared staff routes (/appointments, /availability, /chat, /emergency,
 * /referrals, /reports, /notifications, /students) live here ONCE.
 * Next.js cannot define the same URL in multiple route groups, so role
 * differences are handled inside the page (via rbac.ts), not via duplicate
 * (admin)/(faculty)/(personnel) folders.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["counselor", "guidance_head", "faculty"]);
  return (
    <StaffShell title="Guidance" groups={STAFF_NAV_GROUPS} profile={profile}>
      {children}
    </StaffShell>
  );
}
