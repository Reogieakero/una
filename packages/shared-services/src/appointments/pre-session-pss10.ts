import type { Clock, DbClient } from "../platform";
import { systemClock } from "../platform";

/** A fresh pre-session check-in must be submitted within this window. */
export const PSS10_PRE_SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Device/database clocks drift by seconds. Allow a check-in submitted moments
 * after the session start (or a device a few minutes behind) to still count.
 */
export const PSS10_PRE_SESSION_SKEW_MS = 5 * 60 * 1000;

/** Students may move a confirmed session until this long before the start. */
export const PSS10_RESCHEDULE_CUTOFF_HOURS = 24;
export const RESCHEDULE_CUTOFF_MS = PSS10_RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000;

/** Stable code the counselor UI branches on to offer a waiver. */
export const PSS10_REQUIRED_CODE = "PSS10_REQUIRED";

export class PreSessionPss10RequiredError extends Error {
  readonly code = PSS10_REQUIRED_CODE;

  constructor(
    message = "No valid pre-session check-in is linked to this session. Ask the student to check in, or record a waiver reason.",
  ) {
    super(message);
    this.name = "PreSessionPss10RequiredError";
  }
}

/** PostgREST can return microseconds; Hermes dislikes more than 3 fraction digits. */
function parseTimestamp(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  return new Date(value.replace(/(\.\d{3})\d+/, "$1")).getTime();
}

/**
 * Valid = linked assessment submitted no earlier than 7 days before the
 * scheduled start and no later than the start (plus clock-skew tolerance).
 * Freshness is anchored to the session, not to "now".
 */
export function isPreSessionPss10Valid(
  submittedAt: string | Date,
  scheduledAt: string | Date,
  clock: Clock = systemClock,
): boolean {
  const submitted = parseTimestamp(submittedAt);
  const start = parseTimestamp(scheduledAt);
  if (!Number.isFinite(submitted) || !Number.isFinite(start)) return false;
  // Keep the clock parameter for symmetry with isPss10Fresh and future rules;
  // the window itself is relative to the session start.
  void clock;
  return submitted >= start - PSS10_PRE_SESSION_DAYS * DAY_MS && submitted <= start + PSS10_PRE_SESSION_SKEW_MS;
}

/**
 * Whether a student may submit a pre-session check-in right now. Opens 7 days
 * before the start and stays open through the start + skew tolerance.
 */
export function isWithinPreSessionSubmitWindow(
  now: Date,
  scheduledAt: string | Date,
): boolean {
  const current = now.getTime();
  const start = parseTimestamp(scheduledAt);
  if (!Number.isFinite(start)) return false;
  return current >= start - PSS10_PRE_SESSION_DAYS * DAY_MS && current <= start + PSS10_PRE_SESSION_SKEW_MS;
}

/** A confirmed session is still movable until 24 hours before start. */
export function isWithinStudentRescheduleWindow(scheduledAt: string | Date, now: Date = new Date()): boolean {
  const start = parseTimestamp(scheduledAt);
  if (!Number.isFinite(start)) return false;
  return start - now.getTime() > RESCHEDULE_CUTOFF_MS;
}

export type PreSessionPss10State = "not_required" | "waived" | "not_due" | "complete" | "expired" | "missing";

/**
 * UI-facing status for one appointment. Never includes scores or answers —
 * only whether a check-in exists and when it was submitted.
 */
export function preSessionPss10State(input: {
  required?: boolean | null;
  waivedAt?: string | null;
  scheduledAt: string | Date;
  submittedAt?: string | Date | null;
  clock?: Clock;
}): PreSessionPss10State {
  if (input.required === false) return "not_required";
  if (input.waivedAt) return "waived";
  if (!input.submittedAt) {
    const now = (input.clock ?? systemClock).now();
    const start = parseTimestamp(input.scheduledAt);
    if (Number.isFinite(start) && now.getTime() < start - PSS10_PRE_SESSION_DAYS * DAY_MS) {
      return "not_due";
    }
    return "missing";
  }
  return isPreSessionPss10Valid(input.submittedAt, input.scheduledAt, input.clock)
    ? "complete"
    : "expired";
}

export type LinkedPss10 = {
  id: string;
  student_id: string;
  appointment_id: string | null;
  created_at: string;
};

/** Latest assessment linked to an appointment (retakes allowed since 00068). */
export async function getPreSessionPss10(
  db: DbClient,
  appointmentId: string,
): Promise<LinkedPss10 | null> {
  const { data, error } = await db
    .from("pss10_assessments")
    .select("id, student_id, appointment_id, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as LinkedPss10 | null) ?? null;
}

/** Latest linked check-in, but only when it belongs to the session's student and is fresh. */
export async function getValidPreSessionPss10(
  db: DbClient,
  appointment: { id: string; student_id: string | null; scheduled_at: string },
  clock: Clock = systemClock,
): Promise<LinkedPss10 | null> {
  if (!appointment.student_id) return null;
  const latest = await getPreSessionPss10(db, appointment.id);
  if (!latest || latest.student_id !== appointment.student_id) return null;
  return isPreSessionPss10Valid(latest.created_at, appointment.scheduled_at, clock) ? latest : null;
}
