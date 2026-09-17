import { createClient } from "@/lib/supabase/client";
import { aliasOrMasked } from "./export-mappers";
import type { ReportBundle, ReportScope, SheetContext, WorkbookOptions } from "./types";
import { buildCoverSheet } from "./sheets/cover";
import { buildSummarySheet } from "./sheets/summary";
import { buildAppointmentsSheet } from "./sheets/appointments";
import { buildReferralsSheet } from "./sheets/referrals";
import { buildFeedbackSheet } from "./sheets/feedback";
import { buildWellbeingSheet } from "./sheets/wellbeing";
import { buildTeamSheet } from "./sheets/team";
import { buildAnnouncementsSheet } from "./sheets/announcements";

export type { ReportBundle, ReportScope, WorkbookOptions };

export async function fetchReportData(scope?: ReportScope): Promise<ReportBundle> {
  const supabase = createClient();
  const [
    officeRes,
    apptsRes,
    refsRes,
    feedRes,
    pssRes,
    counselorsRes,
    annRes,
  ] = await Promise.all([
    supabase.from("workspace_settings").select("value").eq("key", "office").maybeSingle(),
    supabase
      .from("appointments")
      .select("id,student_id,counselor_id,scheduled_at,status,mode,concern,created_at")
      .order("scheduled_at", { ascending: false })
      .limit(2000),
    supabase
      .from("referrals")
      .select("id,student_id,reason,status,priority,assigned_counselor_id,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("feedback")
      .select("appointment_id,student_id,rating,comment,created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("pss10_assessments").select("id,student_id,band,total_score,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("counselors").select("id,profile_id,specialization,is_available"),
    supabase.from("announcements").select("id,title,published_at,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  if (apptsRes.error) throw new Error("Couldn't load appointments for export.");
  if (refsRes.error) throw new Error("Couldn't load referrals for export.");
  if (feedRes.error) throw new Error("Couldn't load feedback for export.");

  // Counselor scope — personal workbook: only my sessions, my referrals,
  // feedback on my sessions, and screenings of students I've seen.
  // (RLS already narrows appointments, but explicit filtering keeps the
  // export correct even where role policies allow wider reads.)
  let appointments = (apptsRes.data ?? []) as any[];
  let referrals = (refsRes.data ?? []) as any[];
  let feedback = (feedRes.data ?? []) as any[];
  let pss = ((pssRes.data ?? []) as any[]) ?? [];
  if (scope?.counselorId) {
    const mine = scope.counselorId;
    appointments = appointments.filter((a) => a.counselor_id === mine);
    const myApptIds = new Set(appointments.map((a) => a.id));
    const myStudentIds = new Set(appointments.map((a) => a.student_id).filter(Boolean));
    referrals = referrals.filter((r) => r.assigned_counselor_id === mine);
    feedback = feedback.filter((f) => myApptIds.has(f.appointment_id));
    pss = pss.filter((p) => myStudentIds.has(p.student_id));
  }

  const counselors = ((counselorsRes.data ?? []) as any[]) ?? [];
  const announcements = ((annRes.data ?? []) as any[]) ?? [];

  // Date-range scope — same rule as the on-screen report: appointments by
  // scheduled date; referrals, feedback, screenings, and posts by created date.
  if (scope?.from || scope?.to) {
    const inWindow = (iso: unknown) => {
      const s = typeof iso === "string" ? iso : "";
      if (!s) return false;
      if (scope.from && s < scope.from) return false;
      if (scope.to && s > scope.to) return false;
      return true;
    };
    appointments = appointments.filter((a) => inWindow(a.scheduled_at));
    referrals = referrals.filter((r) => inWindow(r.created_at));
    feedback = feedback.filter((f) => inWindow(f.created_at));
    pss = pss.filter((p) => inWindow(p.created_at));
  }

  // Counselor names
  const profileIds = [...new Set(counselors.map((c) => c.profile_id).filter(Boolean))];
  const counselorName = new Map<string, string>();
  const counselorSpec = new Map<string, string | null>();
  const counselorAvail = new Map<string, boolean>();
  for (const c of counselors) {
    counselorSpec.set(c.id, c.specialization ?? null);
    counselorAvail.set(c.id, !!c.is_available);
  }
  if (profileIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", profileIds);
    const byProfile = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name ?? "Counselor"]));
    for (const c of counselors) counselorName.set(c.id, byProfile.get(c.profile_id) ?? "Counselor");
  }

  // Student aliases (privacy-safe; chunked so large offices don't blow the URL limit)
  const studentIds = [...new Set([...appointments.map((a) => a.student_id), ...referrals.map((r) => r.student_id)].filter(Boolean))];
  const aliasByStudent = new Map<string, string>();
  for (let i = 0; i < studentIds.length; i += 200) {
    const chunk = studentIds.slice(i, i + 200);
    if (!chunk.length) break;
    const { data } = await supabase.from("students").select("id,anonymous_alias").in("id", chunk);
    for (const s of (data ?? []) as any[]) aliasByStudent.set(s.id, s.anonymous_alias ?? aliasOrMasked(null, s.id));
  }

  const office = (officeRes.data as { value?: { name?: string; location?: string; contact?: string } } | null)?.value;

  return { appointments, referrals, feedback, pss, counselors, announcements, counselorName, counselorSpec, counselorAvail, aliasByStudent, office };
}

export async function buildWorkbook(bundle: ReportBundle, opts?: WorkbookOptions) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const stamp = new Date();
  const stampLabel = stamp.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const fileDay = stamp.toISOString().slice(0, 10);
  wb.creator = "DOrSU Guidance Office";
  wb.company = "DOrSU Guidance";
  wb.created = stamp;
  wb.modified = stamp;

  const { appointments, referrals, feedback, pss, office } = bundle;
  const officeLine = office?.name ? `${office.name}${office.location ? ` · ${office.location}` : ""}` : "DOrSU Guidance";
  const meta = `Generated ${stampLabel}  •  Range: ${opts?.rangeLabel ?? "All time"}  •  ${officeLine}  •  Privacy-safe: student aliases only, never real names`;

  const totalAppts = appointments.length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const missed = appointments.filter((a) => a.status === "cancelled" || a.status === "rejected" || a.status === "no_show").length;
  const avgRating = feedback.length ? feedback.reduce((a, f) => a + (f.rating ?? 0), 0) / feedback.length : 0;
  const openRefs = referrals.filter((r) => ["pending", "assigned", "acknowledged", "in_progress", "confirmed", "escalated"].includes(r.status)).length;
  const resolvedRefs = referrals.filter((r) => r.status === "resolved").length;
  const highStress = pss.filter((p) => p.band === "high").length;

  const ctx: SheetContext = {
    meta,
    officeLine,
    personal: !!opts?.personal,
    totalAppts,
    completed,
    missed,
    avgRating,
    openRefs,
    resolvedRefs,
    highStress,
  };

  buildCoverSheet(wb, bundle, ctx);
  buildSummarySheet(wb, bundle, ctx);
  buildAppointmentsSheet(wb, bundle, ctx);
  buildReferralsSheet(wb, bundle, ctx);
  buildFeedbackSheet(wb, bundle, ctx);
  buildWellbeingSheet(wb, bundle, ctx);
  buildTeamSheet(wb, bundle, ctx);
  buildAnnouncementsSheet(wb, bundle, ctx);

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, fileDay };
}
