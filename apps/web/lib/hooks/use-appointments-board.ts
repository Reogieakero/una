"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listCounselorAppointments, listOfficeAppointments } from "@dorsu/shared-services";

export type BoardAppointment = {
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
  /** True for sessions minted as follow-ups from a session note (00054). */
  is_follow_up: boolean;
  /** Origin session the follow-up was documented from; null for regular bookings. */
  follow_up_of: string | null;
};

export type BoardCounselor = { id: string; name: string };

/** Counselor availability window driving the confirm/reschedule dropdowns. */
export type BoardSlot = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

export type AppointmentsBoardData = {
  role: string | null;
  counselorId: string | null;
  appointments: BoardAppointment[];
  aliases: Map<string, string>;
  studentProfiles: Map<string, string>;
  counselors: BoardCounselor[];
  headIds: string[];
  /** Own availability slots (counselor role only) — confirm/reschedule scope. */
  slots: BoardSlot[];
};

export const APPOINTMENTS_BOARD_KEY = ["appointments", "board"] as const;

/** Fresh window — inside it, going back to /appointments renders zero-fetch. */
export const APPOINTMENTS_BOARD_STALE_MS = 60_000;

const EMPTY_MAP = new Map<string, string>();

export async function fetchAppointmentsBoard(): Promise<AppointmentsBoardData> {
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
  if (!r || r === "faculty") {
    return {
      role: r,
      counselorId: cid,
      appointments: [],
      aliases: EMPTY_MAP,
      studentProfiles: EMPTY_MAP,
      counselors: [],
      headIds: [],
      slots: [],
    };
  }

  // Linked counselors read their own queue only; unlinked counselors get an
  // empty board (never the office-wide list — RLS would block it anyway,
  // but no office query is even issued).
  if (r === "counselor" && !cid) {
    return {
      role: r,
      counselorId: cid,
      appointments: [],
      aliases: EMPTY_MAP,
      studentProfiles: EMPTY_MAP,
      counselors: [],
      headIds: [],
      slots: [],
    };
  }

  const data =
    r === "counselor"
      ? await listCounselorAppointments(supabase, cid as string)
      : await listOfficeAppointments(supabase);
  const appointments = ((data ?? []) as BoardAppointment[]);

  const studentIds = [...new Set(appointments.map((a) => a.student_id).filter((id): id is string => !!id))];
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

  const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
  const profileIds = ((counselorRows ?? []) as { id: string; profile_id: string }[]).map((c) => c.profile_id);
  let names = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
    names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
  }
  const counselors = ((counselorRows ?? []) as { id: string; profile_id: string }[]).map((c) => ({
    id: c.id,
    name: names.get(c.profile_id) ?? "Counselor",
  }));
  const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
  const headIds = ((headRows ?? []) as { id: string }[]).map((h) => h.id);

  // Own availability windows power the counselor's confirm/reschedule
  // dropdowns (the schedule must sit inside these slots). The head never
  // schedules, so only the counselor branch fetches them.
  let slots: BoardSlot[] = [];
  if (r === "counselor" && cid) {
    const { data: slotRows } = await supabase
      .from("counselor_availability")
      .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
      .eq("counselor_id", cid);
    slots = ((slotRows ?? []) as BoardSlot[]);
  }

  return { role: r, counselorId: cid, appointments, aliases, studentProfiles, counselors, headIds, slots };
}

/**
 * Cached appointments board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /appointments shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Mutations refetch explicitly, so actions never serve stale rows.
 * Filters and dialog state stay local on purpose.
 */
export function useAppointmentsBoard() {
  return useQuery({
    queryKey: [...APPOINTMENTS_BOARD_KEY],
    queryFn: fetchAppointmentsBoard,
    staleTime: APPOINTMENTS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
