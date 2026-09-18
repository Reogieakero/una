import type { DbClient } from "../platform";
import { pss10SubmitSchema, feedbackSchema } from "@dorsu/shared-schemas";
import { calculatePss10 } from "../assessments/pss10-scoring";

/**
 * Appointment lifecycle (role-separated):
 *
 *   pending (student booked, no counselor)
 *     -> assigned   (admin assigns a counselor)
 *     -> cancelled  (student cancels)
 *     -> rejected   (admin rejects the request — pending only; unassign first)
 *   assigned
 *     -> confirmed  (counselor confirms)
 *     -> cancelled  (student cancels)
 *     -> pending    (admin clears the counselor — reject from here instead)
 *   confirmed
 *     -> completed  (counselor, session done)
 *     -> no_show    (counselor, student didn't arrive)
 *     -> cancelled  (student cancels)
 *
 * Terminal: completed, cancelled, rejected, no_show.
 * Each mutation guards its from-statuses so rows can never skip a step,
 * even if the UI is bypassed. RLS + rbac.ts own WHO may call WHAT.
 */

/** Submit a PSS-10 (validates shape, scores, persists with band). */
export async function submitPss10(
  db: DbClient,
  input: { studentId: string; answers: number[]; appointmentId?: string },
) {
  const parsed = pss10SubmitSchema.parse({
    answers: input.answers,
    appointmentId: input.appointmentId,
  });
  const { totalScore, band } = calculatePss10(parsed.answers);
  const { data, error } = await db
    .from("pss10_assessments")
    .insert({
      student_id: input.studentId,
      appointment_id: parsed.appointmentId ?? null,
      answers: parsed.answers,
      total_score: totalScore,
      band,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Admin assigns (or clears with null) a counselor.
 * pending/assigned + counselor  -> assigned
 * assigned + null               -> pending (unassign)
 */
export async function assignAppointment(
  db: DbClient,
  appointmentId: string,
  counselorId: string | null,
) {
  if (counselorId) {
    const { data, error } = await db
      .from("appointments")
      .update({ counselor_id: counselorId, status: "assigned" })
      .eq("id", appointmentId)
      .in("status", ["pending", "assigned"])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db
    .from("appointments")
    .update({ counselor_id: null, status: "pending" })
    .eq("id", appointmentId)
    .eq("status", "assigned")
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Admin rejects a request (terminal — pending only).
 * Once a counselor is assigned the request can no longer be rejected;
 * unassign it back to pending first. */
export async function rejectAppointment(db: DbClient, appointmentId: string) {
  const { data: current, error: curErr } = await db
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .single();
  if (curErr || !current) throw curErr ?? new Error("Session not found.");
  if ((current as { status: string }).status !== "pending") {
    throw new Error("Only pending sessions can be rejected. Unassign the counselor first.");
  }
  const { data, error } = await db
    .from("appointments")
    .update({ status: "rejected" })
    .eq("id", appointmentId)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ── Counselor availability scope (confirm + reschedule) ── */

// Slots are set in Philippine wall-clock time and Asia/Manila has no DST,
// so a fixed UTC+8 shift converts instants to the wall-clock the slots use.
// The web dropdowns build options in the counselor's browser-local time —
// identical for PH counselors. Documented here so server and UI never drift
// silently for anyone elsewhere.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_SESSION_MS = 60 * 60 * 1000;

type AvailabilitySlotRow = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

function manilaParts(t: number): { day: number; weekday: number; mins: number } {
  const w = new Date(t + MANILA_OFFSET_MS);
  return {
    day: Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()),
    weekday: w.getUTCDay(),
    mins: w.getUTCHours() * 60 + w.getUTCMinutes(),
  };
}

function hhmmToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function ymdToDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Pre-migration fallback: when the database never got 00051
 * (appointments.ends_at missing), writes carrying ends_at fail with an
 * undefined-column error. Detect it, drop the end time, and let the caller
 * retry once — scheduling keeps working, only the end display is lost until
 * the migration is applied. Same precedent as the meeting_url/00034 path.
 */
export function isMissingEndsAtColumn(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  const msg = (error as { message?: unknown }).message;
  if (typeof msg === "string" && /ends_at/i.test(msg)) return true;
  return code === "42703";
}

/**
 * Pure scope check: [startMs, endMs) must sit entirely inside ONE availability
 * slot on the start day (same slot window, same weekday, inside any
 * valid_from/valid_to range — never spanning midnight). Exported for reuse.
 */
export function fitsAvailabilitySlot(
  slots: AvailabilitySlotRow[],
  startMs: number,
  endMs: number,
): boolean {
  if (!(startMs < endMs)) return false;
  const s = manilaParts(startMs);
  const e = manilaParts(endMs);
  if (s.day !== e.day) return false;
  return slots.some((slot) => {
    if (slot.weekday !== s.weekday) return false;
    if (s.mins < hhmmToMins(slot.start_time) || e.mins > hhmmToMins(slot.end_time)) return false;
    if (!slot.is_recurring) {
      const from = slot.valid_from ? ymdToDay(slot.valid_from) : null;
      const to = slot.valid_to ? ymdToDay(slot.valid_to) : null;
      // One-off slots without an explicit date range fall back to the
      // weekday match above so older rows keep working.
      if (from !== null && s.day < from) return false;
      if (to !== null && s.day > to) return false;
    }
    return true;
  });
}

async function getCounselorSlots(db: DbClient, counselorId: string): Promise<AvailabilitySlotRow[]> {
  const { data, error } = await db
    .from("counselor_availability")
    .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
    .eq("counselor_id", counselorId);
  if (error) throw error;
  return ((data ?? []) as AvailabilitySlotRow[]);
}

/** No overlapping active session for this counselor (ends_at ?? start + 60m). */
async function assertNoOverlap(
  db: DbClient,
  counselorId: string,
  excludeAppointmentId: string | null,
  startMs: number,
  endMs: number,
) {
  let q = db
    .from("appointments")
    .select("id, scheduled_at, ends_at")
    .eq("counselor_id", counselorId)
    .in("status", ["assigned", "confirmed"])
    .lt("scheduled_at", new Date(endMs).toISOString())
    .gt("scheduled_at", new Date(startMs - 12 * 60 * 60 * 1000).toISOString());
  // Mint path (referral confirm) has no row to exclude yet — null skips it.
  if (excludeAppointmentId) q = q.neq("id", excludeAppointmentId);
  const { data, error } = await q;
  if (error) throw error;
  for (const row of ((data ?? []) as { id: string; scheduled_at: string; ends_at: string | null }[])) {
    const s = new Date(row.scheduled_at).getTime();
    const e = row.ends_at ? new Date(row.ends_at).getTime() : s + DEFAULT_SESSION_MS;
    if (s < endMs && e > startMs) {
      throw new Error("That time overlaps another session on your calendar — pick a free window.");
    }
  }
}

/**
 * Shared counselor schedule gate: future start, valid end, inside the
 * counselor's availability scope, no double-booking. Returns normalized
 * bounds; throws friendly errors the UI passes straight through.
 * Exported so referral-confirm (which mints sessions) enforces the same
 * scope — pass null exclusion on the mint path.
 */
export async function validateCounselorSchedule(
  db: DbClient,
  counselorId: string,
  scheduledAt: Date,
  endsAt?: Date | null,
  excludeAppointmentId?: string | null,
): Promise<{ startMs: number; endMs: number }> {
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Choose a valid session date and time");
  }
  const startMs = scheduledAt.getTime();
  if (startMs <= Date.now()) {
    throw new Error("Sessions must be scheduled in the future");
  }
  let endMs = startMs + DEFAULT_SESSION_MS;
  if (endsAt !== undefined && endsAt !== null) {
    if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
      throw new Error("Choose a valid session end time");
    }
    endMs = endsAt.getTime();
    if (!(endMs > startMs)) {
      throw new Error("The end time must be after the start time");
    }
  }
  const slots = await getCounselorSlots(db, counselorId);
  if (!slots.length) {
    throw new Error("Set your availability slots first — sessions must fall inside them.");
  }
  if (!fitsAvailabilitySlot(slots, startMs, endMs)) {
    throw new Error("That time is outside your availability slots — pick a window inside one.");
  }
  await assertNoOverlap(db, counselorId, excludeAppointmentId ?? null, startMs, endMs);
  return { startMs, endMs };
}

/** Counselor confirms an assigned appointment (assignment gate — no skipping pending).
 * The counselor sets the final session time/date on confirm; the student is
 * notified with that scheduled slot (see /appointments page runConfirming).
 * The window must sit inside the counselor's availability slots and must not
 * overlap another session — enforced here, not just in the picker.
 * Online sessions additionally require a Google Meet link, stored on the
 * row so the board + calendar can offer a Join button.
 * scheduledAt is required for new calls but optional for backward compat —
 * omitting it keeps the student's requested time.
 */

/**
 * Follow-up gate for session notes: a single moment (the eventual session
 * start) must be in the future and sit inside one of the counselor's
 * availability slots with room for at least a 15-minute start — the same
 * validity the SlotSchedulePicker start options use, in the same Manila
 * wall-clock the slots use. No overlap check: a follow-up is a plan, not a
 * booking; the real session validates overlap when it is actually scheduled.
 * Throws friendly errors the UI passes straight through.
 */
export async function validateFollowUpMoment(
  db: DbClient,
  counselorId: string,
  at: Date,
): Promise<{ startMs: number }> {
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
    throw new Error("Pick a follow-up date and time.");
  }
  const startMs = at.getTime();
  if (startMs <= Date.now()) {
    throw new Error("Follow-ups must be in the future.");
  }
  const slots = await getCounselorSlots(db, counselorId);
  if (!slots.length) {
    throw new Error("Set your availability slots first — follow-ups must fall inside them.");
  }
  const m = manilaParts(startMs);
  const ok = slots.some((slot) => {
    if (slot.weekday !== m.weekday) return false;
    if (m.mins < hhmmToMins(slot.start_time) || m.mins + 15 > hhmmToMins(slot.end_time)) return false;
    if (!slot.is_recurring) {
      const from = slot.valid_from ? ymdToDay(slot.valid_from) : null;
      const to = slot.valid_to ? ymdToDay(slot.valid_to) : null;
      if (from !== null && m.day < from) return false;
      if (to !== null && m.day > to) return false;
    }
    return true;
  });
  if (!ok) {
    throw new Error("That follow-up is outside your availability slots — pick a time inside one.");
  }
  return { startMs };
}

export type FollowUpSessionResult = {
  id: string;
  scheduled_at: string;
  ends_at: string | null;
  status: string;
  /** What happened: minted new, moved to a new moment, or called off. */
  action: "minted" | "rescheduled" | "cancelled";
};

const LIVE_FOLLOW_UP_STATUSES = ["assigned", "confirmed"] as const;

/**
 * Follow-up lifecycle for session notes. A documented follow-up is a real
 * session (confirmed — counselor and slot already chosen by the documenting
 * counselor), not a note-only date, so it shows on the sessions page and
 * notifies like any other session. Exactly one LIVE follow-up per origin:
 * - wanted + none → mint (end = start + 60m clamped to the covering slot;
 *   the moment gate guarantees at least 15 minutes of room).
 * - wanted + live at a new moment → move it (scope + overlap re-validated).
 * - wanted + live at the same moment → null (no change, callers stay quiet).
 * - unwanted + live → cancel it.
 * Finished follow-ups (completed / cancelled / no-show / rejected) are
 * history and never touched. Throws friendly errors the UI passes through.
 */
export async function syncFollowUpSession(
  db: DbClient,
  origin: {
    id: string;
    student_id: string | null;
    counselor_id: string;
    mode: "in_person" | "online";
    concern: string;
    is_anonymous: boolean;
  },
  at: Date | null,
): Promise<FollowUpSessionResult | null> {
  const { data: existing } = await db
    .from("appointments")
    .select("id,status,scheduled_at")
    .eq("follow_up_of", origin.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cur = (existing ?? null) as { id: string; status: string; scheduled_at: string } | null;
  const live =
    cur && (LIVE_FOLLOW_UP_STATUSES as readonly string[]).includes(cur.status) ? cur : null;

  if (!at) {
    if (!live) return null;
    const { data: cancelled } = await db
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", live.id)
      .in("status", [...LIVE_FOLLOW_UP_STATUSES])
      .select("id,scheduled_at,ends_at,status")
      .maybeSingle();
    const c = cancelled as FollowUpSessionResult | null;
    return c ? { ...c, action: "cancelled" } : null;
  }

  // Scope gate first (future + inside availability) — same as note save.
  const { startMs } = await validateFollowUpMoment(db, origin.counselor_id, at);
  const slots = await getCounselorSlots(db, origin.counselor_id);
  const m = manilaParts(startMs);
  const win = slots
    .filter((s) => s.weekday === m.weekday)
    .map((s) => ({ start: hhmmToMins(s.start_time), end: hhmmToMins(s.end_time) }))
    .find((w) => m.mins >= w.start && m.mins + 15 <= w.end);
  // The gate above guarantees a covering window; fall back to a full hour so
  // a shape change can never mint a negative-length session.
  const endMs = win
    ? Math.min(startMs + DEFAULT_SESSION_MS, m.day + win.end * 60_000)
    : startMs + DEFAULT_SESSION_MS;
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();

  if (live && new Date(live.scheduled_at).getTime() === startMs) return null;

  if (live) {
    await assertNoOverlap(db, origin.counselor_id, live.id, startMs, endMs);
    const { data: moved } = await db
      .from("appointments")
      .update({ scheduled_at: startISO, ends_at: endISO })
      .eq("id", live.id)
      .in("status", [...LIVE_FOLLOW_UP_STATUSES])
      .select("id,scheduled_at,ends_at,status")
      .maybeSingle();
    const row = moved as Omit<FollowUpSessionResult, "action"> | null;
    if (row) return { ...row, action: "rescheduled" };
    // It slipped terminal between the read and the write — mint fresh below.
  }

  await assertNoOverlap(db, origin.counselor_id, null, startMs, endMs);
  const { data, error } = await db
    .from("appointments")
    .insert({
      student_id: origin.student_id,
      counselor_id: origin.counselor_id,
      scheduled_at: startISO,
      ends_at: endISO,
      mode: origin.mode,
      status: "confirmed",
      concern: origin.concern,
      is_anonymous: origin.is_anonymous,
      is_follow_up: true,
      follow_up_of: origin.id,
    })
    .select("id,scheduled_at,ends_at,status")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't schedule the follow-up session.");
  return { ...(data as Omit<FollowUpSessionResult, "action">), action: "minted" };
}

/** Google Meet links live at meet.google.com/<code>. */
const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[A-Za-z0-9-]+(?:\?.*)?\/?$/;

/** Loose check shared by callers that collect the link client-side. */
export function isMeetUrl(url: string): boolean {
  return MEET_URL_RE.test(url.trim());
}

export async function confirmAppointment(
  db: DbClient,
  appointmentId: string,
  scheduledAt?: Date,
  meetingUrl?: string | null,
  endsAt?: Date | null,
) {
  const { data: current, error: curErr } = await db
    .from("appointments")
    .select("mode, status, counselor_id")
    .eq("id", appointmentId)
    .single();
  if (curErr || !current) throw curErr ?? new Error("Session not found.");
  const cur = current as { mode: string; status: string; counselor_id: string | null };
  if (cur.status !== "assigned") {
    throw new Error("Only assigned sessions can be confirmed.");
  }
  const patch: Record<string, string> = { status: "confirmed", confirmed_datetime: new Date().toISOString() };
  if (scheduledAt !== undefined) {
    if (!cur.counselor_id) throw new Error("Session has no counselor yet.");
    const { startMs, endMs } = await validateCounselorSchedule(db, cur.counselor_id, scheduledAt, endsAt, appointmentId);
    patch.scheduled_at = new Date(startMs).toISOString();
    if (endsAt !== undefined && endsAt !== null) patch.ends_at = new Date(endMs).toISOString();
  }
  const link = (meetingUrl ?? "").trim();
  if (cur.mode === "online") {
    if (!link) {
      throw new Error("Add the Google Meet link for this online session.");
    }
    if (!isMeetUrl(link)) {
      throw new Error("That doesn't look like a Google Meet link — paste a meet.google.com link.");
    }
    patch.meeting_url = link;
  } else if (link) {
    if (!/^https:\/\//i.test(link)) {
      throw new Error("Meeting links must start with https://");
    }
    patch.meeting_url = link;
  }
  const runUpdate = () =>
    db
      .from("appointments")
      .update(patch)
      .eq("id", appointmentId)
      .eq("status", "assigned")
      .select()
      .single();
  let result = await runUpdate();
  if (result.error && "ends_at" in patch && isMissingEndsAtColumn(result.error)) {
    delete patch.ends_at;
    result = await runUpdate();
  }
  const { data, error } = result;
  if (error) {
    // The Meet link column ships in migration 00034 — if the database was
    // never updated, online confirms fail here (not on the status gate).
    // Say so plainly instead of a generic "changed status" message.
    const code = (error as { code?: string })?.code ?? "";
    const msg = (error as { message?: string })?.message ?? "";
    if (/meeting_url/i.test(msg) || code === "PGRST204" || code === "42703") {
      throw new Error(
        "This online session needs the latest database update (appointments.meeting_url is missing). Apply migration 00034, then confirm again."
      );
    }
    throw error;
  }
  return data;
}

/** Counselor marks a confirmed appointment complete (session done). */
export async function completeAppointment(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointmentId)
    .eq("status", "confirmed")
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Student cancels their booking (from any active step — never terminal). */
export async function cancelAppointment(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .in("status", ["pending", "assigned", "confirmed"])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Counselor marks a confirmed appointment as no-show (terminal). */
export async function markAppointmentNoShow(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", appointmentId)
    .eq("status", "confirmed")
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Counselor reschedules one of their sessions to a new window inside their
 * availability slots (status untouched — assigned stays assigned, confirmed
 * stays confirmed). Ownership is enforced by RLS (only the assigned
 * counselor's update passes); the from-status gate + scope + overlap checks
 * below hold even if the UI is bypassed. The student is notified with the
 * new schedule (see /appointments page runConfirming).
 */
export async function rescheduleAppointmentByCounselor(
  db: DbClient,
  appointmentId: string,
  scheduledAt: Date,
  endsAt?: Date | null,
) {
  const { data: current, error: curErr } = await db
    .from("appointments")
    .select("status, counselor_id")
    .eq("id", appointmentId)
    .single();
  if (curErr || !current) throw curErr ?? new Error("Session not found.");
  const cur = current as { status: string; counselor_id: string | null };
  if (!["assigned", "confirmed"].includes(cur.status)) {
    throw new Error("Only assigned or confirmed sessions can be rescheduled.");
  }
  if (!cur.counselor_id) throw new Error("Session has no counselor yet.");
  const { startMs, endMs } = await validateCounselorSchedule(db, cur.counselor_id, scheduledAt, endsAt, appointmentId);
  const patch: Record<string, string> = { scheduled_at: new Date(startMs).toISOString() };
  if (endsAt !== undefined && endsAt !== null) patch.ends_at = new Date(endMs).toISOString();
  const runUpdate = () =>
    db
      .from("appointments")
      .update(patch)
      .eq("id", appointmentId)
      .in("status", ["assigned", "confirmed"])
      .select()
      .single();
  let result = await runUpdate();
  if (result.error && "ends_at" in patch && isMissingEndsAtColumn(result.error)) {
    delete patch.ends_at;
    result = await runUpdate();
  }
  if (result.error) throw result.error;
  return result.data;
}

/**
 * Student reschedules their booking to a future slot (status untouched).
 * Active steps only — terminal rows must rebook instead.
 */
export async function rescheduleAppointment(
  db: DbClient,
  appointmentId: string,
  scheduledAt: Date,
) {
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Choose a valid date and time");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Rescheduled sessions must be in the future");
  }
  const { data, error } = await db
    .from("appointments")
    .update({ scheduled_at: scheduledAt.toISOString() })
    .eq("id", appointmentId)
    .in("status", ["pending", "assigned", "confirmed"])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Submit post-session feedback (one rating per completed appointment). */
export async function submitFeedback(
  db: DbClient,
  input: { appointmentId: string; studentId: string; rating: number; comment?: string | null },
) {
  const parsed = feedbackSchema.parse(input);
  const { data, error } = await db
    .from("feedback")
    .insert({
      appointment_id: parsed.appointmentId,
      student_id: input.studentId,
      rating: parsed.rating,
      comment: parsed.comment ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
