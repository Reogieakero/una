"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listCounselorAppointments, listOfficeAppointments } from "@dorsu/shared-services";
import type { BoardSlot } from "./use-appointments-board";

export type CalendarSession = {
  id: string;
  /** Null for walk-in sessions confirmed from typed-identity referrals. */
  student_id: string | null;
  counselor_id: string | null;
  scheduled_at: string;
  /** Counselor-picked end inside an availability slot; null on older rows. */
  ends_at: string | null;
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
  /** student_id → profile_id, for notifying the student after an outcome. */
  studentProfiles: Map<string, string>;
  /** Active guidance-head profile ids, for oversight notifications. */
  headIds: string[];
  /** Own availability windows — power the notes modal's follow-up picker. */
  slots: BoardSlot[];
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
    return { role: r, counselorId: null, sessions: [], aliases: EMPTY_MAP, counselorNames: EMPTY_MAP, studentProfiles: EMPTY_MAP, headIds: [], slots: [] };
  }
  // Linked counselors read their own queue only; unlinked counselors get an
  // empty calendar (never the office-wide list — RLS would block it anyway,
  // but no office query is even issued).
  if (r === "counselor" && !cid) {
    return { role: r, counselorId: null, sessions: [], aliases: EMPTY_MAP, counselorNames: EMPTY_MAP, studentProfiles: EMPTY_MAP, headIds: [], slots: [] };
  }
  const data =
    r === "counselor"
      ? await listCounselorAppointments(supabase, cid as string, "confirmed")
      : await listOfficeAppointments(supabase, { status: "confirmed" });
  // Calendar shows confirmed sessions only — i.e. appointments the counselor
  // scheduled on confirm (including sessions minted from confirmed referrals).
  // Pending / assigned requests live on /appointments; terminal rows stay out.
  const list = ((data ?? []) as CalendarSession[]).filter((a) => a.scheduled_at && a.status === "confirmed");

  const studentIds = [...new Set(list.map((a) => a.student_id).filter((id): id is string => !!id))];
  let aliases = EMPTY_MAP;
  let studentProfiles = EMPTY_MAP;
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("id, profile_id, anonymous_alias")
      .in("id", studentIds.slice(0, 500));
    const studentRows = ((students ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]);
    aliases = new Map(studentRows.map((s) => [s.id, s.anonymous_alias ?? "Student"]));
    studentProfiles = new Map(studentRows.map((s) => [s.id, s.profile_id]));
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

  const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
  const headIds = ((headRows ?? []) as { id: string }[]).map((h) => h.id);

  // Own availability windows power the notes modal's follow-up picker.
  // The head never schedules, so only the counselor branch fetches them.
  let slots: BoardSlot[] = [];
  if (r === "counselor" && cid) {
    const { data: slotRows } = await supabase
      .from("counselor_availability")
      .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
      .eq("counselor_id", cid);
    slots = ((slotRows ?? []) as BoardSlot[]);
  }

  return { role: r, counselorId: cid, sessions: list, aliases, counselorNames, studentProfiles, headIds, slots };
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
