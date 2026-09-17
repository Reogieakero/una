"use client";

import { packRemarkLines } from "@/lib/referrals/referral-form-excel";
import { cn } from "@/lib/utils";

export type ReferralPreviewData = {
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
};

const NAVY = "#1e3a5f";
const BLUE = "#1f4e79";
const ARIAL = "Arial, Helvetica, sans-serif";
const TIMES = '"Times New Roman", Times, serif';
const NBSP = "\u00a0";

function Value({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("border-b border-black px-1 text-[12px] leading-6", className)}
      style={{ fontFamily: TIMES }}
    >
      {children || NBSP}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 text-[12px] leading-6" style={{ fontFamily: TIMES }}>
      {children}
    </span>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className="shrink-0 text-[15px] leading-6" style={{ fontFamily: ARIAL }}>
      {checked ? "☑" : "☐"}
    </span>
  );
}

/**
 * On-screen twin of the downloadable Excel template (FM-DOrSU-GCTC-02) —
 * same header, seal, doc-code box, field placement, checkbox columns, ruled
 * remarks lines, and bottom-right signature. Labels and filled values share
 * one baseline (flex items-baseline, identical type size), exactly as the
 * Excel cells do with vertical-middle alignment.
 */
export function ReferralExcelPreview({ data }: { data: ReferralPreviewData }) {
  const remarkLines = [...packRemarkLines(data.remarks, 7, 95)];
  while (remarkLines.length < 7) remarkLines.push("");
  const has = (c: string) => data.classifications.includes(c);

  const leftCases = ["Behavioral", "Relational", "Financial", "Absenteeism"];
  const rightCases = ["Social Adjustment", "Academic-related", "Health"];

  return (
    <div className="bg-white text-black">
      {/* Letterhead */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div>
          <p
            className="border-t-[3px] text-[17px] font-bold leading-7"
            style={{ fontFamily: ARIAL, color: BLUE, borderColor: BLUE }}
          >
            DAVAO ORIENTAL
          </p>
          <p className="text-[17px] font-bold leading-7" style={{ fontFamily: ARIAL, color: BLUE }}>
            STATE UNIVERSITY
          </p>
          <p
            className="border-b-[3px] pb-1 text-[9px] italic leading-5"
            style={{ fontFamily: ARIAL, color: BLUE, borderColor: BLUE }}
          >
            &ldquo;A University of excellence, innovation, and inclusion&rdquo;
          </p>
        </div>
        <div className="flex flex-col items-center px-1 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/dorsu-logo.png"
            alt="DOrSU seal"
            className="h-16 w-16 object-contain sm:h-[76px] sm:w-[76px]"
          />
        </div>
        <div className="justify-self-end">
          <table
            className="w-full border-collapse text-center"
            style={{ fontFamily: ARIAL, border: `1px solid ${NAVY}` }}
          >
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  className="border px-1 py-0.5 text-[7px] text-white"
                  style={{ borderColor: NAVY, backgroundColor: BLUE }}
                >
                  Document Code No.
                </td>
              </tr>
              <tr>
                <td
                  colSpan={5}
                  className="border px-1 py-0.5 text-[10px] font-bold"
                  style={{ borderColor: NAVY, color: NAVY }}
                >
                  FM-DOrSU-GCTC-02
                </td>
              </tr>
              <tr>
                {["Issue Status", "Rev No."].map((h) => (
                  <td
                    key={h}
                    className="border px-1 py-0.5 text-[6px] text-white"
                    style={{ borderColor: NAVY, backgroundColor: BLUE }}
                  >
                    {h}
                  </td>
                ))}
                <td
                  colSpan={2}
                  className="border px-1 py-0.5 text-[6px] text-white"
                  style={{ borderColor: NAVY, backgroundColor: BLUE }}
                >
                  Effective Date
                </td>
                <td
                  className="border px-1 py-0.5 text-[6px] text-white"
                  style={{ borderColor: NAVY, backgroundColor: BLUE }}
                >
                  Page
                </td>
              </tr>
              <tr>
                {["01", "00"].map((v) => (
                  <td
                    key={v}
                    className="border px-1 py-0.5 text-[8px]"
                    style={{ borderColor: NAVY, color: NAVY }}
                  >
                    {v}
                  </td>
                ))}
                <td
                  colSpan={2}
                  className="border px-1 py-0.5 text-[8px]"
                  style={{ borderColor: NAVY, color: NAVY }}
                >
                  07.22.2022
                </td>
                <td
                  className="border px-1 py-0.5 text-[8px]"
                  style={{ borderColor: NAVY, color: NAVY }}
                >
                  1 of 1
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Title */}
      <h3
        className="mt-3 text-center text-[16px] font-bold tracking-wide"
        style={{ fontFamily: TIMES, color: BLUE }}
      >
        COUNSELING REFERRAL FORM
      </h3>

      {/* Date — top right */}
      <div className="mt-2 flex items-baseline justify-end gap-1">
        <Label>Date:</Label>
        <Value className="w-28">{data.dateLabel}</Value>
      </div>

      {/* Name + I.D. */}
      <div className="mt-1 flex items-baseline gap-4">
        <div className="flex flex-1 items-baseline gap-1">
          <Label>Name of Student:</Label>
          <Value className="flex-1">{data.studentName}</Value>
        </div>
        <div className="flex flex-1 items-baseline gap-1">
          <Label>I.D. Number:</Label>
          <Value className="flex-1">{data.studentNo}</Value>
        </div>
      </div>

      {/* Gender / Age / Course & Year */}
      <div className="mt-1 flex items-baseline gap-4">
        <div className="flex flex-1 items-baseline gap-1">
          <Label>Gender:</Label>
          <Value className="flex-1">{data.gender}</Value>
        </div>
        <div className="flex flex-1 items-baseline gap-1">
          <Label>Age:</Label>
          <Value className="flex-1">{data.age}</Value>
        </div>
        <div className="flex flex-[1.5] items-baseline gap-1">
          <Label>Course &amp; Year:</Label>
          <Value className="flex-1">{data.courseYear}</Value>
        </div>
      </div>

      {/* Relation */}
      <div className="mt-1 flex items-baseline gap-1">
        <Label>Relation to the client:</Label>
        <Value className="flex-1">{data.relation}</Value>
      </div>

      {/* Case Classification */}
      <p className="mt-3 text-[12px] font-bold leading-6" style={{ fontFamily: TIMES }}>
        Case Classification:
      </p>
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          {leftCases.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <Box checked={has(c)} />
              <span className="text-[12px] leading-6" style={{ fontFamily: TIMES }}>
                {c}
              </span>
            </div>
          ))}
        </div>
        <div>
          {rightCases.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <Box checked={has(c)} />
              <span className="text-[12px] leading-6" style={{ fontFamily: TIMES }}>
                {c}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Box checked={has("Others")} />
            <span className="shrink-0 text-[12px] leading-6" style={{ fontFamily: TIMES }}>
              Others please specify:
            </span>
            <Value className="flex-1">{has("Others") ? data.classificationOther : ""}</Value>
          </div>
        </div>
      </div>

      {/* Remarks — 7 ruled lines */}
      <p className="mt-3 text-[12px] font-bold leading-6" style={{ fontFamily: TIMES }}>
        REMARKS:
      </p>
      <div>
        {remarkLines.map((line, i) => (
          <p
            key={i}
            className="h-7 border-b border-black px-1 text-[12px] leading-7"
            style={{ fontFamily: TIMES }}
          >
            {line || NBSP}
          </p>
        ))}
      </div>

      {/* Signature — bottom right */}
      <div className="mt-5 flex justify-end">
        <div className="w-56 text-center">
          <p
            className="border-b border-black px-2 pb-1 text-[12px] leading-6"
            style={{ fontFamily: TIMES }}
          >
            {data.referrerName || NBSP}
          </p>
          <p className="mt-1 text-[11px] italic leading-5 text-black" style={{ fontFamily: TIMES }}>
            Referrer&apos;s Name and Signature
          </p>
        </div>
      </div>
    </div>
  );
}
