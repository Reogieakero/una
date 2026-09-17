"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type FeedbackRow = {
  id: string;
  appointment_id: string;
  student_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type FeedbackContext = { concern: string; counselor: string; when: string };

export type FeedbackBoardData = {
  role: string | null;
  counselorId: string | null;
  rows: FeedbackRow[];
  aliases: Map<string, string>;
  contexts: Map<string, FeedbackContext>;
  completedTotal: number;
};

export const FEEDBACK_BOARD_KEY = ["feedback", "board"] as const;

/** Fresh window — inside it, going back to /feedback renders zero-fetch. */
export const FEEDBACK_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: FeedbackRow[] = [];
const EMPTY_MAP_STR = new Map<string, string>();
const EMPTY_CONTEXTS = new Map<string, FeedbackContext>();

export async function fetchFeedbackBoard(): Promise<FeedbackBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let r: string | null = null;
  let cid: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    r = (profile as { role: string } | null)?.role ?? null;
    if (r === "counselor") {
      const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
      cid = (c as { id: string } | null)?.id ?? null;
    }
  }
  // Faculty can't open feedback (rbac) — blocked card below covers it.
  if (r === "faculty" || (r === "counselor" && !cid)) {
    return { role: r, counselorId: cid, rows: EMPTY_ROWS, aliases: EMPTY_MAP_STR, contexts: EMPTY_CONTEXTS, completedTotal: 0 };
  }
  let list: FeedbackRow[] = [];
  let count = 0;
  if (r === "counselor" && cid) {
    // Counselor scope — feedback on my sessions only.
    const { data: myAppts } = await supabase.from("appointments").select("id").eq("counselor_id", cid).limit(2000);
    const ids = ((myAppts ?? []) as { id: string }[]).map((a) => a.id);
    const mine: FeedbackRow[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: fb } = await supabase
        .from("feedback")
        .select("id, appointment_id, student_id, rating, comment, created_at")
        .in("appointment_id", chunk)
        .limit(500);
      mine.push(...((fb ?? []) as FeedbackRow[]));
      if (mine.length >= 500) break;
    }
    mine.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    list = mine.slice(0, 500);
    const { count: c } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("counselor_id", cid)
      .eq("status", "completed");
    count = c ?? 0;
  } else {
    const [{ data: fb }, { count: c }] = await Promise.all([
      supabase
        .from("feedback")
        .select("id, appointment_id, student_id, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);
    list = ((fb ?? []) as FeedbackRow[]);
    count = c ?? 0;
  }

  const studentIds = [...new Set(list.map((f) => f.student_id))];
  const apptIds = [...new Set(list.map((f) => f.appointment_id))];
  const [{ data: studentRows }, { data: apptRows }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, anonymous_alias").in("id", studentIds.slice(0, 300))
      : Promise.resolve({ data: [] }),
    apptIds.length
      ? supabase.from("appointments").select("id, concern, counselor_id, scheduled_at").in("id", apptIds.slice(0, 300))
      : Promise.resolve({ data: [] }),
  ]);
  const aliases = new Map(
    ((studentRows ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"])
  );
  const appts = ((apptRows ?? []) as { id: string; concern: string; counselor_id: string | null; scheduled_at: string }[]);
  const counselorIds = [...new Set(appts.map((a) => a.counselor_id).filter(Boolean))] as string[];
  let names = new Map<string, string>();
  if (counselorIds.length) {
    const { data: crows } = await supabase.from("counselors").select("id, profile_id").in("id", counselorIds.slice(0, 100));
    const rows2 = ((crows ?? []) as { id: string; profile_id: string }[]);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", rows2.map((c) => c.profile_id));
    const byProfile = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
    names = new Map(rows2.map((c) => [c.id, byProfile.get(c.profile_id) ?? "Counselor"]));
  }
  const contexts = new Map(
    appts.map((a) => [
      a.id,
      {
        concern: a.concern,
        counselor: a.counselor_id ? (names.get(a.counselor_id) ?? "Counselor") : "Unassigned",
        when: a.scheduled_at,
      },
    ])
  );
  return { role: r, counselorId: cid, rows: list, aliases, contexts, completedTotal: count };
}

/**
 * Cached feedback analytics — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /feedback shows cached numbers instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * The page is read-only, so no invalidation paths are needed.
 */
export function useFeedbackBoard() {
  return useQuery({
    queryKey: [...FEEDBACK_BOARD_KEY],
    queryFn: fetchFeedbackBoard,
    staleTime: FEEDBACK_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
