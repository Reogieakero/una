"use client";

import { useEffect, useState } from "react";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
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
  // The sheet is a print layout (small type). Zoom makes it readable on
  // screen without changing what Print / PDF outputs.
  const [zoom, setZoom] = useState(1);

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
    const referralId: string = referral.id;
    (async () => {
      try {
        // 00069: official referral documents are identifying by design, so
        // the form resolves the linked student through an RLS-style scoped
        // RPC instead of reading the students table directly.
        const { data } = await createClient().rpc("get_referral_student", { p_referral_id: referralId });
        if (!alive) return;
        const row = (((data ?? []) as {
          anonymous_alias: string | null;
          student_no: string;
          program: string | null;
          year_level: string | null;
        }[])[0]) ?? null;
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
      <div aria-hidden className="absolute inset-0 bg-black/40 print:hidden" onClick={onClose} />
      {/* Paper record: keep this dialog identical to light mode even in dark mode. */}
      <div className="referral-form-light no-scrollbar relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-card sm:max-w-4xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h2 id="ref-form-title" className="font-display text-lg font-bold text-ink">
              Counseling Referral Form
            </h2>
            <p className="mt-0.5 truncate text-xs font-medium text-ink-muted">
              {student?.alias ?? referral.student_name_text ?? "Student"} · Official printable record
              (FM-DOrSU-GCTC-02)
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print / PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <p className="mb-3 rounded-lg bg-cream px-3 py-2 text-[13px] leading-relaxed text-ink-muted print:hidden">
          This is the official paper form as submitted. Use the zoom controls to read small print,
          or Print / PDF to save a copy.
        </p>

        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-white p-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100))}
              disabled={zoom <= 0.75}
              aria-label="Zoom out"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[3rem] text-center text-xs font-bold tabular-nums text-ink-muted">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.25) * 100) / 100))}
              disabled={zoom >= 2}
              aria-label="Zoom in"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              aria-label="Reset zoom to 100%"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <span className="text-xs font-medium text-ink-faint">Zoom applies to this view only.</span>
        </div>

        {studentLoading && !student ? (
          <div className="animate-pulse space-y-3" aria-hidden>
            <div className="h-10 rounded bg-ink/10" />
            <div className="h-40 rounded bg-ink/10" />
            <div className="h-24 rounded bg-ink/10" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink/10 p-4 sm:p-6 print:overflow-visible print:border-0 print:p-0">
            <div className="referral-sheet-zoom" style={{ zoom }}>
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
          </div>
        )}
      </div>
    </div>
  );
}
