import { requireRole } from "@/lib/auth/guard";
import { StaffShell } from "@/components/shared/staff-shell";
import { STAFF_NAV_GROUPS } from "@/components/shared/staff-nav";

/**
 * Shared staff routes (/appointments, /sessions, /availability, /chat, /emergency,
 * /referrals, /reports, /notifications, /students, /settings) live here ONCE.
 * Next.js cannot define the same URL in multiple route groups, so role
 * differences are handled inside the page (via rbac.ts), not via duplicate
 * (admin)/(faculty)/(personnel) folders. `admin` may enter the shell but
 * every page fails closed for it except the ones that explicitly allow it
 * (currently only /settings) — the sidebar likewise hides all other links.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["counselor", "guidance_head", "faculty", "admin"]);
  return (
    <StaffShell title="Guidance" groups={STAFF_NAV_GROUPS} profile={profile}>
      {children}
    </StaffShell>
  );
}
