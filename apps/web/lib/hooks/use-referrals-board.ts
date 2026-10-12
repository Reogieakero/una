"use client";

import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { patchBoard } from "@/lib/patch-board";
import { listReferralPage, type ReferralCursor } from "@dorsu/shared-services";
import { MAX_PAGE_SIZE } from "@/lib/pagination";

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

export type ReferralsStats = {
  total: number;
  pending: number;
  assigned: number;
  confirmed: number;
  resolved: number;
  unassigned: number;
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
  /** Pager state for this cache entry. */
  page: number;
  size: number;
  hasMore: boolean;
  /** Server-side total (status RPC, RLS-scoped) — "~N" labels, not exact. */
  totalApprox: number;
  stats: ReferralsStats;
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

export type ReferralsScope = {
  page: number;
  size: number;
  status: string;
  priority: string;
  assignee: string;
};

/** Default first-page scope (sidebar prefetch + simple consumers). */
export const DEFAULT_REFERRALS_SCOPE: ReferralsScope = {
  page: 1,
  size: 25,
  status: "all",
  priority: "all",
  assignee: "all",
};

/**
 * Cursor chain per filter signature — index i holds the cursor FOR page i+1
 * (index 0 is always null = page 1). Module-scoped: survives in-app
 * navigation, keyed by size+filters so a filter change starts a fresh chain.
 * Deep ?page=N links walk forward once with limit-1 probes, then pin.
 */
const cursorChains = new Map<string, (ReferralCursor | null)[]>();

function chainKey(size: number, status: string, priority: string, assignee: string): string {
  return `${size}|${status}|${priority}|${assignee}`;
}

/**
 * Upsert one referral row into EVERY cached board page — prepends when new
 * (actor submit, incoming realtime row), merges when known. Pages holding
 * the row converge without a full refetch; other pages are untouched.
 */
export function upsertReferralRow(qc: QueryClient, row: ReferralsRow, alias?: string | null) {
  const entries = qc.getQueryCache().findAll({ queryKey: [...REFERRALS_BOARD_KEY] });
  for (const entry of entries) {
    patchBoard<ReferralsBoardData>(qc, entry.queryKey, (prev) => {
      const rows = prev.rows.some((r) => r.id === row.id)
        ? prev.rows.map((r) => (r.id === row.id ? { ...r, ...row } : r))
        : [row, ...prev.rows];
      const aliases =
        alias && row.student_id ? new Map(prev.aliases).set(row.student_id, alias) : prev.aliases;
      return { ...prev, rows, aliases };
    });
  }
}

/** Patch one row's fields across every cached page (triage/assign moves). */
export function patchReferralRow(qc: QueryClient, id: string, patch: Partial<ReferralsRow>) {
  const entries = qc.getQueryCache().findAll({ queryKey: [...REFERRALS_BOARD_KEY] });
  for (const entry of entries) {
    patchBoard<ReferralsBoardData>(qc, entry.queryKey, (prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }
}

/** Single-row fetch for deep-links landing on an unloaded page. */
export async function fetchReferralCard(id: string): Promise<{
  row: ReferralsRow;
  alias: string | null;
  facultyName: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("referrals").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Referral not found.");
  const row = data as ReferralsRow;
  let alias: string | null = null;
  if (row.student_id) {
    const { data: s } = await supabase
      .from("students")
      .select("anonymous_alias")
      .eq("id", row.student_id)
      .single();
    alias = (s as { anonymous_alias: string | null } | null)?.anonymous_alias ?? null;
  }
  let facultyName: string | null = null;
  if (row.referring_faculty_id) {
    const { data: f } = await supabase
      .from("faculty_members")
      .select("profile_id")
      .eq("id", row.referring_faculty_id)
      .single();
    const pid = (f as { profile_id: string } | null)?.profile_id;
    if (pid) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", pid).single();
      facultyName = (p as { full_name: string | null } | null)?.full_name ?? null;
    }
  }
  return { row, alias, facultyName };
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
const EMPTY_STATS: ReferralsStats = { total: 0, pending: 0, assigned: 0, confirmed: 0, resolved: 0, unassigned: 0 };

export async function fetchReferralsBoard(scope: ReferralsScope): Promise<ReferralsBoardData> {
  const page = Math.max(1, Math.floor(scope.page) || 1);
  const size = Math.min(Math.max(Math.floor(scope.size) || 25, 1), MAX_PAGE_SIZE);
  const status = scope.status || "all";
  const priority = scope.priority || "all";
  const assignee = scope.assignee || "all";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const r = (profile as { role: string } | null)?.role ?? null;
  const myName = (profile as { full_name: string | null } | null)?.full_name ?? "Staff";
  const base = {
    role: r,
    me: user.id,
    myName,
    page,
    size,
    hasMore: false,
    totalApprox: 0,
    stats: EMPTY_STATS,
  };
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
      ...base,
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

  // Keyset walk: resolve the cursor for the requested page (limit-1 probes
  // for skipped pages — one indexed row each, then pinned in the chain).
  const key = chainKey(size, status, priority, assignee);
  let chain = cursorChains.get(key);
  if (!chain) {
    chain = [null];
    cursorChains.set(key, chain);
  }
  const listOpts = {
    status,
    priority,
    // Counselors see their own queue only — RLS enforces it too, but scoping
    // the query keeps pages dense for them.
    assignee: r === "counselor" && counselorId ? counselorId : assignee,
  };
  while (chain.length < page) {
    const probe = await listReferralPage(supabase, { ...listOpts, limit: 1, cursor: chain[chain.length - 1] });
    chain.push(probe.nextCursor);
    if (!probe.hasMore) break;
  }
  const { rows: pageRows, nextCursor, hasMore } = await listReferralPage(supabase, {
    ...listOpts,
    limit: size,
    cursor: chain[page - 1] ?? null,
  });
  chain[page] = nextCursor;
  const data = ((pageRows ?? []) as ReferralsRow[]);

  // Round 1 — independent reads, one batch.
  // Trail is scoped to THIS page's ids (≤50 IN-list) instead of the old
  // global 500-row pull; stats come from the RLS-scoped status RPC.
  const pageIds = data.map((x) => x.id);
  const [actionsRes, headRes, counselorRes, statusRes, unassignedRes] = await Promise.all([
    pageIds.length
      ? supabase
          .from("referral_actions")
          .select("id, referral_id, actor_profile_id, actor_name, actor_role, action, note, created_at")
          .in("referral_id", pageIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id").eq("role", "guidance_head").eq("is_active", true),
    supabase.from("counselors").select("id, profile_id").limit(100),
    supabase.rpc("head_referral_status_counts"),
    supabase
      .from("referrals")
      .select("id", { count: "estimated", head: true })
      .in("status", ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"])
      .is("assigned_counselor_id", null),
  ]);
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

  // Round 2 — everything keyed off the page, still one batch.
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

  // Server stats (RLS-scoped status RPC) + unassigned pipeline count.
  // Fallback when the 00061 RPC is not deployed yet (e.g. staging before
  // `supabase db push`): per-status estimated counts keep the stats menu
  // correct at zero extra cost once the RPC exists.
  const statusCounts = new Map<string, number>();
  for (const s of ((statusRes.data ?? []) as { status: string; count: number | string }[])) {
    statusCounts.set(s.status, Number(s.count ?? 0));
  }
  if (statusRes.error) {
    const [totalRes, pendRes, assRes, confRes, resRes] = await Promise.all([
      supabase.from("referrals").select("id", { count: "estimated", head: true }),
      supabase.from("referrals").select("id", { count: "estimated", head: true }).eq("status", "pending"),
      supabase.from("referrals").select("id", { count: "estimated", head: true }).eq("status", "assigned"),
      supabase.from("referrals").select("id", { count: "estimated", head: true }).eq("status", "confirmed"),
      supabase.from("referrals").select("id", { count: "estimated", head: true }).eq("status", "resolved"),
    ]);
    statusCounts.set("__total", totalRes.count ?? 0);
    statusCounts.set("pending", pendRes.count ?? 0);
    statusCounts.set("assigned", assRes.count ?? 0);
    statusCounts.set("confirmed", confRes.count ?? 0);
    statusCounts.set("resolved", resRes.count ?? 0);
  }
  const total = statusCounts.has("__total")
    ? (statusCounts.get("__total") ?? 0)
    : [...statusCounts.values()].reduce((a, b) => a + b, 0);
  const stats: ReferralsStats = {
    total,
    pending: statusCounts.get("pending") ?? 0,
    assigned: statusCounts.get("assigned") ?? 0,
    confirmed: statusCounts.get("confirmed") ?? 0,
    resolved: statusCounts.get("resolved") ?? 0,
    unassigned: (unassignedRes as { count: number | null }).count ?? 0,
  };

  // Own availability windows scope the counselor's confirm schedule picker.
  let slots: BoardSlot[] = [];
  if (r === "counselor" && counselorId) {
    const { data: slotRows } = await supabase
      .from("counselor_availability")
      .select("weekday, start_time, end_time, is_recurring, valid_from, valid_to")
      .eq("counselor_id", counselorId);
    slots = ((slotRows ?? []) as BoardSlot[]);
  }

  return {
    ...base,
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
    hasMore,
    totalApprox: total,
    stats,
  };
}

/**
 * Cached referrals board — stale-while-revalidate, keyed by page + size +
 * structured filters. Text search stays client-side over the loaded page
 * (see page); changing any structured filter must reset to page 1 (the
 * cursor chain is keyed by the filter signature).
 */
export function useReferralsBoard(scope: ReferralsScope) {
  return useQuery({
    queryKey: [...REFERRALS_BOARD_KEY, scope.page, scope.size, scope.status, scope.priority, scope.assignee],
    queryFn: () => fetchReferralsBoard(scope),
    staleTime: REFERRALS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
