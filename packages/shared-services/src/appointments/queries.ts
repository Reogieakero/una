import type { DbClient } from "../platform";

/** List a student's appointments newest-first (pure read, RLS scopes rows). */
export async function listStudentAppointments(db: DbClient, studentId: string) {
  const { data, error } = await db
    .from("appointments")
    .select("*, pss10:pss10_assessments(*)")
    .eq("student_id", studentId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** List a counselor's queue filtered by status (pure read). */
export async function listCounselorAppointments(
  db: DbClient,
  counselorId: string,
  status?: string,
) {
  let q = db
    .from("appointments")
    .select("*")
    .eq("counselor_id", counselorId)
    .order("scheduled_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** List office-wide appointments newest-first (pure read, RLS scopes rows). */
export async function listOfficeAppointments(
  db: DbClient,
  opts?: { status?: string; limit?: number },
) {
  let q = db
    .from("appointments")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Fetch one appointment with its PSS-10 + feedback (pure read). */
export async function getAppointmentDetail(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .select("*, pss10:pss10_assessments(*), feedback(*)")
    .eq("id", appointmentId)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch a student's most recent PSS-10 (used by the booking gate). */
export async function getLatestPss10(db: DbClient, studentId: string) {
  const { data, error } = await db
    .from("pss10_assessments")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
