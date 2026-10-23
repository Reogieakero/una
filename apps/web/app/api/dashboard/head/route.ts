import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;
const ACTIVE_APPOINTMENTS = ["pending", "assigned", "confirmed"] as const;

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

type AppointmentFeedRow = {
  id: string;
  scheduled_at: string;
  created_at: string;
  status: string;
  concern: string;
  student_id: string | null;
  is_anonymous: boolean;
};

type FacultyReferralRow = {
  id: string;
  reason: string;
  priority: string;
  status: string;
  student_id: string | null;
  referring_faculty_id: string | null;
  created_at: string;
};

export type HeadDashboardPayload = {
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
    latestBookings,
    facultyReferrals,
    unassignedAppointments,
    announcements,
    weekRows,
    statusRows,
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
    // P8: estimated avoids a full exact-count scan per dashboard load.
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
    // P3b: week + status aggregates come from SQL RPCs (≤31 bucket rows)
    // instead of pulling 500 + 1000 raw rows to group in JS.
    supabase.rpc("head_appointment_daily_counts", {
      from_ts: weekAgo.toISOString(),
      to_ts: tomorrow.toISOString(),
    }),
    supabase.rpc("head_referral_status_counts"),
  ]);

  const bookingRows = (latestBookings.data ?? []) as AppointmentFeedRow[];
  const unassignedRows = (unassignedAppointments.data ?? []) as AppointmentFeedRow[];
  const referralRows = (facultyReferrals.data ?? []) as FacultyReferralRow[];

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
    const { data } = await supabase.from("students").select("id, anonymous_alias").in("id", studentIds);
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
    const d = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), day: dayLabel(d), sessions: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of ((weekRows.data ?? []) as { day: string; sessions: number | string }[])) {
    if (!row?.day) continue;
    const b = byKey.get(dayKey(new Date(row.day)));
    if (b) b.sessions += Number(row.sessions ?? 0);
  }

  const counts = new Map<string, number>();
  for (const row of ((statusRows.data ?? []) as { status: string; count: number | string }[])) {
    if (!row?.status) continue;
    counts.set(row.status, Number(row.count ?? 0));
  }
  const statusChart = [...counts.entries()]
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_META[k]?.label ?? k, value: v, color: STATUS_META[k]?.color ?? "#94A3B8" }));

  const aliasOf = (r: { student_id: string | null }) =>
    (r.student_id ? aliasById.get(r.student_id) : undefined) ?? "Student";

  const payload: HeadDashboardPayload = {
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
    statusChart: statusRows.error ? [] : statusChart,
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
