/* Counseling Referral Form — Excel template generator (matches public/image.png)
 * Run: node scripts/generate-referral-template.mjs [output.xlsx]
 * Requires: exceljs (already in apps/web dependencies)
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outArg = process.argv[2];
const OUT = outArg
  ? path.resolve(process.cwd(), outArg)
  : path.resolve(__dirname, "../../../public/Counseling-Referral-Form-Template.xlsx");

const NAVY = "FF1E3A5F";
const BLUE = "FF1F4E79";
const BLACK = "FF000000";
const MUTED = "FF64748B";

const SERIF = "Times New Roman";
const SANS = "Arial";

const thinBlack = { style: "thin", color: { argb: BLACK } };
const thinNavy = { style: "thin", color: { argb: NAVY } };

function setBottomUnderline(ws, row, colStart, colEnd) {
  for (let c = colStart; c <= colEnd; c++) {
    const cell = ws.getRow(row).getCell(c);
    cell.border = { ...cell.border, bottom: thinBlack };
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DOrSU Guidance Office";
  wb.company = "Davao Oriental State University";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Counseling Referral Form", {
    properties: { tabColor: { argb: NAVY } },
    pageSetup: {
      paperSize: 1, // Letter
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: false,
    },
  });

  const NCOLS = 20;
  // Uniform narrow grid; merges do the layout work.
  for (let i = 1; i <= NCOLS; i++) ws.getColumn(i).width = 5.4;

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
  ws.printArea = `A1:T33`;

  // ── Row heights ──
  ws.getRow(1).height = 8;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 15;
  ws.getRow(5).height = 4;
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
  // (Navy rules are applied after the seal merge below, so the merge can't wipe them.)

  // ── Header: seal logo (J2:K4 — page top-center) ──
  ws.mergeCells("J2:K4");
  const seal = ws.getCell("J2");
  seal.value = "◉\nDOrSU"; // fallback if logo file is missing
  seal.font = { name: SANS, size: 9, bold: true, color: { argb: BLUE } };
  seal.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  // Embed the official DOrSU seal (downloaded from dorsu.edu.ph/university-seal).
  // Aspect-fit (never stretched): fixed pixel size + fractional offset centers
  // the logo inside J2:K4 instead of stretching it across the range.
  const logoCandidates = [
    path.resolve(__dirname, "../public/images/dorsu-logo.png"),
    path.resolve(__dirname, "../../../public/dorsu-logo.png"),
    path.resolve(process.cwd(), "public/images/dorsu-logo.png"),
  ];
  const logoPath = logoCandidates.find((p) => fs.existsSync(p));
  if (logoPath) {
    const ext = path.extname(logoPath).slice(1).toLowerCase() === "jpg" ? "jpeg" : "png";
    const imageId = wb.addImage({ filename: logoPath, extension: ext });
    let place = { tl: { col: 9, row: 1 }, br: { col: 11, row: 4 } }; // stretched fallback
    try {
      const buf = fs.readFileSync(logoPath);
      const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR";
      if (isPng) {
        const lw = buf.readUInt32BE(16);
        const lh = buf.readUInt32BE(20);
        const COL_PX = 5.4 * 7 + 5; // ≈43px per grid column at width 5.4
        const rangeW = (11 - 9) * COL_PX; // J:K
        const rangeH = (ws.getRow(2).height + ws.getRow(3).height + ws.getRow(4).height) * (96 / 72);
        const s = Math.min(rangeW / lw, rangeH / lh);
        const w = Math.max(1, Math.round(lw * s));
        const h = Math.max(1, Math.round(lh * s));
        place = { tl: { col: 9 + (rangeW - w) / 2 / COL_PX, row: 1 }, ext: { width: w, height: h } };
      }
    } catch {
      // keep stretched fallback
    }
    ws.addImage(imageId, { ...place, editAs: "oneCell" });
    seal.value = null; // image replaces the text placeholder
  } else {
    console.warn("DOrSU logo not found, using text placeholder. Looked in:", logoCandidates.join(", "));
  }

  // Navy rules above/below the name block — shortened to the text width.
  // Set after the seal merge: only each merge master's border renders, and
  // this keeps the seal area (J2:K4) free of stray rules.
  for (let c = 1; c <= 9; c++) {
    const top = ws.getRow(2).getCell(c);
    top.border = { ...top.border, top: { style: "medium", color: { argb: BLUE } } };
    const bot = ws.getRow(4).getCell(c);
    bot.border = { ...bot.border, bottom: { style: "medium", color: { argb: BLUE } } };
  }

  // ── Header: document code box (O2:T5, right) ──
  // O2:T2 label bar, O3:T3 code, row4 sub-labels, row5 values
  ws.mergeCells("O2:T2");
  ws.mergeCells("O3:T3");
  const docLabel = ws.getCell("O2");
  docLabel.value = "Document Code No.";
  docLabel.font = { name: SANS, size: 7, color: { argb: "FFFFFFFF" } };
  docLabel.alignment = { vertical: "middle", horizontal: "center" };
  docLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  docLabel.border = { top: thinNavy, left: thinNavy, right: thinNavy, bottom: thinNavy };
  const docCode = ws.getCell("O3");
  docCode.value = "FM-DOrSU-GCTC-02";
  docCode.font = { name: SANS, size: 10, bold: true, color: { argb: NAVY } };
  docCode.alignment = { vertical: "middle", horizontal: "center" };

  const subLabels = [
    ["O4", "Issue Status"],
    ["P4", "Rev No."],
    ["Q4", "Effective Date"],
    ["S4", "Page"],
  ];
  // Q4:R4 + S4:T4 merged for the longer labels
  ws.mergeCells("Q4:R4");
  ws.mergeCells("S4:T4");
  ws.mergeCells("Q5:R5");
  ws.mergeCells("S5:T5");
  for (const [addr, text] of subLabels) {
    const c = ws.getCell(addr);
    c.value = text;
    c.font = { name: SANS, size: 6, color: { argb: "FFFFFFFF" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  }
  const subValues = [
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
  // Borders around the whole doc box
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

  // ── Student info lines ──
  const labelFont = { name: SERIF, size: 11, color: { argb: BLACK } };
  const inputFont = { name: SERIF, size: 11, color: { argb: BLACK } };

  // Row 9: Date on top, right side
  ws.getRow(9).height = 20;
  ws.getCell("R9").value = "Date:";
  ws.getCell("R9").font = labelFont;
  ws.getCell("R9").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("S9:T9");
  ws.getCell("S9").font = inputFont;
  ws.getCell("S9").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 9, 19, 20);

  // Row 10: Name of Student + I.D. Number — labels wide enough to never
  // clip, inputs fill the rest.
  ws.getRow(10).height = 20;
  ws.mergeCells("A10:C10");
  ws.getCell("A10").value = "Name of Student:";
  ws.getCell("A10").font = labelFont;
  ws.getCell("A10").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("D10:J10"); // 7 cols input
  ws.getCell("D10").font = inputFont;
  ws.getCell("D10").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 10, 4, 10);

  ws.mergeCells("K10:M10");
  ws.getCell("K10").value = "I.D. Number:";
  ws.getCell("K10").font = labelFont;
  ws.getCell("K10").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("N10:T10"); // 7 cols input
  ws.getCell("N10").font = inputFont;
  ws.getCell("N10").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 10, 14, 20);

  // Row 11: Gender / Age / Course & Year — roomy labels, shorter lines.
  ws.getRow(11).height = 20;
  ws.mergeCells("A11:B11");
  ws.getCell("A11").value = "Gender:";
  ws.getCell("A11").font = labelFont;
  ws.getCell("A11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("C11:F11"); // 4 cols input
  ws.getCell("C11").font = inputFont;
  ws.getCell("C11").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 11, 3, 6);
  ws.getCell("G11").value = "Age:";
  ws.getCell("G11").font = labelFont;
  ws.getCell("G11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("H11:K11"); // 4 cols input
  ws.getCell("H11").font = inputFont;
  ws.getCell("H11").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 11, 8, 11);
  ws.mergeCells("L11:N11");
  ws.getCell("L11").value = "Course & Year:";
  ws.getCell("L11").font = labelFont;
  ws.getCell("L11").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("O11:T11"); // 6 cols input
  ws.getCell("O11").font = inputFont;
  ws.getCell("O11").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 11, 15, 20);

  // Row 12: Relation to the client — roomy label, line right after it.
  ws.getRow(12).height = 20;
  ws.mergeCells("A12:D12");
  ws.getCell("A12").value = "Relation to the client:";
  ws.getCell("A12").font = labelFont;
  ws.getCell("A12").alignment = { vertical: "middle", horizontal: "left" };
  ws.mergeCells("E12:T12");
  ws.getCell("E12").font = inputFont;
  ws.getCell("E12").alignment = { vertical: "middle" };
  setBottomUnderline(ws, 12, 5, 20);

  ws.getRow(13).height = 10;

  // ── Case Classification ──
  ws.getRow(14).height = 18;
  ws.mergeCells("A14:F14");
  ws.getCell("A14").value = "Case Classification:";
  ws.getCell("A14").font = { name: SERIF, size: 11, bold: true, color: { argb: BLACK } };
  ws.getCell("A14").alignment = { vertical: "middle", horizontal: "left" };

  const boxFont = { name: SANS, size: 13, color: { argb: BLACK } };
  const optFont = { name: SERIF, size: 11, color: { argb: BLACK } };
  const cases = [
    [15, "Behavioral", "Social Adjustment"],
    [16, "Relational", "Academic-related"],
    [17, "Financial", "Health"],
    [18, "Absenteeism", "Others please specify:"],
  ];
  for (const [r, left, right] of cases) {
    ws.getRow(r).height = 19;
    // left checkbox + label (A-F block)
    ws.getCell(`A${r}`).value = "☐";
    ws.getCell(`A${r}`).font = boxFont;
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "center" };
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = left;
    ws.getCell(`B${r}`).font = optFont;
    ws.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "left" };
    // right checkbox + label (G-T block, pulled closer to the left column)
    ws.getCell(`G${r}`).value = "☐";
    ws.getCell(`G${r}`).font = boxFont;
    ws.getCell(`G${r}`).alignment = { vertical: "middle", horizontal: "center" };
    if (r === 18) {
      ws.mergeCells(`H${r}:K${r}`); // roomy text, short line right after it
      ws.getCell(`H${r}`).value = right;
      ws.getCell(`H${r}`).font = optFont;
      ws.getCell(`H${r}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(`L${r}:O${r}`); // short line, like the paper form
      setBottomUnderline(ws, r, 12, 15);
    } else {
      ws.mergeCells(`H${r}:T${r}`);
      ws.getCell(`H${r}`).value = right;
      ws.getCell(`H${r}`).font = optFont;
      ws.getCell(`H${r}`).alignment = { vertical: "middle", horizontal: "left" };
    }
  }

  ws.getRow(19).height = 8;

  // ── Remarks ──
  ws.getRow(20).height = 18;
  ws.mergeCells("A20:C20");
  ws.getCell("A20").value = "REMARKS:";
  ws.getCell("A20").font = { name: SERIF, size: 11, bold: true, color: { argb: BLACK } };
  ws.getCell("A20").alignment = { vertical: "middle", horizontal: "left" };

  for (let r = 21; r <= 27; r++) {
    ws.getRow(r).height = 24;
    ws.mergeCells(`A${r}:T${r}`);
    const c = ws.getCell(`A${r}`);
    c.font = inputFont;
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    setBottomUnderline(ws, r, 1, 20);
  }

  ws.getRow(28).height = 14;

  // ── Signature (bottom-right corner area) ──
  ws.getRow(29).height = 20; // breathing space pushing the signature lower
  ws.getRow(30).height = 22;
  ws.mergeCells("L30:S30");
  setBottomUnderline(ws, 30, 12, 19);
  ws.getRow(31).height = 16;
  ws.mergeCells("L31:S31");
  const sig = ws.getCell("L31");
  sig.value = "Referrer's Name and Signature";
  sig.font = { name: SERIF, size: 10, italic: true, color: { argb: BLACK } };
  sig.alignment = { vertical: "top", horizontal: "center" };

  // Light data-validation hint for classification boxes (optional, harmless on print)
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

  // Freeze below title so the form header stays visible while filling digitally
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 8 }];

  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
