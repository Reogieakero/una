"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FacultyDashboardPayload } from "@/app/api/dashboard/faculty/route";

export type { FacultyDashboardPayload };

export const FACULTY_DASHBOARD_KEY = ["dashboard", "faculty"] as const;

/** Fresh window — inside it, going back to /dashboard renders zero-fetch. */
export const FACULTY_DASHBOARD_STALE_MS = 60_000;

export async function fetchFacultyDashboard(): Promise<FacultyDashboardPayload> {
  const res = await fetch("/api/dashboard/faculty", { credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load the dashboard right now.");
  }
  return (await res.json()) as FacultyDashboardPayload;
}

/**
 * Cached faculty dashboard query — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /dashboard shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 */
export function useFacultyDashboard() {
  return useQuery({
    queryKey: [...FACULTY_DASHBOARD_KEY],
    queryFn: fetchFacultyDashboard,
    staleTime: FACULTY_DASHBOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/** Warm the cache (e.g. hovering the Dashboard nav link) for instant open. */
export function usePrefetchFacultyDashboard(enabled = true) {
  const qc = useQueryClient();
  return () =>
    enabled &&
    qc.prefetchQuery({
      queryKey: [...FACULTY_DASHBOARD_KEY],
      queryFn: fetchFacultyDashboard,
      staleTime: FACULTY_DASHBOARD_STALE_MS,
    });
}
