import type { DbClient } from "../platform";
import { createReferralSchema, updateReferralSchema } from "@dorsu/shared-schemas";

/**
 * Referral lifecycle (role-separated, mirrors appointments in
 * `appointments/mutations.ts` — different start line, same role split).
 *
 * Appointments start from the student booking directly; referrals start from
 * faculty flagging a student for session. From there the flow is the same:
 *
 *   pending (flagged, no counselor)
 *     -> assigned   (admin assigns a counselor)
 *     -> rejected   (admin rejects the referral)
 *   assigned
 *     -> confirmed  (counselor confirms, session gets scheduled)
 *     -> rejected   (admin rejects)
 *     -> pending    (admin clears the counselor)
 *   confirmed
 *     -> resolved   (counselor, session done — requires a confirmed session
 *                    with a schedule, enforced below)
 *
 * Terminal: resolved, rejected.
 * Legacy: acknowledged, in_progress, escalated stay valid so existing rows
 * keep working; escalate remains available from any active step.
 * Each mutation guards its from-statuses so rows can never skip a step,
 * even if the UI is bypassed. RLS + rbac.ts own WHO may call WHAT.
 */

/** Who may move a referral TO each status — mirrors the appointments split:
// admin assigns + rejects, counselor confirms + resolves + escalates. A row
// can never read "resolved" unless a counselor resolved it, even if the UI
// is bypassed. */
const REFERRAL_MOVE_ROLES: Record<string, string[]> = {
  pending: ["guidance_head"],
  assigned: ["guidance_head"],
  rejected: ["guidance_head"],
  confirmed: ["counselor"],
  resolved: ["counselor"],
  escalated: ["counselor"],
  acknowledged: ["counselor"],
  in_progress: ["counselor"],
};

const REFERRAL_MOVE_ROLE_ERRORS: Record<string, string> = {
  pending: "Can't unassign a referral — only the guidance head can manage assignment.",
  assigned: "Can't assign a referral — only the guidance head can assign a counselor.",
  rejected: "Can't reject a referral — only the guidance head can reject it.",
  confirmed: "Can't confirm a referral — only the assigned counselor can confirm it.",
  resolved: "Can't resolve a referral — only the handling counselor can resolve it.",
  escalated: "Can't escalate a referral — only the handling counselor can escalate it.",
  acknowledged: "Can't acknowledge a referral — only the handling counselor can triage it.",
  in_progress: "Can't start a referral — only the handling counselor can triage it.",
};

/** Valid status moves (same-status reassignment is always allowed). */
const REFERRAL_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "rejected", "escalated"],
  assigned: ["confirmed", "rejected", "pending", "escalated", "acknowledged"],
  confirmed: ["resolved", "escalated"],
  acknowledged: ["in_progress", "resolved", "escalated", "assigned", "confirmed"],
  in_progress: ["resolved", "escalated", "confirmed"],
  escalated: ["acknowledged", "resolved", "assigned", "confirmed"],
  resolved: [],
  rejected: [],
};

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

/** Counseling staff triages a referral and appends to the audit trail.
 *
 * Status moves must follow REFERRAL_TRANSITIONS (no skipping steps), the
 * actor must hold a role in REFERRAL_MOVE_ROLES for the target status (a
 * head can never resolve / confirm / escalate; a counselor can never
 * assign / reject), and — same flow discipline as appointment sessions — a
 * referral can only move to `resolved` once the referred student has a
 * confirmed session with a schedule (confirmed/completed appointment with
 * scheduled_at set).
 * Assigned/pending requests don't count.
 */
export async function triageReferral(
  db: DbClient,
  input: {
    referralId: string;
    actorProfileId: string;
    status: "assigned" | "acknowledged" | "in_progress" | "confirmed" | "resolved" | "escalated" | "rejected" | "pending";
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
  const { data: current, error: curErr } = await db
    .from("referrals")
    .select("status, student_id")
    .eq("id", parsed.referralId)
    .single();
  if (curErr || !current) throw curErr ?? new Error("Referral not found.");
  const cur = current as { status: string; student_id: string };
  // Role gate — who may move a referral TO the target status. Checked
  // before the transition gate so a head can never resolve (or confirm /
  // escalate) and a counselor can never assign / reject, UI or not.
  const { data: actor } = await db
    .from("profiles")
    .select("role")
    .eq("id", input.actorProfileId)
    .single();
  const actorRole = (actor as { role: string } | null)?.role ?? null;
  if (!(REFERRAL_MOVE_ROLES[parsed.status] ?? []).includes(actorRole ?? "")) {
    throw new Error(REFERRAL_MOVE_ROLE_ERRORS[parsed.status] ?? `Can't move a referral to ${parsed.status}.`);
  }
  const reassignOnly =
    parsed.status === cur.status && parsed.assignedCounselorId !== undefined;
  if (!reassignOnly && !(REFERRAL_TRANSITIONS[cur.status] ?? []).includes(parsed.status)) {
    throw new Error(`Can't move a referral from ${cur.status} to ${parsed.status}.`);
  }
  if (parsed.status === "resolved") {
    const { data: session } = await db
      .from("appointments")
      .select("id")
      .eq("student_id", cur.student_id)
      .in("status", ["confirmed", "completed"])
      .not("scheduled_at", "is", null)
      .limit(1)
      .maybeSingle();
    if (!session) {
      throw new Error(
        "Resolve needs a confirmed session first — confirm the student's appointment with its schedule before closing this referral."
      );
    }
  }
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

/**
 * Admin assigns (or clears with null) a counselor.
 * pending/assigned + counselor  -> assigned
 * assigned + null               -> pending (unassign)
 */
export async function assignReferral(
  db: DbClient,
  referralId: string,
  counselorId: string | null,
  actorProfileId: string,
) {
  if (counselorId) {
    const { data: counselor } = await db
      .from("counselors")
      .select("id")
      .eq("id", counselorId)
      .maybeSingle();
    if (!counselor) throw new Error("Unknown counselor.");
    return triageReferral(db, {
      referralId,
      actorProfileId,
      status: "assigned",
      assignedCounselorId: counselorId,
      actionNote: "Assigned to counselor",
    });
  }
  return triageReferral(db, {
    referralId,
    actorProfileId,
    status: "pending",
    assignedCounselorId: null,
    actionNote: "Unassigned",
  });
}

/** Admin rejects a referral (terminal — pending/assigned only). */
export async function rejectReferral(db: DbClient, referralId: string, actorProfileId: string) {
  return triageReferral(db, { referralId, actorProfileId, status: "rejected" });
}

/** Counselor confirms an assigned referral (assignment gate — no skipping pending). */
export async function confirmReferral(db: DbClient, referralId: string, actorProfileId: string) {
  return triageReferral(db, { referralId, actorProfileId, status: "confirmed" });
}
