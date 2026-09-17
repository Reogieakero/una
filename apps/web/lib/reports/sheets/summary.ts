import {
  INK,
  MUTED,
  PRIMARY,
  applyTitleBlock,
  addFooterNote,
  finalizeSheet,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
} from "../export-styles";
import { APPT_STATUS, PRIORITY, REF_STATUS, countBy, pct, titleCase } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildSummarySheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { appointments, referrals, feedback, pss } = bundle;
  const { meta, totalAppts, completed } = ctx;

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
