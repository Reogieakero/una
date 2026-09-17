import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseReportRange,
  parseReportSection,
  withRange,
  type ReportSection,
} from "@/lib/reports-scope";

export type FacultyReportsReferral = {
  id: string;
  status: string;
  priority: string;
  classification: string[];
  reason: string | null;
  created_at: string;
};

export type FacultyReportsPayload = {
  section: ReportSection;
  range: { preset: string; from: string | null; to: string | null; label: string };
  facultyId: string;
  referrals: FacultyReportsReferral[];
  fetchedAt: string;
};

/**
 * GET /api/reports/faculty — one round-trip for the faculty reports page.
 * Scoped to the caller's faculty_members row (RLS enforces it too): only
 * referrals the faculty member filed. The client caches it with TanStack
 * Query keyed by section + range, so going back (or re-picking a recent
 * filter) renders cached aggregates instantly and revalidates in the
 * background.
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
  if (role !== "faculty") {
    return NextResponse.json({ error: "Faculty only." }, { status: 403 });
  }

  const { data: frow } = await supabase
    .from("faculty_members")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  const facultyId = (frow as { id: string } | null)?.id ?? null;

  const url = new URL(request.url);
  const section = parseReportSection(url.searchParams.get("section"));
  const range = parseReportRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  if (!facultyId) {
    return NextResponse.json(
      {
        section,
        range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
        facultyId: "",
        referrals: [],
        unlinked: true,
        fetchedAt: new Date().toISOString(),
      } satisfies FacultyReportsPayload & { unlinked: boolean },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  }

  const { data } = await withRange(
    supabase
      .from("referrals")
      .select("id,status,priority,case_classification,reason,created_at")
      .eq("referring_faculty_id", facultyId)
      .order("created_at", { ascending: false })
      .limit(2000),
    "created_at",
    range
  );

  const payload: FacultyReportsPayload = {
    section,
    range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
    facultyId,
    referrals: (((data ?? []) as { id: string; status: string; priority: string; case_classification: string[] | null; reason: string | null; created_at: string }[]).map(
      (r) => ({ id: r.id, status: r.status, priority: r.priority, classification: r.case_classification ?? [], reason: r.reason, created_at: r.created_at })
    )),
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
