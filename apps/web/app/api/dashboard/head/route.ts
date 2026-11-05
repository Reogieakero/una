import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;
const ACTIVE_APPOINTMENTS = ["pending", "assigned", "confirmed"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#F59E0B" },
  assigned: { label: "Assigned", color: "#6366F1" },
  acknowledged: { label: "Acknowledged", color: "#3B82F6" },
  in_progress: { label: "In progress", color: "#2563EB" },
  confirmed: { label: "Confirmed", color: "#3B82F6" },
  resolved: { label: "Resolved", color: "#22C55E" },
  escalated: { label: "Escalated", color: "#EF4444" },
  rejected: { label: "Rejected", color: "#EF4444" },
};

/** Lifecycle order used by the status chart legend. */
const STATUS_ORDER = [
  "pending",
  "assigned",
  "acknowledged",
  "in_progress",
  "confirmed",
  "escalated",
  "resolved",
  "rejected",
] as const;

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

const CLASSIFICATION_ORDER = [
  "Behavioral",
  "Relational",
  "Financial",
  "Absenteeism",
  "Social Adjustment",
  "Academic-related",
  "Health",
  "Others",
] as const;

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type HeadPeriod = "today" | "week" | "month" | "custom";
export type HeadBucket = "day" | "week" | "month";

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ResolvedRange = {
  period: HeadPeriod;
  from: Date;
  to: Date; // exclusive
  prevFrom: Date;
  prevTo: Date; // exclusive
  bucket: HeadBucket;
  label: string;
};

/**
 * Resolve ?period / ?from / ?to into an inclusive-start, exclusive-end UTC
 * window plus the equal-length comparison window used for trend chips.
 * Invalid custom input falls back to the 7-day view instead of erroring.
 */
function resolveRange(url: URL): ResolvedRange {
  const today = startOfTodayUTC();
  const tomorrow = addDays(today, 1);
  const requested = url.searchParams.get("period");
  let period: HeadPeriod =
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
      parsedFrom &&
      parsedTo &&
      !Number.isNaN(parsedFrom.getTime()) &&
      !Number.isNaN(parsedTo.getTime());

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
  const bucket: HeadBucket = spanDays <= 8 ? "day" : spanDays <= 120 ? "week" : "month";
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

type ReferralFeedRow = {
  id: string;
  reason: string;
  priority: string;
  status: string;
  student_id: string | null;
  referring_faculty_id: string | null;
  created_at: string;
};

type AppointmentFeedRow = {
  id: string;
  scheduled_at: string;
  created_at: string;
  status: string;
  concern: string;
  student_id: string | null;
  is_anonymous: boolean;
};

type BreakdownRow = { dimension: string; key: string; count: number | string };
type StatusCountRow = { status: string; count: number | string };
type DailyCountRow = { day: string; referrals: number | string };
type SessionCountRow = { day: string; sessions: number | string };

function toCountMap(rows: StatusCountRow[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row?.status) continue;
    map.set(row.status, Number(row.count ?? 0));
  }
  return map;
}

function sum(map: Map<string, number>, keys: readonly string[]): number {
  return keys.reduce((total, key) => total + (map.get(key) ?? 0), 0);
}

function total(map: Map<string, number>): number {
  let n = 0;
  for (const value of map.values()) n += value;
  return n;
}

/** Percentage change, or null when there is no baseline to compare against. */
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Bucket daily referral counts into the chart's resolved interval. The RPC
 * returns ≤366 rows, so a small linear scan per bucket is cheaper than any
 * cleverer mapping and keeps this dependency-free.
 */
function bucketTrend(
  rows: DailyCountRow[] | null | undefined,
  range: ResolvedRange
): { key: string; label: string; count: number }[] {
  const points = (rows ?? [])
    .map((row) => {
      if (!row?.day) return null;
      const t = new Date(`${row.day}T00:00:00Z`).getTime();
      if (Number.isNaN(t)) return null;
      return { t, n: Number(row.referrals ?? 0) };
    })
    .filter((p): p is { t: number; n: number } => p !== null);

  type Bucket = { start: number; end: number; key: string; label: string; count: number };
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
      const end = Math.min(addDays(d, 7).getTime(), range.to.getTime());
      buckets.push({
        start: d.getTime(),
        end,
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

  for (const point of points) {
    const bucket = buckets.find((b) => point.t >= b.start && point.t < b.end);
    if (bucket) bucket.count += point.n;
  }

  return buckets.map(({ key, label, count }) => ({ key, label, count }));
}

function orderedBreakdown(
  rows: BreakdownRow[] | null | undefined,
  dimension: string,
  order: readonly string[],
  labelOf: (key: string) => string
): { key: string; name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    if (row?.dimension !== dimension || !row.key) continue;
    counts.set(row.key, (counts.get(row.key) ?? 0) + Number(row.count ?? 0));
  }
  const rank = new Map(order.map((key, i) => [key, i]));
  return [...counts.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => (rank.get(a[0]) ?? 99) - (rank.get(b[0]) ?? 99))
    .map(([key, value]) => ({ key, name: labelOf(key), value }));
}

export type HeadDashboardPayload = {
  range: {
    period: HeadPeriod;
    from: string;
    to: string;
    label: string;
    bucket: HeadBucket;
  };
  comparison: { from: string; to: string };
  stats: {
    filtered: {
      total: number;
      pending: number;
      assigned: number;
      confirmed: number;
      resolved: number;
      rejected: number;
      escalated: number;
      trends: {
        total: number | null;
        pending: number | null;
        assigned: number | null;
        resolved: number | null;
      };
    };
    snapshot: {
      totalReferralsAllTime: number | null;
      upcomingSessionsThisWeek: number | null;
      activeStudents: number | null;
      activeCounselors: number | null;
    };
  };
  referralTrend: { key: string; label: string; count: number }[];
  sessionTrend: { key: string; label: string; count: number }[];
  byStatus: { key: string; name: string; value: number }[];
  byUrgency: { key: string; name: string; value: number }[];
  byClassification: { key: string; name: string; value: number }[];
  kpis: { sessionsToday: number | null; referralsWaiting: number | null; openChats: number | null };
  latestBookings: {
    id: string;
    scheduledAt: string;
    createdAt: string;
    status: string;
    concern: string;
    studentAlias: string;
    isAnonymous: boolean;
  }[];
  facultyReferrals: {
    id: string;
    reason: string;
    priority: string;
    status: string;
    studentAlias: string;
    facultyName: string;
    createdAt: string;
  }[];
  unassignedAppointments: {
    id: string;
    scheduledAt: string;
    createdAt: string;
    status: string;
    concern: string;
    studentAlias: string;
  }[];
  announcements: { id: string; title: string; publishedAt: string | null }[];
  weekChart: { key: string; day: string; sessions: number }[];
  fetchedAt: string;
};

/**
 * GET /api/dashboard/head — one round-trip for the guidance-head dashboard.
 *
 * Query: ?period=today|week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 * (defaults to the rolling 7-day view). The client caches each period
 * separately with TanStack Query, so switching back is instant.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string; is_active?: boolean | null } | null)?.role;
  if ((profile as { is_active?: boolean | null } | null)?.is_active === false) {
    return NextResponse.json({ error: "Account deactivated." }, { status: 403 });
  }
  if (role !== "guidance_head") {
    return NextResponse.json({ error: "Guidance head only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = resolveRange(url);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const prevFromIso = range.prevFrom.toISOString();
  const prevToIso = range.prevTo.toISOString();

  const today = startOfTodayUTC();
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -6);
  const nowIso = new Date().toISOString();
  const weekAhead = addDays(today, 7).toISOString();

  // Every independent query fires together — one parallel batch instead of a
  // sequential RSC waterfall. Counts use estimated head-only scans.
  const [
    todayCount,
    referralsCount,
    chatsCount,
    latestBookings,
    facultyReferrals,
    unassignedAppointments,
    announcements,
    weekRows,
    sessionTrendRows,
    currentStatusRows,
    previousStatusRows,
    breakdownRows,
    trendRows,
    allTimeReferrals,
    upcomingSessions,
    activeStudents,
    activeCounselors,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "estimated", head: true })
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString()),
    supabase
      .from("referrals")
      .select("id", { count: "estimated", head: true })
      .in("status", [...OPEN_REFERRALS]),
    // The head's inbox is direct staff messages only (student–counselor
    // threads are participant-private) — this KPI counts its unread DMs.
    supabase
      .from("staff_messages")
      .select("id", { count: "estimated", head: true })
      .eq("recipient_profile_id", user.id)
      .eq("is_read", false),
    supabase
      .from("appointments")
      .select("id, scheduled_at, created_at, status, concern, student_id, is_anonymous")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("referrals")
      .select("id, reason, priority, status, student_id, referring_faculty_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("appointments")
      .select("id, scheduled_at, created_at, status, concern, student_id, is_anonymous")
      .in("status", [...ACTIVE_APPOINTMENTS])
      .is("counselor_id", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("announcements")
      .select("id, title, published_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3),
    // Session bars for the current rolling week (unchanged from before).
    supabase.rpc("head_appointment_daily_counts", {
      from_ts: weekAgo.toISOString(),
      to_ts: tomorrow.toISOString(),
    }),
    // Sessions booked across the selected window — the trend line beside
    // Urgency follows the period filter (weekChart below stays the fixed
    // rolling week).
    supabase.rpc("head_appointment_daily_counts", { from_ts: fromIso, to_ts: toIso }),
    // Referral stats for the selected window + the equal-length previous one.
    supabase.rpc("head_referral_status_counts", { from_ts: fromIso, to_ts: toIso }),
    supabase.rpc("head_referral_status_counts", { from_ts: prevFromIso, to_ts: prevToIso }),
    supabase.rpc("head_referral_breakdowns", { from_ts: fromIso, to_ts: toIso }),
    supabase.rpc("head_referral_daily_counts", { from_ts: fromIso, to_ts: toIso }),
    supabase.from("referrals").select("id", { count: "estimated", head: true }),
    supabase
      .from("appointments")
      .select("id", { count: "estimated", head: true })
      .in("status", [...ACTIVE_APPOINTMENTS])
      .gte("scheduled_at", nowIso)
      .lt("scheduled_at", weekAhead),
    supabase
      .from("profiles")
      .select("id", { count: "estimated", head: true })
      .eq("role", "student")
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id", { count: "estimated", head: true })
      .eq("role", "counselor")
      .eq("is_active", true),
  ]);

  const bookingRows = (latestBookings.data ?? []) as AppointmentFeedRow[];
  const unassignedRows = (unassignedAppointments.data ?? []) as AppointmentFeedRow[];
  const referralRows = (facultyReferrals.data ?? []) as ReferralFeedRow[];

  // Student aliases: one lookup shared by all three feeds.
  const studentIds = [
    ...new Set(
      [...bookingRows, ...unassignedRows, ...referralRows]
        .map((r) => r.student_id)
        .filter((id): id is string => !!id)
    ),
  ];
  let aliasById = new Map<string, string>();
  if (studentIds.length) {
    const { data } = await supabase.rpc("get_student_aliases", { ids: studentIds });
    aliasById = new Map(
      ((data ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [
        s.id,
        s.anonymous_alias ?? "Student",
      ])
    );
  }

  // Faculty names: referrals store the faculty_members row, whose display
  // name lives on the linked profile. Two batched lookups, no N+1.
  const facultyIds = [
    ...new Set(referralRows.map((r) => r.referring_faculty_id).filter((id): id is string => !!id)),
  ];
  let facultyNameById = new Map<string, string>();
  if (facultyIds.length) {
    const { data: facultyRows } = await supabase
      .from("faculty_members")
      .select("id, profile_id")
      .in("id", facultyIds);
    const rows = (facultyRows ?? []) as { id: string; profile_id: string }[];
    const profileIds = [...new Set(rows.map((f) => f.profile_id))];
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
      const nameByProfile = new Map(
        ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
          p.id,
          p.full_name ?? "Faculty",
        ])
      );
      facultyNameById = new Map(rows.map((f) => [f.id, nameByProfile.get(f.profile_id) ?? "Faculty"]));
    }
  }

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * DAY_MS);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of ((weekRows.data ?? []) as { day: string; sessions: number | string }[])) {
    if (!row?.day) continue;
    const b = byKey.get(dayKey(new Date(row.day)));
    if (b) b.sessions += Number(row.sessions ?? 0);
  }

  const currentStatus = toCountMap(currentStatusRows.data as StatusCountRow[] | null);
  const previousStatus = toCountMap(previousStatusRows.data as StatusCountRow[] | null);

  const currentTotal = total(currentStatus);
  const currentPending = currentStatus.get("pending") ?? 0;
  const currentAssigned = sum(currentStatus, ["assigned", "acknowledged", "in_progress"]);
  const currentResolved = currentStatus.get("resolved") ?? 0;

  const previousTotal = total(previousStatus);
  const previousPending = previousStatus.get("pending") ?? 0;
  const previousAssigned = sum(previousStatus, ["assigned", "acknowledged", "in_progress"]);
  const previousResolved = previousStatus.get("resolved") ?? 0;

  const breakdown = (breakdownRows.data ?? []) as BreakdownRow[];
  const byStatus = STATUS_ORDER.filter((key) => (currentStatus.get(key) ?? 0) > 0).map((key) => ({
    key,
    name: STATUS_META[key]?.label ?? key,
    value: currentStatus.get(key) ?? 0,
  }));

  const aliasOf = (r: { student_id: string | null }) =>
    (r.student_id ? aliasById.get(r.student_id) : undefined) ?? "Student";

  const payload: HeadDashboardPayload = {
    range: {
      period: range.period,
      from: fromIso,
      to: toIso,
      label: range.label,
      bucket: range.bucket,
    },
    comparison: { from: prevFromIso, to: prevToIso },
    stats: {
      filtered: {
        total: currentTotal,
        pending: currentPending,
        assigned: currentAssigned,
        confirmed: currentStatus.get("confirmed") ?? 0,
        resolved: currentResolved,
        rejected: currentStatus.get("rejected") ?? 0,
        escalated: currentStatus.get("escalated") ?? 0,
        trends: {
          total: pctChange(currentTotal, previousTotal),
          pending: pctChange(currentPending, previousPending),
          assigned: pctChange(currentAssigned, previousAssigned),
          resolved: pctChange(currentResolved, previousResolved),
        },
      },
      snapshot: {
        totalReferralsAllTime: allTimeReferrals.error ? null : (allTimeReferrals.count ?? 0),
        upcomingSessionsThisWeek: upcomingSessions.error ? null : (upcomingSessions.count ?? 0),
        activeStudents: activeStudents.error ? null : (activeStudents.count ?? 0),
        activeCounselors: activeCounselors.error ? null : (activeCounselors.count ?? 0),
      },
    },
    referralTrend: trendRows.error ? [] : bucketTrend(trendRows.data as DailyCountRow[] | null, range),
    sessionTrend: sessionTrendRows.error
      ? []
      : bucketTrend(
          ((sessionTrendRows.data ?? []) as SessionCountRow[]).map((row) => ({
            day: row.day,
            referrals: row.sessions,
          })),
          range
        ),
    byStatus,
    byUrgency: orderedBreakdown(breakdown, "priority", PRIORITY_ORDER, (k) => PRIORITY_LABEL[k] ?? k),
    byClassification: orderedBreakdown(breakdown, "classification", CLASSIFICATION_ORDER, (k) => k),
    kpis: {
      sessionsToday: todayCount.error ? null : (todayCount.count ?? 0),
      referralsWaiting: referralsCount.error ? null : (referralsCount.count ?? 0),
      openChats: chatsCount.error ? null : (chatsCount.count ?? 0),
    },
    latestBookings: latestBookings.error
      ? []
      : bookingRows.map((a) => ({
          id: a.id,
          scheduledAt: a.scheduled_at,
          createdAt: a.created_at,
          status: a.status,
          concern: a.concern,
          studentAlias: aliasOf(a),
          isAnonymous: a.is_anonymous,
        })),
    facultyReferrals: facultyReferrals.error
      ? []
      : referralRows.map((r) => ({
          id: r.id,
          reason: r.reason,
          priority: r.priority,
          status: r.status,
          studentAlias: aliasOf(r),
          facultyName: (r.referring_faculty_id ? facultyNameById.get(r.referring_faculty_id) : undefined) ?? "Faculty",
          createdAt: r.created_at,
        })),
    unassignedAppointments: unassignedAppointments.error
      ? []
      : unassignedRows.map((a) => ({
          id: a.id,
          scheduledAt: a.scheduled_at,
          createdAt: a.created_at,
          status: a.status,
          concern: a.concern,
          studentAlias: aliasOf(a),
        })),
    announcements: announcements.error
      ? []
      : (((announcements.data ?? []) as { id: string; title: string; published_at: string | null }[]).map((a) => ({
          id: a.id,
          title: a.title,
          publishedAt: a.published_at,
        }))),
    weekChart: weekRows.error ? [] : buckets,
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
