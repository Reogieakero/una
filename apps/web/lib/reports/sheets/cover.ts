import { INK, LINE, MUTED, NAVY, PRIMARY, THIN_BORDER, styleDataRows } from "../export-styles";
import { pct } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildCoverSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { appointments, referrals, feedback, pss, counselors, announcements } = bundle;
  const { meta, officeLine, personal, totalAppts, completed, missed, avgRating, openRefs, resolvedRefs, highStress } = ctx;

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
  ws.getCell("A2").value = personal ? "My Transactions Report" : "Consolidated Transactions Report";
  ws.getCell("A2").font = { name: "Calibri", size: 22, bold: true, color: { argb: NAVY } };
  ws.getRow(2).height = 32;

  ws.mergeCells("A3:C3");
  ws.getCell("A3").value = personal
    ? "One workbook  •  my sessions, referrals & outcomes  •  meeting-ready"
    : "One workbook  •  every admin transaction  •  meeting-ready";
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
