import {
  INK,
  MUTED,
  PRIMARY,
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
import { APPT_STATUS, aliasOrMasked, fmtDateTime, pct, titleCase } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildAppointmentsSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { appointments, counselorName, aliasByStudent } = bundle;
  const { meta, totalAppts, completed, missed } = ctx;

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
