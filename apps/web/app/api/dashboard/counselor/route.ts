import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export type CounselorDashboardPayload = {
  kpis: {
    sessionsToday: number | null;
    awaitingConfirmation: number | null;
    openReferrals: number | null;
    openChats: number | null;
  };
  today: { id: string; scheduledAt: string; status: string; concern: string; studentAlias: string }[];
  actionQueue: { id: string; scheduledAt: string; status: string; concern: string; studentAlias: string }[];
  myReferrals: {
    id: string;
    reason: string;
    status: string;
    priority: string;
    studentAlias: string;
    createdAt: string;
  }[];
  fetchedAt: string;
};

/**
 * GET /api/dashboard/counselor — one round-trip for the counselor dashboard.
 * Everything is scoped to the caller's counselor row (RLS enforces it too),
 * so a counselor only ever sees their own queue. The client caches it with
 * TanStack Query (60s fresh), so navigating back to /dashboard renders cached
 * data instantly and revalidates in the background instead of blocking on
 * the query waterfall.
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
  if (role !== "counselor") {
    return NextResponse.json({ error: "Counselor only." }, { status: 403 });
  }

  const { data: crow } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
  const counselorId = (crow as { id: string } | null)?.id ?? null;
  if (!counselorId) {
    return NextResponse.json(
      {
        kpis: { sessionsToday: null, awaitingConfirmation: null, openReferrals: null, openChats: null },
        today: [],
        actionQueue: [],
        myReferrals: [],
        unlinked: true,
        fetchedAt: new Date().toISOString(),
      } satisfies CounselorDashboardPayload & { unlinked: boolean },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  }

  const today = startOfTodayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [todayRes, confirmRes, referralsRes, chatsRes, todayRows, actionRows, refRows] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("counselor_id", counselorId)
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .in("status", ["assigned", "confirmed"]),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("counselor_id", counselorId)
        .eq("status", "assigned"),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("assigned_counselor_id", counselorId)
        .in("status", ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"]),
      supabase
        .from("chat_threads")
        .select("id", { count: "exact", head: true })
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
        .in("status", ["assigned", "confirmed"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5),
      supabase
        .from("referrals")
        .select("id, reason, priority, status, student_id, created_at")
        .eq("assigned_counselor_id", counselorId)
        .in("status", ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"])
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  type SessionRow = { id: string; scheduled_at: string; status: string; concern: string; student_id: string };
  const sessionRows = [...((todayRows.data ?? []) as SessionRow[]), ...((actionRows.data ?? []) as SessionRow[])];
  const refList = ((refRows.data ?? []) as { id: string; student_id: string }[]).map((r) => r.student_id);
  const aliasIds = [...new Set([...sessionRows.map((r) => r.student_id), ...refList])];
  let aliasById = new Map<string, string>();
  if (aliasIds.length) {
    const { data } = await supabase.from("students").select("id, anonymous_alias").in("id", aliasIds);
    aliasById = new Map(((data ?? []) as { id: string; anonymous_alias: string | null }[]).map((s) => [s.id, s.anonymous_alias ?? "Student"]));
  }

  const payload: CounselorDashboardPayload = {
    kpis: {
      sessionsToday: todayRes.error ? null : (todayRes.count ?? 0),
      awaitingConfirmation: confirmRes.error ? null : (confirmRes.count ?? 0),
      openReferrals: referralsRes.error ? null : (referralsRes.count ?? 0),
      openChats: chatsRes.error ? null : (chatsRes.count ?? 0),
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
    myReferrals: (
      (refRows.data ?? []) as { id: string; reason: string; priority: string; status: string; student_id: string; created_at: string }[]
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
