import type { DbClient, Clock } from "../platform";
import { isUniqueViolation, systemClock } from "../platform";
import { createAppointmentSchema } from "@dorsu/shared-schemas";
import { getLatestPss10 } from "./queries";

const PSS10_FRESH_DAYS = 30;

/** Booking requires a completed PSS-10 within 30 days (freshness gate). */
export function isPss10Fresh(completedAt: string | Date, clock: Clock = systemClock): boolean {
  const done = new Date(completedAt).getTime();
  const ageMs = clock.now().getTime() - done;
  return ageMs >= 0 && ageMs <= PSS10_FRESH_DAYS * 24 * 60 * 60 * 1000;
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
  const { data, error } = await db
    .from("appointments")
    .insert({
      student_id: input.studentId,
      counselor_id: parsed.counselorId ?? null,
      scheduled_at: parsed.scheduledAt.toISOString(),
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
