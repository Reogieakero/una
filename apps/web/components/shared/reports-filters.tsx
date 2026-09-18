"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { REPORT_SECTIONS, isCustomRangeValid, type ReportSection } from "@/lib/reports-scope";
import { useRestoreReportScope, writeStoredScope } from "@/lib/hooks/use-report-scope";
import { HoverMenu } from "@/components/shared/hover-menu";
import { ReportRangeModal } from "@/components/shared/report-range-modal";
import { Spinner } from "@/components/ui/spinner";

/**
 * Report scope controls — one right-aligned row, no card background:
 * a Section dropdown plus a Date-range button that opens a modal
 * (presets or a custom from/to range). URL-driven via replace() so the
 * server streams the scoped report and print/export see the same scope;
 * the last selection also persists locally so a refresh restores it.
 * Explicit URL params always win over the stored selection.
 */
export function ReportsFilters({
  section,
  preset,
  fromDay,
  toDay,
  rangeLabel,
  fetching = false,
}: {
  section: ReportSection;
  preset: string;
  fromDay: string;
  toDay: string;
  rangeLabel: string;
  /** True while the report query refetches (section/range change) — shows a loading pill. */
  fetching?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(fromDay);
  const [tempTo, setTempTo] = useState(toDay);

  // Restore the last stored scope on first load (URL params win).
  useRestoreReportScope();

  const go = (patch: Record<string, string | null>) => {    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const pickSection = (v: string) => {
    const s = v as ReportSection;
    // Always write the param explicitly — a missing ?section= now means the
    // "sessions" default, so "All" must be set, not deleted.
    go({ section: s });
    writeStoredScope({ section: s, preset, from: fromDay, to: toDay });
  };

  const pickPreset = (key: string) => {
    setTempFrom("");
    setTempTo("");
    go({ range: key === "all" ? null : key, from: null, to: null });
    writeStoredScope({ section, preset: key, from: "", to: "" });
    setRangeOpen(false);
  };

  const customValid = isCustomRangeValid(tempFrom, tempTo);

  const applyCustom = () => {
    if (!customValid) return;
    go({ range: null, from: tempFrom, to: tempTo });
    writeStoredScope({ section, preset: "custom", from: tempFrom, to: tempTo });
    setRangeOpen(false);
  };

  const clearRange = () => {
    setTempFrom("");
    setTempTo("");
    go({ range: null, from: null, to: null });
    writeStoredScope({ section, preset: "all", from: "", to: "" });
    setRangeOpen(false);
  };

  const openRangeModal = () => {
    setTempFrom(fromDay);
    setTempTo(toDay);
    setRangeOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden" aria-busy={fetching}>
        {fetching && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[13px] font-bold text-ink-faint shadow-card">
            <Spinner size="xs" label="Loading reports…" />
            Loading…
          </span>
        )}
        <HoverMenu
          buttonLabel={REPORT_SECTIONS.find((s) => s.key === section)?.label ?? "All"}
          ariaLabel="Report section"
          options={REPORT_SECTIONS.map((s) => ({ value: s.key, label: s.label }))}
          value={section}
          onPick={pickSection}
          align="right"
        />
        <button
          type="button"
          onClick={openRangeModal}
          aria-haspopup="dialog"
          className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {rangeLabel}
        </button>
      </div>

      {rangeOpen && (
        <ReportRangeModal
          preset={preset}
          tempFrom={tempFrom}
          tempTo={tempTo}
          onClose={() => setRangeOpen(false)}
          onPickPreset={pickPreset}
          onRangeChange={(from, to) => {
            setTempFrom(from);
            setTempTo(to);
          }}
          onApply={applyCustom}
          onClear={clearRange}
        />
      )}
    </>
  );
}

/** Slim exact-position skeleton for the filter row while it streams in. */
export function ReportsFiltersSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse items-center justify-end gap-2">
      <div className="h-8 w-32 rounded bg-ink/10" />
      <div className="h-8 w-40 rounded bg-ink/10" />
    </div>
  );
}
