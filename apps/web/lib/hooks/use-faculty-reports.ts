"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { FacultyReportsPayload } from "@/app/api/reports/faculty/route";
import type { ReportSection } from "@/lib/reports-scope";

export type { FacultyReportsPayload };

export const FACULTY_REPORTS_KEY = ["reports", "faculty"] as const;

/** Fresh window — inside it, going back re-renders zero-fetch. */
export const FACULTY_REPORTS_STALE_MS = 60_000;

export type FacultyReportsScope = {
  section: ReportSection;
  /** Preset key the filters picked ("7d" | "30d" | "90d" | "all" | "custom"). */
  preset: string;
  /** YYYY-MM-DD bounds ("" when open). Sliced from the canonical range. */
  fromDay: string;
  toDay: string;
};

export async function fetchFacultyReports(scope: FacultyReportsScope): Promise<FacultyReportsPayload> {
  const p = new URLSearchParams();
  p.set("section", scope.section);
  if (scope.preset !== "all" && scope.preset !== "custom") p.set("range", scope.preset);
  if (scope.fromDay) p.set("from", scope.fromDay);
  if (scope.toDay) p.set("to", scope.toDay);
  const res = await fetch(`/api/reports/faculty?${p.toString()}`, { credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load the reports right now.");
  }
  return (await res.json()) as FacultyReportsPayload;
}

/**
 * Cached faculty reports query — stale-while-revalidate, keyed by filter.
 * The QueryClient lives in the root layout and survives in-app navigation,
 * so going back to /reports (or re-picking a recently used filter) shows
 * cached aggregates instantly while a background refetch (only if stale)
 * refreshes them without blocking.
 */
export function useFacultyReports(scope: FacultyReportsScope) {
  return useQuery({
    queryKey: [...FACULTY_REPORTS_KEY, scope.section, scope.preset, scope.fromDay, scope.toDay],
    queryFn: () => fetchFacultyReports(scope),
    staleTime: FACULTY_REPORTS_STALE_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
