import { requireRole } from "@/lib/auth/guard";
import { StaffShell } from "@/components/shared/staff-shell";
import { STAFF_NAV_GROUPS } from "@/components/shared/staff-nav";

/** Counselor group guard — policy source is rbac.ts, enforced here (principle #7). */
/* NOTE: title must stay identical across (admin)/(staff)/(counselor) layouts —
   the navbar is remounted on cross-group navigation, and any text difference
   shifts the centered menu and reads as the bar "moving". */
export default async function CounselorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["counselor", "guidance_head"]);
  return (
    <StaffShell title="Guidance" groups={STAFF_NAV_GROUPS} profile={profile}>
      {children}
    </StaffShell>
  );
}
