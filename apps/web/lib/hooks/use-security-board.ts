"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type SecurityGlassLog = {
  id: string;
  accessor_profile_id: string;
  student_id: string;
  justification: string;
  accessed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type SecurityAuditRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SecurityBoardData = {
  me: string | null;
  logs: SecurityGlassLog[];
  audit: SecurityAuditRow[];
  names: Map<string, string>;
  aliases: Map<string, string>;
  students: { id: string; label: string }[];
  roleCounts: Map<string, number>;
  deactivated: number;
  headIds: string[];
};

export const SECURITY_BOARD_KEY = ["security", "board"] as const;

/** Fresh window — inside it, going back to /security renders zero-fetch. */
export const SECURITY_BOARD_STALE_MS = 60_000;

const EMPTY_LOGS: SecurityGlassLog[] = [];
const EMPTY_AUDIT: SecurityAuditRow[] = [];
const EMPTY_MAP = new Map<string, string>();
const EMPTY_STUDENTS: { id: string; label: string }[] = [];
const EMPTY_COUNTS = new Map<string, number>();
const EMPTY_IDS: string[] = [];

export async function fetchSecurityBoard(): Promise<SecurityBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: glass }, { data: auditRows }, { data: profiles }] = await Promise.all([
    supabase.from("break_glass_logs").select("*").order("accessed_at", { ascending: false }).limit(50),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, email, role, full_name, is_active").limit(300),
  ]);
  const glassList = ((glass ?? []) as SecurityGlassLog[]);
  const profs = ((profiles ?? []) as { id: string; email: string; role: string; full_name: string | null; is_active: boolean }[]);
  const counts = new Map<string, number>();
  let off = 0;
  for (const p of profs) {
    counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
    if (!p.is_active) off += 1;
  }

  const studentIds = [...new Set(glassList.map((g) => g.student_id))];
  const [{ data: studentRows }, { data: directory }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, anonymous_alias").in("id", studentIds.slice(0, 200))
      : Promise.resolve({ data: [] }),
    supabase.from("students").select("id, anonymous_alias, student_no").order("created_at", { ascending: false }).limit(200),
  ]);
  return {
    me: user?.id ?? null,
    logs: glassList,
    audit: ((auditRows ?? []) as SecurityAuditRow[]),
    names: new Map(profs.map((p) => [p.id, p.full_name ?? p.email])),
    aliases: new Map(
      ((studentRows ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"])
    ),
    students: ((directory ?? []) as { id: string; anonymous_alias: string | null; student_no: string }[]).map((s) => ({
      id: s.id,
      label: `${s.anonymous_alias ?? "Student"} · ${s.student_no}`,
    })),
    roleCounts: counts,
    deactivated: off,
    headIds: profs.filter((p) => p.role === "guidance_head" && p.is_active).map((p) => p.id),
  };
}

/**
 * Cached security console — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /security shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Mutations (log access, mark reviewed) refetch explicitly, so actions
 * never serve stale rows. Form and filter state stay local on purpose.
 */
export function useSecurityBoard() {
  return useQuery({
    queryKey: [...SECURITY_BOARD_KEY],
    queryFn: fetchSecurityBoard,
    staleTime: SECURITY_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
