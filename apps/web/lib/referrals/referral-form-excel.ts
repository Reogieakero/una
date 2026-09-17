/* Filled Counseling Referral Form (FM-DOrSU-GCTC-02) workbook builder.
 * Client-safe: exceljs is dynamically imported so it never lands in the
 * initial bundle (same pattern as lib/reports/workbook).
 *
 * Layout mirrors scripts/generate-referral-template.mjs exactly — same
 * merges, rows, fonts, and underlines — with faculty-entered values written
 * into the input cells. Every value cell uses the same Times New Roman 11
 * face and vertical-middle alignment as its label, so label and filled text
 * always share one horizontal baseline.
 */

/** Shared download/print basename: Counseling-Referral-Form-<student>-<day>. */
export function referralFileBase(studentName: string, when: Date = new Date()): string {
  const safe = (studentName || "student").replace(/[^\w\-]+/g, "_").slice(0, 40) || "student";
  return `Counseling-Referral-Form-${safe}-${when.toISOString().slice(0, 10)}`;
}

export type ReferralExcelData = {
  studentName: string;
  studentNo: string;
  /** e.g. "Sep 18, 2026" */
  dateLabel: string;
  gender: string;
  age: string;
  courseYear: string;
  relation: string;
  /** Official classification names, e.g. "Behavioral", "Others". */
  classifications: string[];
  classificationOther: string;
  remarks: string;
  referrerName: string;
  /** Raw PNG bytes as base64 (no data: prefix). Logo is skipped when absent. */
  logoBase64?: string | null;
};

const NAVY = "FF1E3A5F";
const BLUE = "FF1F4E79";
const BLACK = "FF000000";
const SERIF = "Times New Roman";
const SANS = "Arial";

const thinBlack = { style: "thin", color: { argb: BLACK } };
const thinNavy = { style: "thin", color: { argb: NAVY } };

const LEFT_CASES = ["Behavioral", "Relational", "Financial", "Absenteeism"];
const RIGHT_CASES = ["Social Adjustment", "Academic-related", "Health", "Others"];

type WS = any;

function setBottomUnderline(ws: WS, row: number, colStart: number, colEnd: number) {
  for (let c = colStart; c <= colEnd; c++) {
    const cell = ws.getRow(row).getCell(c);
    cell.border = { ...cell.border, bottom: thinBlack };
  }
}

/** Value face — identical metrics to the labels so both share one baseline. */
function valueFont() {
  return { name: SERIF, size: 11, color: { argb: BLACK } };
}

/** Write a filled value into the master cell of an input merge. */
function fillCell(ws: WS, addr: string, text: string, horizontal: "left" | "center" = "left") {
  const cell = ws.getCell(addr);
  cell.value = text || "";
  cell.font = valueFont();
  cell.alignment = { vertical: "middle", horizontal, wrapText: false };
  return cell;
}

/** PNG width/height from the IHDR chunk (base64 without prefix). */
function pngDims(b64: string): { w: number; h: number } | null {
  try {
    const bin = atob(b64.slice(0, 32));
    const bytes = Array.from(bin, (ch) => ch.charCodeAt(0));
    if (bytes.length < 24) return null;
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
    const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (!w || !h) return null;
    return { w, h };
  } catch {
    return null;
  }
}

/** Pack remarks into at most maxLines display lines (~100 chars each). Shared
 *  with the on-screen Excel preview so both break lines identically. */
export function packRemarkLines(text: string, maxLines: number, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
    } else {
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (next.length > maxChars && cur) {
          out.push(cur);
          cur = w;
        } else {
          cur = next;
        }
      }
      out.push(cur);
    }
    if (out.length >= maxLines) break;
  }
  return out.slice(0, maxLines);
}

export async function buildFilledReferralWorkbook(data: ReferralExcelData): Promise<{
  buffer: ArrayBuffer;
  fileName: string;
}> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const stamp = new Date();
  wb.creator = "DOrSU Guidance Office";
  wb.company = "Davao Oriental State University";
  wb.created = stamp;
  wb.modified = stamp;

  const ws: WS = wb.addWorksheet("Counseling Referral Form", {
    properties: { tabColor: { argb: NAVY } },
  });
  ws.pageSetup = {
    paperSize: 1,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
  };

  for (let i = 1; i <= 20; i++) ws.getColumn(i).width = 5.4;

  ws.views = [{ showGridLines: false }];
  ws.pageMargins = { left: 0.45, right: 0.45, top: 0.45, bottom: 0.45, header: 0.25, footer: 0.25 };
  ws.headerFooter = {
    oddHeader: `&"${SANS}"&8&K64748B DOrSU Guidance  —  Counseling Referral Form (FM-DOrSU-GCTC-02)`,
    oddFooter: `&"${SANS}"&8&K64748B Page &P of &N`,
  };
  ws.sheetProperties = {
    ...(ws.sheetProperties ?? {}),
    pageSetUpPr: { ...((ws.sheetProperties ?? {}).pageSetUpPr ?? {}), fitToPage: true },
  };
  ws.printArea = "A1:T33";

  ws.getRow(1).height = 8;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 15;
  ws.getRow(5).height = 14;
  ws.getRow(6).height = 10;
  ws.getRow(7).height = 27;
  ws.getRow(8).height = 8;

  // ── Header: university name (A2:I4, left) ──
  ws.mergeCells("A2:I2");
  ws.mergeCells("A3:I3");
  ws.mergeCells("A4:I4");
  const u1 = ws.getCell("A2");
  u1.value = "DAVAO ORIENTAL";
  u1.font = { name: SANS, size: 17, bold: true, color: { argb: BLUE } };
  u1.alignment = { vertical: "bottom", horizontal: "left" };
  const u2 = ws.getCell("A3");
  u2.value = "STATE UNIVERSITY";
  u2.font = { name: SANS, size: 17, bold: true, color: { argb: BLUE } };
  u2.alignment = { vertical: "top", horizontal: "left" };
  const u3 = ws.getCell("A4");
  u3.value = '"A University of excellence, innovation, and inclusion"';
  u3.font = { name: SANS, size: 9, italic: true, color: { argb: BLUE } };
  u3.alignment = { vertical: "middle", horizontal: "left" };

  // ── Header: seal logo (J2:K4 — page top-center), aspect-fit, never stretched ──
  ws.mergeCells("J2:K4");
  const seal = ws.getCell("J2");
  seal.value = null;
  seal.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  if (data.logoBase64) {
    const dims = pngDims(data.logoBase64);
    const imageId = wb.addImage({ base64: data.logoBase64, extension: "png" });
    if (dims) {
      const COL_PX = 5.4 * 7 + 5;
      const rangeW = (11 - 9) * COL_PX;
      const rangeH = (ws.getRow(2).height + ws.getRow(3).height + ws.getRow(4).height) * (96 / 72);
      const s = Math.min(rangeW / dims.w, rangeH / dims.h);
      const w = Math.max(1, Math.round(dims.w * s));
      const h = Math.max(1, Math.round(dims.h * s));
      ws.addImage(imageId, {
        tl: { col: 9 + (rangeW - w) / 2 / COL_PX, row: 1 },
        ext: { width: w, height: h },
        editAs: "oneCell",
      });
    } else {
      ws.addImage(imageId, { tl: { col: 9, row: 1 }, br: { col: 11, row: 4 }, editAs: "oneCell" });
    }
  }

  // Navy rules above/below the name block — shortened to the text width.
  for (let c = 1; c <= 9; c++) {
    const top = ws.getRow(2).getCell(c);
    top.border = { ...top.border, top: { style: "medium", color: { argb: BLUE } } };
    const bot = ws.getRow(4).getCell(c);
    bot.border = { ...bot.border, bottom: { style: "medium", color: { argb: BLUE } } };
  }

  // ── Header: document code box (O2:T5, right) ──
  ws.mergeCells("O2:T2");
  ws.mergeCells("O3:T3");
  const docLabel = ws.getCell("O2");
  docLabel.value = "Document Code No.";
  docLabel.font = { name: SANS, size: 7, color: { argb: "FFFFFFFF" } };
  docLabel.alignment = { vertical: "middle", horizontal: "center" };
  docLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  const docCode = ws.getCell("O3");
  docCode.value = "FM-DOrSU-GCTC-02";
  docCode.font = { name: SANS, size: 10, bold: true, color: { argb: NAVY } };
  docCode.alignment = { vertical: "middle", horizontal: "center" };
  ws.mergeCells("Q4:R4");
  ws.mergeCells("S4:T4");
  ws.mergeCells("Q5:R5");
  ws.mergeCells("S5:T5");
  const subLabels: Array<[string, string]> = [
    ["O4", "Issue Status"],
    ["P4", "Rev No."],
    ["Q4", "Effective Date"],
    ["S4", "Page"],
  ];
  for (const [addr, text] of subLabels) {
    const c = ws.getCell(addr);
    c.value = text;
    c.font = { name: SANS, size: 6, color: { argb: "FFFFFFFF" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  }
  const subValues: Array<[string, string]> = [
    ["O5", "01"],
    ["P5", "00"],
    ["Q5", "07.22.2022"],
    ["S5", "1 of 1"],
  ];
  for (const [addr, text] of subValues) {
    const c = ws.getCell(addr);
    c.value = text;
    c.font = { name: SANS, size: 8, color: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  }
  for (let r = 2; r <= 5; r++) {
    for (let c = 15; c <= 20; c++) {
      const cell = ws.getRow(r).getCell(c);
      const b = cell.border ?? {};
      cell.border = {
        top: b.top ?? thinNavy,
        left: b.left ?? thinNavy,
        bottom: b.bottom ?? thinNavy,
        right: b.right ?? thinNavy,
      };
    }
  }
  ws.getRow(4).height = 14;
  ws.getRow(5).height = 12;

  // ── Title ──
  ws.mergeCells("A7:T7");
  const title = ws.getCell("A7");
  title.value = "COUNSELING REFERRAL FORM";
  title.font = { name: SERIF, size: 16, bold: true, color: { argb: BLUE } };
  title.alignment = { vertical: "middle", horizontal: "center" };

  // ── Student info (labels + filled values share one horizontal baseline) ──
  const labelFont = { name: SERIF, size: 11, color: { argb: BLACK } };

  ws.getRow(9).height = 20;
  ws.getCell("R9").value = "Date:";
  ws.getCell("R9").font = labelFont;
  ws.getCell("R9").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("S9:T9");
  fillCell(ws, "S9", data.dateLabel);
  setBottomUnderline(ws, 9, 19, 20);

  ws.getRow(10).height = 20;
  ws.mergeCells("A10:C10");
  ws.getCell("A10").value = "Name of Student:";
  ws.getCell("A10").font = labelFont;
  ws.getCell("A10").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("D10:J10");
  fillCell(ws, "D10", data.studentName);
  setBottomUnderline(ws, 10, 4, 10);
  ws.mergeCells("K10:M10");
  ws.getCell("K10").value = "I.D. Number:";
  ws.getCell("K10").font = labelFont;
  ws.getCell("K10").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("N10:T10");
  fillCell(ws, "N10", data.studentNo);
  setBottomUnderline(ws, 10, 14, 20);

  ws.getRow(11).height = 20;
  ws.mergeCells("A11:B11");
  ws.getCell("A11").value = "Gender:";
  ws.getCell("A11").font = labelFont;
  ws.getCell("A11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("C11:F11");
  fillCell(ws, "C11", data.gender);
  setBottomUnderline(ws, 11, 3, 6);
  ws.getCell("G11").value = "Age:";
  ws.getCell("G11").font = labelFont;
  ws.getCell("G11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("H11:K11");
  fillCell(ws, "H11", data.age);
  setBottomUnderline(ws, 11, 8, 11);
  ws.mergeCells("L11:N11");
  ws.getCell("L11").value = "Course & Year:";
  ws.getCell("L11").font = labelFont;
  ws.getCell("L11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("O11:T11");
  fillCell(ws, "O11", data.courseYear);
  setBottomUnderline(ws, 11, 15, 20);

  ws.getRow(12).height = 20;
  ws.mergeCells("A12:D12");
  ws.getCell("A12").value = "Relation to the client:";
  ws.getCell("A12").font = labelFont;
  ws.getCell("A12").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("E12:T12");
  fillCell(ws, "E12", data.relation);
  setBottomUnderline(ws, 12, 5, 20);

  ws.getRow(13).height = 10;

  // ── Case Classification (checked boxes match the faculty's picks) ──
  ws.getRow(14).height = 18;
  ws.mergeCells("A14:F14");
  ws.getCell("A14").value = "Case Classification:";
  ws.getCell("A14").font = { name: SERIF, size: 11, bold: true, color: { argb: BLACK } };
  ws.getCell("A14").alignment = { vertical: "middle", horizontal: "left" };

  const boxFont = { name: SANS, size: 13, color: { argb: BLACK } };
  const optFont = { name: SERIF, size: 11, color: { argb: BLACK } };
  const picked = new Set((data.classifications ?? []).map((c) => c.trim()).filter(Boolean));
  const rows: Array<[number, string, string]> = [
    [15, LEFT_CASES[0], RIGHT_CASES[0]],
    [16, LEFT_CASES[1], RIGHT_CASES[1]],
    [17, LEFT_CASES[2], RIGHT_CASES[2]],
    [18, LEFT_CASES[3], RIGHT_CASES[3]],
  ];
  for (const [r, left, right] of rows) {
    ws.getRow(r).height = 19;
    const lb = ws.getCell(`A${r}`);
    lb.value = picked.has(left) ? "☑" : "☐";
    lb.font = boxFont;
    lb.alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = left;
    ws.getCell(`B${r}`).font = optFont;
    ws.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "left" };
    const rb = ws.getCell(`G${r}`);
    const rightKey = right === "Others" ? "Others" : right;
    rb.value = picked.has(rightKey) ? "☑" : "☐";
    rb.font = boxFont;
    rb.alignment = { vertical: "middle", horizontal: "center" };
    if (r === 18) {
      ws.mergeCells(`H${r}:K${r}`);
      ws.getCell(`H${r}`).value = "Others please specify:";
      ws.getCell(`H${r}`).font = optFont;
      ws.getCell(`H${r}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(`L${r}:O${r}`);
      if (picked.has("Others")) fillCell(ws, `L${r}`, data.classificationOther);
      setBottomUnderline(ws, r, 12, 15);
    } else {
      ws.mergeCells(`H${r}:T${r}`);
      ws.getCell(`H${r}`).value = right;
      ws.getCell(`H${r}`).font = optFont;
      ws.getCell(`H${r}`).alignment = { vertical: "middle", horizontal: "left" };
    }
  }

  ws.getRow(19).height = 8;

  // ── Remarks (packed across the 7 ruled lines) ──
  ws.getRow(20).height = 18;
  ws.mergeCells("A20:C20");
  ws.getCell("A20").value = "REMARKS:";
  ws.getCell("A20").font = { name: SERIF, size: 11, bold: true, color: { argb: BLACK } };
  ws.getCell("A20").alignment = { vertical: "middle", horizontal: "left" };

  const lines = packRemarkLines(data.remarks, 7, 100);
  for (let i = 0; i < 7; i++) {
    const r = 21 + i;
    ws.getRow(r).height = 24;
    ws.mergeCells(`A${r}:T${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = lines[i] ?? "";
    c.font = valueFont();
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    setBottomUnderline(ws, r, 1, 20);
  }

  ws.getRow(28).height = 14;

  // ── Signature (bottom-right) ──
  ws.getRow(29).height = 20;
  ws.getRow(30).height = 22;
  ws.mergeCells("L30:S30");
  fillCell(ws, "L30", data.referrerName, "center");
  setBottomUnderline(ws, 30, 12, 19);
  ws.getRow(31).height = 16;
  ws.mergeCells("L31:S31");
  const sig = ws.getCell("L31");
  sig.value = "Referrer's Name and Signature";
  sig.font = { name: SERIF, size: 10, italic: true, color: { argb: BLACK } };
  sig.alignment = { vertical: "top", horizontal: "center" };

  for (let r = 15; r <= 18; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"☐,☑"'],
      showDropDown: false,
      showErrorMessage: false,
    };
    ws.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"☐,☑"'],
      showDropDown: false,
      showErrorMessage: false,
    };
  }

  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 8 }];

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  return { buffer, fileName: `${referralFileBase(data.studentName, stamp)}.xlsx` };
}
