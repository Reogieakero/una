"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Alias-only longitudinal record (00070). Every RPC is scoped by
 * public.can_access_student() and returns no student_no, contact number, or
 * profile identity. Timeline rows carry note metadata only — note text is
 * fetched per session through /api/session-notes.
 */

export type StudentRecordHeader = {
  id: string;
  anonymous_alias: string | null;
  program: string | null;
  year_level: string | null;
  college: string | null;
  created_at: string;
};

export type StudentRecordCounts = {
  total_sessions: number;
  completed_sessions: number;
  open_referrals: number;
  latest_band: string | null;
  follow_ups_due: number;
};

export type StudentTimelineRow = {
  event_type: string;
  event_id: string;
  occurred_at: string | null;
  status: string | null;
  label: string | null;
  band: string | null;
  score: number | null;
  rating: number | null;
  note_id: string | null;
  follow_up_at: string | null;
  appointment_id: string | null;
};

export type StudentRecordData = {
  header: StudentRecordHeader;
  counts: StudentRecordCounts | null;
  timeline: StudentTimelineRow[];
  /** Caller's role, used only to label the scope badge and note edit rights. */
  viewerRole: string | null;
};

export const studentRecordKey = (studentId: string) => ["students", "record", studentId] as const;

export const STUDENT_RECORD_STALE_MS = 30_000;

export async function fetchStudentRecord(studentId: string): Promise<StudentRecordData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Role only decides whether the page should offer editing; the RPC remains
  // the authority and still scopes every row by can_access_student().
  const roleRes = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null, error: null };

  const [headerRes, countsRes, timelineRes] = await Promise.all([
    supabase.rpc("get_student_record", { p_student_id: studentId }),
    supabase.rpc("get_student_record_counts", { p_student_id: studentId }),
    supabase.rpc("get_student_timeline", { p_student_id: studentId, p_limit: 200 }),
  ]);

  if (headerRes.error) throw new Error("Couldn't load this student record.");
  if (countsRes.error) throw new Error("Couldn't load this student record.");
  if (timelineRes.error) throw new Error("Couldn't load this student timeline.");

  const header = ((headerRes.data ?? []) as StudentRecordHeader[])[0];
  if (!header) throw new Error("Student not found or outside your caseload.");

  return {
    header,
    counts: ((countsRes.data ?? []) as StudentRecordCounts[])[0] ?? null,
    timeline: (timelineRes.data ?? []) as StudentTimelineRow[],
    viewerRole: ((roleRes.data as { role?: string } | null)?.role) ?? null,
  };
}

export function useStudentRecord(studentId: string | null) {
  return useQuery({
    queryKey: studentId ? studentRecordKey(studentId) : ["students", "record", "none"],
    queryFn: () => fetchStudentRecord(studentId as string),
    enabled: !!studentId,
    staleTime: STUDENT_RECORD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
