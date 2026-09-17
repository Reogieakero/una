"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listCounselorAppointments, listOfficeAppointments } from "@dorsu/shared-services";

export type CalendarSession = {
  id: string;
  student_id: string;
  counselor_id: string | null;
  scheduled_at: string;
  mode: string;
  status: string;
  concern: string;
  meeting_url: string | null;
};

export type SessionsCalendarData = {
  role: string | null;
  counselorId: string | null;
  sessions: CalendarSession[];
  aliases: Map<string, string>;
  counselorNames: Map<string, string>;
};

export const SESSIONS_CALENDAR_KEY = ["sessions", "calendar"] as const;

/** Fresh window — inside it, going back to /sessions renders zero-fetch. */
export const SESSIONS_CALENDAR_STALE_MS = 60_000;

const EMPTY_MAP = new Map<string, string>();

export async function fetchSessionsCalendar(): Promise<SessionsCalendarData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  let cid: string | null = null;
  if (r === "counselor") {
    const { data } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
    cid = (data as { id: string } | null)?.id ?? null;
  }
  if (!r || !["counselor", "guidance_head"].includes(r)) {
    return { role: r, counselorId: null, sessions: [], aliases: EMPTY_MAP, counselorNames: EMPTY_MAP };
  }
  // Linked counselors read their own queue only; unlinked counselors get an
  // empty calendar (never the office-wide list — RLS would block it anyway,
  // but no office query is even issued).
  if (r === "counselor" && !cid) {
    return { role: r, counselorId: null, sessions: [], aliases: EMPTY_MAP, counselorNames: EMPTY_MAP };
  }
  const data =
    r === "counselor"
      ? await listCounselorAppointments(supabase, cid as string, "confirmed")
      : await listOfficeAppointments(supabase, { status: "confirmed" });
  // Calendar shows confirmed sessions only — i.e. appointments the counselor
  // scheduled on confirm (including sessions minted from confirmed referrals).
  // Pending / assigned requests live on /appointments; terminal rows stay out.
  const list = ((data ?? []) as CalendarSession[]).filter((a) => a.scheduled_at && a.status === "confirmed");

  const studentIds = [...new Set(list.map((a) => a.student_id))];
  let aliases = EMPTY_MAP;
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("id, anonymous_alias")
      .in("id", studentIds.slice(0, 500));
    aliases = new Map(
      ((students ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [
        s.id,
        s.anonymous_alias ?? "Student",
      ])
    );
  }

  let counselorNames = EMPTY_MAP;
  if (r === "guidance_head") {
    const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
    const cRows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", cRows.map((c) => c.profile_id));
    const names = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"])
    );
    counselorNames = new Map(cRows.map((c) => [c.id, names.get(c.profile_id) ?? "Counselor"]));
  }

  return { role: r, counselorId: cid, sessions: list, aliases, counselorNames };
}

/**
 * Cached session calendar — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /sessions shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Calendar UI state (view/cursor/selection) stays local on purpose.
 */
export function useSessionsCalendar() {
  return useQuery({
    queryKey: [...SESSIONS_CALENDAR_KEY],
    queryFn: fetchSessionsCalendar,
    staleTime: SESSIONS_CALENDAR_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
