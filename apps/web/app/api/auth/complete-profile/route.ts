import { NextResponse } from "next/server";
import { completeStaffProfileSchema } from "@dorsu/shared-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/home";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/complete-profile — an approved self-registered counselor or
 * faculty fills in their real name and staff details (00076).
 *
 * Runs with the service role because `profiles.full_name`/`profile_completed`
 * and the staff row must be written together. The caller is re-checked here:
 * approved + self-service staff + not already completed.
 */
const STAFF_ROLES = new Set(["faculty", "counselor"]);

export async function POST(request: Request) {
  const gate = hitRateLimit(`complete-profile:${clientIp(request)}`, 20, 10 * 60 * 1000);
  if (gate.limited) {
    return NextResponse.json(
      { error: "Too many attempts — please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = completeStaffProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, approval_status, profile_completed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const row = profile as {
    role: string;
    approval_status: string;
    profile_completed: boolean;
  };
  if (!STAFF_ROLES.has(row.role)) {
    return NextResponse.json({ error: "This account has no staff profile to complete." }, { status: 400 });
  }
  if (row.approval_status !== "approved") {
    return NextResponse.json({ error: "Wait for guidance-head approval first." }, { status: 409 });
  }
  if (row.profile_completed) {
    return NextResponse.json({ ok: true, redirectTo: homeForRole(row.role) });
  }

  const { fullName, employeeNo, department, specialization } = parsed.data;
  const clean = (value: string | undefined) => (value?.trim() ? value.trim() : null);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName.trim(), profile_completed: true })
    .eq("id", user.id);
  if (profileError) {
    return NextResponse.json({ error: "Couldn't save your profile. Please try again." }, { status: 500 });
  }

  const table = row.role === "counselor" ? "counselors" : "faculty_members";
  const extra =
    row.role === "counselor"
      ? { specialization: clean(specialization) }
      : { department: clean(department) };
  const { error: staffError } = await admin
    .from(table)
    .upsert(
      { profile_id: user.id, employee_no: clean(employeeNo), ...extra },
      { onConflict: "profile_id" },
    );
  if (staffError) {
    // Roll the completion flag back so the user is asked again.
    await admin.from("profiles").update({ profile_completed: false }).eq("id", user.id);
    const duplicate = /duplicate|unique|23505/i.test(staffError.message);
    return NextResponse.json(
      {
        error: duplicate
          ? "That employee number is already in use. Check it with the Guidance office."
          : "Couldn't save your staff details. Please try again.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, redirectTo: homeForRole(row.role) });
}
