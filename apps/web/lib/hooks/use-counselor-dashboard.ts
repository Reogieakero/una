"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CounselorDashboardPayload } from "@/app/api/dashboard/counselor/route";
import type { DashboardPeriod } from "@/lib/dashboard-range";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type { CounselorDashboardPayload };
export type CounselorPeriod = DashboardPeriod;

export type CounselorDashboardRange = {
  period: CounselorPeriod;
  /** YYYY-MM-DD, only used when period === "custom". */
  from?: string;
  to?: string;
};

export const COUNSELOR_DASHBOARD_KEY = ["dashboard", "counselor"] as const;

/** Fresh window — inside it, going back to /dashboard renders zero-fetch. */
export const COUNSELOR_DASHBOARD_STALE_MS = 60_000;

/** Default view when no range is supplied (also used by sidebar prefetch). */
export const COUNSELOR_DASHBOARD_DEFAULT_RANGE: CounselorDashboardRange = { period: "week" };

export function counselorDashboardKey(
  range: CounselorDashboardRange = COUNSELOR_DASHBOARD_DEFAULT_RANGE
) {
  return [...COUNSELOR_DASHBOARD_KEY, range.period, range.from ?? "", range.to ?? ""] as const;
}

export async function fetchCounselorDashboard(
  range: CounselorDashboardRange = COUNSELOR_DASHBOARD_DEFAULT_RANGE
): Promise<CounselorDashboardPayload> {
  const params = new URLSearchParams({ period: range.period });
  if (range.period === "custom") {
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
  }
  const res = await fetchWithTimeout(`/api/dashboard/counselor?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load the dashboard right now.");
  }
  return (await res.json()) as CounselorDashboardPayload;
}

/**
 * Cached counselor dashboard query — stale-while-revalidate, one cache entry
 * per period. `keepPreviousData` means switching Today → Month keeps the old
 * cards on screen (with an "updating" spinner) instead of flashing skeletons.
 * The QueryClient lives in the root layout and survives in-app navigation, so
 * the second visit to /dashboard shows cached rows instantly.
 */
export function useCounselorDashboard(
  range: CounselorDashboardRange = COUNSELOR_DASHBOARD_DEFAULT_RANGE
) {
  return useQuery({
    queryKey: counselorDashboardKey(range),
    queryFn: () => fetchCounselorDashboard(range),
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
      queryKey: counselorDashboardKey(COUNSELOR_DASHBOARD_DEFAULT_RANGE),
      queryFn: () => fetchCounselorDashboard(COUNSELOR_DASHBOARD_DEFAULT_RANGE),
      staleTime: COUNSELOR_DASHBOARD_STALE_MS,
    });
}
