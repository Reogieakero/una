"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/primitives";
import { ReferralExcelPreview } from "./ReferralExcelPreview";
import type { Referral } from "./status";

export type FormStudent = {
  alias: string;
  studentNo: string;
  program: string | null;
  yearLevel: string | null;
};

function formatSheetDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Official-form record modal — renders a submitted referral on the
 * digitized Counseling Referral Form sheet (same layout as submission).
 * Print outs only the sheet, so "Save as PDF" yields the official form.
 */
export function ReferralFormModal({
  referral,
  referrerName,
  onClose,
}: {
  referral: Referral | null;
  /** Referrer display name (office resolves via board maps; faculty views own). */
  referrerName: string;
  onClose: () => void;
}) {
  const [student, setStudent] = useState<FormStudent | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  useEffect(() => {
    if (!referral) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [referral, onClose]);

  useEffect(() => {
    if (!referral) {
      setStudent(null);
      return;
    }
    // Walk-ins have no student record — the typed paper name/number render instead.
    if (!referral.student_id) {
      setStudent(null);
      setStudentLoading(false);
      return;
    }
    let alive = true;
    setStudentLoading(true);
    const studentId: string = referral.student_id;
    (async () => {
      try {
        const { data } = await createClient()
          .from("students")
          .select("anonymous_alias, student_no, program, year_level")
          .eq("id", studentId)
          .maybeSingle();
        if (!alive) return;
        const row = data as {
          anonymous_alias: string | null;
          student_no: string;
          program: string | null;
          year_level: string | null;
        } | null;
        setStudent(
          row
            ? {
                alias: row.anonymous_alias ?? "Student",
                studentNo: row.student_no,
                program: row.program,
                yearLevel: row.year_level,
              }
            : null
        );
      } catch {
        if (alive) setStudent(null);
      } finally {
        if (alive) setStudentLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [referral]);

  if (!referral) return null;

  const courseYear = student ? [student.program, student.yearLevel].filter(Boolean).join(" ") : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ref-form-title"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/40 print:hidden" onClick={onClose} />
      <div className="no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-card sm:max-w-2xl sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
          <h2 id="ref-form-title" className="font-display text-lg font-bold text-ink">
            Counseling Referral Form
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        {studentLoading && !student ? (
          <div className="animate-pulse space-y-3" aria-hidden>
            <div className="h-10 rounded bg-ink/10" />
            <div className="h-40 rounded bg-ink/10" />
            <div className="h-24 rounded bg-ink/10" />
          </div>
        ) : (
          <div className="rounded-lg border border-ink/10 p-4 sm:p-6 print:border-0 print:p-0">
            <ReferralExcelPreview
              data={{
                studentName: student?.alias ?? referral.student_name_text ?? "Student",
                studentNo: student?.studentNo ?? referral.student_no_text ?? "",
                courseYear,
                gender: referral.student_gender ?? "",
                age: referral.student_age ?? "",
                relation: referral.relation_to_client ?? "",
                classifications: referral.case_classification ?? [],
                classificationOther: referral.classification_other ?? "",
                remarks: referral.reason,
                referrerName,
                dateLabel: formatSheetDate(referral.created_at),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
