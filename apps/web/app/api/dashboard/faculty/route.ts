import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export type FacultyDashboardPayload = {
  kpis: {
    totalReferrals: number | null;
    pending: number | null;
    inProgress: number | null;
    resolved: number | null;
    unreadNotifications: number | null;
  };
  recent: {
    id: string;
    reason: string;
    status: string;
    priority: string;
    classification: string[];
    studentAlias: string;
    createdAt: string;
  }[];
  attention: {
    id: string;
    reason: string;
    status: string;
    priority: string;
    classification: string[];
    studentAlias: string;
    createdAt: string;
  }[];
  announcements: { id: string; title: string; publishedAt: string | null }[];
  trend: { day: string; referrals: number }[];
  fetchedAt: string;
};

/**
 * GET /api/dashboard/faculty — one round-trip for the faculty dashboard.
 * Everything is scoped to the caller's faculty_members row (RLS enforces it
 * too), so faculty only ever see referrals they filed. The client caches it
 * with TanStack Query (60s fresh), so navigating back to /dashboard renders
 * cached data instantly and revalidates in the background.
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
  if (role !== "faculty") {
    return NextResponse.json({ error: "Faculty only." }, { status: 403 });
  }

  const { data: frow } = await supabase
    .from("faculty_members")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  const facultyId = (frow as { id: string } | null)?.id ?? null;
  if (!facultyId) {
    return NextResponse.json(
      {
        kpis: {
          totalReferrals: null,
          pending: null,
          inProgress: null,
          resolved: null,
          unreadNotifications: null,
        },
        recent: [],
        attention: [],
        announcements: [],
        trend: [],
        unlinked: true,
        fetchedAt: new Date().toISOString(),
      } satisfies FacultyDashboardPayload & { unlinked: boolean },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  }

  const IN_PROGRESS = ["assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

  const today = startOfTodayUTC();
  const fortnightAgo = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);

  const [totalRes, pendingRes, progressRes, resolvedRes, unreadRes, recentRows, attentionRows, announcements, trendRows] =
    await Promise.all([
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referring_faculty_id", facultyId),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referring_faculty_id", facultyId)
        .eq("status", "pending"),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referring_faculty_id", facultyId)
        .in("status", [...IN_PROGRESS]),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referring_faculty_id", facultyId)
        .eq("status", "resolved"),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .eq("is_read", false),
      supabase
        .from("referrals")
        .select("id, reason, priority, status, case_classification, student_id, created_at")
        .eq("referring_faculty_id", facultyId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("referrals")
        .select("id, reason, priority, status, case_classification, student_id, created_at")
        .eq("referring_faculty_id", facultyId)
        .in("status", ["pending", "escalated"])
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("announcements")
        .select("id, title, published_at")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(3),
      supabase
        .from("referrals")
        .select("created_at")
        .eq("referring_faculty_id", facultyId)
        .gte("created_at", fortnightAgo.toISOString())
        .limit(500),
    ]);

  type RefRow = {
    id: string;
    reason: string;
    priority: string;
    status: string;
    case_classification: string[] | null;
    student_id: string;
    created_at: string;
  };
  const combined = [...((recentRows.data ?? []) as RefRow[]), ...((attentionRows.data ?? []) as RefRow[])];
  const studentIds = [...new Set(combined.map((r) => r.student_id))];
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

  const mapRef = (r: RefRow) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    priority: r.priority,
    classification: r.case_classification ?? [],
    studentAlias: aliasById.get(r.student_id) ?? "Student",
    createdAt: r.created_at,
  });

  const trendBuckets = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(fortnightAgo.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), day: dayLabel(d), referrals: 0 };
  });
  const byKey = new Map(trendBuckets.map((b) => [b.key, b]));
  for (const row of ((trendRows.data ?? []) as { created_at: string }[])) {
    const b = byKey.get(dayKey(new Date(row.created_at)));
    if (b) b.referrals += 1;
  }
  const trend = trendRows.error ? [] : trendBuckets.map(({ day, referrals }) => ({ day, referrals }));

  const payload: FacultyDashboardPayload = {
    kpis: {
      totalReferrals: totalRes.error ? null : (totalRes.count ?? 0),
      pending: pendingRes.error ? null : (pendingRes.count ?? 0),
      inProgress: progressRes.error ? null : (progressRes.count ?? 0),
      resolved: resolvedRes.error ? null : (resolvedRes.count ?? 0),
      unreadNotifications: unreadRes.error ? null : (unreadRes.count ?? 0),
    },
    recent: recentRows.error ? [] : (((recentRows.data ?? []) as RefRow[]).map(mapRef)),
    attention: attentionRows.error ? [] : (((attentionRows.data ?? []) as RefRow[]).map(mapRef)),
    announcements: announcements.error
      ? []
      : (((announcements.data ?? []) as { id: string; title: string; published_at: string | null }[]).map((a) => ({
          id: a.id,
          title: a.title,
          publishedAt: a.published_at,
        }))),
    trend,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
