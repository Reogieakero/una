"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CounselorDashboardPayload } from "@/app/api/dashboard/counselor/route";

export type { CounselorDashboardPayload };

export const COUNSELOR_DASHBOARD_KEY = ["dashboard", "counselor"] as const;

/** Fresh window — inside it, going back to /dashboard renders zero-fetch. */
export const COUNSELOR_DASHBOARD_STALE_MS = 60_000;

export async function fetchCounselorDashboard(): Promise<CounselorDashboardPayload> {
  const res = await fetch("/api/dashboard/counselor", { credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load the dashboard right now.");
  }
  return (await res.json()) as CounselorDashboardPayload;
}

/**
 * Cached counselor dashboard query — stale-while-revalidate.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so the second visit to /dashboard shows cached rows instantly while a
 * background refetch (only if stale) refreshes them without blocking.
 */
export function useCounselorDashboard() {
  return useQuery({
    queryKey: [...COUNSELOR_DASHBOARD_KEY],
    queryFn: fetchCounselorDashboard,
    staleTime: COUNSELOR_DASHBOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/** Warm the cache (e.g. hovering the Dashboard nav link) for instant open. */
export function usePrefetchCounselorDashboard(enabled = true) {
  const qc = useQueryClient();
  return () =>
    enabled &&
    qc.prefetchQuery({
      queryKey: [...COUNSELOR_DASHBOARD_KEY],
      queryFn: fetchCounselorDashboard,
      staleTime: COUNSELOR_DASHBOARD_STALE_MS,
    });
}
