/* Brand / palette (matches the app: navy ink + primary blue) */

export const NAVY = "FF1E3A5F";
export const PRIMARY = "FF2563EB";
export const INK = "FF0F172A";
export const MUTED = "FF64748B";
export const LINE = "FFE2E8F0";
export const BAND = "FFF8FAFC";
export const TOTAL_BG = "FFDBEAFE";

export const THIN_BORDER = {
  top: { style: "thin" as const, color: { argb: LINE } },
  left: { style: "thin" as const, color: { argb: LINE } },
  bottom: { style: "thin" as const, color: { argb: LINE } },
  right: { style: "thin" as const, color: { argb: LINE } },
};

export type PillKind = "appt" | "ref" | "priority" | "band";

/** Pill-like fill for a status / priority / band value (pro touch, still prints well). */
export function pillStyle(kind: PillKind, raw: string) {
  const v = (raw ?? "").toLowerCase();
  if (kind === "appt") {
    if (v === "completed") return { bg: "FFDCFCE7", fg: "FF166534" };
    if (v === "confirmed" || v === "assigned") return { bg: "FFDBEAFE", fg: "FF1E40AF" };
    if (v === "pending") return { bg: "FFFEF3C7", fg: "FF92400E" };
    return { bg: "FFFEE2E2", fg: "FF991B1B" }; // cancelled / rejected / no-show
  }
  if (kind === "ref") {
    if (v === "resolved") return { bg: "FFDCFCE7", fg: "FF166534" };
    if (v === "escalated" || v === "rejected") return { bg: "FFFEE2E2", fg: "FF991B1B" };
    if (v === "pending") return { bg: "FFFEF3C7", fg: "FF92400E" };
    return { bg: "FFDBEAFE", fg: "FF1E40AF" }; // assigned / acknowledged / in_progress / confirmed
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

export type WS = any;

export function colLetter(n: number): string {
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
export function applyTitleBlock(ws: WS, nCols: number, title: string, subtitle: string, meta: string) {
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

export function styleHeaderRow(ws: WS, rowNum: number, nCols: number) {
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

export function styleDataRows(ws: WS, fromRow: number, toRow: number, nCols: number, opts?: { tall?: boolean }) {
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

export function styleTotalRow(ws: WS, rowNum: number, nCols: number) {
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

export function addFooterNote(ws: WS, rowNum: number, nCols: number, text: string) {
  const last = colLetter(nCols);
  ws.mergeCells(`A${rowNum}:${last}${rowNum}`);
  const cell = ws.getCell(`A${rowNum}`);
  cell.value = text;
  cell.font = { name: "Calibri", size: 8, italic: true, color: { argb: MUTED } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(rowNum).height = 22;
}

export function finalizeSheet(ws: WS, headerRow: number, lastDataRow: number, widths: number[]) {
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

export function pillCell(cell: any, text: string, style: { bg: string; fg: string }) {
  cell.value = text;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bg } };
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: style.fg } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = THIN_BORDER;
}
