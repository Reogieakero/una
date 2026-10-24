import {
  INK,
  MUTED,
  PRIMARY,
  addFooterNote,
  applyTitleBlock,
  finalizeSheet,
  styleDataRows,
  styleHeaderRow,
} from "../export-styles";
import { MIN_CELL, suppressCount } from "../suppression";
import type { ReportBundle, SheetContext } from "../types";

/**
 * Head-only quality + trend sheet (00071). Small cells are withheld exactly
 * as on screen: a band count below MIN_CELL becomes "<5" rather than a number.
 */
export function buildQualitySheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const trends = bundle.trends ?? [];
  const quality = bundle.quality ?? null;
  if (!trends.length && !quality) return;

  const ws: any = wb.addWorksheet("Quality & trends", { properties: { tabColor: { argb: "FF9333EA" } } });
  applyTitleBlock(
    ws,
    5,
    "Data quality and wellbeing trends",
    "Head-only aggregates — no students, aliases, or note text",
    ctx.meta
  );

  let row = 5;
  const cell = (r: number, c: number, value: string | number, bold = false) => {
    const target = ws.getRow(r).getCell(c);
    target.value = value;
    target.font = { name: "Calibri", size: 10, bold, color: { argb: bold ? INK : MUTED } };
    target.alignment = { vertical: "middle", horizontal: typeof value === "number" ? "center" : "left", wrapText: true };
  };

  if (quality) {
    cell(row, 1, "Data quality", true);
    row += 1;
    const metrics: [string, string][] = [
      ["Completed sessions", String(quality.completed_sessions)],
      ["Completed without a note", String(quality.completed_without_note)],
      ["Screenings not linked to a session", String(quality.screenings_unlinked)],
      ["Open referrals without a counselor", String(quality.referrals_unassigned)],
      ["Feedback responses", String(quality.feedback_responses)],
      ["Feedback coverage", quality.feedback_coverage == null ? "—" : `${quality.feedback_coverage}%`],
      ["Latest daily summary", quality.summary_last_day ?? "Never"],
      ["Daily summary age (days)", quality.summary_age_days == null ? "—" : String(quality.summary_age_days)],
    ];
    for (const [label, value] of metrics) {
      cell(row, 1, label);
      cell(row, 2, value, true);
      row += 1;
    }
    row += 1;
  }

  if (trends.length) {
    cell(row, 1, `Wellbeing trend (band cells < ${MIN_CELL} withheld)`, true);
    row += 1;
    const headers = ["Day", "Screenings", "Low", "Moderate", "High", "Average"];
    headers.forEach((h, i) => (ws.getCell(row, i + 1).value = h));
    styleHeaderRow(ws, row, headers.length);
    const start = row + 1;
    row = start;
    for (const t of trends) {
      ws.getRow(row).height = 18;
      cell(row, 1, t.day);
      cell(row, 2, t.screenings, true);
      cell(row, 3, suppressCount(t.low) ?? `<${MIN_CELL}`);
      cell(row, 4, suppressCount(t.moderate) ?? `<${MIN_CELL}`);
      cell(row, 5, suppressCount(t.high) ?? `<${MIN_CELL}`);
      cell(row, 6, t.avg_score ?? "—");
      row += 1;
    }
    styleDataRows(ws, start, row - 1, headers.length);
    finalizeSheet(ws, 5, row - 1, [34, 22, 12, 14, 12, 14]);
  } else {
    finalizeSheet(ws, 5, row - 1, [34, 30]);
  }

  addFooterNote(
    ws,
    row + 1,
    5,
    `Suppression: cells with 1–${MIN_CELL - 1} records are hidden so a count cannot identify a student.`
  );
}
