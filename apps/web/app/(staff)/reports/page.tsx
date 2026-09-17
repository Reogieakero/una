import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HeadReportsView } from "@/components/shared/head-reports-view";
import { CounselorReportsView } from "@/components/shared/counselor-reports-view";
import { parseReportRange, parseReportSection } from "@/lib/reports-scope";

/**
 * Shared /reports — one URL, role-aware.
 * Counselors get their personal report (own cases only); the head keeps the
 * office-wide one. Faculty is redirected to their home (/referrals).
 * `?section=` picks one section (or all); `?range=` / `?from=&to=` scope every
 * metric to a time window. Sessions scope by scheduled date; referrals,
 * feedback, and screenings scope by created date.
 * Both branches render cached client views with the same layout, so going
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
  if (profile.role === "faculty") redirect("/referrals");
  const section = parseReportSection(searchParams?.section);
  const range = parseReportRange({ range: searchParams?.range, from: searchParams?.from, to: searchParams?.to });
  if (profile.role === "counselor") {
    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return <CounselorReportsView firstName={firstName} section={section} range={range} />;
  }
  if (profile.role === "guidance_head") return <HeadReportsView section={section} range={range} />;
  redirect("/");
}
