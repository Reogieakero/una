import {
  INK,
  MUTED,
  THIN_BORDER,
  addFooterNote,
  applyTitleBlock,
  colLetter,
  finalizeSheet,
  pillCell,
  pillStyle,
  styleDataRows,
  styleHeaderRow,
  styleTotalRow,
} from "../export-styles";
import { PRIORITY, REF_STATUS, aliasOrMasked, fmtDay, titleCase } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildReferralsSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { referrals, counselorName, aliasByStudent } = bundle;
  const { meta, openRefs } = ctx;

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
  const unassigned = referrals.filter((x) => !x.assigned_counselor_id && !["resolved", "rejected"].includes(x.status)).length;
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
