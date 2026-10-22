import type { DbClient, Clock } from "../platform";
import { isUniqueViolation, systemClock } from "../platform";
import { createAppointmentSchema } from "@dorsu/shared-schemas";
import { getLatestPss10 } from "./queries";
import { validateCounselorSchedule } from "./mutations";

const PSS10_FRESH_DAY_MS = 24 * 60 * 60 * 1000;
const PSS10_FRESH_DAYS = 30;

/**
 * Client clocks drift (and the phone may be a few seconds/minutes behind the
 * database). A PSS-10 submitted moments ago must not read as "expired"
 * because `server created_at - device now` came out slightly negative.
 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Parse a DB timestamp defensively. PostgREST returns microsecond precision
 * (`...T16:45:00.123456+00:00`); some JS engines (notably Hermes on React
 * Native) are stricter than V8 about fractional digits, so trim to
 * milliseconds before parsing.
 */
function parseTimestamp(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  const normalized = value.replace(/(\.\d{3})\d+/, "$1");
  return new Date(normalized).getTime();
}

/** Booking requires a completed PSS-10 within 30 days (freshness gate). */
export function isPss10Fresh(completedAt: string | Date, clock: Clock = systemClock): boolean {
  const done = parseTimestamp(completedAt);
  if (!Number.isFinite(done)) return false;
  const ageMs = clock.now().getTime() - done;
  return ageMs >= -CLOCK_SKEW_TOLERANCE_MS && ageMs <= PSS10_FRESH_DAYS * PSS10_FRESH_DAY_MS;
}

/** Create an appointment only if the PSS-10 gate passes (never bypass client-side). */
export async function bookAppointment(
  db: DbClient,
  input: {
    studentId: string;
    counselorId?: string | null;
    scheduledAt: Date;
    mode: "in_person" | "online";
    concern: string;
    isAnonymous?: boolean;
    pss10Id?: string;
    /**
     * Idempotency key (UUID v4, one per booking intent). Retries reuse the
     * key: a 23505 on UNIQUE(appointments.idempotency_key) returns the
     * already-created row instead of double-booking.
     */
    idempotencyKey?: string;
  },
  clock: Clock = systemClock,
) {
  const parsed = createAppointmentSchema.parse({
    counselorId: input.counselorId ?? null,
    scheduledAt: input.scheduledAt,
    mode: input.mode,
    concern: input.concern,
    isAnonymous: input.isAnonymous ?? false,
    pss10Id: input.pss10Id,
    idempotencyKey: input.idempotencyKey,
  });
  if (parsed.scheduledAt.getTime() <= clock.now().getTime()) {
    throw new Error("Appointments must be scheduled in the future");
  }
  // Gate: prefer the explicitly passed pss10Id, else the latest assessment.
  let gateId = parsed.pss10Id ?? null;
  let gateDate: string | null = null;
  if (gateId) {
    const { data, error } = await db
      .from("pss10_assessments")
      .select("id, created_at, student_id")
      .eq("id", gateId)
      .single();
    if (error || !data || data.student_id !== input.studentId) {
      throw new Error("Invalid PSS-10 reference for this student");
    }
    gateDate = data.created_at;
  } else {
    const latest = await getLatestPss10(db, input.studentId);
    if (!latest) throw new Error("Complete a PSS-10 check-in before booking");
    gateId = latest.id;
    gateDate = latest.created_at;
  }
  if (!gateDate || !isPss10Fresh(gateDate, clock)) {
    throw new Error("PSS-10 expired — please retake the check-in before booking");
  }
  // Slot guard (P12): when a counselor is picked at booking time, the window
  // must sit inside their availability slots with no overlap — same gate the
  // counselor confirm path enforces. Unassigned (pending, null counselor)
  // bookings skip this; the head/counselor validates on assign/confirm.
  let endsAtIso: string | null = null;
  if (parsed.counselorId) {
    const { endMs } = await validateCounselorSchedule(db, parsed.counselorId, parsed.scheduledAt, null, null);
    endsAtIso = new Date(endMs).toISOString();
  }
  const { data, error } = await db
    .from("appointments")
    .insert({
      student_id: input.studentId,
      counselor_id: parsed.counselorId ?? null,
      scheduled_at: parsed.scheduledAt.toISOString(),
      ...(endsAtIso ? { ends_at: endsAtIso } : {}),
      mode: parsed.mode,
      concern: parsed.concern,
      is_anonymous: parsed.isAnonymous,
      pss10_id: gateId,
      idempotency_key: parsed.idempotencyKey ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (!error) return data;
  // Counselor slot taken between the gate check and the insert (race) —
  // the exclusion constraint (00059) aborts with 23P01. Surface it as a
  // friendly retry message instead of a raw Postgres error.
  if (error && (error as { code?: string }).code === "23P01") {
    throw new Error("That time was just taken — please pick another window.");
  }
  // Retry of the same intent: return the row the first attempt created.
  // Scoped to (student_id, idempotency_key) so one student's key can never
  // resolve to another student's appointment.
  if (error && isUniqueViolation(error) && parsed.idempotencyKey) {
    const { data: existing, error: lookupError } = await db
      .from("appointments")
      .select()
      .eq("student_id", input.studentId)
      .eq("idempotency_key", parsed.idempotencyKey)
      .single();
    if (!lookupError && existing) return existing;
  }
  throw error;
}
