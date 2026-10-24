"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type EmergencyStudent = { id: string; label: string; alias: string };

export type EmergencyGrantSeed = {
  studentId: string;
  alias: string;
  expiresAt: string;
  logId: string;
  reviewed: boolean;
};

export type EmergencyBoardData = {
  role: string | null;
  me: string | null;
  myName: string;
  students: EmergencyStudent[];
  headIds: string[];
  grant: EmergencyGrantSeed | null;
};

export const EMERGENCY_BOARD_KEY = ["emergency", "board"] as const;

/** Fresh window — inside it, going back to /emergency renders zero-fetch. */
export const EMERGENCY_BOARD_STALE_MS = 60_000;

const EMPTY_STUDENTS: EmergencyStudent[] = [];
const EMPTY_IDS: string[] = [];

export async function fetchEmergencyBoard(): Promise<EmergencyBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  const myName = (profile as { full_name: string | null } | null)?.full_name ?? "Staff";
  if (!r || !["counselor", "guidance_head"].includes(r)) {
    return { role: r, me: user.id, myName, students: EMPTY_STUDENTS, headIds: EMPTY_IDS, grant: null };
  }
  // Alias-level directory (00069): the break-glass picker never exposes a
  // student number. Counselors see their caseload only (matching the reveal
  // API's caseload gate); the head sees everyone.
  const { data: directoryData, error: directoryError } = await supabase.rpc("list_student_directory");
  if (directoryError) throw directoryError;
  const directory = ((directoryData ?? []) as { id: string; anonymous_alias: string | null }[]).slice(0, 300);
  const [{ data: heads }, { data: mine }] = await Promise.all([
    supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true),
    supabase
      .from("break_glass_logs")
      .select("id, student_id, expires_at, reviewed_at")
      .eq("accessor_profile_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("accessed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const students = directory.map((s) => ({
    id: s.id,
    alias: s.anonymous_alias ?? "Student",
    label: s.anonymous_alias ?? "Student",
  }));
  const g = mine as { id: string; student_id: string; expires_at: string; reviewed_at: string | null } | null;
  return {
    role: r,
    me: user.id,
    myName,
    students,
    headIds: ((heads ?? []) as { id: string }[]).map((h) => h.id),
    grant: g
      ? {
          studentId: g.student_id,
          alias: directory.find((s) => s.id === g.student_id)?.anonymous_alias ?? "Student",
          expiresAt: g.expires_at,
          logId: g.id,
          reviewed: !!g.reviewed_at,
        }
      : null,
  };
}

/**
 * Cached emergency board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /emergency shows cached data instantly while a
 * background refetch (only if stale) refreshes it without blocking.
 * The live grant (countdown, review polling, reveal) stays local on purpose
 * — only its seed comes from the cache, once per visit.
 */
export function useEmergencyBoard() {
  return useQuery({
    queryKey: [...EMERGENCY_BOARD_KEY],
    queryFn: fetchEmergencyBoard,
    staleTime: EMERGENCY_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
