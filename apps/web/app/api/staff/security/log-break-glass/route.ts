import { NextResponse } from "next/server";
import { breakGlassSchema } from "@dorsu/shared-schemas";
import { isStudentOnCounselorCaseload } from "@dorsu/shared-services";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/staff/security/log-break-glass — Step 1 "Log emergency access".
 *
 * Counselor scope (enforced here, not just in the UI dropdown): a counselor
 * may only log access for students on their caseload — an assigned
 * appointment (`appointments.counselor_id`) OR an assigned referral
 * (`referrals.assigned_counselor_id`). The guidance head keeps the full
 * directory. Browser clients must use this route so the check cannot be
 * bypassed with a direct table insert.
 */
export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = breakGlassSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  const callerRole = (callerProfile as { role: string } | null)?.role ?? null;
  if (!callerRole || !["counselor", "guidance_head"].includes(callerRole)) {
    return NextResponse.json({ error: "Only counselors and the guidance head may log emergency access." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Counselor gate — must be on caseload (referred student or assigned appointment).
  if (callerRole === "counselor") {
    const onCaseload = await isStudentOnCounselorCaseload(admin, {
      counselorProfileId: caller.id,
      studentId: parsed.data.studentId,
    });
    if (!onCaseload) {
      return NextResponse.json(
        { error: "Only students from your assigned appointments and referrals are eligible for emergency access." },
        { status: 403 }
      );
    }
  }

  const { data, error } = await admin
    .from("break_glass_logs")
    .insert({
      accessor_profile_id: caller.id,
      student_id: parsed.data.studentId,
      justification: parsed.data.justification,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Couldn't log that access." }, { status: 500 });

  return NextResponse.json({ ok: true, log: data });
}
