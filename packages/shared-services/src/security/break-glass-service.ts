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
