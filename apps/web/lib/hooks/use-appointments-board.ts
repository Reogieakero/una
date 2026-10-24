"use client";

import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listAppointmentPage, type AppointmentCursor } from "@dorsu/shared-services";
import { MAX_PAGE_SIZE } from "@/lib/pagination";
import { patchBoard } from "@/lib/patch-board";

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
  /** True when this session still needs a fresh pre-session PSS-10 (00068). */
  pss10_required: boolean;
  /** Counselor-recorded waiver timestamp; null when no waiver. */
  pss10_waived_at: string | null;
  /** Operational waiver reason (never clinical detail). */
  pss10_waiver_reason: string | null;
  /** Latest linked check-in submission, derived from pss10_assessments. */
  pss10_checkin_at?: string | null;
  /** Request timestamp — the office board's primary sort. */
  created_at: string;
  /** Last-write timestamp (00062 trigger) — the counselor board's primary sort. */
  updated_at: string;
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

export type AppointmentsStats = {
  total: number;
  pending: number;
  assigned: number;
  confirmed: number;
  completed: number;
  unassigned: number;
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
  /** Pager state for this cache entry. */
  page: number;
  size: number;
  hasMore: boolean;
  /** Server-side total (estimated counts, RLS-scoped) — "~N" labels. */
  totalApprox: number;
  stats: AppointmentsStats;
  kindCounts: { appointments: number; followups: number };
};

export const APPOINTMENTS_BOARD_KEY = ["appointments", "board"] as const;

export type AppointmentsScope = {
  page: number;
  size: number;
  status: string;
  mode: string;
  counselor: string;
  kind: "appointments" | "followups";
};

/** Default first-page scope (sidebar prefetch + simple consumers). */
export const DEFAULT_APPOINTMENTS_SCOPE: AppointmentsScope = {
  page: 1,
  size: 25,
  status: "all",
  mode: "all",
  counselor: "all",
  kind: "appointments",
};

/**
 * Cursor chain per scope signature — index i holds the cursor FOR page i+1
 * (index 0 is always null = page 1). Module-scoped: survives in-app
 * navigation. Deep ?page=N links walk forward once with limit-1 probes.
 */
const cursorChains = new Map<string, (AppointmentCursor | null)[]>();

function chainKey(scope: { size: number; status: string; mode: string; counselor: string; kind: string; asc: boolean; orderBy: string }): string {
  return `${scope.size}|${scope.status}|${scope.mode}|${scope.counselor}|${scope.kind}|${scope.asc ? "a" : "d"}|${scope.orderBy}`;
}

/** Patch one appointment's fields across every cached page. */
export function patchAppointmentRow(qc: QueryClient, id: string, patch: Partial<BoardAppointment>) {
  const entries = qc.getQueryCache().findAll({ queryKey: [...APPOINTMENTS_BOARD_KEY] });
  for (const entry of entries) {
    patchBoard<AppointmentsBoardData>(qc, entry.queryKey, (prev) => ({
      ...prev,
      appointments: prev.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }
}

/** Upsert one appointment into every cached page (realtime arrivals). */
export function upsertAppointmentRow(qc: QueryClient, row: BoardAppointment) {
  const entries = qc.getQueryCache().findAll({ queryKey: [...APPOINTMENTS_BOARD_KEY] });
  for (const entry of entries) {
    patchBoard<AppointmentsBoardData>(qc, entry.queryKey, (prev) => ({
      ...prev,
      appointments: prev.appointments.some((a) => a.id === row.id)
        ? prev.appointments.map((a) => (a.id === row.id ? { ...a, ...row } : a))
        : [row, ...prev.appointments],
    }));
  }
}

/** Single-row fetch for deep-links landing on an unloaded page. */
export async function fetchAppointmentCard(id: string): Promise<{ row: BoardAppointment; alias: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, student_id, counselor_id, scheduled_at, ends_at, mode, status, concern, meeting_url, is_follow_up, follow_up_of, created_at, updated_at, pss10_required, pss10_waived_at, pss10_waiver_reason")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Session not found.");
  const [row] = await attachLinkedCheckins(supabase, [data as BoardAppointment]);
  let alias: string | null = null;
  if (row.student_id) {
    const { data: s } = await supabase.from("students").select("anonymous_alias").eq("id", row.student_id).single();
    alias = (s as { anonymous_alias: string | null } | null)?.anonymous_alias ?? null;
  }
  return { row, alias };
}

/**
 * Attach the newest linked pre-session check-in per appointment. The board
 * never needs answers/scores here — only the timestamp that proves a fresh
 * check-in exists. Batched by visible ids (RLS scopes rows).
 */
async function attachLinkedCheckins(
  supabase: ReturnType<typeof createClient>,
  rows: BoardAppointment[],
): Promise<BoardAppointment[]> {
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return rows;
  const { data } = await supabase
    .from("pss10_assessments")
    .select("appointment_id, student_id, created_at")
    .in("appointment_id", ids)
    .order("created_at", { ascending: false });
  const latest = new Map<string, string>();
  for (const row of (data ?? []) as { appointment_id: string | null; created_at: string }[]) {
    if (row.appointment_id && !latest.has(row.appointment_id)) {
      latest.set(row.appointment_id, row.created_at);
    }
  }
  return rows.map((r) => ({ ...r, pss10_checkin_at: latest.get(r.id) ?? null }));
}

/** Fresh window — inside it, going back to /appointments renders zero-fetch. */
export const APPOINTMENTS_BOARD_STALE_MS = 60_000;

const EMPTY_MAP = new Map<string, string>();
const EMPTY_STATS: AppointmentsStats = { total: 0, pending: 0, assigned: 0, confirmed: 0, completed: 0, unassigned: 0 };
const EMPTY_KIND = { appointments: 0, followups: 0 };

const ACTIVE_APPT = ["pending", "assigned", "confirmed"] as const;

export async function fetchAppointmentsBoard(scope: AppointmentsScope): Promise<AppointmentsBoardData> {
  const page = Math.max(1, Math.floor(scope.page) || 1);
  const size = Math.min(Math.max(Math.floor(scope.size) || 25, 1), MAX_PAGE_SIZE);
  const status = scope.status || "all";
  const mode = scope.mode || "all";
  // Counselors read their own queue only — forced server-side (RLS too).
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
  const base = {
    role: r,
    counselorId: cid,
    page,
    size,
    hasMore: false,
    totalApprox: 0,
    stats: EMPTY_STATS,
    kindCounts: EMPTY_KIND,
  };
  if (!r || r === "faculty") {
    return {
      ...base,
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
      ...base,
      appointments: [],
      aliases: EMPTY_MAP,
      studentProfiles: EMPTY_MAP,
      counselors: [],
      headIds: [],
      slots: [],
    };
  }

  // Counselor queue reads latest-activity first: the 00062 trigger bumps
  // updated_at on assign/confirm/reschedule/complete, so whatever the counselor
  // or head just touched is on top. The office reads most-recently-requested
  // first (created_at) so mobile bookings land on top regardless of how far
  // out the session date is.
  const asc = false;
  const orderBy: "created_at" | "updated_at" = r === "counselor" ? "updated_at" : "created_at";
  const listOpts = {
    status,
    mode,
    counselor: scope.counselor || "all",
    isFollowUp: scope.kind === "followups",
    ascending: asc,
    orderBy,
    ...(r === "counselor" ? { counselorId: cid as string } : {}),
  };
  const key = chainKey({ size, status, mode, counselor: r === "counselor" ? (cid as string) : listOpts.counselor, kind: scope.kind, asc, orderBy });
  let chain = cursorChains.get(key);
  if (!chain) {
    chain = [null];
    cursorChains.set(key, chain);
  }
  while (chain.length < page) {
    const probe = await listAppointmentPage(supabase, { ...listOpts, limit: 1, cursor: chain[chain.length - 1] });
    chain.push(probe.nextCursor);
    if (!probe.hasMore) break;
  }
  const { rows, nextCursor, hasMore } = await listAppointmentPage(supabase, {
    ...listOpts,
    limit: size,
    cursor: chain[page - 1] ?? null,
  });
  chain[page] = nextCursor;
  const appointments = ((rows ?? []) as BoardAppointment[]);
  const appointmentsWithCheckins = appointments.length
    ? await attachLinkedCheckins(supabase, appointments)
    : appointments;

  // Stats + kind tabs: estimated counts (RLS-scoped, one parallel batch).
  // Tabs show role-scope queue sizes; the text search stays client-side.
  const countBase = (extra?: (q: any) => any) => {
    let q = supabase.from("appointments").select("id", { count: "estimated", head: true });
    if (r === "counselor" && cid) q = q.eq("counselor_id", cid);
    if (extra) q = extra(q);
    return q;
  };
  const [
    totalRes,
    pendingRes,
    assignedRes,
    confirmedRes,
    completedRes,
    unassignedRes,
    regularRes,
    followupRes,
  ] = await Promise.all([
    countBase(),
    countBase((q) => q.eq("status", "pending")),
    countBase((q) => q.eq("status", "assigned")),
    countBase((q) => q.eq("status", "confirmed")),
    countBase((q) => q.eq("status", "completed")),
    countBase((q) => q.in("status", [...ACTIVE_APPT]).is("counselor_id", null)),
    countBase((q) => q.eq("is_follow_up", false)),
    countBase((q) => q.eq("is_follow_up", true)),
  ]);

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

  return {
    ...base,
    appointments: appointmentsWithCheckins,
    aliases,
    studentProfiles,
    counselors,
    headIds,
    slots,
    hasMore,
    totalApprox: totalRes.count ?? 0,
    stats: {
      total: totalRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      assigned: assignedRes.count ?? 0,
      confirmed: confirmedRes.count ?? 0,
      completed: completedRes.count ?? 0,
      unassigned: unassignedRes.count ?? 0,
    },
    kindCounts: {
      appointments: regularRes.count ?? 0,
      followups: followupRes.count ?? 0,
    },
  };
}

/**
 * Cached appointments board — stale-while-revalidate, keyed by page + size
 * + structured filters. Text search stays client-side over the loaded page;
 * changing any structured filter must reset to page 1.
 */
export function useAppointmentsBoard(scope: AppointmentsScope) {
  return useQuery({
    queryKey: [...APPOINTMENTS_BOARD_KEY, scope.page, scope.size, scope.status, scope.mode, scope.counselor, scope.kind],
    queryFn: () => fetchAppointmentsBoard(scope),
    staleTime: APPOINTMENTS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
