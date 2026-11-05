import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { HeadReportsView } from "@/components/shared/head-reports-view";
import { CounselorReportsView } from "@/components/shared/counselor-reports-view";
import { FacultyReportsView } from "@/components/shared/faculty-reports-view";
import { clampSectionForRole, parseCohortGroup, parseReportRange, parseReportSection, reportSectionsForRole } from "@/lib/reports-scope";

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
  const approval = (profile as { approval_status?: string | null }).approval_status;
  if (approval === "pending") redirect("/pending-approval");
  if (approval === "rejected") redirect("/login?rejected=1");
  if ((profile as { is_active?: boolean | null }).is_active === false) redirect("/login?deactivated=1");
  const section = parseReportSection(searchParams?.section);
  const range = parseReportRange({ range: searchParams?.range, from: searchParams?.from, to: searchParams?.to });
  const group = parseCohortGroup(searchParams?.group);
  if (profile.role === "faculty") {
    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    // Faculty reports cover referrals only; the shared default (Overview)
    // now lands on useful content, and the tab list hides the sections they
    // don't have.
    return (
      <FacultyReportsView
        firstName={firstName}
        section={clampSectionForRole("faculty", section)}
        range={range}
        sections={reportSectionsForRole("faculty")}
      />
    );
  }
  if (profile.role === "counselor") {
    const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return (
      <CounselorReportsView
        firstName={firstName}
        section={clampSectionForRole("counselor", section)}
        range={range}
        sections={reportSectionsForRole("counselor")}
      />
    );
  }
  if (profile.role === "guidance_head") {
    return (
      <HeadReportsView
        section={section}
        range={range}
        group={group}
        sections={reportSectionsForRole("head")}
      />
    );
  }
  redirect("/");
}
