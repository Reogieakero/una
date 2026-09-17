import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

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

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type HeadDashboardPayload = {
  kpis: { sessionsToday: number | null; referralsWaiting: number | null; openChats: number | null };
  referralsWaiting: { id: string; reason: string; priority: string; studentAlias: string; createdAt: string }[];
  upcomingSessions: { id: string; scheduledAt: string; status: string; concern: string }[];
  unassigned: { id: string; reason: string; priority: string; studentAlias: string; createdAt: string }[];
  announcements: { id: string; title: string; publishedAt: string | null }[];
  weekChart: { key: string; day: string; sessions: number }[];
  statusChart: { name: string; value: number; color: string }[];
  fetchedAt: string;
};

/**
 * GET /api/dashboard/head — one round-trip for the guidance-head (admin)
 * dashboard. The client caches it with TanStack Query (60s fresh), so
 * navigating back to /dashboard renders cached data instantly and
 * revalidates in the background instead of blocking on ~10 queries.
 */
export async function GET() {
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

  const today = startOfTodayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Every independent query fires together — one parallel batch instead of
  // the old sequential RSC waterfall.
  const [
    todayCount,
    referralsCount,
    chatsCount,
    referralsRecent,
    upcoming,
    unassigned,
    announcements,
    weekRows,
    statusRows,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", today.toISOString())
      .lt("scheduled_at", tomorrow.toISOString()),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_REFERRALS]),
    // The head's inbox is direct staff messages only (student–counselor
    // threads are participant-private) — this KPI counts its unread DMs.
    supabase
      .from("staff_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", user.id)
      .eq("is_read", false),
    supabase
      .from("referrals")
      .select("id, reason, priority, status, student_id, created_at")
      .in("status", [...OPEN_REFERRALS])
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, concern")
      .gte("scheduled_at", new Date().toISOString())
      .in("status", ["pending", "assigned", "confirmed"])
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("referrals")
      .select("id, reason, priority, student_id, created_at")
      .in("status", [...OPEN_REFERRALS])
      .is("assigned_counselor_id", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("announcements")
      .select("id, title, published_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("appointments")
      .select("scheduled_at")
      .gte("scheduled_at", weekAgo.toISOString())
      .limit(500),
    supabase.from("referrals").select("status").limit(1000),
  ]);

  type ReferralRow = {
    id: string;
    reason: string;
    priority: string;
    student_id: string;
    created_at: string;
  };
  const recentRows = ((referralsRecent.data ?? []) as ReferralRow[]);
  const unassignedRows = (((unassigned as { data: unknown }).data ?? []) as ReferralRow[]);
  const studentIds = [...new Set([...recentRows, ...unassignedRows].map((r) => r.student_id))];
  let aliasById = new Map<string, string>();
  if (studentIds.length) {
    const { data } = await supabase.from("students").select("id, anonymous_alias").in("id", studentIds);
    aliasById = new Map(((data ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"]));
  }

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of ((weekRows.data ?? []) as { scheduled_at: string }[])) {
    const b = byKey.get(dayKey(new Date(row.scheduled_at)));
    if (b) b.sessions += 1;
  }

  const counts = new Map<string, number>();
  for (const row of ((statusRows.data ?? []) as { status: string }[])) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  const statusChart = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_META[k]?.label ?? k, value: v, color: STATUS_META[k]?.color ?? "#94A3B8" }));

  const payload: HeadDashboardPayload = {
    kpis: {
      sessionsToday: todayCount.error ? null : (todayCount.count ?? 0),
      referralsWaiting: referralsCount.error ? null : (referralsCount.count ?? 0),
      openChats: chatsCount.error ? null : (chatsCount.count ?? 0),
    },
    referralsWaiting: referralsRecent.error
      ? []
      : recentRows.map((r) => ({
          id: r.id,
          reason: r.reason,
          priority: r.priority,
          studentAlias: aliasById.get(r.student_id) ?? "Student",
          createdAt: r.created_at,
        })),
    upcomingSessions: upcoming.error
      ? []
      : (((upcoming.data ?? []) as { id: string; scheduled_at: string; status: string; concern: string }[]).map((a) => ({
          id: a.id,
          scheduledAt: a.scheduled_at,
          status: a.status,
          concern: a.concern,
        }))),
    unassigned: unassigned.error
      ? []
      : unassignedRows.map((r) => ({
          id: r.id,
          reason: r.reason,
          priority: r.priority,
          studentAlias: aliasById.get(r.student_id) ?? "Student",
          createdAt: r.created_at,
        })),
    announcements: announcements.error
      ? []
      : (((announcements.data ?? []) as { id: string; title: string; published_at: string | null }[]).map((a) => ({
          id: a.id,
          title: a.title,
          publishedAt: a.published_at,
        }))),
    weekChart: weekRows.error ? [] : buckets,
    statusChart: statusRows.error ? [] : statusChart,
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
