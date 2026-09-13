import type { DbClient } from "../platform";
import { pss10SubmitSchema, feedbackSchema } from "@dorsu/shared-schemas";
import { calculatePss10 } from "../assessments/pss10-scoring";

/**
 * Appointment lifecycle (role-separated):
 *
 *   pending (student booked, no counselor)
 *     -> assigned   (admin assigns a counselor)
 *     -> cancelled  (student cancels)
 *     -> rejected   (admin rejects the request)
 *   assigned
 *     -> confirmed  (counselor confirms)
 *     -> cancelled  (student cancels)
 *     -> rejected   (admin rejects)
 *     -> pending    (admin clears the counselor)
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

/** Admin rejects a request (terminal — pending/assigned only). */
export async function rejectAppointment(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: "rejected" })
    .eq("id", appointmentId)
    .in("status", ["pending", "assigned"])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Counselor confirms an assigned appointment (assignment gate — no skipping pending). */
export async function confirmAppointment(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", appointmentId)
    .eq("status", "assigned")
    .select()
    .single();
  if (error) throw error;
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
