"use client";

import { Check } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { CreateReferralInput } from "@dorsu/shared-schemas";
import { Dropdown } from "@/components/shared/dropdown";
import { FieldError } from "@/components/ui/primitives";
import { CLASSIFICATION_COLUMNS } from "./status";
import { cn } from "@/lib/utils";

export type SheetStudent = {
  id: string;
  label: string;
  alias: string;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
};

type FillProps = {
  mode: "fill";
  form: UseFormReturn<CreateReferralInput>;
  students: SheetStudent[];
  studentPick: string;
  onStudentPick: (id: string) => void;
  openMenuKey: string | null;
  onOpenMenuChange: (k: string | null) => void;
  referrerName: string;
  dateLabel: string;
};

type ViewProps = {
  mode: "view";
  studentName: string;
  studentNo: string;
  courseYear: string;
  gender: string;
  age: string;
  relation: string;
  classification: string[];
  classificationOther: string | null;
  remarks: string;
  referrerName: string;
  dateLabel: string;
};

const BLANK =
  "w-full border-0 border-b border-ink/40 bg-transparent px-1 py-0.5 font-serif text-[15px] text-ink placeholder:text-ink-faint/70 focus:border-primary-600 focus:outline-none focus:ring-0";

function Seal() {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#1e3a5f] p-0.5 sm:h-20 sm:w-20">
        <span className="flex h-full w-full flex-col items-center justify-center rounded-full border border-[#1e3a5f]/60 text-center leading-none">
          <span className="font-serif text-[13px] font-bold text-[#1e3a5f] sm:text-base">DOrSU</span>
          <span className="mt-0.5 px-1 font-serif text-[6px] font-semibold uppercase tracking-wider text-[#1e3a5f]/80 sm:text-[7px]">
            State University
          </span>
        </span>
      </span>
    </div>
  );
}

function DocBox() {
  const cell = "border border-ink/30 px-1.5 py-0.5";
  return (
    <table className="w-full border-collapse font-serif text-[9px] leading-tight text-ink sm:text-[10px]" aria-label="Document control">
      <tbody>
        <tr>
          <td colSpan={4} className={cn(cell, "bg-ink/5 font-semibold")}>Document Code No.</td>
        </tr>
        <tr>
          <td colSpan={4} className={cn(cell, "font-bold")}>FM-DOrSU-GCTC-02</td>
        </tr>
        <tr>
          <td className={cn(cell, "bg-ink/5 font-semibold")}>Revision No.</td>
          <td className={cn(cell, "font-bold")}>01</td>
          <td className={cn(cell, "bg-ink/5 font-semibold")}>Page No.</td>
          <td className={cn(cell, "font-bold")}>00</td>
        </tr>
        <tr>
          <td className={cn(cell, "bg-ink/5 font-semibold")}>Effective Date</td>
          <td className={cn(cell, "font-bold")}>07.22.2022</td>
          <td className={cn(cell, "bg-ink/5 font-semibold")}>Page</td>
          <td className={cn(cell, "font-bold")}>1 of 1</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Digitized Counseling Referral Form (FM-DOrSU-GCTC-02) — same fields,
 * wording, and placement as the official paper sheet. One layout serves
 * both modes: `fill` (faculty submission with paper-blank inputs) and
 * `view` (read-only record in the modal / printout).
 */
export function ReferralFormSheet(props: FillProps | ViewProps) {
  const isFill = props.mode === "fill";
  const watched = isFill ? props.form.watch() : null;
  const errors = isFill ? props.form.formState.errors : null;

  const picked = isFill ? props.students.find((s) => s.id === props.studentPick) ?? null : null;
  const studentName = isFill ? (picked?.alias ?? "") : props.studentName;
  const studentNo = isFill ? (picked?.studentNo ?? "") : props.studentNo;
  const courseYear = isFill
    ? [picked?.program, picked?.yearLevel].filter(Boolean).join(" ") || ""
    : props.courseYear;
  const gender = isFill ? (watched?.studentGender ?? "") : props.gender;
  const age = isFill ? (watched?.studentAge ?? "") : props.age;
  const relation = isFill ? (watched?.relationToClient ?? "") : props.relation;
  const classification: string[] = isFill ? (watched?.caseClassification ?? []) : props.classification;
  const classificationOther = isFill ? (watched?.classificationOther ?? "") : (props.classificationOther ?? "");
  const remarks = isFill ? "" : props.remarks;

  const toggleClassification = (c: CreateReferralInput["caseClassification"][number]) => {
    if (!isFill) return;
    const cur = props.form.getValues("caseClassification") ?? [];
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
    props.form.setValue("caseClassification", next, {
      shouldValidate: true,
    });
  };

  return (
    <div id="referral-form-sheet" className="bg-white font-serif text-ink">
      {/* Letterhead */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
        <div className="leading-tight">
          <p className="font-serif text-sm font-bold text-[#1e3a5f] sm:text-lg">DAVAO ORIENTAL</p>
          <p className="font-serif text-sm font-bold text-[#1e3a5f] sm:text-lg">STATE UNIVERSITY</p>
          <p className="mt-1 font-serif text-[9px] italic text-ink-soft sm:text-[11px]">
            &ldquo;A University of excellence, innovation, and inclusion&rdquo;
          </p>
        </div>
        <Seal />
        <div className="justify-self-end">
          <DocBox />
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-4 text-center font-serif text-base font-bold tracking-wide text-[#1e3a5f] sm:text-xl">
        COUNSELING REFERRAL FORM
      </h3>

      {/* Identity rows */}
      <div className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] text-ink-soft">Name of Student:</span>
              {isFill ? (
                <>
                  <Dropdown
                    menuKey="ref-sheet-student"
                    openMenuKey={props.openMenuKey}
                    onOpenChange={props.onOpenMenuChange}
                    value={props.studentPick}
                    onChange={props.onStudentPick}
                    ariaLabel="Name of student"
                    options={props.students.map((s) => ({ value: s.id, label: s.label }))}
                  />
                  <FieldError message={errors?.studentId?.message} />
                </>
              ) : (
                <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px] font-semibold">
                  {studentName || "—"}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">I.D. Number:</span>
              {isFill ? (
                <input className={BLANK} value={studentNo} readOnly aria-label="I.D. Number" placeholder="Auto from student" tabIndex={-1} />
              ) : (
                <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px] font-semibold">
                  {studentNo || "—"}
                </span>
              )}
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[13px] text-ink-soft">Gender:</span>
              {isFill ? (
                <input
                  className={BLANK}
                  placeholder=""
                  {...props.form.register("studentGender")}
                  aria-label="Gender"
                />
              ) : (
                <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px]">{gender || "—"}</span>
              )}
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">Age:</span>
              {isFill ? (
                <input className={BLANK} placeholder="" {...props.form.register("studentAge")} aria-label="Age" />
              ) : (
                <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px]">{age || "—"}</span>
              )}
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">Course &amp; Year:</span>
              {isFill ? (
                <input
                  className={BLANK}
                  value={courseYear}
                  readOnly
                  aria-label="Course and Year"
                  placeholder="Auto from student"
                  tabIndex={-1}
                />
              ) : (
                <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px]">{courseYear || "—"}</span>
              )}
            </label>
          </div>
          <label className="block">
            <span className="text-[13px] text-ink-soft">Relation to the client:</span>
            {isFill ? (
              <input
                className={BLANK}
                placeholder="e.g. Instructor, Class adviser"
                {...props.form.register("relationToClient")}
                aria-label="Relation to the client"
              />
            ) : (
              <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px]">{relation || "—"}</span>
            )}
          </label>
        </div>
        <label className="block md:pt-0">
          <span className="text-[13px] text-ink-soft">Date:</span>
          <span className="block border-b border-ink/40 px-1 py-0.5 text-[15px]">{props.dateLabel}</span>
        </label>
      </div>

      {/* Case Classification */}
      <div className="mt-4">
        <p className="text-[13px] text-ink-soft">
          Case Classification: {isFill && <span className="text-red-600">*</span>}
        </p>
        <div className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {CLASSIFICATION_COLUMNS.map((col, ci) => (
            <div key={ci} className="space-y-2">
              {col.map((c) => {
                const checked = classification.includes(c);
                const box = (
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border-2",
                      checked ? "border-[#1e3a5f] bg-[#1e3a5f] text-white" : "border-ink/40 bg-white"
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                  </span>
                );
                const text = <span className="text-[15px]">{c}</span>;
                return isFill ? (
                  <div key={c}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={c}
                      onClick={() => toggleClassification(c)}
                      className="flex items-center gap-2.5 rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {box}
                      {text}
                    </button>
                    {c === "Others" && checked && (
                      <span className="mt-1 flex items-center gap-2 pl-8">
                        <span className="shrink-0 text-[13px] text-ink-soft">please specify:</span>
                        <input
                          className={BLANK}
                          placeholder=""
                          {...props.form.register("classificationOther")}
                          aria-label="Others, please specify"
                        />
                      </span>
                    )}
                  </div>
                ) : (
                  <div key={c} className="flex items-center gap-2.5 px-1 py-0.5">
                    {box}
                    {text}
                    {c === "Others" && checked && classificationOther.trim() && (
                      <span className="border-b border-ink/40 px-1 text-[15px]">{classificationOther}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {isFill && <FieldError message={errors?.caseClassification?.message ?? errors?.classificationOther?.message} />}
      </div>

      {/* Remarks */}
      <div className="mt-4">
        <p className="text-[13px] text-ink-soft">REMARKS:</p>
        {isFill ? (
          <>
            <textarea
              rows={5}
              className="mt-1 w-full resize-y rounded-none border border-ink/20 bg-white px-2 py-1 font-serif text-[15px] leading-7 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-300"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 27px, rgba(30,58,95,0.25) 27px, rgba(30,58,95,0.25) 28px)",
              }}
              placeholder="Write the observations and reason for referral here…"
              {...props.form.register("reason")}
              aria-label="Remarks"
            />
            <FieldError message={errors?.reason?.message} />
          </>
        ) : (
          <p className="mt-1 min-h-[140px] whitespace-pre-wrap px-2 py-1 text-[15px] leading-7">
            {remarks || "—"}
          </p>
        )}
      </div>

      {/* Referrer */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-[280px] text-center">
          <p className="border-b border-ink px-2 pb-1 font-serif text-[15px] font-semibold">
            {props.referrerName || "—"}
          </p>
          <p className="mt-1 font-serif text-[12px] italic text-ink-soft">Referrer&apos;s Name and Signature</p>
        </div>
      </div>
    </div>
  );
}
