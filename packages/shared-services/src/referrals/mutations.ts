import type { DbClient } from "../platform";
import { createReferralSchema, updateReferralSchema } from "@dorsu/shared-schemas";

/** Faculty/personnel flags a student; at least one referrer side required. */
export async function createReferral(
  db: DbClient,
  input: {
    studentId: string;
    reason: string;
    priority?: "low" | "medium" | "high" | "urgent";
    referringFacultyId?: string;
    referringPersonnelId?: string;
    assignedCounselorId?: string;
  },
) {
  if (!input.referringFacultyId && !input.referringPersonnelId) {
    throw new Error("Referral needs a faculty or personnel referrer");
  }
  const parsed = createReferralSchema.parse({
    studentId: input.studentId,
    reason: input.reason,
    priority: input.priority ?? "medium",
    assignedCounselorId: input.assignedCounselorId,
  });
  const { data, error } = await db
    .from("referrals")
    .insert({
      referring_faculty_id: input.referringFacultyId ?? null,
      referring_personnel_id: input.referringPersonnelId ?? null,
      student_id: parsed.studentId,
      reason: parsed.reason,
      priority: parsed.priority,
      assigned_counselor_id: parsed.assignedCounselorId ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Counseling staff triages a referral and appends to the audit trail. */
export async function triageReferral(
  db: DbClient,
  input: {
    referralId: string;
    actorProfileId: string;
    status: "acknowledged" | "in_progress" | "resolved" | "escalated";
    assignedCounselorId?: string | null;
    actionNote?: string;
  },
) {
  const parsed = updateReferralSchema.parse({
    referralId: input.referralId,
    status: input.status,
    assignedCounselorId: input.assignedCounselorId ?? undefined,
    actionNote: input.actionNote,
  });
  const { data, error } = await db
    .from("referrals")
    .update({
      status: parsed.status,
      ...(parsed.assignedCounselorId !== undefined
        ? { assigned_counselor_id: parsed.assignedCounselorId }
        : {}),
    })
    .eq("id", parsed.referralId)
    .select()
    .single();
  if (error) throw error;
  const { error: actErr } = await db.from("referral_actions").insert({
    referral_id: parsed.referralId,
    actor_profile_id: input.actorProfileId,
    action: parsed.status,
    note: parsed.actionNote ?? null,
  });
  if (actErr) throw actErr;
  return data;
}
