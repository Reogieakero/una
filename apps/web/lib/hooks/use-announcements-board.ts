"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AnnouncementsRow = {
  id: string;
  author_profile_id: string;
  title: string;
  body: string;
  audience: string[] | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

export type AnnouncementsBoardData = {
  role: string | null;
  myName: string;
  rows: AnnouncementsRow[];
  authors: Map<string, string>;
};

export const ANNOUNCEMENTS_BOARD_KEY = ["announcements", "board"] as const;

/** Fresh window — inside it, going back to /announcements renders zero-fetch. */
export const ANNOUNCEMENTS_BOARD_STALE_MS = 60_000;

const EMPTY_ROWS: AnnouncementsRow[] = [];
const EMPTY_AUTHORS = new Map<string, string>();

export async function fetchAnnouncementsBoard(): Promise<AnnouncementsBoardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: string | null = null;
  let myName = "Guidance";
  if (user) {
    const { data: me } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
    const typed = me as { full_name: string | null; role: string | null } | null;
    if (typed?.full_name) myName = typed.full_name;
    role = typed?.role ?? null;
  }
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = ((data ?? []) as AnnouncementsRow[]);
  let authors = EMPTY_AUTHORS;
  const authorIds = [...new Set(rows.map((a) => a.author_profile_id))];
  if (authorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds.slice(0, 100));
    authors = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"])
    );
  }
  return { role, myName, rows, authors };
}

/**
 * Cached announcements board — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /announcements shows cached posts instantly while
 * a background refetch (only if stale) refreshes them without blocking.
 * Mutations (post, publish, unpublish, delete) refetch explicitly.
 * Composer, view, and dialog state stay local on purpose.
 */
export function useAnnouncementsBoard() {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_BOARD_KEY],
    queryFn: fetchAnnouncementsBoard,
    staleTime: ANNOUNCEMENTS_BOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
