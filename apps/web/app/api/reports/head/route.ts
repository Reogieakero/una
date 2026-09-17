import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseReportRange,
  parseReportSection,
  withRange,
  type ReportSection,
} from "@/lib/reports-scope";

const OPEN_REFERRALS = ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"] as const;

export type HeadReportsAppt = {
  id: string;
  status: string;
  mode: string;
  concern: string | null;
  counselor_id: string | null;
  scheduled_at: string;
};

export type HeadReportsReferral = {
  id: string;
  status: string;
  priority: string;
  created_at: string;
};

export type HeadReportsFeedback = {
  rating: number;
  comment: string | null;
  created_at: string;
};

export type HeadReportsScreening = {
  band: string;
  total_score: number;
  created_at: string;
};

export type HeadReportsWorkloadEntry = {
  id: string;
  name: string;
  spec: string | null;
  total: number;
  completed: number;
};

export type HeadReportsPayload = {
  section: ReportSection;
  range: { preset: string; from: string | null; to: string | null; label: string };
  appointments: HeadReportsAppt[];
  referrals: HeadReportsReferral[];
  feedback: HeadReportsFeedback[];
  screenings: HeadReportsScreening[];
  pipeline: { unassigned: number; escalated: number; oldestOpenAt: string | null };
  workload: { ranked: HeadReportsWorkloadEntry[]; unassignedSessions: number };
  fetchedAt: string;
};

const EMPTY_PIPELINE = { unassigned: 0, escalated: 0, oldestOpenAt: null as string | null };
const EMPTY_WORKLOAD = { ranked: [] as HeadReportsWorkloadEntry[], unassignedSessions: 0 };

/**
 * GET /api/reports/head — one round-trip for the guidance-head (admin)
 * reports page. The client caches it with TanStack Query keyed by
 * section + range, so going back (or re-picking a recent filter) renders
 * cached aggregates instantly and revalidates in the background instead of
 * blocking on ~25 sequential queries.
 *
 * Only the tables needed for the requested section are read.
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
  const section = parseReportSection(url.searchParams.get("section"));
  const range = parseReportRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  const showAll = section === "all";
  const needAppts = showAll || section === "sessions" || section === "operations";
  const needRefs = showAll || section === "referrals";
  const needFeedback = showAll || section === "satisfaction";
  const needScreenings = showAll || section === "wellbeing";
  const needPipeline = showAll || section === "referrals";
  const needWorkload = showAll || section === "operations";

  // Every independent query fires together — one parallel batch instead of
  // the old per-section Suspense waterfall.
  const [apptsRes, refsRes, feedbackRes, pssRes, unassignedRes, escalatedRes, oldestRes, counselorsRes] =
    await Promise.all([
      needAppts
        ? withRange(
            supabase
              .from("appointments")
              .select("id,status,mode,concern,counselor_id,scheduled_at")
              .limit(2000),
            "scheduled_at",
            range
          )
        : Promise.resolve({ data: null, error: null }),
      needRefs
        ? withRange(
            supabase.from("referrals").select("id,status,priority,created_at").limit(2000),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null }),
      needFeedback
        ? withRange(
            supabase.from("feedback").select("rating,comment,created_at").limit(1000),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null }),
      needScreenings
        ? withRange(
            supabase.from("pss10_assessments").select("band,total_score,created_at").limit(1000),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null }),
      needPipeline
        ? withRange(
            supabase
              .from("referrals")
              .select("id", { count: "exact", head: true })
              .in("status", [...OPEN_REFERRALS])
              .is("assigned_counselor_id", null),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null, count: null }),
      needPipeline
        ? withRange(
            supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "escalated"),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null, count: null }),
      needPipeline
        ? withRange(
            supabase
              .from("referrals")
              .select("created_at")
              .in("status", [...OPEN_REFERRALS])
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle(),
            "created_at",
            range
          )
        : Promise.resolve({ data: null, error: null }),
      needWorkload
        ? supabase.from("counselors").select("id,profile_id,specialization")
        : Promise.resolve({ data: null, error: null }),
    ]);

  const appointments = ((apptsRes.data ?? []) as HeadReportsAppt[]);
  const referrals = ((refsRes.data ?? []) as HeadReportsReferral[]);
  const feedback = ((feedbackRes.data ?? []) as HeadReportsFeedback[]);
  const screenings = ((pssRes.data ?? []) as HeadReportsScreening[]);

  const pipeline = !needPipeline
    ? EMPTY_PIPELINE
    : {
        unassigned:
          (unassignedRes as { error: unknown; count: number | null }).error != null
            ? 0
            : ((unassignedRes as { count: number | null }).count ?? 0),
        escalated:
          (escalatedRes as { error: unknown; count: number | null }).error != null
            ? 0
            : ((escalatedRes as { count: number | null }).count ?? 0),
        oldestOpenAt:
          ((oldestRes.data as { created_at?: string } | null)?.created_at ?? null),
      };

  let workload = EMPTY_WORKLOAD;
  if (needWorkload) {
    const byCounselor = new Map<string, { total: number; completed: number }>();
    let unassignedSessions = 0;
    for (const r of appointments) {
      if (!r.counselor_id) {
        unassignedSessions += 1;
        continue;
      }
      const e = byCounselor.get(r.counselor_id) ?? { total: 0, completed: 0 };
      e.total += 1;
      if (r.status === "completed") e.completed += 1;
      byCounselor.set(r.counselor_id, e);
    }
    const counselors = ((counselorsRes.data ?? []) as { id: string; profile_id: string; specialization: string | null }[]);
    const profileIds = [...new Set(counselors.map((c) => c.profile_id).filter(Boolean))];
    const byProfile = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", profileIds);
      for (const p of ((profiles ?? []) as { id: string; full_name: string | null }[])) {
        byProfile.set(p.id, p.full_name ?? "Counselor");
      }
    }
    const ranked = [...byCounselor.entries()]
      .map(([id, v]) => {
        const c = counselors.find((x) => x.id === id);
        return {
          id,
          ...v,
          name: c ? (byProfile.get(c.profile_id) ?? "Counselor") : "Counselor",
          spec: c?.specialization ?? null,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    workload = { ranked, unassignedSessions };
  }

  const payload: HeadReportsPayload = {
    section,
    range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
    appointments,
    referrals,
    feedback,
    screenings,
    pipeline,
    workload,
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation, keyed by filter).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
