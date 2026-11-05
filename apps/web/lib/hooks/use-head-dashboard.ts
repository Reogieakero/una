"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HeadDashboardPayload, HeadPeriod } from "@/app/api/dashboard/head/route";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type { HeadDashboardPayload, HeadPeriod };

export type HeadDashboardRange = {
  period: HeadPeriod;
  /** YYYY-MM-DD, only used when period === "custom". */
  from?: string;
  to?: string;
};

export const HEAD_DASHBOARD_KEY = ["dashboard", "head"] as const;

/** Fresh window — inside it, going back to /dashboard renders zero-fetch. */
export const HEAD_DASHBOARD_STALE_MS = 60_000;

/** Default view when no range is supplied (also used by sidebar prefetch). */
export const HEAD_DASHBOARD_DEFAULT_RANGE: HeadDashboardRange = { period: "week" };

export function headDashboardKey(range: HeadDashboardRange = HEAD_DASHBOARD_DEFAULT_RANGE) {
  return [...HEAD_DASHBOARD_KEY, range.period, range.from ?? "", range.to ?? ""] as const;
}

export async function fetchHeadDashboard(
  range: HeadDashboardRange = HEAD_DASHBOARD_DEFAULT_RANGE
): Promise<HeadDashboardPayload> {
  const params = new URLSearchParams({ period: range.period });
  if (range.period === "custom") {
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
  }
  const res = await fetchWithTimeout(`/api/dashboard/head?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load the dashboard right now.");
  }
  return (await res.json()) as HeadDashboardPayload;
}

/**
 * Cached admin dashboard query — stale-while-revalidate, one cache entry per
 * period. `keepPreviousData` means switching Today → Month keeps the old cards
 * on screen (with an "updating" spinner) instead of flashing skeletons.
 */
export function useHeadDashboard(range: HeadDashboardRange = HEAD_DASHBOARD_DEFAULT_RANGE) {
  return useQuery({
    queryKey: headDashboardKey(range),
    queryFn: () => fetchHeadDashboard(range),
    staleTime: HEAD_DASHBOARD_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/** Warm the cache (e.g. hovering the Dashboard nav link) for instant open. */
export function usePrefetchHeadDashboard(enabled = true) {
  const qc = useQueryClient();
  return () =>
    enabled &&
    qc.prefetchQuery({
      queryKey: headDashboardKey(HEAD_DASHBOARD_DEFAULT_RANGE),
      queryFn: () => fetchHeadDashboard(HEAD_DASHBOARD_DEFAULT_RANGE),
      staleTime: HEAD_DASHBOARD_STALE_MS,
    });
}
