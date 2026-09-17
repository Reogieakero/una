import type { DbClient } from "../platform";
import { createReferralSchema, updateReferralSchema } from "@dorsu/shared-schemas";
import { isMeetUrl, isMissingEndsAtColumn, validateCounselorSchedule } from "../appointments/mutations";

/**
 * Referral lifecycle (role-separated, mirrors appointments in
 * `appointments/mutations.ts` — different start line, same role split).
 *
 * Appointments start from the student booking directly; referrals start from
 * faculty flagging a student for session. From there the flow is the same:
 *
 *   pending (flagged, no counselor)
 *     -> assigned   (admin assigns a counselor)
 *     -> rejected   (admin rejects the referral — pending only; unassign first)
 *   assigned
 *     -> confirmed  (counselor confirms, session gets scheduled)
 *     -> pending    (admin clears the counselor — reject from here instead)
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

/** Valid status moves (same-status reassignment is always allowed). Reject is
 * pending-only: once a counselor is assigned the referral must be unassigned
 * back to pending before it can be rejected. */
const REFERRAL_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "rejected", "escalated"],
  assigned: ["confirmed", "pending", "escalated", "acknowledged"],
  confirmed: ["resolved", "escalated"],
  acknowledged: ["in_progress", "resolved", "escalated", "assigned", "confirmed"],
  in_progress: ["resolved", "escalated", "confirmed"],
  escalated: ["acknowledged", "resolved", "assigned", "confirmed"],
  resolved: [],
  rejected: [],
};

/** Faculty/personnel flags a student; at least one referrer side required.
 * Walk-ins (no account yet) file with typed name/number instead of studentId. */
export async function createReferral(
  db: DbClient,
  input: {
    studentId?: string;
    studentNameText?: string;
    studentNoText?: string;
    reason: string;
    priority?: "low" | "medium" | "high" | "urgent";
    studentGender?: string;
    studentAge?: string;
    relationToClient?: string;
    caseClassification: string[];
    classificationOther?: string;
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
    studentNameText: input.studentNameText || undefined,
    studentNoText: input.studentNoText || undefined,
    reason: input.reason,
    priority: input.priority ?? "medium",
    studentGender: input.studentGender || undefined,
    studentAge: input.studentAge || undefined,
    relationToClient: input.relationToClient || undefined,
    caseClassification: input.caseClassification,
    classificationOther: input.classificationOther || undefined,
    assignedCounselorId: input.assignedCounselorId,
  });
  const { data, error } = await db
    .from("referrals")
    .insert({
      referring_faculty_id: input.referringFacultyId ?? null,
      referring_personnel_id: input.referringPersonnelId ?? null,
      student_id: parsed.studentId ?? null,
      student_name_text: parsed.studentNameText || null,
      student_no_text: parsed.studentNoText || null,
      reason: parsed.reason,
      priority: parsed.priority,
      student_gender: parsed.studentGender || null,
      student_age: parsed.studentAge || null,
      relation_to_client: parsed.relationToClient || null,
      case_classification: parsed.caseClassification,
      classification_other: parsed.classificationOther || null,
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
  const [curR, actorR] = await Promise.allSettled([
    db.from("referrals").select("status, student_id, assigned_counselor_id").eq("id", parsed.referralId).single(),
    // Own profile row is always readable — full_name rides along free so the
    // trail row can stamp the actor's display name (faculty cannot resolve
    // names via profiles RLS, so the stamp is their only channel).
    db.from("profiles").select("role, full_name").eq("id", input.actorProfileId).single(),
  ]);
  if (curR.status === "rejected") throw curR.reason ?? new Error("Referral not found.");
  const { data: current, error: curErr } = curR.value;
  if (curErr || !current) throw curErr ?? new Error("Referral not found.");
  const cur = current as { status: string; student_id: string | null; assigned_counselor_id: string | null };
  // Role gate — who may move a referral TO the target status. Checked
  // before the transition gate so a head can never resolve (or confirm /
  // escalate) and a counselor can never assign / reject, UI or not.
  const actor = actorR.status === "fulfilled" ? actorR.value.data : null;
  const actorRole = (actor as { role: string } | null)?.role ?? null;
  const actorName = (actor as { full_name: string | null } | null)?.full_name ?? null;
  if (!(REFERRAL_MOVE_ROLES[parsed.status] ?? []).includes(actorRole ?? "")) {
    throw new Error(REFERRAL_MOVE_ROLE_ERRORS[parsed.status] ?? `Can't move a referral to ${parsed.status}.`);
  }
  // Counselor ownership — a counselor may only triage referrals the admin
  // assigned to them (mirrors the RLS row scope with a clear message).
  if (actorRole === "counselor") {
    const { data: mine } = await db
      .from("counselors")
      .select("id")
      .eq("profile_id", input.actorProfileId)
      .maybeSingle();
    const myCounselorId = (mine as { id: string } | null)?.id ?? null;
    if (!myCounselorId || cur.assigned_counselor_id !== myCounselorId) {
      throw new Error("Can't triage a referral — only the assigned counselor can work on it.");
    }
  }
  const reassignOnly =
    parsed.status === cur.status && parsed.assignedCounselorId !== undefined;
  if (!reassignOnly && !(REFERRAL_TRANSITIONS[cur.status] ?? []).includes(parsed.status)) {
    throw new Error(`Can't move a referral from ${cur.status} to ${parsed.status}.`);
  }
  if (parsed.status === "resolved") {
    // A confirmed session with a schedule unlocks resolve. Linked students
    // match any of their sessions; walk-ins (NULL student) match the session
    // minted from this referral.
    let session: { id: string } | null = null;
    if (cur.student_id) {
      const { data } = await db
        .from("appointments")
        .select("id")
        .eq("student_id", cur.student_id)
        .in("status", ["confirmed", "completed"])
        .not("scheduled_at", "is", null)
        .limit(1)
        .maybeSingle();
      session = (data as { id: string } | null) ?? null;
    }
    if (!session) {
      const { data } = await db
        .from("appointments")
        .select("id")
        .eq("source_referral_id", parsed.referralId)
        .in("status", ["confirmed", "completed"])
        .not("scheduled_at", "is", null)
        .limit(1)
        .maybeSingle();
      session = (data as { id: string } | null) ?? null;
    }
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
    actor_name: actorName,
    actor_role: actorRole,
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

/** Admin rejects a referral (terminal — pending only).
 * Once a counselor is assigned the referral can no longer be rejected;
 * unassign it back to pending first. */
export async function rejectReferral(db: DbClient, referralId: string, actorProfileId: string) {
  const { data: current, error: curErr } = await db
    .from("referrals")
    .select("status")
    .eq("id", referralId)
    .single();
  if (curErr || !current) throw curErr ?? new Error("Referral not found.");
  if ((current as { status: string }).status !== "pending") {
    throw new Error("Only pending referrals can be rejected. Unassign the counselor first.");
  }
  return triageReferral(db, { referralId, actorProfileId, status: "rejected" });
}

/** Counselor confirms an assigned referral (assignment gate — no skipping pending). */
export async function confirmReferral(db: DbClient, referralId: string, actorProfileId: string) {
  return triageReferral(db, { referralId, actorProfileId, status: "confirmed" });
}

/**
 * Structured trail note carrying the counselor-set session time AND mode.
 * Referrals has no scheduled_at column, so the confirm action stores
 * "Session scheduled for <ISO> (<mode>)" — boards parse it back (same
 * schedule discipline as appointment confirm, different storage). Older
 * notes without the mode suffix still parse (mode reads as unknown).
 */
export const REFERRAL_SCHEDULE_NOTE_PREFIX = "Session scheduled for ";

/**
 * Counselor confirms a referral AND mints its session in one move.
 *
 * assigned/escalated → confirmed, plus an appointments row (status
 * confirmed) linked via source_referral_id so the session lands on the
 * calendar/board and unblocks resolve. Re-confirming refreshes the same
 * row instead of minting duplicates (matched on source_referral_id while
 * still active); terminal sessions are left alone and a fresh row is cut.
 *
 * Guards (UI or not): the actor must be the assigned counselor; the slot
 * must be in the future; online sessions require a Google Meet link. The
 * student self-booking PSS-10 gate does not apply — this is counselor
 * judgment, and the insert runs under the counselor insert RLS policy
 * (00036), which only permits rows assigned to the caller.
 */
export async function confirmReferralWithSession(
  db: DbClient,
  input: {
    referralId: string;
    actorProfileId: string;
    scheduledAt: Date;
    mode: "in_person" | "online";
    meetingUrl?: string | null;
    endsAt?: Date | null;
  },
) {
  if (input.mode !== "in_person" && input.mode !== "online") {
    throw new Error("Unknown session mode.");
  }
  if (!(input.scheduledAt instanceof Date) || Number.isNaN(input.scheduledAt.getTime())) {
    throw new Error("Choose a valid session date and time");
  }
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new Error("Sessions must be scheduled in the future.");
  }
  const link = (input.meetingUrl ?? "").trim();
  if (input.mode === "online") {
    if (!link) {
      throw new Error("Add the Google Meet link for this online session.");
    }
    if (!isMeetUrl(link)) {
      throw new Error("That doesn't look like a Google Meet link — paste a meet.google.com link.");
    }
  } else if (link && !/^https:\/\//i.test(link)) {
    throw new Error("Meeting links must start with https://");
  }

  // Independent reads — one round-trip batch instead of three sequential hops.
  // allSettled preserves the old precedence: a missing referral reports
  // "Referral not found." even if a companion read also fails.
  const [mineR, refR, existingR] = await Promise.allSettled([
    db.from("counselors").select("id").eq("profile_id", input.actorProfileId).maybeSingle(),
    db
      .from("referrals")
      .select("id, status, student_id, reason, assigned_counselor_id")
      .eq("id", input.referralId)
      .single(),
    db
      .from("appointments")
      .select("id, status")
      .eq("source_referral_id", input.referralId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (refR.status === "rejected") throw refR.reason ?? new Error("Referral not found.");
  const myCounselorId =
    ((mineR.status === "fulfilled" ? mineR.value.data : null) as { id: string } | null)?.id ?? null;
  const { data: ref, error: refErr } = refR.value;
  const existing = existingR.status === "fulfilled" ? existingR.value.data : null;
  if (refErr || !ref) throw refErr ?? new Error("Referral not found.");
  const referral = ref as {
    id: string;
    status: string;
    student_id: string | null;
    reason: string;
    assigned_counselor_id: string | null;
  };
  // Walk-ins (no account yet) confirm with a scheduled session exactly like
  // linked students — the minted appointment simply carries a NULL student.
  if (referral.status !== "assigned" && referral.status !== "escalated") {
    throw new Error(`Can't confirm a referral from ${referral.status} — only assigned referrals can be confirmed.`);
  }
  if (!myCounselorId || referral.assigned_counselor_id !== myCounselorId) {
    throw new Error("Can't confirm a referral — only the assigned counselor can confirm it.");
  }

  const active = (existing as { id: string; status: string } | null)?.status ?? null;
  const refreshingId =
    existing && ["pending", "assigned", "confirmed"].includes(active ?? "")
      ? (existing as { id: string }).id
      : null;
  // Same availability scope + overlap gate as appointment confirm — the
  // minted session must sit inside the counselor's slots.
  const { startMs, endMs } = await validateCounselorSchedule(
    db,
    myCounselorId,
    input.scheduledAt,
    input.endsAt ?? null,
    refreshingId,
  );
  const iso = new Date(startMs).toISOString();
  const nowIso = new Date().toISOString();
  const sessionPatch = {
    counselor_id: myCounselorId,
    scheduled_at: iso,
    requested_datetime: iso,
    mode: input.mode,
    status: "confirmed",
    confirmed_datetime: nowIso,
    meeting_url: input.mode === "online" ? link : link || null,
    ...(input.endsAt !== undefined && input.endsAt !== null ? { ends_at: new Date(endMs).toISOString() } : {}),
  };
  if (refreshingId) {
    const runUpdate = () => db.from("appointments").update(sessionPatch).eq("id", refreshingId);
    let upRes = await runUpdate();
    if (upRes.error && "ends_at" in sessionPatch && isMissingEndsAtColumn(upRes.error)) {
      delete (sessionPatch as Record<string, unknown>).ends_at;
      upRes = await runUpdate();
    }
    if (upRes.error) throw upRes.error;
  } else {
    const runInsert = () =>
      db.from("appointments").insert({
        student_id: referral.student_id,
        concern: referral.reason,
        source_referral_id: input.referralId,
        ...sessionPatch,
      });
    let insRes = await runInsert();
    if (insRes.error && "ends_at" in sessionPatch && isMissingEndsAtColumn(insRes.error)) {
      delete (sessionPatch as Record<string, unknown>).ends_at;
      insRes = await runInsert();
    }
    if (insRes.error) throw insRes.error;
  }

  return triageReferral(db, {
    referralId: input.referralId,
    actorProfileId: input.actorProfileId,
    status: "confirmed",
    actionNote: `${REFERRAL_SCHEDULE_NOTE_PREFIX}${iso} (${input.mode})`,
  });
}
