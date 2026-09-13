"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/* ── Brand / palette (matches the app: navy ink + primary blue) ── */

const NAVY = "FF1E3A5F";
const PRIMARY = "FF2563EB";
const INK = "FF0F172A";
const MUTED = "FF64748B";
const LINE = "FFE2E8F0";
const BAND = "FFF8FAFC";
const TOTAL_BG = "FFDBEAFE";

const THIN_BORDER = {
  top: { style: "thin" as const, color: { argb: LINE } },
  left: { style: "thin" as const, color: { argb: LINE } },
  bottom: { style: "thin" as const, color: { argb: LINE } },
  right: { style: "thin" as const, color: { argb: LINE } },
};

/* ── Label maps ── */

const APPT_STATUS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  no_show: "No-show",
};

const REF_STATUS: Record<string, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  escalated: "Escalated",
};

const PRIORITY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function titleCase(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** Pill-like fill for a status / priority / band value (pro touch, still prints well). */
function pillStyle(kind: "appt" | "ref" | "priority" | "band", raw: string) {
  const v = (raw ?? "").toLowerCase();
  if (kind === "appt") {
    if (v === "completed") return { bg: "FFDCFCE7", fg: "FF166534" };
    if (v === "confirmed" || v === "assigned") return { bg: "FFDBEAFE", fg: "FF1E40AF" };
    if (v === "pending") return { bg: "FFFEF3C7", fg: "FF92400E" };
    return { bg: "FFFEE2E2", fg: "FF991B1B" }; // cancelled / rejected / no-show
  }
  if (kind === "ref") {
    if (v === "resolved") return { bg: "FFDCFCE7", fg: "FF166534" };
    if (v === "escalated") return { bg: "FFFEE2E2", fg: "FF991B1B" };
    if (v === "pending") return { bg: "FFFEF3C7", fg: "FF92400E" };
    return { bg: "FFDBEAFE", fg: "FF1E40AF" };
  }
  if (kind === "priority") {
    if (v === "urgent") return { bg: "FFFEE2E2", fg: "FF991B1B" };
    if (v === "high") return { bg: "FFFEF3C7", fg: "FF92400E" };
    if (v === "medium") return { bg: "FFDBEAFE", fg: "FF1E40AF" };
    return { bg: "FFF1F5F9", fg: "FF475569" };
  }
  if (v === "high") return { bg: "FFFEE2E2", fg: "FF991B1B" };
  if (v === "moderate") return { bg: "FFFEF3C7", fg: "FF92400E" };
  return { bg: "FFDCFCE7", fg: "FF166534" };
}

/* ── ExcelJS styling helpers (kept tiny so every sheet looks identical) ── */

type WS = any;

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Title (row 1) + subtitle (row 2) + meta (row 3) + spacer (row 4). Header lives on row 5. */
function applyTitleBlock(ws: WS, nCols: number, title: string, subtitle: string, meta: string) {
  const last = colLetter(nCols);
  ws.mergeCells(`A1:${last}1`);
  ws.mergeCells(`A2:${last}2`);
  ws.mergeCells(`A3:${last}3`);
  const c1 = ws.getCell("A1");
  c1.value = title;
  c1.font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY } };
  c1.alignment = { vertical: "middle", horizontal: "left" };
  const c2 = ws.getCell("A2");
  c2.value = subtitle;
  c2.font = { name: "Calibri", size: 11, bold: true, color: { argb: PRIMARY } };
  c2.alignment = { vertical: "middle", horizontal: "left" };
  const c3 = ws.getCell("A3");
  c3.value = meta;
  c3.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
  c3.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 19;
  ws.getRow(3).height = 28;
  ws.getRow(4).height = 8;
}

function styleHeaderRow(ws: WS, rowNum: number, nCols: number) {
  const row = ws.getRow(rowNum);
  row.height = 24;
  for (let c = 1; c <= nCols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  }
}

function styleDataRows(ws: WS, fromRow: number, toRow: number, nCols: number, opts?: { tall?: boolean }) {
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    if (!row.height || row.height < 18) row.height = opts?.tall ? 30 : 20;
    for (let c = 1; c <= nCols; c++) {
      const cell = row.getCell(c);
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill =
          r % 2 === 0
            ? { type: "pattern", pattern: "solid", fgColor: { argb: BAND } }
            : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      }
      if (!cell.font || !cell.font.size) {
        cell.font = { name: "Calibri", size: 10, color: { argb: INK } };
      }
      if (!cell.alignment || !cell.alignment.horizontal) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
      if (!cell.border) cell.border = THIN_BORDER;
      else {
        // Ensure every side has at least the thin line (pills keep their fill).
        cell.border = { ...THIN_BORDER, ...cell.border };
      }
    }
  }
}

function styleTotalRow(ws: WS, rowNum: number, nCols: number) {
  const row = ws.getRow(rowNum);
  row.height = 22;
  for (let c = 1; c <= nCols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center", wrapText: true };
    cell.border = THIN_BORDER;
  }
}

function addFooterNote(ws: WS, rowNum: number, nCols: number, text: string) {
  const last = colLetter(nCols);
  ws.mergeCells(`A${rowNum}:${last}${rowNum}`);
  const cell = ws.getCell(`A${rowNum}`);
  cell.value = text;
  cell.font = { name: "Calibri", size: 8, italic: true, color: { argb: MUTED } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(rowNum).height = 22;
}

function finalizeSheet(ws: WS, headerRow: number, lastDataRow: number, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  const last = colLetter(widths.length);
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: `A${headerRow}:${last}${headerRow}`, to: `A${headerRow}:${last}${lastDataRow}` };
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
  };
  ws.pageMargins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  ws.printTitleRow = `${headerRow}:${headerRow}`;
  ws.headerFooter = {
    oddHeader: "&\"Calibri,Bold\"&10&K64748B DOrSU Guidance  —  &A",
    oddFooter: "&\"Calibri\"&8&K64748B Page &P of &N",
  };
  ws.sheetProperties = {
    ...(ws.sheetProperties ?? {}),
    pageSetUpPr: { ...((ws.sheetProperties ?? {}).pageSetUpPr ?? {}), fitToPage: true },
  };
}

function pillCell(cell: any, text: string, style: { bg: string; fg: string }) {
  cell.value = text;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bg } };
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: style.fg } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = THIN_BORDER;
}

/** Privacy-safe display name: alias when known, otherwise a masked Student-XXXX code. Never a real name. */
function aliasOrMasked(alias: string | null | undefined, id: string | null | undefined): string {
  if (alias && alias.trim()) return alias.trim();
  const tail = (id ?? "").replace(/-/g, "").slice(0, 4).toUpperCase() || "—";
  return `Student-${tail}`;
}

/* ── Data fetch ── */

async function fetchReportData() {
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
    supabase.from("pss10_assessments").select("band,total_score,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("counselors").select("id,profile_id,specialization,is_available"),
    supabase.from("announcements").select("id,title,published_at,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  if (apptsRes.error) throw new Error("Couldn't load appointments for export.");
  if (refsRes.error) throw new Error("Couldn't load referrals for export.");
  if (feedRes.error) throw new Error("Couldn't load feedback for export.");

  const appointments = (apptsRes.data ?? []) as any[];
  const referrals = (refsRes.data ?? []) as any[];
  const feedback = (feedRes.data ?? []) as any[];
  const pss = ((pssRes.data ?? []) as any[]) ?? [];
  const counselors = ((counselorsRes.data ?? []) as any[]) ?? [];
  const announcements = ((annRes.data ?? []) as any[]) ?? [];

  // Counselor names
  const profileIds = [...new Set(counselors.map((c) => c.profile_id).filter(Boolean))];
  let counselorName = new Map<string, string>();
  let counselorSpec = new Map<string, string | null>();
  let counselorAvail = new Map<string, boolean>();
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

type ReportBundle = Awaited<ReturnType<typeof fetchReportData>>;

/* ── Workbook builder ── */

async function buildWorkbook(bundle: ReportBundle) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const stamp = new Date();
  const stampLabel = stamp.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const fileDay = stamp.toISOString().slice(0, 10);
  wb.creator = "DOrSU Guidance Office";
  wb.company = "DOrSU Guidance";
  wb.created = stamp;
  wb.modified = stamp;

  const { appointments, referrals, feedback, pss, counselors, announcements, counselorName, counselorSpec, counselorAvail, aliasByStudent, office } = bundle;
  const officeLine = office?.name ? `${office.name}${office.location ? ` · ${office.location}` : ""}` : "DOrSU Guidance";
  const meta = `Generated ${stampLabel}  •  ${officeLine}  •  Privacy-safe: student aliases only, never real names`;

  const countBy = (items: any[], pick: (x: any) => string) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = pick(it) ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const totalAppts = appointments.length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const missed = appointments.filter((a) => a.status === "cancelled" || a.status === "rejected" || a.status === "no_show").length;
  const avgRating = feedback.length ? feedback.reduce((a, f) => a + (f.rating ?? 0), 0) / feedback.length : 0;
  const openRefs = referrals.filter((r) => ["pending", "acknowledged", "in_progress", "escalated"].includes(r.status)).length;
  const resolvedRefs = referrals.filter((r) => r.status === "resolved").length;
  const highStress = pss.filter((p) => p.band === "high").length;

  /* — Sheet 1: Cover — */
  {
    const ws: any = wb.addWorksheet("Cover", { properties: { tabColor: { argb: PRIMARY } } });
    ws.getColumn(1).width = 26;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 52;
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true };
    ws.pageMargins = { left: 0.6, right: 0.6, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

    ws.mergeCells("A1:C1");
    ws.getCell("A1").value = officeLine.toUpperCase();
    ws.getCell("A1").font = { name: "Calibri", size: 10, bold: true, color: { argb: PRIMARY } };
    ws.getCell("A1").alignment = { vertical: "middle" };
    ws.getRow(1).height = 18;

    ws.mergeCells("A2:C2");
    ws.getCell("A2").value = "Consolidated Transactions Report";
    ws.getCell("A2").font = { name: "Calibri", size: 22, bold: true, color: { argb: NAVY } };
    ws.getRow(2).height = 32;

    ws.mergeCells("A3:C3");
    ws.getCell("A3").value = "One workbook  •  every admin transaction  •  meeting-ready";
    ws.getCell("A3").font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF334155" } };
    ws.getRow(3).height = 18;

    ws.mergeCells("A4:C4");
    ws.getCell("A4").value = meta;
    ws.getCell("A4").font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
    ws.getCell("A4").alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(4).height = 28;

    let r = 6;
    ws.mergeCells(`A${r}:C${r}`);
    ws.getCell(`A${r}`).value = "WHAT'S INSIDE";
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(r).height = 22;
    r += 1;
    const contents: [string, string, number][] = [
      ["Summary", "KPIs + every breakdown on one page", 0],
      ["Appointments", "Every booked session (date, status, mode, concern, counselor)", appointments.length],
      ["Referrals", "Every referral (status, priority, reason, assignee)", referrals.length],
      ["Feedback", "Every satisfaction rating + comment", feedback.length],
      ["Wellbeing", "Every PSS-10 screening (band + score)", pss.length],
      ["Team", "Counselor workload + availability", counselors.length],
      ["Announcements", "Every office post + publish state", announcements.length],
    ];
    ws.getRow(r).height = 22;
    ["Sheet", "Contents", "Rows"].forEach((h, i) => {
      const c = ws.getRow(r).getCell(i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 9, bold: true, color: { argb: MUTED } };
      c.alignment = { vertical: "middle", horizontal: i === 2 ? "center" : "left" };
      c.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
    r += 1;
    const startContents = r;
    for (const [sheet, desc, n] of contents) {
      ws.getRow(r).height = 20;
      const c0 = ws.getRow(r).getCell(1);
      c0.value = sheet;
      c0.font = { name: "Calibri", size: 10, bold: true, color: { argb: PRIMARY } };
      c0.alignment = { vertical: "middle" };
      ws.getRow(r).getCell(2).value = desc;
      ws.getRow(r).getCell(2).font = { name: "Calibri", size: 10, color: { argb: INK } };
      ws.getRow(r).getCell(2).alignment = { vertical: "middle", wrapText: true };
      const c2 = ws.getRow(r).getCell(3);
      c2.value = sheet === "Summary" ? "—" : n;
      c2.font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
      c2.alignment = { vertical: "middle", horizontal: "center" };
      for (let c = 1; c <= 3; c++) ws.getRow(r).getCell(c).border = THIN_BORDER;
      r += 1;
    }
    styleDataRows(ws, startContents, r - 1, 3);

    r += 1;
    ws.mergeCells(`A${r}:C${r}`);
    ws.getCell(`A${r}`).value = "KEY FIGURES";
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle" };
    ws.getRow(r).height = 22;
    r += 1;
    const kpis: [string, string, string][] = [
      ["Total sessions", String(totalAppts), "All appointments booked"],
      ["Completion rate", pct(completed, totalAppts), `${completed} completed · ${missed} missed`],
      ["Avg. satisfaction", feedback.length ? `${avgRating.toFixed(1)} / 5` : "—", `${feedback.length} responses`],
      ["Open referrals", String(openRefs), "Waiting for action"],
      ["Referrals resolved", pct(resolvedRefs, referrals.length), `${resolvedRefs} of ${referrals.length}`],
      ["High-stress screens", String(highStress), `Of ${pss.length} PSS-10 screenings`],
    ];
    const kpiStart = r;
    for (const [k, v, note] of kpis) {
      ws.getRow(r).height = 20;
      ws.getRow(r).getCell(1).value = k;
      ws.getRow(r).getCell(1).font = { name: "Calibri", size: 10, color: { argb: INK } };
      ws.getRow(r).getCell(2).value = v;
      ws.getRow(r).getCell(2).font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
      ws.getRow(r).getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(r).getCell(3).value = note;
      ws.getRow(r).getCell(3).font = { name: "Calibri", size: 9, color: { argb: MUTED } };
      ws.getRow(r).getCell(3).alignment = { vertical: "middle" };
      for (let c = 1; c <= 3; c++) ws.getRow(r).getCell(c).border = THIN_BORDER;
      r += 1;
    }
    styleDataRows(ws, kpiStart, r - 1, 3);

    r += 1;
    ws.mergeCells(`A${r}:C${r}`);
    ws.getCell(`A${r}`).value =
      "Privacy: aliases only (e.g. Student-A3F9) — no real student names leave the system.  •  Tip: use the header filters + freeze panes on each sheet in meetings.";
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 8, italic: true, color: { argb: MUTED } };
    ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(r).height = 30;
  }

  /* — Sheet 2: Summary — */
  {
    const ws: any = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FF22C55E" } } });
    applyTitleBlock(ws, 4, "Executive summary", "KPIs + breakdowns  •  the one page to project in meetings", meta);
    const headers = ["Section", "Breakdown", "Count", "Share"];
    headers.forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, 4);
    const rows: (string | number)[][] = [];
    rows.push(["Totals", "Appointments", totalAppts, "—"]);
    rows.push(["Totals", "Referrals", referrals.length, "—"]);
    rows.push(["Totals", "Feedback responses", feedback.length, feedback.length ? pct(feedback.length, completed || 1) + " of completed" : "—"]);
    rows.push(["Totals", "PSS-10 screenings", pss.length, "—"]);
    for (const [k, v] of countBy(appointments, (a) => APPT_STATUS[a.status] ?? titleCase(a.status))) {
      rows.push(["Sessions by status", k, v, pct(v, totalAppts)]);
    }
    for (const [k, v] of countBy(appointments, (a) => (a.mode === "in_person" ? "In person" : a.mode === "online" ? "Online" : titleCase(a.mode)))) {
      rows.push(["Sessions by mode", k, v, pct(v, totalAppts)]);
    }
    for (const [k, v] of countBy(referrals, (x) => REF_STATUS[x.status] ?? titleCase(x.status))) {
      rows.push(["Referrals by status", k, v, pct(v, referrals.length)]);
    }
    for (const [k, v] of countBy(referrals, (x) => PRIORITY[x.priority] ?? titleCase(x.priority))) {
      rows.push(["Referrals by priority", k, v, pct(v, referrals.length)]);
    }
    for (const star of [5, 4, 3, 2, 1]) {
      const v = feedback.filter((f) => f.rating === star).length;
      if (feedback.length) rows.push(["Satisfaction", `${star}-star`, v, pct(v, feedback.length)]);
    }
    for (const band of ["low", "moderate", "high"]) {
      const v = pss.filter((p) => p.band === band).length;
      if (pss.length) rows.push(["Stress band (PSS-10)", titleCase(band), v, pct(v, pss.length)]);
    }
    let r = 6;
    for (const row of rows) {
      ws.getRow(r).height = 20;
      row.forEach((val, i) => {
        const c = ws.getRow(r).getCell(i + 1);
        c.value = val;
        c.font = {
          name: "Calibri",
          size: 10,
          bold: i === 0 || i === 2,
          color: { argb: i === 0 ? PRIMARY : INK },
        };
        c.alignment = { vertical: "middle", horizontal: i >= 2 ? "center" : "left", wrapText: true };
      });
      r += 1;
    }
    if (!rows.length) {
      ws.mergeCells(`A6:D6`);
      ws.getCell("A6").value = "No records yet — figures will appear once sessions are booked.";
      ws.getCell("A6").font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
      r = 7;
    }
    styleDataRows(ws, 6, r - 1, 4);
    styleTotalRow(ws, r, 4);
    ws.getCell(r, 1).value = "TOTAL RECORDS";
    ws.getCell(r, 2).value = `${totalAppts + referrals.length + feedback.length + pss.length} rows across all sheets`;
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.getCell(r, 3).value = totalAppts + referrals.length + feedback.length + pss.length;
    ws.getCell(r, 3).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(r, 4).value = "—";
    finalizeSheet(ws, 5, r, [26, 30, 14, 20]);
    addFooterNote(ws, r + 1, 4, "Completion = completed ÷ booked  •  Resolution = resolved ÷ referrals  •  Satisfaction covers respondents only.");
  }

  /* — Sheet 3: Appointments — */
  {
    const ws: any = wb.addWorksheet("Appointments", { properties: { tabColor: { argb: PRIMARY } } });
    const nCols = 7;
    applyTitleBlock(ws, nCols, "Appointments — every session", `${totalAppts} transaction${totalAppts === 1 ? "" : "s"}  •  newest first`, meta);
    ["#", "Date & time", "Status", "Mode", "Concern", "Counselor", "Student"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    let r = 6;
    if (!appointments.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No sessions yet — booked appointments will list here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      appointments.forEach((a, idx) => {
        ws.getRow(r).height = 30;
        const num = ws.getRow(r).getCell(1);
        num.value = idx + 1;
        num.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        num.alignment = { vertical: "middle", horizontal: "center" };
        num.border = THIN_BORDER;

        const d = ws.getRow(r).getCell(2);
        d.value = fmtDateTime(a.scheduled_at);
        d.font = { name: "Calibri", size: 10, color: { argb: INK } };
        d.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        d.border = THIN_BORDER;

        pillCell(ws.getRow(r).getCell(3), APPT_STATUS[a.status] ?? titleCase(a.status), pillStyle("appt", a.status));

        const mode = ws.getRow(r).getCell(4);
        mode.value = a.mode === "in_person" ? "In person" : a.mode === "online" ? "Online" : titleCase(a.mode);
        mode.font = { name: "Calibri", size: 10, color: { argb: INK } };
        mode.alignment = { vertical: "middle", horizontal: "center" };
        mode.border = THIN_BORDER;

        const concern = ws.getRow(r).getCell(5);
        concern.value = (a.concern ?? "—").toString();
        concern.font = { name: "Calibri", size: 10, color: { argb: INK } };
        concern.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        concern.border = THIN_BORDER;

        const coun = ws.getRow(r).getCell(6);
        coun.value = a.counselor_id ? (counselorName.get(a.counselor_id) ?? "Counselor") : "Unassigned";
        coun.font = { name: "Calibri", size: 10, color: { argb: INK } };
        coun.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        coun.border = THIN_BORDER;

        const stu = ws.getRow(r).getCell(7);
        stu.value = aliasOrMasked(aliasByStudent.get(a.student_id), a.student_id);
        stu.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
        stu.alignment = { vertical: "middle", horizontal: "left" };
        stu.border = THIN_BORDER;
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols, { tall: true });
    // Re-apply pills after banding (banding skips cells that already have a fill).
    for (let rr = 6; rr < r; rr++) {
      const a = appointments[rr - 6];
      if (a) pillCell(ws.getRow(rr).getCell(3), APPT_STATUS[a.status] ?? titleCase(a.status), pillStyle("appt", a.status));
    }
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 2).value = `${totalAppts} sessions  •  ${completed} completed (${pct(completed, totalAppts)})  •  ${missed} missed`;
    ws.mergeCells(`B${r}:E${r}`);
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 6).value = "—";
    ws.getCell(r, 7).value = "—";
    finalizeSheet(ws, 5, r, [7, 24, 16, 14, 48, 24, 18]);
    addFooterNote(ws, r + 1, nCols, "Student column shows privacy-safe aliases only.  •  Filter by Status / Mode for meetings; print is set to landscape fit-to-page.");
  }

  /* — Sheet 4: Referrals — */
  {
    const ws: any = wb.addWorksheet("Referrals", { properties: { tabColor: { argb: "FFF59E0B" } } });
    const nCols = 7;
    applyTitleBlock(ws, nCols, "Referrals — every case", `${referrals.length} transaction${referrals.length === 1 ? "" : "s"}  •  newest first`, meta);
    ["#", "Date filed", "Status", "Priority", "Reason", "Assigned to", "Student"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    let r = 6;
    if (!referrals.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No referrals yet — new cases will list here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      referrals.forEach((x, idx) => {
        ws.getRow(r).height = 32;
        const num = ws.getRow(r).getCell(1);
        num.value = idx + 1;
        num.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        num.alignment = { vertical: "middle", horizontal: "center" };
        num.border = THIN_BORDER;

        const d = ws.getRow(r).getCell(2);
        d.value = fmtDay(x.created_at);
        d.font = { name: "Calibri", size: 10, color: { argb: INK } };
        d.alignment = { vertical: "middle", horizontal: "left" };
        d.border = THIN_BORDER;

        pillCell(ws.getRow(r).getCell(3), REF_STATUS[x.status] ?? titleCase(x.status), pillStyle("ref", x.status));
        pillCell(ws.getRow(r).getCell(4), PRIORITY[x.priority] ?? titleCase(x.priority), pillStyle("priority", x.priority));

        const reason = ws.getRow(r).getCell(5);
        reason.value = (x.reason ?? "—").toString();
        reason.font = { name: "Calibri", size: 10, color: { argb: INK } };
        reason.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        reason.border = THIN_BORDER;

        const asg = ws.getRow(r).getCell(6);
        asg.value = x.assigned_counselor_id ? (counselorName.get(x.assigned_counselor_id) ?? "Counselor") : "Unassigned";
        asg.font = { name: "Calibri", size: 10, bold: !x.assigned_counselor_id, color: { argb: x.assigned_counselor_id ? INK : "FF991B1B" } };
        asg.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        asg.border = THIN_BORDER;

        const stu = ws.getRow(r).getCell(7);
        stu.value = aliasOrMasked(aliasByStudent.get(x.student_id), x.student_id);
        stu.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };
        stu.alignment = { vertical: "middle", horizontal: "left" };
        stu.border = THIN_BORDER;
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols, { tall: true });
    for (let rr = 6; rr < r; rr++) {
      const x = referrals[rr - 6];
      if (x) {
        pillCell(ws.getRow(rr).getCell(3), REF_STATUS[x.status] ?? titleCase(x.status), pillStyle("ref", x.status));
        pillCell(ws.getRow(rr).getCell(4), PRIORITY[x.priority] ?? titleCase(x.priority), pillStyle("priority", x.priority));
      }
    }
    const unassigned = referrals.filter((x) => !x.assigned_counselor_id && x.status !== "resolved").length;
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 2).value = `${referrals.length} referrals  •  ${openRefs} open  •  ${unassigned} unassigned`;
    ws.mergeCells(`B${r}:E${r}`);
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 6).value = "—";
    ws.getCell(r, 7).value = "—";
    finalizeSheet(ws, 5, r, [7, 18, 17, 14, 52, 24, 18]);
    addFooterNote(ws, r + 1, nCols, "Triage urgent + high first; keep Unassigned at zero.  •  Escalated rows are highlighted red.");
  }

  /* — Sheet 5: Feedback — */
  {
    const ws: any = wb.addWorksheet("Feedback", { properties: { tabColor: { argb: "FF22C55E" } } });
    const nCols = 5;
    applyTitleBlock(
      ws,
      nCols,
      "Feedback — every rating",
      `${feedback.length} response${feedback.length === 1 ? "" : "s"}${feedback.length ? `  •  avg ${avgRating.toFixed(1)} / 5` : ""}  •  newest first`,
      meta
    );
    ["#", "Date", "Rating", "Stars", "Comment"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    let r = 6;
    if (!feedback.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No ratings yet — student feedback will list here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      feedback.forEach((f, idx) => {
        ws.getRow(r).height = 32;
        const num = ws.getRow(r).getCell(1);
        num.value = idx + 1;
        num.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        num.alignment = { vertical: "middle", horizontal: "center" };
        num.border = THIN_BORDER;

        const d = ws.getRow(r).getCell(2);
        d.value = fmtDay(f.created_at);
        d.font = { name: "Calibri", size: 10, color: { argb: INK } };
        d.alignment = { vertical: "middle", horizontal: "left" };
        d.border = THIN_BORDER;

        const rating = ws.getRow(r).getCell(3);
        rating.value = f.rating;
        const good = (f.rating ?? 0) >= 4;
        const mid = (f.rating ?? 0) === 3;
        rating.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: good ? "FFDCFCE7" : mid ? "FFFEF3C7" : "FFFEE2E2" },
        };
        rating.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: good ? "FF166534" : mid ? "FF92400E" : "FF991B1B" },
        };
        rating.alignment = { vertical: "middle", horizontal: "center" };
        rating.border = THIN_BORDER;

        const stars = ws.getRow(r).getCell(4);
        stars.value = "★".repeat(Math.max(0, Math.min(5, f.rating ?? 0))) + "☆".repeat(Math.max(0, 5 - (f.rating ?? 0)));
        stars.font = { name: "Calibri", size: 11, color: { argb: "FFF59E0B" } };
        stars.alignment = { vertical: "middle", horizontal: "center" };
        stars.border = THIN_BORDER;

        const comment = ws.getRow(r).getCell(5);
        comment.value = (f.comment ?? "").toString().trim() || "—";
        comment.font = { name: "Calibri", size: 10, italic: !(f.comment ?? "").trim(), color: { argb: (f.comment ?? "").trim() ? INK : MUTED } };
        comment.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        comment.border = THIN_BORDER;
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols, { tall: true });
    for (let rr = 6; rr < r; rr++) {
      const f = feedback[rr - 6];
      if (f) {
        const good = (f.rating ?? 0) >= 4;
        const mid = (f.rating ?? 0) === 3;
        const rating = ws.getRow(rr).getCell(3);
        rating.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: good ? "FFDCFCE7" : mid ? "FFFEF3C7" : "FFFEE2E2" },
        };
        rating.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: good ? "FF166534" : mid ? "FF92400E" : "FF991B1B" },
        };
      }
    }
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "AVERAGE";
    ws.getCell(r, 2).value = feedback.length ? `${avgRating.toFixed(1)} / 5 across ${feedback.length} responses` : "No responses yet";
    ws.mergeCells(`B${r}:D${r}`);
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 5).value = feedback.length ? pct(feedback.length, completed || 1) + " coverage" : "—";
    ws.getCell(r, 5).alignment = { vertical: "middle", horizontal: "center" };
    finalizeSheet(ws, 5, r, [7, 18, 12, 14, 70]);
    addFooterNote(ws, r + 1, nCols, "Satisfaction covers respondents only — compare the average against coverage before acting on a dip.");
  }

  /* — Sheet 6: Wellbeing — */
  {
    const ws: any = wb.addWorksheet("Wellbeing", { properties: { tabColor: { argb: "FF8B5CF6" } } });
    const nCols = 5;
    const avgScore = pss.length ? pss.reduce((a, p) => a + (p.total_score ?? 0), 0) / pss.length : 0;
    applyTitleBlock(
      ws,
      nCols,
      "Wellbeing — every PSS-10 screening",
      `${pss.length} screening${pss.length === 1 ? "" : "s"}${pss.length ? `  •  avg ${avgScore.toFixed(1)} / 40` : ""}  •  newest first`,
      meta
    );
    ["#", "Date", "Band", "Score (/40)", "Signal"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    let r = 6;
    if (!pss.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No screenings yet — PSS-10 results will list here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      pss.forEach((p, idx) => {
        ws.getRow(r).height = 20;
        const num = ws.getRow(r).getCell(1);
        num.value = idx + 1;
        num.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        num.alignment = { vertical: "middle", horizontal: "center" };
        num.border = THIN_BORDER;

        const d = ws.getRow(r).getCell(2);
        d.value = fmtDay(p.created_at);
        d.font = { name: "Calibri", size: 10, color: { argb: INK } };
        d.alignment = { vertical: "middle", horizontal: "left" };
        d.border = THIN_BORDER;

        pillCell(ws.getRow(r).getCell(3), titleCase(p.band), pillStyle("band", p.band));

        const score = ws.getRow(r).getCell(4);
        score.value = p.total_score;
        score.font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
        score.alignment = { vertical: "middle", horizontal: "center" };
        score.border = THIN_BORDER;

        const sig = ws.getRow(r).getCell(5);
        sig.value = p.band === "high" ? "Add capacity — follow up" : p.band === "moderate" ? "Monitor" : "Steady";
        sig.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        sig.alignment = { vertical: "middle", horizontal: "left" };
        sig.border = THIN_BORDER;
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols);
    for (let rr = 6; rr < r; rr++) {
      const p = pss[rr - 6];
      if (p) pillCell(ws.getRow(rr).getCell(3), titleCase(p.band), pillStyle("band", p.band));
    }
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 2).value = pss.length ? `${pss.length} screenings  •  ${highStress} high (${pct(highStress, pss.length)})` : "No screenings yet";
    ws.mergeCells(`B${r}:C${r}`);
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 4).value = pss.length ? Number(avgScore.toFixed(1)) : "—";
    ws.getCell(r, 4).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(r, 5).value = "—";
    finalizeSheet(ws, 5, r, [7, 18, 16, 16, 46]);
    addFooterNote(ws, r + 1, nCols, "PSS-10 bands are screening signals, not diagnoses — a rising high share means add capacity, not label students.");
  }

  /* — Sheet 7: Team — */
  {
    const ws: any = wb.addWorksheet("Team", { properties: { tabColor: { argb: "FF0EA5E9" } } });
    const nCols = 7;
    applyTitleBlock(ws, nCols, "Team — counselor workload", `${counselors.length} counselor${counselors.length === 1 ? "" : "s"}  •  ranked by sessions`, meta);
    ["#", "Counselor", "Specialization", "Status", "Sessions", "Completed", "Completion"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    const byCounselor = new Map<string, { total: number; completed: number }>();
    let unassignedSessions = 0;
    for (const a of appointments) {
      if (!a.counselor_id) {
        unassignedSessions += 1;
        continue;
      }
      const e = byCounselor.get(a.counselor_id) ?? { total: 0, completed: 0 };
      e.total += 1;
      if (a.status === "completed") e.completed += 1;
      byCounselor.set(a.counselor_id, e);
    }
    const ranked = counselors
      .map((c) => ({
        id: c.id,
        name: counselorName.get(c.id) ?? "Counselor",
        spec: counselorSpec.get(c.id) ?? "—",
        avail: counselorAvail.get(c.id) ?? false,
        total: byCounselor.get(c.id)?.total ?? 0,
        completed: byCounselor.get(c.id)?.completed ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
    let r = 6;
    if (!ranked.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No counselors yet — add the team and workload will rank here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      ranked.forEach((c, idx) => {
        ws.getRow(r).height = 22;
        const cells: (string | number)[] = [
          idx + 1,
          c.name,
          c.spec || "—",
          c.avail ? "Available" : "Off",
          c.total,
          c.completed,
          pct(c.completed, c.total),
        ];
        cells.forEach((val, i) => {
          const cell = ws.getRow(r).getCell(i + 1);
          cell.value = val;
          cell.font = { name: "Calibri", size: 10, bold: i === 1 || i >= 4, color: { argb: INK } };
          cell.alignment = { vertical: "middle", horizontal: i === 0 || i >= 3 ? "center" : "left", wrapText: true };
          cell.border = THIN_BORDER;
        });
        const st = ws.getRow(r).getCell(4);
        st.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: c.avail ? "FFDCFCE7" : "FFFEF3C7" },
        };
        st.font = { name: "Calibri", size: 10, bold: true, color: { argb: c.avail ? "FF166534" : "FF92400E" } };
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols);
    for (let rr = 6; rr < r; rr++) {
      const c = ranked[rr - 6];
      if (c) {
        const st = ws.getRow(rr).getCell(4);
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.avail ? "FFDCFCE7" : "FFFEF3C7" } };
        st.font = { name: "Calibri", size: 10, bold: true, color: { argb: c.avail ? "FF166534" : "FF92400E" } };
        st.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 2).value = `${counselors.length} counselors${unassignedSessions ? `  •  ${unassignedSessions} unassigned session${unassignedSessions === 1 ? "" : "s"}` : ""}`;
    ws.mergeCells(`B${r}:D${r}`);
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 5).value = totalAppts;
    ws.getCell(r, 5).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(r, 6).value = completed;
    ws.getCell(r, 6).alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell(r, 7).value = pct(completed, totalAppts);
    ws.getCell(r, 7).alignment = { vertical: "middle", horizontal: "center" };
    finalizeSheet(ws, 5, r, [7, 28, 30, 16, 14, 14, 16]);
    addFooterNote(ws, r + 1, nCols, "Rebalance when one lane overloads — keep unassigned sessions at zero.");
  }

  /* — Sheet 8: Announcements — */
  {
    const ws: any = wb.addWorksheet("Announcements", { properties: { tabColor: { argb: "FF64748B" } } });
    const nCols = 5;
    applyTitleBlock(ws, nCols, "Announcements — every post", `${announcements.length} post${announcements.length === 1 ? "" : "s"}  •  newest first`, meta);
    ["#", "Title", "State", "Published", "Created"].forEach((h, i) => (ws.getCell(5, i + 1).value = h));
    styleHeaderRow(ws, 5, nCols);
    let r = 6;
    if (!announcements.length) {
      ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
      ws.getCell(`A${r}`).value = "No posts yet — published announcements will list here.";
      ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 22;
      r += 1;
    } else {
      announcements.forEach((a, idx) => {
        ws.getRow(r).height = 24;
        const num = ws.getRow(r).getCell(1);
        num.value = idx + 1;
        num.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
        num.alignment = { vertical: "middle", horizontal: "center" };
        num.border = THIN_BORDER;

        const title = ws.getRow(r).getCell(2);
        title.value = (a.title ?? "—").toString();
        title.font = { name: "Calibri", size: 10, bold: true, color: { argb: INK } };
        title.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        title.border = THIN_BORDER;

        const live = !!a.published_at && new Date(a.published_at).getTime() <= Date.now();
        const st = ws.getRow(r).getCell(3);
        st.value = live ? "Live" : a.published_at ? "Scheduled" : "Draft";
        st.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: live ? "FFDCFCE7" : a.published_at ? "FFDBEAFE" : "FFF1F5F9" },
        };
        st.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: live ? "FF166534" : a.published_at ? "FF1E40AF" : "FF475569" },
        };
        st.alignment = { vertical: "middle", horizontal: "center" };
        st.border = THIN_BORDER;

        const pub = ws.getRow(r).getCell(4);
        pub.value = a.published_at ? fmtDay(a.published_at) : "—";
        pub.font = { name: "Calibri", size: 10, color: { argb: INK } };
        pub.alignment = { vertical: "middle", horizontal: "left" };
        pub.border = THIN_BORDER;

        const cre = ws.getRow(r).getCell(5);
        cre.value = fmtDay(a.created_at);
        cre.font = { name: "Calibri", size: 10, color: { argb: INK } };
        cre.alignment = { vertical: "middle", horizontal: "left" };
        cre.border = THIN_BORDER;
        r += 1;
      });
    }
    styleDataRows(ws, 6, r - 1, nCols);
    for (let rr = 6; rr < r; rr++) {
      const a = announcements[rr - 6];
      if (a) {
        const live = !!a.published_at && new Date(a.published_at).getTime() <= Date.now();
        const st = ws.getRow(rr).getCell(3);
        st.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: live ? "FFDCFCE7" : a.published_at ? "FFDBEAFE" : "FFF1F5F9" },
        };
        st.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: live ? "FF166534" : a.published_at ? "FF1E40AF" : "FF475569" },
        };
        st.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
    styleTotalRow(ws, r, nCols);
    ws.getCell(r, 1).value = "TOTAL";
    ws.getCell(r, 2).value = `${announcements.length} posts`;
    ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "left" };
    ws.getCell(r, 3).value = "—";
    ws.getCell(r, 4).value = "—";
    ws.getCell(r, 5).value = "—";
    finalizeSheet(ws, 5, r, [7, 56, 16, 20, 20]);
    addFooterNote(ws, r + 1, nCols, "Live = published_at is set and in the past.");
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, fileDay };
}

/* ── Buttons ── */

/** Export the whole office as one styled multi-sheet Excel workbook (replaces the old flat CSV). */
export function ExportReportsButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const bundle = await fetchReportData();
          const { buffer, fileDay } = await buildWorkbook(bundle);
          const blob = new Blob([buffer as unknown as BlobPart], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `DOrSU-Guidance-Report-${fileDay}.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast.success("Workbook downloaded — 8 sheets, print-ready.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't build the workbook — please try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-4 py-1.5 text-[13px] font-bold text-ink transition hover:border-primary-400 disabled:opacity-50"
    >
      {busy ? "Building workbook…" : "Export Excel"}
    </button>
  );
}

/** Print / save-as-PDF via the browser print dialog. */
export function PrintReportsButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-1.5 text-[13px] font-bold text-white shadow-soft transition hover:bg-primary-700"
    >
      Print report
    </button>
  );
}
