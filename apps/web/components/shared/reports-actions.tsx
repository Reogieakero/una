"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buildWorkbook, fetchReportData } from "@/lib/reports/workbook";

/**
 * Export office (or personal, when counselorId is set) as one styled
 * multi-sheet Excel workbook.
 *
 * Thin client wrapper — all Supabase fetching and ExcelJS workbook
 * construction lives in `@/lib/reports/workbook` (palette, label mappers
 * and per-sheet builders alongside it). This module only owns the button
 * behavior defined below.
 *
 * Behavior contract (unchanged from the original monolith):
 * - filename: `DOrSU-My-Report-<day>.xlsx` when personal, else
 *   `DOrSU-Guidance-Report-<day>.xlsx`
 * - toasts mirror the previous success / failure messages exactly
 */
type ExportReportsButtonProps = {
  counselorId?: string | null;
  from?: string | null;
  to?: string | null;
  rangeLabel?: string;
};

export function ExportReportsButton({
  counselorId,
  from,
  to,
  rangeLabel,
}: ExportReportsButtonProps = {}) {
  const [busy, setBusy] = useState(false);
  const personal = !!counselorId;
  const label = rangeLabel ?? "All time";

  async function handleExport() {
    setBusy(true);
    try {
      const bundle = await fetchReportData(
        personal ? { counselorId, from, to } : { from, to }
      );
      const { buffer, fileDay } = await buildWorkbook(bundle, {
        personal,
        rangeLabel: label,
      });

      const blob = new Blob([buffer as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = personal
        ? `DOrSU-My-Report-${fileDay}.xlsx`
        : `DOrSU-Guidance-Report-${fileDay}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      toast.success(
        personal
          ? `Your workbook downloaded — ${label}, your cases only.`
          : `Workbook downloaded — ${label}, print-ready.`
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Couldn't build the workbook — please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-4 py-1.5 text-[13px] font-bold text-ink transition hover:border-primary-400 disabled:opacity-50"
    >
      {busy ? "Building workbook…" : "Export Excel"}
    </button>
  );
}
