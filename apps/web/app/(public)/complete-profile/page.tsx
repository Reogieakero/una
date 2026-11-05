import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/home";
import { AuthShell } from "@/components/auth/AuthShell";
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm";

/**
 * Post-approval setup for self-registered staff (00076). The account was
 * created from an email address alone, so this is where the real name and the
 * role-specific details land. Only approved, incomplete counselors/faculty see
 * this screen; everyone else is routed away.
 */
export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name, approval_status, profile_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileData) redirect("/register/role");
  const profile = profileData as {
    role: string;
    full_name: string | null;
    approval_status: string;
    profile_completed: boolean;
  };

  if (profile.approval_status === "pending") redirect("/pending-approval");
  if (profile.approval_status === "rejected") redirect("/login?rejected=1");
  if (profile.role !== "faculty" && profile.role !== "counselor") {
    redirect(homeForRole(profile.role));
  }
  if (profile.profile_completed) redirect(homeForRole(profile.role));

  const role = profile.role as "faculty" | "counselor";
  let employeeNo = "";
  let department = "";
  let specialization = "";

  if (role === "faculty") {
    const { data } = await supabase
      .from("faculty_members")
      .select("employee_no, department")
      .eq("profile_id", user.id)
      .maybeSingle();
    const row = data as { employee_no: string | null; department: string | null } | null;
    employeeNo = row?.employee_no ?? "";
    department = row?.department ?? "";
  } else {
    const { data } = await supabase
      .from("counselors")
      .select("employee_no, specialization")
      .eq("profile_id", user.id)
      .maybeSingle();
    const row = data as { employee_no: string | null; specialization: string | null } | null;
    employeeNo = row?.employee_no ?? "";
    specialization = row?.specialization ?? "";
  }

  const roleLabel = role === "counselor" ? "guidance counselor" : "faculty";

  return (
    <AuthShell
      variant="register"
      title="Finish your staff profile"
      subtitle={`Your ${roleLabel} account is approved. Add your real details so students and colleagues can identify you.`}
    >
      <CompleteProfileForm
        role={role}
        defaultValues={{
          fullName: profile.full_name ?? "",
          employeeNo,
          department,
          specialization,
        }}
      />
    </AuthShell>
  );
}
