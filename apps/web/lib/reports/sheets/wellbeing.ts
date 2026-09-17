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
import { fmtDay, pct, titleCase } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildWellbeingSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { pss } = bundle;
  const { meta, highStress } = ctx;

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
