import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DAY_MS,
  addDays,
  bucketTimestamps,
  dayKey,
  dayLabel,
  orderedCounts,
  pctChange,
  resolveRange,
  startOfTodayUTC,
  type DashboardBucket,
  type DashboardPeriod,
  type ResolvedRange,
} from "@/lib/dashboard-range";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

/** Lifecycle order used by the session-status chart legend. */
const APPT_STATUS_ORDER = [
  "pending",
  "assigned",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "rejected",
] as const;

const APPT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const MODE_ORDER = ["online", "in_person"] as const;
const MODE_LABEL: Record<string, string> = { online: "Online", in_person: "In person" };

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** A session row trimmed to the fields the dashboard aggregates. */
type SessionStatRow = { scheduled_at: string; status: string; mode: string };
type ReferralStatRow = { created_at: string; status: string; priority: string };

export type CounselorDashboardPayload = {
  range: {
    period: DashboardPeriod;
    from: string;
    to: string;
    label: string;
    bucket: DashboardBucket;
  };
  comparison: { from: string; to: string };
  stats: {
    filtered: {
      total: number;
      completed: number;
      confirmed: number;
      noShow: number;
      cancelled: number;
      trends: {
        total: number | null;
        completed: number | null;
        confirmed: number | null;
        noShow: number | null;
      };
    };
    referrals: {
      total: number;
      resolved: number;
      escalated: number;
      trends: { total: number | null; resolved: number | null };
    };
    snapshot: {
      sessionsToday: number | null;
      awaitingConfirmation: number | null;
      openReferrals: number | null;
      openChats: number | null;
    };
  };
  sessionTrend: { key: string; label: string; count: number }[];
  referralTrend: { key: string; label: string; count: number }[];
  byStatus: { key: string; name: string; value: number }[];
  byMode: { key: string; name: string; value: number }[];
  byReferralPriority: { key: string; name: string; value: number }[];
  weekChart: { key: string; day: string; sessions: number }[];
  /** Compatibility surface for callers that still read the flat KPIs. */
  kpis: {
    sessionsToday: number | null;
    awaitingConfirmation: number | null;
    openReferrals: number | null;
    openChats: number | null;
  };
  today: { id: string; scheduledAt: string; status: string; concern: string; studentAlias: string }[];
  actionQueue: { id: string; scheduledAt: string; status: string; concern: string; studentAlias: string }[];
  actionReferrals: {
    id: string;
    reason: string;
    status: string;
    priority: string;
    studentAlias: string;
    createdAt: string;
  }[];
  myReferrals: {
    id: string;
    reason: string;
    status: string;
    priority: string;
    studentAlias: string;
    createdAt: string;
  }[];
  unlinked?: boolean;
  fetchedAt: string;
};

function emptyPayload(range: ResolvedRange, unlinked = false): CounselorDashboardPayload {
  return {
    range: {
      period: range.period,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      bucket: range.bucket,
    },
    comparison: { from: range.prevFrom.toISOString(), to: range.prevTo.toISOString() },
    stats: {
      filtered: {
        total: 0,
        completed: 0,
        confirmed: 0,
        noShow: 0,
        cancelled: 0,
        trends: { total: null, completed: null, confirmed: null, noShow: null },
      },
      referrals: {
        total: 0,
        resolved: 0,
        escalated: 0,
        trends: { total: null, resolved: null },
      },
      snapshot: {
        sessionsToday: unlinked ? null : 0,
        awaitingConfirmation: unlinked ? null : 0,
        openReferrals: unlinked ? null : 0,
        openChats: unlinked ? null : 0,
      },
    },
    sessionTrend: [],
    referralTrend: [],
    byStatus: [],
    byMode: [],
    byReferralPriority: [],
    weekChart: [],
    kpis: {
      sessionsToday: unlinked ? null : 0,
      awaitingConfirmation: unlinked ? null : 0,
      openReferrals: unlinked ? null : 0,
      openChats: unlinked ? null : 0,
    },
    today: [],
    actionQueue: [],
    actionReferrals: [],
    myReferrals: [],
    ...(unlinked ? { unlinked: true } : {}),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/dashboard/counselor — one round-trip for the counselor dashboard.
 *
 * Everything is scoped to the caller's counselor row (RLS enforces it too),
 * so a counselor only ever sees their own queue, sessions, and referrals.
 * Query: ?period=today|week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD —
 * the same contract as the guidance-head dashboard, so both views share the
 * period filter and chart shapes.
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
  if (role !== "counselor") {
    return NextResponse.json({ error: "Counselor only." }, { status: 403 });
  }

  const range = resolveRange(new URL(request.url));
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const prevFromIso = range.prevFrom.toISOString();
  const prevToIso = range.prevTo.toISOString();

  const { data: crow } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
  const counselorId = (crow as { id: string } | null)?.id ?? null;
  if (!counselorId) {
    return NextResponse.json(emptyPayload(range, true), {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  }

  const today = startOfTodayUTC();
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -6);
  const nowIso = new Date().toISOString();

  const [
    todayRes,
    confirmRes,
    referralsRes,
    chatsRes,
    todayRows,
    actionRows,
    refRows,
    confirmRefsRes,
    actionRefRows,
    currentAppts,
    previousAppts,
    currentRefs,
    previousRefs,
    weekRows,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "estimated", head: true })
      .eq("counselor_id", counselorId)
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString())
      .in("status", ["assigned", "confirmed"]),
    supabase
      .from("appointments")
      .select("id", { count: "estimated", head: true })
      .eq("counselor_id", counselorId)
      .eq("status", "assigned"),
    supabase
      .from("referrals")
      .select("id", { count: "estimated", head: true })
      .eq("assigned_counselor_id", counselorId)
      .in("status", [...OPEN_REFERRALS]),
    supabase
      .from("chat_threads")
      .select("id", { count: "estimated", head: true })
      .eq("counselor_id", counselorId)
      .eq("status", "open"),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, concern, student_id")
      .eq("counselor_id", counselorId)
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, concern, student_id")
      .eq("counselor_id", counselorId)
      .eq("status", "assigned")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("referrals")
      .select("id, reason, priority, status, student_id, created_at")
      .eq("assigned_counselor_id", counselorId)
      .in("status", [...OPEN_REFERRALS])
      .order("created_at", { ascending: false })
      .limit(5),
    // Assigned-only referrals needing confirmation (dashboard action queue).
    // P8: estimated count — exact KPI scans are the dashboard's hidden tax.
    supabase
      .from("referrals")
      .select("id", { count: "estimated", head: true })
      .eq("assigned_counselor_id", counselorId)
      .eq("status", "assigned"),
    supabase
      .from("referrals")
      .select("id, reason, priority, status, student_id, created_at")
      .eq("assigned_counselor_id", counselorId)
      .eq("status", "assigned")
      .order("created_at", { ascending: false })
      .limit(5),
    // Chart aggregates: the caller's own sessions/referrals in the selected
    // window (and the equal-length previous one for trend chips). The
    // office-wide head RPCs are intentionally not used here.
    supabase
      .from("appointments")
      .select("scheduled_at, status, mode")
      .eq("counselor_id", counselorId)
      .gte("scheduled_at", fromIso)
      .lt("scheduled_at", toIso)
      .limit(2000),
    supabase
      .from("appointments")
      .select("scheduled_at, status, mode")
      .eq("counselor_id", counselorId)
      .gte("scheduled_at", prevFromIso)
      .lt("scheduled_at", prevToIso)
      .limit(2000),
    supabase
      .from("referrals")
      .select("created_at, status, priority")
      .eq("assigned_counselor_id", counselorId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .limit(2000),
    supabase
      .from("referrals")
      .select("created_at, status, priority")
      .eq("assigned_counselor_id", counselorId)
      .gte("created_at", prevFromIso)
      .lt("created_at", prevToIso)
      .limit(2000),
    // Rolling current week bars (fixed, independent of the period filter).
    supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("counselor_id", counselorId)
      .gte("scheduled_at", weekAgo.toISOString())
      .lt("scheduled_at", tomorrow.toISOString())
      .limit(2000),
  ]);

  type SessionRow = { id: string; scheduled_at: string; status: string; concern: string; student_id: string };
  const sessionRows = [...((todayRows.data ?? []) as SessionRow[]), ...((actionRows.data ?? []) as SessionRow[])];
  const refList = [
    ...((refRows.data ?? []) as { student_id: string }[]).map((r) => r.student_id),
    ...((actionRefRows.data ?? []) as { student_id: string }[]).map((r) => r.student_id),
  ];
  const aliasIds = [...new Set([...sessionRows.map((r) => r.student_id), ...refList].filter((id): id is string => !!id))];
  let aliasById = new Map<string, string>();
  if (aliasIds.length) {
    const { data } = await supabase.rpc("get_student_aliases", { ids: aliasIds });
    aliasById = new Map(
      ((data ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [
        s.id,
        s.anonymous_alias ?? "Student",
      ])
    );
  }

  const current = (currentAppts.data ?? []) as SessionStatRow[];
  const previous = (previousAppts.data ?? []) as SessionStatRow[];
  const currentReferralRows = (currentRefs.data ?? []) as ReferralStatRow[];
  const previousReferralRows = (previousRefs.data ?? []) as ReferralStatRow[];

  const countStatus = (rows: SessionStatRow[], status: string) => rows.filter((r) => r.status === status).length;
  const countRefStatus = (rows: ReferralStatRow[], status: string) =>
    rows.filter((r) => r.status === status).length;

  const totalSessions = current.length;
  const completed = countStatus(current, "completed");
  const confirmed = countStatus(current, "confirmed");
  const noShow = countStatus(current, "no_show");
  const cancelled = countStatus(current, "cancelled");

  const prevTotal = previous.length;
  const prevCompleted = countStatus(previous, "completed");
  const prevConfirmed = countStatus(previous, "confirmed");
  const prevNoShow = countStatus(previous, "no_show");

  const totalRefs = currentReferralRows.length;
  const resolvedRefs = countRefStatus(currentReferralRows, "resolved");
  const escalatedRefs = countRefStatus(currentReferralRows, "escalated");
  const prevTotalRefs = previousReferralRows.length;
  const prevResolvedRefs = countRefStatus(previousReferralRows, "resolved");

  const sessionsToday = todayRes.error ? null : (todayRes.count ?? 0);
  const awaitingAppts = confirmRes.error ? 0 : (confirmRes.count ?? 0);
  const awaitingRefs = confirmRefsRes.error ? 0 : (confirmRefsRes.count ?? 0);
  const awaitingConfirmation =
    confirmRes.error && confirmRefsRes.error ? null : awaitingAppts + awaitingRefs;
  const openReferrals = referralsRes.error ? null : (referralsRes.count ?? 0);
  const openChats = chatsRes.error ? null : (chatsRes.count ?? 0);

  // Rolling-week bars: one entry per UTC day, zero-filled.
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * DAY_MS);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of (weekRows.data ?? []) as { scheduled_at: string }[]) {
    if (!row?.scheduled_at) continue;
    const b = byKey.get(dayKey(new Date(row.scheduled_at)));
    if (b) b.sessions += 1;
  }

  const payload: CounselorDashboardPayload = {
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
        total: totalSessions,
        completed,
        confirmed,
        noShow,
        cancelled,
        trends: {
          total: pctChange(totalSessions, prevTotal),
          completed: pctChange(completed, prevCompleted),
          confirmed: pctChange(confirmed, prevConfirmed),
          noShow: pctChange(noShow, prevNoShow),
        },
      },
      referrals: {
        total: totalRefs,
        resolved: resolvedRefs,
        escalated: escalatedRefs,
        trends: {
          total: pctChange(totalRefs, prevTotalRefs),
          resolved: pctChange(resolvedRefs, prevResolvedRefs),
        },
      },
      snapshot: {
        sessionsToday,
        awaitingConfirmation,
        openReferrals,
        openChats,
      },
    },
    sessionTrend: bucketTimestamps(current.map((r) => r.scheduled_at), range),
    referralTrend: bucketTimestamps(currentReferralRows.map((r) => r.created_at), range),
    byStatus: orderedCounts(current.map((r) => r.status), APPT_STATUS_ORDER, (k) => APPT_STATUS_LABEL[k] ?? k),
    byMode: orderedCounts(current.map((r) => r.mode), MODE_ORDER, (k) => MODE_LABEL[k] ?? k),
    byReferralPriority: orderedCounts(
      currentReferralRows.map((r) => r.priority),
      PRIORITY_ORDER,
      (k) => PRIORITY_LABEL[k] ?? k
    ),
    weekChart: weekRows.error ? [] : buckets,
    kpis: {
      sessionsToday,
      awaitingConfirmation,
      openReferrals,
      openChats,
    },
    today: ((todayRows.data ?? []) as SessionRow[]).map((a) => ({
      id: a.id,
      scheduledAt: a.scheduled_at,
      status: a.status,
      concern: a.concern,
      studentAlias: aliasById.get(a.student_id) ?? "Student",
    })),
    actionQueue: ((actionRows.data ?? []) as SessionRow[]).map((a) => ({
      id: a.id,
      scheduledAt: a.scheduled_at,
      status: a.status,
      concern: a.concern,
      studentAlias: aliasById.get(a.student_id) ?? "Student",
    })),
    actionReferrals: (
      (actionRefRows.data ?? []) as {
        id: string;
        reason: string;
        priority: string;
        status: string;
        student_id: string;
        created_at: string;
      }[]
    ).map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      priority: r.priority,
      studentAlias: aliasById.get(r.student_id) ?? "Student",
      createdAt: r.created_at,
    })),
    myReferrals: (
      (refRows.data ?? []) as {
        id: string;
        reason: string;
        priority: string;
        status: string;
        student_id: string;
        created_at: string;
      }[]
    ).map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      priority: r.priority,
      studentAlias: aliasById.get(r.student_id) ?? "Student",
      createdAt: r.created_at,
    })),
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
