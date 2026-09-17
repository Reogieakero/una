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
import { fmtDay } from "../export-mappers";
import type { ReportBundle, SheetContext } from "../types";

export function buildAnnouncementsSheet(wb: any, bundle: ReportBundle, ctx: SheetContext) {
  const { announcements } = bundle;
  const { meta } = ctx;

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
