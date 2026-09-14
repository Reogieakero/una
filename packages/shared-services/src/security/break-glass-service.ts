import type { DbClient } from "../platform";
import { breakGlassSchema } from "@dorsu/shared-schemas";

/** Break-glass requires a non-empty justification and always writes an audit row. */
export async function breakGlassAccess(
  db: DbClient,
  input: { accessorProfileId: string; studentId: string; justification: string },
) {
  const parsed = breakGlassSchema.parse({
    studentId: input.studentId,
    justification: input.justification,
  });
  // DB trigger trg_break_glass_audit appends to audit_logs automatically.
  const { data, error } = await db
    .from("break_glass_logs")
    .insert({
      accessor_profile_id: input.accessorProfileId,
      student_id: parsed.studentId,
      justification: parsed.justification,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Counselor caseload rule — Step 1 "Log emergency access" may only target
 * students on the counselor's caseload: an assigned appointment
 * (`appointments.counselor_id`) OR an assigned referral
 * (`referrals.assigned_counselor_id`). The head keeps the full directory.
 * Call with a privileged (service-role) client from API routes — RLS would
 * otherwise hide other students' rows from the caller.
 */
export async function isStudentOnCounselorCaseload(
  db: DbClient,
  input: { counselorProfileId: string; studentId: string },
): Promise<boolean> {
  const { data: counselor } = await db
    .from("counselors")
    .select("id")
    .eq("profile_id", input.counselorProfileId)
    .maybeSingle();
  const counselorId = (counselor as { id: string } | null)?.id ?? null;
  if (!counselorId) return false;
  const [{ data: appt }, { data: ref }] = await Promise.all([
    db
      .from("appointments")
      .select("id")
      .eq("counselor_id", counselorId)
      .eq("student_id", input.studentId)
      .limit(1)
      .maybeSingle(),
    db
      .from("referrals")
      .select("id")
      .eq("assigned_counselor_id", counselorId)
      .eq("student_id", input.studentId)
      .limit(1)
      .maybeSingle(),
  ]);
  return !!(appt ?? ref);
}

/** Leadership reviews a break-glass event (marks reviewer + timestamp). */
export async function reviewBreakGlass(
  db: DbClient,
  input: { logId: string; reviewerProfileId: string },
) {
  const { data, error } = await db
    .from("break_glass_logs")
    .update({ reviewed_by: input.reviewerProfileId, reviewed_at: new Date().toISOString() })
    .eq("id", input.logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
