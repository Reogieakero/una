"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type UsersProfile = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
};

export type UsersBoardData = {
  me: string | null;
  rows: UsersProfile[];
  details: Map<string, string>;
};

export const USERS_BOARD_KEY = ["users", "board"] as const;

/** Fresh window — inside it, going back to /users renders zero-fetch. */
export const USERS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: UsersProfile[] = [];
const EMPTY_DETAILS = new Map<string, string>();

export async function fetchUsersBoard(): Promise<UsersBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = ((data ?? []) as UsersProfile[]);

  const ids = rows.map((u) => u.id);
  const details = new Map<string, string>();
  if (ids.length) {
    const [counselors, students, faculty] = await Promise.all([
      supabase.from("counselors").select("profile_id, specialization").in("profile_id", ids.slice(0, 200)),
      supabase.from("students").select("profile_id, program, year_level").in("profile_id", ids.slice(0, 200)),
      supabase.from("faculty_members").select("profile_id, department").in("profile_id", ids.slice(0, 200)),
    ]);
    for (const c of ((counselors.data ?? []) as { profile_id: string; specialization: string | null }[])) {
      if (c.specialization) details.set(c.profile_id, c.specialization);
    }
    for (const s of ((students.data ?? []) as {
      profile_id: string;
      program: string | null;
      year_level: string | null;
    }[])) {
      details.set(s.profile_id, [s.program, s.year_level].filter(Boolean).join(" · ") || "Student");
    }
    for (const f of ((faculty.data ?? []) as { profile_id: string; department: string | null }[])) {
      if (f.department) details.set(f.profile_id, f.department);
    }
  }
  return { me: user.id, rows, details };
}

/**
 * Cached users directory — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /users shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 * Mutations refetch explicitly, so actions never serve stale rows.
 * Filters, search, and dialog state stay local on purpose.
 */
export function useUsersBoard() {
  return useQuery({
    queryKey: [...USERS_BOARD_KEY],
    queryFn: fetchUsersBoard,
    staleTime: USERS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
