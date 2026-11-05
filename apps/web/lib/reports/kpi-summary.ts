import type { ReportRange } from "@/lib/reports-scope";

/**
 * Shared KPI aggregation for /reports.
 *
 * Overview cards show a delta against the preceding equal-length window, so
 * each report route sends a `comparison` summary computed from the same
 * scoping rules as the main payload. Pure helpers here so the API routes and
 * the client views share one definition of "open", "missed", and "average".
 */

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

export type ReportKpiRows = {
  appointments: { status: string }[];
  referrals: { status: string; priority?: string }[];
  feedback: { rating: number }[];
  screenings: { band: string }[];
};

export type ReportKpiSummary = {
  sessions: number;
  completed: number;
  missed: number;
  referrals: number;
  openReferrals: number;
  resolvedReferrals: number;
  urgentReferrals: number;
  feedback: number;
  avgRating: number | null;
  screenings: number;
  highStress: number;
};

export function summarizeKpi(rows: ReportKpiRows): ReportKpiSummary {
  const completed = rows.appointments.filter((a) => a.status === "completed").length;
  const missed = rows.appointments.filter((a) =>
    ["cancelled", "rejected", "no_show"].includes(a.status)
  ).length;
  const ratings = rows.feedback.map((f) => f.rating);
  const resolvedReferrals = rows.referrals.filter((r) => r.status === "resolved").length;
  const openReferrals = rows.referrals.filter((r) =>
    (OPEN_REFERRALS as readonly string[]).includes(r.status)
  ).length;
  const urgentReferrals = rows.referrals.filter((r) => r.priority === "urgent").length;

  return {
    sessions: rows.appointments.length,
    completed,
    missed,
    referrals: rows.referrals.length,
    openReferrals,
    resolvedReferrals,
    urgentReferrals,
    feedback: ratings.length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    screenings: rows.screenings.length,
    highStress: rows.screenings.filter((s) => s.band === "high").length,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The equal-length window immediately before `range`, or null when the range
 * is open ("All time") — there is nothing meaningful to compare against.
 */
export function previousRange(range: ReportRange): ReportRange | null {
  if (!range.from || !range.to) return null;
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;

  const span = to - from + 1;
  const prevTo = from - 1;
  const prevFrom = prevTo - span + 1;
  return {
    preset: "custom",
    from: new Date(prevFrom).toISOString(),
    to: new Date(prevTo).toISOString(),
    label: "Previous period",
  };
}

/** Whole-day count covered by a range (null when unbounded). */
export function rangeDays(range: ReportRange): number | null {
  if (!range.from || !range.to) return null;
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(1, Math.round((to - from + 1) / DAY_MS));
}

/** Relative change in percent; null when there is no baseline to compare to. */
export function kpiChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Percentage-point change, for rates (completion, resolution, coverage). */
export function kpiPointChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** Rate as a percentage, or null when the denominator is empty. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}
