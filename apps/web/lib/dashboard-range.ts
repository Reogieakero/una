/**
 * Shared date-range math for the staff dashboards.
 *
 * The guidance-head route introduced this contract: `?period=today|week|
 * month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`, an inclusive-start /
 * exclusive-end UTC window, and an equal-length previous window for trend
 * chips. The counselor dashboard mirrors the same filter, so the rules live
 * here instead of being copy-pasted into a second route.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardPeriod = "today" | "week" | "month" | "custom";
export type DashboardBucket = "day" | "week" | "month";

export type ResolvedRange = {
  period: DashboardPeriod;
  from: Date;
  to: Date; // exclusive
  prevFrom: Date;
  prevTo: Date; // exclusive
  bucket: DashboardBucket;
  label: string;
};

export function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Percentage change, or null when there is no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Resolve ?period / ?from / ?to into an inclusive-start, exclusive-end UTC
 * window plus the equal-length comparison window used for trend chips.
 * Invalid custom input falls back to the 7-day view instead of erroring.
 */
export function resolveRange(url: URL): ResolvedRange {
  const today = startOfTodayUTC();
  const tomorrow = addDays(today, 1);
  const requested = url.searchParams.get("period");
  let period: DashboardPeriod =
    requested === "today" || requested === "week" || requested === "month" || requested === "custom"
      ? requested
      : "week";

  let from: Date;
  let to: Date;

  if (period === "today") {
    from = today;
    to = tomorrow;
  } else if (period === "month") {
    from = addDays(today, -29);
    to = tomorrow;
  } else if (period === "custom") {
    const rawFrom = url.searchParams.get("from");
    const rawTo = url.searchParams.get("to");
    const parsedFrom = rawFrom ? new Date(rawFrom) : null;
    const parsedTo = rawTo ? new Date(rawTo) : null;
    const valid =
      parsedFrom && parsedTo && !Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime());

    if (!valid) {
      period = "week";
      from = addDays(today, -6);
      to = tomorrow;
    } else {
      from = new Date(Date.UTC(parsedFrom.getUTCFullYear(), parsedFrom.getUTCMonth(), parsedFrom.getUTCDate()));
      to = addDays(new Date(Date.UTC(parsedTo.getUTCFullYear(), parsedTo.getUTCMonth(), parsedTo.getUTCDate())), 1);
      if (to <= from) to = addDays(from, 1);
      // Cap absurd ranges so the trend chart and queries stay bounded.
      if (to.getTime() - from.getTime() > 366 * DAY_MS) from = addDays(to, -366);
    }
  } else {
    from = addDays(today, -6);
    to = tomorrow;
  }

  const span = to.getTime() - from.getTime();
  const spanDays = Math.round(span / DAY_MS);
  const bucket: DashboardBucket = spanDays <= 8 ? "day" : spanDays <= 120 ? "week" : "month";
  const label =
    period === "today"
      ? "Today"
      : period === "week"
        ? "Last 7 days"
        : period === "month"
          ? "Last 30 days"
          : `${dayLabel(from)} – ${dayLabel(addDays(to, -1))}`;

  return {
    period,
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    bucket,
    label,
  };
}

type Bucket = { start: number; end: number; key: string; label: string; count: number };

function buildBuckets(range: ResolvedRange): Bucket[] {
  const buckets: Bucket[] = [];

  if (range.bucket === "day") {
    for (let d = new Date(range.from); d < range.to; d = addDays(d, 1)) {
      buckets.push({
        start: d.getTime(),
        end: addDays(d, 1).getTime(),
        key: isoDay(d),
        label: dayLabel(d),
        count: 0,
      });
    }
  } else if (range.bucket === "week") {
    for (let d = new Date(range.from); d < range.to; d = addDays(d, 7)) {
      buckets.push({
        start: d.getTime(),
        end: Math.min(addDays(d, 7).getTime(), range.to.getTime()),
        key: isoDay(d),
        label: dayLabel(d),
        count: 0,
      });
    }
  } else {
    let d = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
    while (d < range.to) {
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const start = Math.max(d.getTime(), range.from.getTime());
      const end = Math.min(next.getTime(), range.to.getTime());
      buckets.push({
        start,
        end,
        key: isoDay(new Date(start)),
        label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        count: 0,
      });
      d = next;
    }
  }

  return buckets;
}

/**
 * Bucket timestamp strings (scheduled_at / created_at) into the chart's
 * resolved interval. A small linear scan per bucket is plenty for the row
 * counts a single dashboard window returns.
 */
export function bucketTimestamps(
  timestamps: (string | null | undefined)[],
  range: ResolvedRange
): { key: string; label: string; count: number }[] {
  const buckets = buildBuckets(range);
  for (const raw of timestamps) {
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    const bucket = buckets.find((b) => t >= b.start && t < b.end);
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ key, label, count }) => ({ key, label, count }));
}

/** Counts grouped by an arbitrary key, ordered by a fixed lifecycle list. */
export function orderedCounts<K extends string>(
  keys: K[],
  order: readonly string[],
  labelOf: (key: string) => string
): { key: string; name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rank = new Map(order.map((key, i) => [key, i]));
  return [...counts.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => (rank.get(a[0]) ?? 99) - (rank.get(b[0]) ?? 99))
    .map(([key, value]) => ({ key, name: labelOf(key), value }));
}
