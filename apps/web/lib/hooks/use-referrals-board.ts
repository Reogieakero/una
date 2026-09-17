"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listReferrals } from "@dorsu/shared-services";

export type ReferralsRow = {
  id: string;
  referring_faculty_id: string | null;
  referring_personnel_id: string | null;
  student_id: string;
  reason: string;
  priority: string;
  status: string;
  assigned_counselor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralsAction = {
  id: string;
  referral_id: string;
  actor_profile_id: string;
  action: string;
  note: string | null;
  created_at: string;
};

export type ReferralsBoardData = {
  role: string | null;
  me: string | null;
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
  students: { id: string; label: string }[];
  readyStudents: Set<string>;
};

export const REFERRALS_BOARD_KEY = ["referrals", "board"] as const;

/** Fresh window — inside it, going back to /referrals renders zero-fetch. */
export const REFERRALS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: ReferralsRow[] = [];
const EMPTY_MAP_STR = new Map<string, string>();
const EMPTY_TRAIL = new Map<string, ReferralsAction[]>();
const EMPTY_IDS: string[] = [];
const EMPTY_STUDENTS: { id: string; label: string }[] = [];
const EMPTY_COUNSELORS: { id: string; name: string }[] = [];
const EMPTY_READY = new Set<string>();

export async function fetchReferralsBoard(): Promise<ReferralsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
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
      .select("id, anonymous_alias, student_no")
      .order("created_at", { ascending: false })
      .limit(200);
    students = (
      (studentRows ?? []) as { id: string; anonymous_alias: string | null; student_no: string }[]
    ).map((s) => ({
      id: s.id,
      label: `${s.anonymous_alias ?? "Student"} · ${s.student_no}`,
    }));
  }
  if (!r || !["counselor", "guidance_head", "faculty"].includes(r)) {
    return {
      role: r,
      me: user.id,
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
    };
  }

  const data = ((await listReferrals(supabase)) ?? []) as ReferralsRow[];

  const { data: actions } = await supabase
    .from("referral_actions")
    .select("id, referral_id, actor_profile_id, action, note, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const grouped = new Map<string, ReferralsAction[]>();
  for (const a of ((actions ?? []) as ReferralsAction[])) {
    if (!grouped.has(a.referral_id)) grouped.set(a.referral_id, []);
    grouped.get(a.referral_id)!.push(a);
  }
  let actorNames = EMPTY_MAP_STR;
  const actorIds = [...new Set(((actions ?? []) as ReferralsAction[]).map((a) => a.actor_profile_id))];
  if (actorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds.slice(0, 200));
    actorNames = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"])
    );
  }

  const studentIds = [...new Set(data.map((x) => x.student_id))];
  let aliases = EMPTY_MAP_STR;
  let studentProfiles = EMPTY_MAP_STR;
  let readyStudents = EMPTY_READY;
  if (studentIds.length) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, profile_id, anonymous_alias")
      .in("id", studentIds.slice(0, 300));
    const srows = ((studentRows ?? []) as { id: string; profile_id: string; anonymous_alias: string | null }[]);
    aliases = new Map(srows.map((s) => [s.id, s.anonymous_alias ?? "Student"]));
    studentProfiles = new Map(srows.map((s) => [s.id, s.profile_id]));
    // Resolve gate — which referred students already hold a confirmed (or
    // completed) session with a schedule. RLS-scoped, so counselors only
    // ever see their own sessions here.
    const { data: sessionRows } = await supabase
      .from("appointments")
      .select("student_id")
      .in("student_id", studentIds.slice(0, 300))
      .in("status", ["confirmed", "completed"])
      .not("scheduled_at", "is", null);
    readyStudents = new Set(((sessionRows ?? []) as { student_id: string }[]).map((a) => a.student_id));
  }

  let counselors = EMPTY_COUNSELORS;
  let counselorProfiles = EMPTY_MAP_STR;
  const { data: counselorRows } = await supabase.from("counselors").select("id, profile_id").limit(100);
  const crows = ((counselorRows ?? []) as { id: string; profile_id: string }[]);
  if (crows.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", crows.map((c) => c.profile_id));
    const names = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Counselor"])
    );
    counselors = crows.map((c) => ({ id: c.id, name: names.get(c.profile_id) ?? "Counselor" }));
    counselorProfiles = new Map(crows.map((c) => [c.id, c.profile_id]));
  }
  const { data: headRows } = await supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true);
  const headIds = ((headRows ?? []) as { id: string }[]).map((h) => h.id);

  let facultyNames = EMPTY_MAP_STR;
  let facultyProfiles = EMPTY_MAP_STR;
  const facIds = [...new Set(data.map((x) => x.referring_faculty_id).filter(Boolean))] as string[];
  if (facIds.length) {
    const { data: facRows } = await supabase.from("faculty_members").select("id, profile_id").in("id", facIds.slice(0, 100));
    const frows = ((facRows ?? []) as { id: string; profile_id: string }[]);
    if (frows.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", frows.map((f) => f.profile_id));
      const names = new Map(
        ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Faculty"])
      );
      facultyNames = new Map(frows.map((f) => [f.id, names.get(f.profile_id) ?? "Faculty"]));
      facultyProfiles = new Map(frows.map((f) => [f.id, f.profile_id]));
    }
  }

  return {
    role: r,
    me: user.id,
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
