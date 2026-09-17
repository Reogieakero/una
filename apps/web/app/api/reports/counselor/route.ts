import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseReportRange,
  parseReportSection,
  withRange,
  type ReportSection,
} from "@/lib/reports-scope";

export type CounselorReportsAppt = {
  id: string;
  status: string;
  mode: string;
  concern: string | null;
  scheduled_at: string;
};

export type CounselorReportsReferral = {
  id: string;
  status: string;
  priority: string;
  created_at: string;
};

export type CounselorReportsFeedback = {
  rating: number;
  comment: string | null;
  created_at: string;
};

export type CounselorReportsScreening = {
  band: string;
  total_score: number;
  created_at: string;
};

export type CounselorReportsPayload = {
  section: ReportSection;
  range: { preset: string; from: string | null; to: string | null; label: string };
  counselorId: string;
  appointments: CounselorReportsAppt[];
  referrals: CounselorReportsReferral[];
  feedback: CounselorReportsFeedback[];
  screenings: CounselorReportsScreening[];
  fetchedAt: string;
};

/**
 * GET /api/reports/counselor — one round-trip for the counselor reports
 * page. Everything is scoped to the caller's counselor row (RLS enforces it
 * too): only sessions assigned to them, referrals assigned to them, feedback
 * on their sessions, and screenings from students they've seen. The client
 * caches it with TanStack Query keyed by section + range, so going back (or
 * re-picking a recent filter) renders cached aggregates instantly and
 * revalidates in the background instead of blocking on the query waterfall.
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
  if (role !== "counselor") {
    return NextResponse.json({ error: "Counselor only." }, { status: 403 });
  }

  const { data: crow } = await supabase.from("counselors").select("id").eq("profile_id", user.id).maybeSingle();
  const counselorId = (crow as { id: string } | null)?.id ?? null;

  const url = new URL(request.url);
  const section = parseReportSection(url.searchParams.get("section"));
  const range = parseReportRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!counselorId) {
    return NextResponse.json(
      {
        section,
        range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
        counselorId: "",
        appointments: [],
        referrals: [],
        feedback: [],
        screenings: [],
        unlinked: true,
        fetchedAt: new Date().toISOString(),
      } satisfies CounselorReportsPayload & { unlinked: boolean },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  }
  const showAll = section === "all";
  const needAppts = showAll || section === "sessions" || section === "operations";
  const needRefs = showAll || section === "referrals";
  const needFeedback = showAll || section === "satisfaction";
  const needScreenings = showAll || section === "wellbeing";

  // Counselor scope keys: my appointment ids bound feedback, my student ids
  // bound screenings. Fetched first so the section queries below stay small.
  let apptIds: string[] = [];
  let studentIds: string[] = [];
  if (needFeedback || needScreenings) {
    const { data: mine } = await supabase
      .from("appointments")
      .select("id,student_id")
      .eq("counselor_id", counselorId)
      .limit(2000);
    const rows = ((mine ?? []) as { id: string; student_id: string }[]);
    apptIds = rows.map((r) => r.id);
    studentIds = [...new Set(rows.map((r) => r.student_id))];
  }

  const fetchFeedback = async (): Promise<CounselorReportsFeedback[]> => {
    if (!apptIds.length) return [];
    const out: CounselorReportsFeedback[] = [];
    for (let i = 0; i < apptIds.length; i += 200) {
      const { data } = await withRange(
        supabase.from("feedback").select("rating,comment,created_at").in("appointment_id", apptIds.slice(i, i + 200)).limit(1000),
        "created_at",
        range
      );
      out.push(...((data ?? []) as CounselorReportsFeedback[]));
      if (out.length >= 1000) break;
    }
    return out.slice(0, 1000);
  };

  const fetchScreenings = async (): Promise<CounselorReportsScreening[]> => {
    if (!studentIds.length) return [];
    const out: CounselorReportsScreening[] = [];
    for (let i = 0; i < studentIds.length; i += 200) {
      const { data } = await withRange(
        supabase.from("pss10_assessments").select("band,total_score,created_at").in("student_id", studentIds.slice(i, i + 200)).limit(1000),
        "created_at",
        range
      );
      out.push(...((data ?? []) as CounselorReportsScreening[]));
      if (out.length >= 1000) break;
    }
    return out.slice(0, 1000);
  };

  const [apptsRes, refsRes, feedback, screenings] = await Promise.all([
    needAppts
      ? withRange(
          supabase
            .from("appointments")
            .select("id,status,mode,concern,scheduled_at")
            .eq("counselor_id", counselorId)
            .limit(2000),
          "scheduled_at",
          range
        )
      : Promise.resolve({ data: null, error: null }),
    needRefs
      ? withRange(
          supabase
            .from("referrals")
            .select("id,status,priority,created_at")
            .eq("assigned_counselor_id", counselorId)
            .limit(2000),
          "created_at",
          range
        )
      : Promise.resolve({ data: null, error: null }),
    needFeedback ? fetchFeedback() : Promise.resolve([]),
    needScreenings ? fetchScreenings() : Promise.resolve([]),
  ]);

  const payload: CounselorReportsPayload = {
    section,
    range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
    counselorId,
    appointments: ((apptsRes.data ?? []) as CounselorReportsAppt[]),
    referrals: ((refsRes.data ?? []) as CounselorReportsReferral[]),
    feedback,
    screenings,
    fetchedAt: new Date().toISOString(),
  };

  // Private short-lived HTTP cache as a second layer; the primary cache is
  // the TanStack Query client (survives in-app navigation, keyed by filter).
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
