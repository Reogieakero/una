import type { DbClient } from "../platform";

/** Board-level appointment columns — every list query uses this (never *). */
export const APPOINTMENT_BOARD_COLS =
  "id, student_id, counselor_id, scheduled_at, ends_at, mode, status, concern, meeting_url, is_follow_up, follow_up_of, source_referral_id, created_at";

/** Hard ceiling — the pager never asks for more (plan: 10/25/50, max 50). */
export const MAX_APPOINTMENT_PAGE_SIZE = 50;

export type AppointmentCursor = { scheduled_at: string; id: string };

export type AppointmentsPage = {
  rows: unknown[];
  /** Cursor for the NEXT page (null when this was the last page). */
  nextCursor: AppointmentCursor | null;
  hasMore: boolean;
};

/**
 * Keyset page of appointments (pure read, RLS scopes rows).
 * Ordering is (scheduled_at, id) — direction preserved per caller (counselor
 * queue earliest-first, office newest-first) so existing UX never moves.
 * scheduled_at is app-required on every writer, so nulls only exist on
 * pre-00020 legacy rows; explicit null placement keeps pages deterministic.
 */
export async function listAppointmentPage(
  db: DbClient,
  opts?: {
    counselorId?: string | null;
    status?: string;
    mode?: string;
    /** Head filter: counselor id, "unassigned", or "all". */
    counselor?: string;
    isFollowUp?: boolean | null;
    ascending?: boolean;
    limit?: number;
    cursor?: AppointmentCursor | null;
  },
): Promise<AppointmentsPage> {
  const size = Math.min(Math.max(opts?.limit ?? 25, 1), MAX_APPOINTMENT_PAGE_SIZE);
  const asc = opts?.ascending ?? false;
  let q = db
    .from("appointments")
    .select(APPOINTMENT_BOARD_COLS)
    .order("scheduled_at", { ascending: asc, nullsFirst: !asc })
    .order("id", { ascending: true })
    .limit(size + 1);
  if (opts?.counselorId) q = q.eq("counselor_id", opts.counselorId);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.mode && opts.mode !== "all") q = q.eq("mode", opts.mode);
  if (opts?.counselor && opts.counselor !== "all") {
    q = opts.counselor === "unassigned" ? q.is("counselor_id", null) : q.eq("counselor_id", opts.counselor);
  }
  if (opts?.isFollowUp !== undefined && opts?.isFollowUp !== null) q = q.eq("is_follow_up", opts.isFollowUp);
  if (opts?.cursor) {
    const c = opts.cursor;
    q = asc
      ? q.or(`scheduled_at.gt.${c.scheduled_at},and(scheduled_at.eq.${c.scheduled_at},id.gt.${c.id})`)
      : q.or(`scheduled_at.lt.${c.scheduled_at},and(scheduled_at.eq.${c.scheduled_at},id.gt.${c.id})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const all = (data ?? []) as Array<{ id: string; scheduled_at: string }>;
  const hasMore = all.length > size;
  const rows = hasMore ? all.slice(0, size) : all;
  const last = rows[rows.length - 1];
  return { rows, nextCursor: hasMore && last ? { scheduled_at: last.scheduled_at, id: last.id } : null, hasMore };
}

/** List a student's appointments newest-first (pure read, RLS scopes rows). */
export async function listStudentAppointments(db: DbClient, studentId: string) {
  const { data, error } = await db
    .from("appointments")
    .select(`${APPOINTMENT_BOARD_COLS}, pss10:pss10_assessments(id, total_score, band, created_at)`)
    .eq("student_id", studentId)
    .order("scheduled_at", { ascending: false })
    .limit(200);
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
    .select(APPOINTMENT_BOARD_COLS)
    .eq("counselor_id", counselorId)
    .order("scheduled_at", { ascending: true })
    .limit(300);
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
    .select(APPOINTMENT_BOARD_COLS)
    .order("scheduled_at", { ascending: false })
    .limit(Math.min(opts?.limit ?? 200, 500));
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Fetch one appointment with its PSS-10 + feedback (pure read). */
export async function getAppointmentDetail(db: DbClient, appointmentId: string) {
  const { data, error } = await db
    .from("appointments")
    .select(`${APPOINTMENT_BOARD_COLS}, pss10:pss10_assessments(id, total_score, band, created_at), feedback(id, rating, comment, created_at)`)
    .eq("id", appointmentId)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch a student's most recent PSS-10 (used by the booking gate). */
export async function getLatestPss10(db: DbClient, studentId: string) {
  const { data, error } = await db
    .from("pss10_assessments")
    .select("id, created_at, student_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
