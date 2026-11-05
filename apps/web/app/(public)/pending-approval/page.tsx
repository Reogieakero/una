import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/home";
import { AuthShell } from "@/components/auth/AuthShell";
import { PendingApprovalNotice } from "@/components/auth/PendingApprovalNotice";

/**
 * Faculty/counselor self-signup holds here until a guidance head approves the
 * account (00075/00076). Approved users are bounced to /complete-profile (or
 * straight to their workspace if they are already set up), so this screen is
 * safe to bookmark.
 */
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, approval_status, is_active, profile_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/register/role");
  if (profile.approval_status === "approved") {
    const incomplete =
      profile.profile_completed === false &&
      (profile.role === "faculty" || profile.role === "counselor");
    redirect(incomplete ? "/complete-profile" : homeForRole(profile.role));
  }
  if (profile.approval_status === "rejected") redirect("/login?rejected=1");

  const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const role = profile.role === "counselor" ? "counselor" : "faculty";
  const roleLabel = role === "counselor" ? "guidance counselor" : "faculty";

  return (
    <AuthShell
      variant="register"
      title="Waiting for approval"
      subtitle={`Thanks, ${firstName}. Your ${roleLabel} account is with the Guidance office.`}
    >
      <PendingApprovalNotice role={role} />
    </AuthShell>
  );
}
