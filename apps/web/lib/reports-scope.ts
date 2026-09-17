/**
 * Shared scope model for /reports — section picker + time-range filter.
 * URL-driven (?section=sessions&range=30d or ?from=2026-08-01&to=2026-08-31)
 * so filtered reports stream server-side, stay bookmarkable, and print/export
 * see the same scope the user sees.
 */

/* ── Sections ── */

export type ReportSection = "all" | "sessions" | "referrals" | "satisfaction" | "wellbeing" | "operations";

export const REPORT_SECTIONS: { key: ReportSection; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sessions", label: "Sessions" },
  { key: "referrals", label: "Referrals" },
  { key: "satisfaction", label: "Satisfaction" },
  { key: "wellbeing", label: "Wellbeing" },
  { key: "operations", label: "Operations" },
];

const SECTION_KEYS = new Set<string>(REPORT_SECTIONS.map((s) => s.key));

function firstParam(v: unknown): string | undefined {
  return Array.isArray(v) ? (typeof v[0] === "string" ? v[0] : undefined) : typeof v === "string" ? v : undefined;
}

export function parseReportSection(v: unknown): ReportSection {
  const s = firstParam(v);
  return s && SECTION_KEYS.has(s) ? (s as ReportSection) : "sessions";
}

/* ── Time range ── */

export type RangePreset = "7d" | "30d" | "90d" | "all";

export type ReportRange = {
  /** Preset key, or "custom" when from/to dates were picked. */
  preset: RangePreset | "custom";
  /** Inclusive UTC lower bound (ISO), or null for open start. */
  from: string | null;
  /** Inclusive UTC upper bound (ISO), or null for open end. */
  to: string | null;
  /** Human label — "All time", "Last 30 days", "Mar 1 – Mar 31, 2026". */
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_DAYS = 370;

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fmtDayShort(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtDayFull(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function customLabel(fromDay: number, toDay: number): string {
  const a = new Date(fromDay);
  const b = new Date(toDay);
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${fmtDayShort(fromDay)} – ${fmtDayFull(toDay)}`;
  }
  return `${fmtDayFull(fromDay)} – ${fmtDayFull(toDay)}`;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(v: string | undefined): number | null {
  if (!v) return null;
  const m = DAY_RE.exec(v.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Round-trip guard so 2026-02-30 doesn't silently become March.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return null;
  }
  return ms;
}

export function parseReportRange(params: { range?: unknown; from?: unknown; to?: unknown }): ReportRange {
  const fromDay = parseDay(firstParam(params.from));
  const toDay = parseDay(firstParam(params.to));
  if (fromDay !== null && toDay !== null && fromDay <= toDay && toDay - fromDay <= MAX_CUSTOM_DAYS * DAY_MS) {
    return {
      preset: "custom",
      from: new Date(fromDay).toISOString(),
      to: new Date(toDay + DAY_MS - 1).toISOString(),
      label: customLabel(fromDay, toDay),
    };
  }
  const preset = firstParam(params.range);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : null;
  if (days !== null) {
    const now = new Date();
    const toStart = startOfDayUTC(now);
    const fromStart = toStart - (days - 1) * DAY_MS;
    return {
      preset: preset as RangePreset,
      from: new Date(fromStart).toISOString(),
      to: new Date(toStart + DAY_MS - 1).toISOString(),
      label: `Last ${days} days`,
    };
  }
  return { preset: "all", from: null, to: null, label: "All time" };
}

/** YYYY-MM-DD (UTC) for native date inputs, derived from a range bound. */
export function rangeDay(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Client-safe check for a custom YYYY-MM-DD window (ordered, ≤370 days). */
export function isCustomRangeValid(from: string, to: string): boolean {
  if (!from || !to || to < from) return false;
  const f = from.split("-").map(Number);
  const t = to.split("-").map(Number);
  if (f.length !== 3 || t.length !== 3 || f.some(Number.isNaN) || t.some(Number.isNaN)) return false;
  const span = Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / DAY_MS);
  return span >= 0 && span <= MAX_CUSTOM_DAYS;
}

/** YYYY-MM-DD → "Mar 1, 2026" (UTC, no timezone shift) for compact summaries. */
export function fmtDayCompact(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ── Query helper ── */

/**
 * Narrows a Supabase filter builder to the range on the given date column.
 * Appointments scope by `scheduled_at` (when the session happens);
 * referrals, feedback, and screenings scope by `created_at` (when filed).
 */
type Rangeable = {
  gte: (column: string, value: string) => Rangeable;
  lte: (column: string, value: string) => Rangeable;
};

export function withRange<T>(query: T, column: string, range: ReportRange): T {
  let out = query as unknown as Rangeable;
  if (range.from) out = out.gte(column, range.from);
  if (range.to) out = out.lte(column, range.to);
  return out as unknown as T;
}

/* ── Trend buckets ── */

export type TrendBucket = { label: string; sessions: number };

/**
 * Daily buckets (≤45 days) or weekly buckets above that, spanning the range
 * inclusively. `place()` drops an ISO timestamp into its bucket; out-of-range
 * rows are ignored.
 */
export function buildTrendBuckets(fromISO: string, toISO: string): { buckets: TrendBucket[]; place: (iso: string) => void } {
  const fromDay = startOfDayUTC(new Date(fromISO));
  const toDay = startOfDayUTC(new Date(toISO));
  const spanDays = Math.max(1, Math.round((toDay - fromDay) / DAY_MS) + 1);
  const sizeDays = spanDays > 45 ? 7 : 1;
  const n = Math.max(1, Math.ceil(spanDays / sizeDays));
  const buckets: TrendBucket[] = Array.from({ length: n }, (_, i) => ({
    label: fmtDayShort(fromDay + i * sizeDays * DAY_MS),
    sessions: 0,
  }));
  const place = (iso: string) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    const i = Math.floor((startOfDayUTC(new Date(t)) - fromDay) / (sizeDays * DAY_MS));
    if (i >= 0 && i < n) buckets[i].sessions += 1;
  };
  return { buckets, place };
}
