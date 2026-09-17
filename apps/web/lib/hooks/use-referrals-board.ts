"use client";

import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { patchBoard } from "@/lib/patch-board";
import { listReferrals } from "@dorsu/shared-services";

export type ReferralsRow = {
  id: string;
  referring_faculty_id: string | null;
  referring_personnel_id: string | null;
  /** Null for walk-ins — show student_name_text instead (migration 00041). */
  student_id: string | null;
  student_name_text: string | null;
  student_no_text: string | null;
  reason: string;
  priority: string;
  /** Official sheet snapshot (migration 00040). */
  student_gender: string | null;
  student_age: string | null;
  relation_to_client: string | null;
  /** Paper Case Classification checkboxes (multi-select). */
  case_classification: string[];
  classification_other: string | null;
  status: string;
  assigned_counselor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralStudentOption = {
  id: string;
  label: string;
  alias: string;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
};

export type ReferralsAction = {
  id: string;
  referral_id: string;
  actor_profile_id: string;
  /** Stamped at write time (00048) — readable where profiles RLS is not. */
  actor_name: string | null;
  /** Stamped at write time (00049) — same reason. */
  actor_role: string | null;
  action: string;
  note: string | null;
  created_at: string;
};

export type ReferralsBoardData = {
  role: string | null;
  me: string | null;
  /** Signed-in staff display name (own profile row). */
  myName: string;
  facultyId: string | null;
  counselorId: string | null;
  rows: ReferralsRow[];
  trail: Map<string, ReferralsAction[]>;
  actorNames: Map<string, string>;
  aliases: Map<string, string>;
  studentProfiles: Map<string, string>;
  counselors: { id: string; name: string }[];
  counselorProfiles: Map<string, string>;
  facultyNames: Map<string, string>;
  facultyProfiles: Map<string, string>;
  headIds: string[];
  students: ReferralStudentOption[];
  readyStudents: Set<string>;
  /** Own availability slots (counselor role only) — confirm schedule scope. */
  slots: BoardSlot[];
};

export type BoardSlot = {
  weekday: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

export const REFERRALS_BOARD_KEY = ["referrals", "board"] as const;

/**
 * Upsert one referral row into the cached board — prepends when new (actor
 * submit, incoming realtime row), merges when known (status/assignee moves).
 * Optionally files the student's display alias in the same pass so the row
 * renders with its name immediately, not after the background reconcile.
 */
export function upsertReferralRow(qc: QueryClient, row: ReferralsRow, alias?: string | null) {
  patchBoard<ReferralsBoardData>(qc, [...REFERRALS_BOARD_KEY], (prev) => {
    const rows = prev.rows.some((r) => r.id === row.id)
      ? prev.rows.map((r) => (r.id === row.id ? { ...r, ...row } : r))
      : [row, ...prev.rows];
    const aliases =
      alias && row.student_id ? new Map(prev.aliases).set(row.student_id, alias) : prev.aliases;
    return { ...prev, rows, aliases };
  });
}

/** Fresh window — inside it, going back to /referrals renders zero-fetch. */
export const REFERRALS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: ReferralsRow[] = [];
const EMPTY_MAP_STR = new Map<string, string>();
const EMPTY_TRAIL = new Map<string, ReferralsAction[]>();
const EMPTY_IDS: string[] = [];
const EMPTY_STUDENTS: ReferralStudentOption[] = [];
const EMPTY_COUNSELORS: { id: string; name: string }[] = [];
const EMPTY_READY = new Set<string>();
const EMPTY_SLOTS: BoardSlot[] = [];

export async function fetchReferralsBoard(): Promise<ReferralsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  const myName = (profile as { full_name: string | null } | null)?.full_name ?? "Staff";
  let facultyId: string | null = null;
  let counselorId: string | null = null;
  let students = EMPTY_STUDENTS;
  if (r === "counselor") {
    const { data: c } = await supabase.from("counselors").select("id").eq("profile_id", user.id).single();
    counselorId = (c as { id: string } | null)?.id ?? null;
  }
  if (r === "faculty") {
    const { data } = await supabase.from("faculty_members").select("id").eq("profile_id", user.id).single();
    facultyId = (data as { id: string } | null)?.id ?? null;
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, anonymous_alias, student_no, program, year_level")
      .order("created_at", { ascending: false })
      .limit(200);
    students = (
      (studentRows ?? []) as {
        id: string;
        anonymous_alias: string | null;
        student_no: string;
        program: string | null;
        year_level: string | null;
      }[]
    ).map((s) => ({
      id: s.id,
      label: `${s.anonymous_alias ?? "Student"} · ${s.student_no}`,
      alias: s.anonymous_alias ?? "Student",
      studentNo: s.student_no,
      program: s.program,
      yearLevel: s.year_level,
    }));
  }
  if (!r || !["counselor", "guidance_head", "faculty"].includes(r)) {
    return {
      role: r,
      me: user.id,
      myName,
      facultyId,
      counselorId,
      rows: EMPTY_ROWS,
      trail: EMPTY_TRAIL,
      actorNames: EMPTY_MAP_STR,
      aliases: EMPTY_MAP_STR,
      studentProfiles: EMPTY_MAP_STR,
      counselors: EMPTY_COUNSELORS,
      counselorProfiles: EMPTY_MAP_STR,
      facultyNames: EMPTY_MAP_STR,
      facultyProfiles: EMPTY_MAP_STR,
      headIds: EMPTY_IDS,
      students,
      readyStudents: EMPTY_READY,
      slots: EMPTY_SLOTS,
    };
  }

  // Round 1 — independent reads, one batch instead of four sequential hops.
  const [listRes, actionsRes, headRes, counselorRes] = await Promise.all([
    listReferrals(supabase),
    supabase
      .from("referral_actions")
      .select("id, referral_id, actor_profile_id, actor_name, actor_role, action, note, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true),
    supabase.from("counselors").select("id, profile_id").limit(100),
  ]);
  const data = ((listRes ?? []) as ReferralsRow[]);
  const actions = actionsRes.data;
  const headIds = (((headRes.data ?? []) as { id: string }[])).map((h) => h.id);
  const crows = (((counselorRes.data ?? []) as { id: string; profile_id: string }[]));

  const grouped = new Map<string, ReferralsAction[]>();
  for (const a of ((actions ?? []) as ReferralsAction[])) {
    if (!grouped.has(a.referral_id)) grouped.set(a.referral_id, []);
    grouped.get(a.referral_id)!.push(a);
  }
  const actorIds = [...new Set(((actions ?? []) as ReferralsAction[]).map((a) => a.actor_profile_id))];
  const studentIds = [...new Set(data.map((x) => x.student_id).filter((id): id is string => !!id))];
  const facIds = [...new Set(data.map((x) => x.referring_faculty_id).filter(Boolean))] as string[];

  // Round 2 — everything keyed off round 1, still one batch. Counselor
  // display names come from the narrow counselor_directory() exception
  // (00049) instead of profiles, so every role — including faculty — sees
  // the handling counselor's name.
  const emptyPage = { data: null };
  const [actorProfilesRes, studentRes, sessionRes, counselorNamesRes, facRes] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds.slice(0, 200))
      : emptyPage,
    studentIds.length
      ? supabase.from("students").select("id, profile_id, anonymous_alias").in("id", studentIds.slice(0, 300))
      : emptyPage,
    studentIds.length
      ? supabase
          .from("appointments")
          .select("student_id")
          .in("student_id", studentIds.slice(0, 300))
          .in("status", ["confirmed", "completed"])
          .not("scheduled_at", "is", null)
      : emptyPage,
    crows.length ? supabase.rpc("counselor_directory") : emptyPage,
    facIds.length
      ? supabase.from("faculty_members").select("id, profile_id").in("id", facIds.slice(0, 100))
      : emptyPage,
  ]);

  let actorNames = EMPTY_MAP_STR;
  if (actorIds.length) {
    const profiles = actorProfilesRes.data;
    actorNames = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"])
    );
  }

  let aliases = EMPTY_MAP_STR;
  let studentProfiles = EMPTY_MAP_STR;
  let readyStudents = EMPTY_READY;
  if (studentIds.length) {
    const srows = (((studentRes.data ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]));
    aliases = new Map(srows.map((s) => [s.id, s.anonymous_alias ?? "Student"]));
    studentProfiles = new Map(srows.map((s) => [s.id, s.profile_id]));
    // Resolve gate — which referred students already hold a confirmed (or
    // completed) session with a schedule. RLS-scoped, so counselors only
    // ever see their own sessions here.
    readyStudents = new Set(
      (((sessionRes.data ?? []) as { student_id: string }[])).map((a) => a.student_id)
    );
  }

  let counselors = EMPTY_COUNSELORS;
  let counselorProfiles = EMPTY_MAP_STR;
  if (crows.length) {
    const names = new Map(
      ((((counselorNamesRes.data ?? []) as { counselor_id: string; display_name: string }[]))).map((c) => [c.counselor_id, c.display_name ?? "Counselor"])
    );
    counselors = crows.map((c) => ({ id: c.id, name: names.get(c.id) ?? "Counselor" }));
    counselorProfiles = new Map(crows.map((c) => [c.id, c.profile_id]));
  }

  let facultyNames = EMPTY_MAP_STR;
  let facultyProfiles = EMPTY_MAP_STR;
  if (facIds.length) {
    const frows = (((facRes.data ?? []) as { id: string; profile_id: string }[]));
    if (frows.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", frows.map((f) => f.profile_id));
      const names = new Map(
        ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Faculty"])
      );
      facultyNames = new Map(frows.map((f) => [f.id, names.get(f.profile_id) ?? "Faculty"]));
      facultyProfiles = new Map(frows.map((f) => [f.id, f.profile_id]));
    }
  }

  // Own availability windows scope the counselor's confirm schedule picker
  // (the minted session must sit inside these slots).
  let slots: BoardSlot[] = [];
  if (r === "counselor" && counselorId) {
    const { data: slotRows } = await supabase
      .from("counselor_availability")
      .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
      .eq("counselor_id", counselorId);
    slots = ((slotRows ?? []) as BoardSlot[]);
  }

  return {
    role: r,
    me: user.id,
    myName,
    facultyId,
    counselorId,
    rows: data,
    trail: grouped,
    actorNames,
    aliases,
    studentProfiles,
    counselors,
    counselorProfiles,
    facultyNames,
    facultyProfiles,
    headIds,
    students,
    readyStudents,
    slots,
  };
}

/**
 * Cached referrals board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /referrals shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Mutations refetch explicitly, so actions never serve stale rows.
 * Filters, search, view, and dialog state stay local on purpose.
 */
export function useReferralsBoard() {
  return useQuery({
    queryKey: [...REFERRALS_BOARD_KEY],
    queryFn: fetchReferralsBoard,
    staleTime: REFERRALS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
