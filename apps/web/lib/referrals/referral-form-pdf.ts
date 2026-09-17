/* Vector PDF twin of the Counseling Referral Form Excel template
 * (FM-DOrSU-GCTC-02). Zero dependencies: uses PDF Base-14 fonts
 * (Times/Helvetica need no embedding) and a hand-rolled writer, so the
 * download works with the locked module store and offline.
 *
 * Geometry mirrors the Excel grid: 20 columns across the printable width,
 * same row heights (Excel row units are points), same merges — so every
 * label, line, and filled value lands where the spreadsheet puts it.
 */

import { packRemarkLines, referralFileBase } from "./referral-form-excel";

export type SealRgba = { data: Uint8Array; w: number; h: number };

export type ReferralPdfData = {
  studentName: string;
  studentNo: string;
  dateLabel: string;
  gender: string;
  age: string;
  courseYear: string;
  relation: string;
  classifications: string[];
  classificationOther: string;
  remarks: string;
  referrerName: string;
  /** Decoded seal pixels (white-flattened + deflated inside). Null = drawn fallback seal. */
  seal: SealRgba | null;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 32;
const COLS = 20;
const COL = (PAGE_W - MARGIN * 2) / COLS;
const NAVY = [30 / 255, 58 / 255, 95 / 255] as const;
const BLUE = [31 / 255, 78 / 255, 121 / 255] as const;

/** Excel row heights (points) for rows 1..31. */
const ROW_H = [0, 8, 22, 22, 14, 12, 10, 27, 8, 20, 20, 20, 20, 10, 18, 19, 19, 19, 19, 8, 18, 24, 24, 24, 24, 24, 24, 24, 14, 20, 22, 16];

const X = (colIdx: number) => MARGIN + colIdx * COL;
function yTop(row: number): number {
  let y = MARGIN;
  for (let k = 1; k < row; k++) y += ROW_H[k] ?? 0;
  return y;
}

const WINANSI_MAP: Record<string, string> = {
  "–": "-",
  "—": "-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "…": "...",
  " ": " ",
  "•": "-",
};

/** Encode text as a PDF literal string (WinAnsi, octal escapes past ASCII). */
function pdfText(s: string): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const mapped = WINANSI_MAP[ch] ?? ch;
    for (const m of mapped) {
      const code = m.charCodeAt(0);
      if (m === "(" || m === ")" || m === "\\") out += "\\" + m;
      else if (code >= 32 && code <= 126) out += m;
      else if (code >= 160 && code <= 255) out += "\\" + code.toString(8).padStart(3, "0");
      else out += "?";
    }
  }
  return `(${out})`;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

class Page {
  ops: string[] = [];
  text(str: string, x: number, yTopDown: number, font: string, size: number, color: readonly number[], align: "left" | "center" = "left") {
    // Cheap width estimate for centering short strings (avg glyph ~0.5em).
    const w = String(str).length * size * 0.5;
    const tx = align === "center" ? x - w / 2 : x;
    const [r, g, b] = color;
    this.ops.push(
      `BT /${font} ${f2(size)} Tf ${f2(r)} ${f2(g)} ${f2(b)} rg ${f2(tx)} ${f2(PAGE_H - yTopDown)} Td ${pdfText(str)} Tj ET`
    );
  }
  centerText(str: string, midX: number, yTopDown: number, font: string, size: number, color: readonly number[]) {
    this.text(str, midX, yTopDown, font, size, color, "center");
  }
  line(x1: number, y1: number, x2: number, y2: number, w: number, color: readonly number[]) {
    const [r, g, b] = color;
    this.ops.push(`${f2(w)} w ${f2(r)} ${f2(g)} ${f2(b)} RG ${f2(x1)} ${f2(PAGE_H - y1)} m ${f2(x2)} ${f2(PAGE_H - y2)} l S`);
  }
  hline(x1: number, x2: number, yTopDown: number, w = 0.8, color: readonly number[] = [0, 0, 0]) {
    this.line(x1, yTopDown, x2, yTopDown, w, color);
  }
  rect(x: number, yTopDown: number, w: number, h: number, stroke: readonly number[] | null, fill: readonly number[] | null) {
    let op = "";
    if (fill) op += `${f2(fill[0])} ${f2(fill[1])} ${f2(fill[2])} rg `;
    if (stroke) op += `${f2(stroke[0])} ${f2(stroke[1])} ${f2(stroke[2])} RG `;
    op += `${f2(x)} ${f2(PAGE_H - (yTopDown + h))} ${f2(w)} ${f2(h)} re`;
    op += fill && stroke ? " B" : fill ? " f" : " S";
    this.ops.push(op);
  }
}

const LEFT_CASES = ["Behavioral", "Relational", "Financial", "Absenteeism"];
const RIGHT_CASES = ["Social Adjustment", "Academic-related", "Health", "Others"];

const T = "T"; // Times-Roman
const TB = "TB"; // Times-Bold
const TI = "TI"; // Times-Italic
const HB = "HB"; // Helvetica-Bold
const BLACK: readonly number[] = [0, 0, 0];

function flattenWhite(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.floor(src.length / 4) * 3);
  for (let i = 0, j = 0; i + 4 <= src.length; i += 4, j += 3) {
    const a = src[i + 3] / 255;
    out[j] = Math.round(255 + (src[i] - 255) * a);
    out[j + 1] = Math.round(255 + (src[i + 1] - 255) * a);
    out[j + 2] = Math.round(255 + (src[i + 2] - 255) * a);
  }
  return out;
}

async function deflateRaw(raw: Uint8Array): Promise<{ data: Uint8Array; filtered: boolean }> {
  try {
    const G = globalThis as any;
    if (typeof G.CompressionStream !== "function") return { data: raw, filtered: false };
    const stream = new G.Blob([raw as any]).stream().pipeThrough(new G.CompressionStream("deflate"));
    const buf = await new G.Response(stream).arrayBuffer();
    return { data: new Uint8Array(buf), filtered: true };
  } catch {
    return { data: raw, filtered: false };
  }
}

function buildPdf(objects: Array<{ head: string; body: Uint8Array | string }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [enc.encode("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let pos = chunks[0].length;
  objects.forEach((o, i) => {
    const head = enc.encode(`${i + 1} 0 obj\n${o.head}\n`);
    const body = typeof o.body === "string" ? enc.encode(o.body) : o.body;
    const tail = enc.encode("\nendobj\n");
    offsets.push(pos);
    chunks.push(head, body, tail);
    pos += head.length + body.length + tail.length;
  });
  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) xref += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
  chunks.push(enc.encode(xref + trailer));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function buildReferralPdf(data: ReferralPdfData): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const p = new Page();
  const picked = new Set((data.classifications ?? []).map((c) => c.trim()).filter(Boolean));

  // ── Header: university name (cols A–I) ──
  p.text("DAVAO ORIENTAL", X(0), yTop(2) + 17, HB, 15, BLUE);
  p.text("STATE UNIVERSITY", X(0), yTop(3) + 17, HB, 15, BLUE);
  p.text('"A University of excellence, innovation, and inclusion"', X(0), yTop(4) + 11, TI, 8.5, BLUE);
  p.hline(X(0), X(9), yTop(2), 1.6, BLUE);
  p.hline(X(0), X(9), yTop(4) + 14, 1.6, BLUE);

  // ── Seal (cols J–K, aspect-fit) or drawn fallback ──
  const sealX0 = X(9);
  const sealX1 = X(11);
  const sealY0 = yTop(2);
  const sealY1 = yTop(4) + 14;
  const sealW = sealX1 - sealX0;
  const sealH = sealY1 - sealY0;
  let sealObj: { head: string; body: Uint8Array } | null = null;
  if (data.seal && data.seal.w > 0 && data.seal.h > 0) {
    const flat = flattenWhite(data.seal.data);
    const { data: img, filtered } = await deflateRaw(flat);
    sealObj = {
      head: `<< /Type /XObject /Subtype /Image /Width ${data.seal.w} /Height ${data.seal.h} /ColorSpace /DeviceRGB /BitsPerComponent 8${filtered ? " /Filter /FlateDecode" : ""} /Length ${img.length} >>\nstream`,
      body: img,
    };
  }

  // ── Document code box (cols O–T) ──
  const boxX0 = X(14);
  const boxX1 = X(20);
  const boxY0 = yTop(2);
  const barH = 15;
  const codeH = 19;
  const subH = 15;
  const valH = yTop(5) + 12 - (boxY0 + barH + codeH + subH);
  const subX = [X(14), X(15), X(16), X(18), X(20)];
  p.rect(boxX0, boxY0, boxX1 - boxX0, barH, NAVY, NAVY);
  p.centerText("Document Code No.", (boxX0 + boxX1) / 2, boxY0 + 11, "HB", 7, [1, 1, 1]);
  p.rect(boxX0, boxY0 + barH, boxX1 - boxX0, codeH, NAVY, null);
  p.centerText("FM-DOrSU-GCTC-02", (boxX0 + boxX1) / 2, boxY0 + barH + 14, HB, 9.5, NAVY);
  const subY = boxY0 + barH + codeH;
  const subLabels = ["Issue Status", "Rev No.", "Effective Date", "Page"];
  const subVals = ["01", "00", "07.22.2022", "1 of 1"];
  for (let i = 0; i < 4; i++) {
    p.rect(subX[i], subY, subX[i + 1] - subX[i], subH, NAVY, NAVY);
    p.centerText(subLabels[i], (subX[i] + subX[i + 1]) / 2, subY + 10.5, "HB", 6, [1, 1, 1]);
    p.rect(subX[i], subY + subH, subX[i + 1] - subX[i], valH, NAVY, null);
    p.centerText(subVals[i], (subX[i] + subX[i + 1]) / 2, subY + subH + valH - 4.5, "HB", 7.5, NAVY);
  }
  p.rect(boxX0, boxY0, boxX1 - boxX0, barH + codeH + subH + valH, NAVY, null);

  // ── Title ──
  p.centerText("COUNSELING REFERRAL FORM", PAGE_W / 2, yTop(7) + 19, TB, 15, BLUE);

  // ── Field rows: label + underline + value share one baseline ──
  const field = (label: string, labelX: number, lineX0: number, lineX1: number, row: number, value: string) => {
    const base = yTop(row) + 14;
    p.text(label, labelX, base, T, 11, BLACK);
    p.hline(lineX0, lineX1, yTop(row) + 15.5, 0.8);
    if (value) p.text(value, lineX0 + 2, base, T, 11, BLACK);
  };
  const r9 = 9;
  p.text("Date:", X(17), yTop(r9) + 14, T, 11, BLACK);
  p.hline(X(18), X(20), yTop(r9) + 15.5, 0.8);
  if (data.dateLabel) p.text(data.dateLabel, X(18) + 2, yTop(r9) + 14, T, 11, BLACK);

  field("Name of Student:", X(0), X(3), X(10), 10, data.studentName);
  // Row 10 I.D. sits on the same row as Name:
  p.text("I.D. Number:", X(10), yTop(10) + 14, T, 11, BLACK);
  p.hline(X(13), X(20), yTop(10) + 15.5, 0.8);
  if (data.studentNo) p.text(data.studentNo, X(13) + 2, yTop(10) + 14, T, 11, BLACK);

  field("Gender:", X(0), X(2), X(6), 11, data.gender);
  field("Age:", X(6), X(7), X(11), 11, data.age);
  field("Course & Year:", X(11), X(14), X(20), 11, data.courseYear);
  field("Relation to the client:", X(0), X(4), X(20), 12, data.relation);

  // ── Case Classification ──
  p.text("Case Classification:", X(0), yTop(14) + 13, TB, 11, BLACK);
  const caseRow = (r: number, left: string, right: string) => {
    const cy = yTop(r) + 9.5;
    const drawBox = (bx: number, checked: boolean) => {
      p.rect(bx, cy - 5, 10, 10, BLACK, null);
      if (checked) {
        p.line(bx + 2.2, cy - 1, bx + 4.6, cy + 2.6, 1.4, BLACK);
        p.line(bx + 4.6, cy + 2.6, bx + 8, cy - 4.4, 1.4, BLACK);
      }
    };
    drawBox(X(0), picked.has(left));
    p.text(left, X(1), yTop(r) + 14, T, 11, BLACK);
    const rk = right === "Others" ? "Others" : right;
    drawBox(X(6), picked.has(rk));
    if (r === 18) {
      p.text("Others please specify:", X(7), yTop(r) + 14, T, 11, BLACK);
      p.hline(X(11), X(15), yTop(r) + 15.5, 0.8);
      if (picked.has("Others") && data.classificationOther) {
        p.text(data.classificationOther, X(11) + 2, yTop(r) + 14, T, 11, BLACK);
      }
    } else {
      p.text(right, X(7), yTop(r) + 14, T, 11, BLACK);
    }
  };
  caseRow(15, LEFT_CASES[0], RIGHT_CASES[0]);
  caseRow(16, LEFT_CASES[1], RIGHT_CASES[1]);
  caseRow(17, LEFT_CASES[2], RIGHT_CASES[2]);
  caseRow(18, LEFT_CASES[3], RIGHT_CASES[3]);

  // ── Remarks: 7 ruled lines ──
  p.text("REMARKS:", X(0), yTop(20) + 13, TB, 11, BLACK);
  const lines = packRemarkLines(data.remarks, 7, 95);
  for (let i = 0; i < 7; i++) {
    const r = 21 + i;
    p.hline(X(0), X(20), yTop(r) + 19, 0.8);
    if (lines[i]) p.text(lines[i], X(0) + 2, yTop(r) + 16, T, 11, BLACK);
  }

  // ── Signature, bottom-right ──
  p.hline(X(11), X(18), yTop(30) + 17, 0.8);
  if (data.referrerName) p.centerText(data.referrerName, (X(11) + X(18)) / 2, yTop(30) + 14, T, 11, BLACK);
  p.centerText("Referrer's Name and Signature", (X(11) + X(18)) / 2, yTop(31) + 12, TI, 10, BLACK);

  // Seal image placement (paints above rules if overlapping).
  const content = p.ops.join("\n");
  const contentParts: string[] = [content];
  if (sealObj && data.seal) {
    const s = Math.min(sealW / data.seal.w, sealH / data.seal.h);
    const w = data.seal.w * s;
    const h = data.seal.h * s;
    const dx = sealX0 + (sealW - w) / 2;
    const dyTopDown = sealY0 + (sealH - h) / 2;
    contentParts.push(
      `q ${f2(w)} 0 0 ${f2(h)} ${f2(dx)} ${f2(PAGE_H - (dyTopDown + h))} cm /Im1 Do Q`
    );
  } else {
    // Drawn fallback seal: ring + DOrSU mark.
    const cx = (sealX0 + sealX1) / 2;
    const cyTopDown = (sealY0 + sealY1) / 2;
    const rr = Math.min(sealW, sealH) / 2 - 2;
    const cy = PAGE_H - cyTopDown;
    const ring: string[] = [];
    for (let a = 0; a < 360; a += 6) {
      const r1 = (a * Math.PI) / 180;
      const r2 = ((a + 6) * Math.PI) / 180;
      ring.push(
        `${f2(1.4)} w ${f2(BLUE[0])} ${f2(BLUE[1])} ${f2(BLUE[2])} RG ${f2(cx + rr * Math.cos(r1))} ${f2(cy + rr * Math.sin(r1))} m ${f2(cx + rr * Math.cos(r2))} ${f2(cy + rr * Math.sin(r2))} l S`
      );
    }
    contentParts.push(
      ring.join("\n") +
        `\nBT /HB 9 Tf ${f2(BLUE[0])} ${f2(BLUE[1])} ${f2(BLUE[2])} rg ${f2(cx - 19)} ${f2(cy - 3)} Td ${pdfText("DOrSU")} Tj ET`
    );
  }
  const contentStr = contentParts.join("\n");
  const contentLen = new TextEncoder().encode(contentStr).length;

  // Fixed numbering: 1 catalog, 2 pages, 3 page, 4-7 fonts, [8 image], contents last.
  const contentIdx = sealObj ? 9 : 8;
  const objects: Array<{ head: string; body: Uint8Array | string }> = [
    { head: "<< /Type /Catalog /Pages 2 0 R >>", body: "" },
    { head: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", body: "" },
    {
      head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /T 4 0 R /TB 5 0 R /TI 6 0 R /HB 7 0 R >>${sealObj ? " /XObject << /Im1 8 0 R >>" : ""} >> /Contents ${contentIdx} 0 R >>`,
      body: "",
    },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>", body: "" },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>", body: "" },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>", body: "" },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", body: "" },
  ];
  if (sealObj) objects.push(sealObj);
  objects.push({ head: `<< /Length ${contentLen} >>\nstream`, body: contentStr });

  const bytes = buildPdf(objects);
  const copy = Uint8Array.from(bytes);
  return {
    buffer: copy.buffer as ArrayBuffer,
    fileName: `${referralFileBase(data.studentName)}.pdf`,
  };
}
