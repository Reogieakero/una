"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Alias-level directory row (00069). `student_no`, `contact_no`, `profile_id`
 * and the student's name/email are intentionally absent — routine staff get
 * aliases only; real identity needs break-glass or oversight.
 */
export type StudentsRow = {
  id: string;
  program: string | null;
  year_level: string | null;
  college: string | null;
  anonymous_alias: string | null;
  created_at: string;
};

export type StudentsAppt = { student_id: string; scheduled_at: string; status: string };
export type StudentsRef = { student_id: string; status: string; priority: string };
export type StudentsScreen = { student_id: string; band: string; created_at: string };

export type StudentsBoardData = {
  role: string | null;
  counselorId: string | null;
  rows: StudentsRow[];
  appts: StudentsAppt[];
  refs: StudentsRef[];
  screens: StudentsScreen[];
};

export const STUDENTS_BOARD_KEY = ["students", "board"] as const;

/** Fresh window — inside it, going back to /students renders zero-fetch. */
export const STUDENTS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: StudentsRow[] = [];
const EMPTY_APPTS: StudentsAppt[] = [];
const EMPTY_REFS: StudentsRef[] = [];
const EMPTY_SCREENS: StudentsScreen[] = [];

export async function fetchStudentsBoard(): Promise<StudentsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  if (!r || !["counselor", "guidance_head"].includes(r)) {
    return { role: r, counselorId: null, rows: EMPTY_ROWS, appts: EMPTY_APPTS, refs: EMPTY_REFS, screens: EMPTY_SCREENS };
  }
  // Directory rows come from the 00069 RPC: alias-level only, caseload-scoped
  // for counselors, directory-wide for head/admin. The table itself is no
  // longer readable by routine staff.
  const directoryPromise = supabase.rpc("list_student_directory");

  if (r === "counselor") {
    // Counselor scope — only students on my caseload: my sessions,
    // referrals assigned to me, and my chat threads. The RPC enforces the
    // same scope; these reads only supply workload aggregates.
    const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
    const cid = (c as { id: string } | null)?.id ?? null;
    if (!cid) {
      return { role: r, counselorId: null, rows: EMPTY_ROWS, appts: EMPTY_APPTS, refs: EMPTY_REFS, screens: EMPTY_SCREENS };
    }
    const [{ data: apptRows }, { data: refRows }, { data: directory, error: dirError }] = await Promise.all([
      supabase.from("appointments").select("student_id, scheduled_at, status").eq("counselor_id", cid).limit(1000),
      supabase.from("referrals").select("student_id, status, priority").eq("assigned_counselor_id", cid).limit(1000),
      directoryPromise,
    ]);
    if (dirError) throw dirError;
    const studentList = ((directory ?? []) as StudentsRow[]).slice(0, 300);
    const myIds = studentList.map((s) => s.id);
    const screenPages = await Promise.all(
      myIds.length
        ? [myIds.slice(0, 1000)].map((chunk) =>
            supabase
              .from("pss10_assessments")
              .select("student_id, band, created_at")
              .in("student_id", chunk)
              .order("created_at", { ascending: false })
              .limit(1000)
          )
        : []
    );
    const screenList = screenPages.flatMap((p) => ((p.data ?? []) as StudentsScreen[]));
    return {
      role: r,
      counselorId: cid,
      rows: studentList,
      appts: ((apptRows ?? []) as StudentsAppt[]),
      refs: ((refRows ?? []) as StudentsRef[]),
      screens: screenList,
    };
  }
  const [{ data: directory, error: dirError }, { data: apptRows }, { data: refRows }, { data: screenRows }] = await Promise.all([
    directoryPromise,
    supabase.from("appointments").select("student_id, scheduled_at, status").limit(1000),
    supabase.from("referrals").select("student_id, status, priority").limit(1000),
    supabase.from("pss10_assessments").select("student_id, band, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  if (dirError) throw dirError;
  return {
    role: r,
    counselorId: null,
    rows: ((directory ?? []) as StudentsRow[]),
    appts: ((apptRows ?? []) as StudentsAppt[]),
    refs: ((refRows ?? []) as StudentsRef[]),
    screens: ((screenRows ?? []) as StudentsScreen[]),
  };
}

/**
 * Cached students directory — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /students shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Filters, search, and chart memos derive from the cache; the directory is
 * read-only so no invalidation paths are needed.
 */
export function useStudentsBoard() {
  return useQuery({
    queryKey: [...STUDENTS_BOARD_KEY],
    queryFn: fetchStudentsBoard,
    staleTime: STUDENTS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
