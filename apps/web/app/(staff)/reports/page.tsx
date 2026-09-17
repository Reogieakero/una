import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HeadReportsView } from "@/components/shared/head-reports-view";
import { CounselorReportsView } from "@/components/shared/counselor-reports-view";
import { FacultyReportsView } from "@/components/shared/faculty-reports-view";
import { parseReportRange, parseReportSection } from "@/lib/reports-scope";

/**
 * Shared /reports — one URL, role-aware.
 * Counselors get their personal report (own cases only), faculty get their
 * own referrals report, and the head keeps the office-wide one.
 * `?section=` picks one section (or all); `?range=` / `?from=&to=` scope every
 * metric to a time window. Sessions scope by scheduled date; referrals,
 * feedback, and screenings scope by created date.
 * All branches render cached client views with the same layout, so going
 * back re-renders instantly and revalidates in the background.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if ((profile as { is_active?: boolean | null }).is_active === false) redirect("/login?deactivated=1");
  const section = parseReportSection(searchParams?.section);
  const range = parseReportRange({ range: searchParams?.range, from: searchParams?.from, to: searchParams?.to });
  if (profile.role === "faculty") {
    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    // Faculty reports cover referrals only — default to "all" (which shows
    // the referral panels) instead of the global "sessions" default, so a
    // bare /reports visit lands on useful content.
    const facultySection = searchParams?.section === undefined ? "all" : section;
    return <FacultyReportsView firstName={firstName} section={facultySection} range={range} />;
  }
  if (profile.role === "counselor") {
    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return <CounselorReportsView firstName={firstName} section={section} range={range} />;
  }
  if (profile.role === "guidance_head") return <HeadReportsView section={section} range={range} />;
  redirect("/");
}
