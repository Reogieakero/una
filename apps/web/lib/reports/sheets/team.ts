import {
  INK,
  MUTED,
  THIN_BORDER,
  addFooterNote,
  applyTitleBlock,
  colLetter,
  finalizeSheet,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
} from "../export-styles";
import { pct } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildTeamSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { appointments, counselors, counselorName, counselorSpec, counselorAvail } = bundle;
  const { meta, personal, totalAppts, completed } = ctx;

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
  // Personal workbook: only my row (other counselors had no rows in the
  // already-filtered appointments, so they'd all show zero).
  const teamRows = personal ? ranked.filter((c) => c.total > 0) : ranked;
  let r = 6;
  if (!teamRows.length) {
    ws.mergeCells(`A${r}:${colLetter(nCols)}${r}`);
    ws.getCell(`A${r}`).value = "No counselors yet — add the team and workload will rank here.";
    ws.getCell(`A${r}`).font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
    ws.getCell(`A${r}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = 22;
    r += 1;
  } else {
    teamRows.forEach((c, idx) => {
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
    const c = teamRows[rr - 6];
    if (c) {
      const st = ws.getRow(rr).getCell(4);
      st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.avail ? "FFDCFCE7" : "FFFEF3C7" } };
      st.font = { name: "Calibri", size: 10, bold: true, color: { argb: c.avail ? "FF166534" : "FF92400E" } };
      st.alignment = { vertical: "middle", horizontal: "center" };
    }
  }
  styleTotalRow(ws, r, nCols);
  ws.getCell(r, 1).value = "TOTAL";
  ws.getCell(r, 2).value = personal
    ? `My sessions${unassignedSessions ? `  •  ${unassignedSessions} unassigned` : ""}`
    : `${counselors.length} counselors${unassignedSessions ? `  •  ${unassignedSessions} unassigned session${unassignedSessions === 1 ? "" : "s"}` : ""}`;
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
