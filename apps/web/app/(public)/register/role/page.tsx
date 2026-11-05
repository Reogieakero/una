import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/home";
import { AuthShell } from "@/components/auth/AuthShell";
import { RolePicker } from "@/components/auth/RolePicker";

/**
 * First-time staff land here from /auth/confirm (Google) or /register (email)
 * before any profile exists. This step decides whether the account is faculty
 * or guidance counselor; both start pending head approval (00075/00076).
 */
export default async function ChooseRolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, profile_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    if (profile.approval_status === "pending") redirect("/pending-approval");
    if (profile.approval_status === "rejected") redirect("/login?rejected=1");
    const incomplete =
      profile.profile_completed === false &&
      (profile.role === "faculty" || profile.role === "counselor");
    redirect(incomplete ? "/complete-profile" : homeForRole(profile.role));
  }

  return (
    <AuthShell
      variant="register"
      title="Join the staff portal"
      subtitle="Choose the role that matches you. A guidance head approves every new staff account."
    >
      <RolePicker />
    </AuthShell>
  );
}
