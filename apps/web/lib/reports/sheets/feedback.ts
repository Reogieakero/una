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
import { fmtDay, pct } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildFeedbackSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { feedback } = bundle;
  const { meta, completed, avgRating } = ctx;

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
